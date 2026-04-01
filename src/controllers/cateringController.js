const db = require('../config/db');
const pdfGenerator = require('../services/pdfGenerator');
const emailService = require('../services/emailService');
const fs = require('fs-extra');

// GET ALL CATERING BOOKINGS
const getAllCateringBookings = async (req, res) => {
    try {
        console.log('📋 Fetching all catering bookings');
        
        const [results] = await db.query(
            'SELECT * FROM catering_bookings ORDER BY event_date DESC, created_at DESC'
        );
        
        console.log(`✅ Found ${results.length} bookings`);
        res.json(results);
    } catch (error) {
        console.error('❌ Error fetching catering bookings:', error);
        res.status(500).json({ error: 'Database error' });
    }
};

// GET SINGLE CATERING BOOKING
const getCateringBookingById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🔍 Fetching booking ID: ${id}`);
        
        const [results] = await db.query(
            'SELECT * FROM catering_bookings WHERE id = ?',
            [id]
        );
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Catering booking not found' });
        }
        
        res.json(results[0]);
    } catch (error) {
        console.error('❌ Error fetching catering booking:', error);
        res.status(500).json({ error: 'Database error' });
    }
};

// CREATE NEW CATERING BOOKING
// CREATE NEW CATERING BOOKING
const createCateringBooking = async (req, res) => {
    let connection;
    try {
        console.log('📝 Creating new catering booking');
        console.log('Request body:', req.body);
        
        const { 
            customer_name, 
            contact_number, 
            email, 
            event_date, 
            event_time, 
            guest_count, 
            menu_package, 
            special_requests,
            status 
        } = req.body;
        
        // Validation
        if (!customer_name || !contact_number || !event_date || !guest_count) {
            return res.status(400).json({ 
                error: 'Missing required fields: name, contact number, event date, and guest count are required' 
            });
        }
        
        // Start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();
        
        // Insert into database
        const [result] = await connection.query(
            `INSERT INTO catering_bookings 
             (customer_name, contact_number, email, event_date, event_time, 
              guest_count, menu_package, special_requests, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                customer_name, 
                contact_number, 
                email || null, 
                event_date, 
                event_time || null, 
                guest_count, 
                menu_package || null, 
                special_requests || null, 
                status || 'pending'
            ]
        );
        
        const bookingId = result.insertId;
        console.log(`✅ Booking created with ID: ${bookingId}`);
        
        // Get the created booking
        const [newBooking] = await connection.query(
            'SELECT * FROM catering_bookings WHERE id = ?',
            [bookingId]
        );
        
        const booking = newBooking[0];
        
        // Commit transaction
        await connection.commit();
        
        // Send confirmation email (don't await - do in background)
        sendConfirmationEmail(booking).catch(err => {
            console.error('❌ Background email error:', err);
        });
        
        res.status(201).json({ 
            success: true,
            message: 'Catering booking created successfully',
            id: bookingId,
            status: 'pending'
        });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('❌ Error creating catering booking:', error);
        res.status(500).json({ error: 'Database error: ' + error.message });
    } finally {
        if (connection) connection.release();
    }
};

// Helper function to send confirmation email
async function sendConfirmationEmail(booking) {
    try {
        console.log(`📧 Preparing confirmation email for booking #${booking.id}`);
        
        // Generate PDF receipt
        const pdfResult = await pdfGenerator.generateCateringReceipt(booking);
        
        if (!pdfResult.success) {
            throw new Error('PDF generation failed');
        }
        
        // Send email with PDF attachment
        const emailResult = await emailService.sendCateringConfirmation(booking, pdfResult.filePath);
        
        if (emailResult.success) {
            console.log(`✅ Confirmation email sent for booking #${booking.id}`);
            
            // Optional: Update database with email status
            await db.query(
                'UPDATE catering_bookings SET email_sent = true, email_sent_at = NOW() WHERE id = ?',
                [booking.id]
            );
            
            // Don't delete PDF immediately - keep for resend
            // pdfGenerator.cleanupOldReceipts(); // Run as cron job
            
        } else {
            console.error(`❌ Failed to send email:`, emailResult.error);
        }
        
    } catch (error) {
        console.error(`❌ Error in email sending process:`, error);
    }
}

// Add function to resend confirmation
const resendConfirmation = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get booking
        const [booking] = await db.query(
            'SELECT * FROM catering_bookings WHERE id = ?',
            [id]
        );
        
        if (booking.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Generate and send email
        await sendConfirmationEmail(booking[0]);
        
        res.json({
            success: true,
            message: 'Confirmation email resent successfully'
        });
        
    } catch (error) {
        console.error('❌ Resend error:', error);
        res.status(500).json({ error: error.message });
    }
};

// UPDATE CATERING BOOKING STATUS
// UPDATE CATERING BOOKING STATUS
const updateCateringBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        
        console.log(`🔄 Updating booking ${id} to status: ${status}`);
        
        // Validate status
        const validStatuses = ['pending', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        // Check if booking exists
        const [check] = await db.query(
            'SELECT * FROM catering_bookings WHERE id = ?',
            [id]
        );
        
        if (check.length === 0) {
            return res.status(404).json({ error: 'Catering booking not found' });
        }
        
        const booking = check[0];
        const oldStatus = booking.status;
        
        // ========== ADD THIS MISSING UPDATE QUERY ==========
        await db.query(
            'UPDATE catering_bookings SET status = ? WHERE id = ?',
            [status, id]
        );
        // ==================================================
        
        console.log(`✅ Booking ${id} updated from ${oldStatus} to ${status}`);
        
        // Send email based on new status
        if (status === 'approved' && oldStatus !== 'approved') {
            console.log(`📧 Sending APPROVAL email to ${booking.email || booking.customer_email}`);
            
            if (typeof emailService.sendApprovalEmail === 'function') {
                emailService.sendApprovalEmail(booking).catch(err => 
                    console.error('❌ Approval email error:', err)
                );
            } else {
                console.log('⚠️ Approval email method not found');
            }
            
        } else if (status === 'rejected' && oldStatus !== 'rejected') {
            console.log(`📧 Sending REJECTION email to ${booking.email || booking.customer_email}`);
            
            if (typeof emailService.sendRejectionEmail === 'function') {
                emailService.sendRejectionEmail(booking).catch(err => 
                    console.error('❌ Rejection email error:', err)
                );
            } else {
                console.log('⚠️ Rejection email method not found');
            }
        }
        
        res.json({ 
            success: true,
            message: `Booking ${status}`,
            status: status
        });
        
    } catch (error) {
        console.error('❌ Error updating catering booking:', error);
        res.status(500).json({ error: 'Database error' });
    }
};

// Helper function for status emails
async function sendStatusEmail(booking, status) {
    try {
        if (status === 'approved') {
            await emailService.sendApprovalConfirmation(booking);
        } else if (status === 'rejected') {
            await emailService.sendRejectionConfirmation(booking);
        }
    } catch (error) {
        console.error(`❌ Failed to send ${status} email:`, error);
    }
}

// DELETE CATERING BOOKING (optional - for admin use)
const deleteCateringBooking = async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🗑️ Deleting booking ID: ${id}`);
        
        // Check if booking exists
        const [check] = await db.query(
            'SELECT id FROM catering_bookings WHERE id = ?',
            [id]
        );
        
        if (check.length === 0) {
            return res.status(404).json({ error: 'Catering booking not found' });
        }
        
        // Delete booking
        await db.query('DELETE FROM catering_bookings WHERE id = ?', [id]);
        
        console.log(`✅ Booking ${id} deleted successfully`);
        
        res.json({ 
            message: 'Catering booking deleted successfully',
            id: id
        });
        
    } catch (error) {
        console.error('❌ Error deleting catering booking:', error);
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = {
    getAllCateringBookings,
    getCateringBookingById,
    createCateringBooking,
    updateCateringBooking,
    deleteCateringBooking,
    resendConfirmation  
};