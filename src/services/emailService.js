const axios = require('axios');

class EmailService {
    constructor() {
        this.apiKey = process.env.BREVO_API_KEY;
        this.fromEmail = process.env.BREVO_FROM_EMAIL || 'fakehkimi03@gmail.com';
        this.fromName = 'Arbhi Catering';
        
        if (!this.apiKey) {
            console.error('❌ BREVO_API_KEY not found in environment variables');
        } else {
            console.log('📧 Brevo email service initialized');
        }
    }

    // Send email using Brevo API
    async sendEmail(to, subject, htmlContent, attachments = []) {
        try {
            const data = {
                sender: {
                    name: this.fromName,
                    email: this.fromEmail
                },
                to: [{ email: to }],
                subject: subject,
                htmlContent: htmlContent
            };
            
            // Add attachments if any
            if (attachments.length > 0) {
                data.attachment = attachments;
            }
            
            const response = await axios.post(
                'https://api.brevo.com/v3/smtp/email',
                data,
                {
                    headers: {
                        'api-key': this.apiKey,
                        'Content-Type': 'application/json',
                        'accept': 'application/json'
                    }
                }
            );
            
            console.log(`✅ Email sent to ${to}`);
            return { success: true, messageId: response.data.messageId };
            
        } catch (error) {
            console.error('❌ Email failed:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    async sendCateringConfirmation(booking, pdfPath) {
        try {
            console.log(`📧 Sending confirmation email for booking #${booking.id}`);
            
            const eventDate = new Date(booking.event_date).toLocaleDateString('en-MY', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; }
        .header { background: linear-gradient(135deg, #1a237e 0%, #283593 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; }
        .details { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 10px 10px; }
        .status-badge { display: inline-block; background: #f57c00; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍽️ Arbhi Catering</h1>
            <p>Booking Request Received</p>
        </div>
        <div class="content">
            <p>Dear <strong>${booking.customer_name}</strong>,</p>
            <div style="text-align: center;">
                <span class="status-badge">PENDING</span>
            </div>
            <div class="details">
                <h3>📋 Booking Details</h3>
                <p><strong>Booking ID:</strong> #CAT${booking.id}</p>
                <p><strong>Event Date:</strong> ${eventDate}</p>
                <p><strong>Guests:</strong> ${booking.guest_count}</p>
                <p><strong>Package:</strong> ${booking.menu_package || 'Standard'}</p>
                ${booking.special_requests ? `<p><strong>Special Requests:</strong> ${booking.special_requests}</p>` : ''}
            </div>
            <p>We will contact you within <strong>24 hours</strong> to confirm your booking.</p>
            <p>Thank you for choosing Arbhi Catering!</p>
        </div>
        <div class="footer">
            <p>Arbhi Catering | 012-345 6789 | Keramat, Kuala Lumpur</p>
        </div>
    </div>
</body>
</html>
            `;
            
            // Read PDF attachment if exists
            let attachment = null;
            try {
                const fs = require('fs-extra');
                const pdfBuffer = await fs.readFile(pdfPath);
                attachment = {
                    name: `Catering_Receipt_${booking.id}.pdf`,
                    content: pdfBuffer.toString('base64')
                };
            } catch (err) {
                console.log('⚠️ PDF not found, sending without attachment');
            }
            
            const attachments = attachment ? [attachment] : [];
            
            return await this.sendEmail(
                booking.email || booking.customer_email,
                `Catering Booking Request Received - #CAT${booking.id}`,
                htmlContent,
                attachments
            );
            
        } catch (error) {
            console.error('❌ Email error:', error);
            return { success: false, error: error.message };
        }
    }
    
    async sendApprovalEmail(booking) {
        try {
            const eventDate = new Date(booking.event_date).toLocaleDateString('en-MY', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; }
        .header { background: #2e7d32; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; }
        .details { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 10px 10px; }
        .success-badge { display: inline-block; background: #2e7d32; color: white; padding: 5px 20px; border-radius: 25px; font-size: 14px; font-weight: bold; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Booking CONFIRMED!</h1>
        </div>
        <div class="content">
            <p>Dear <strong>${booking.customer_name}</strong>,</p>
            <div style="text-align: center;">
                <div class="success-badge">✓ APPROVED</div>
            </div>
            <div class="details">
                <h3>📋 Event Details</h3>
                <p><strong>Date:</strong> ${eventDate}</p>
                <p><strong>Guests:</strong> ${booking.guest_count}</p>
                <p><strong>Package:</strong> ${booking.menu_package || 'Standard'}</p>
            </div>
            <p>We will contact you soon to finalize the details.</p>
            <p>Thank you for choosing Arbhi Catering!</p>
        </div>
        <div class="footer">
            <p>Arbhi Catering | 012-345 6789 | Keramat, Kuala Lumpur</p>
        </div>
    </div>
</body>
</html>
            `;
            
            return await this.sendEmail(
                booking.email || booking.customer_email,
                `✅ Catering Booking CONFIRMED! - #CAT${booking.id}`,
                htmlContent
            );
            
        } catch (error) {
            console.error('❌ Approval email failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async sendRejectionEmail(booking) {
        try {
            const eventDate = new Date(booking.event_date).toLocaleDateString('en-MY', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; }
        .header { background: #d32f2f; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; }
        .details { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 10px 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Booking Update</h1>
        </div>
        <div class="content">
            <p>Dear <strong>${booking.customer_name}</strong>,</p>
            <p>Thank you for your interest. Unfortunately, we cannot accommodate your booking for ${eventDate}.</p>
            <div class="details">
                <h3>📋 Your Request</h3>
                <p><strong>Date:</strong> ${eventDate}</p>
                <p><strong>Guests:</strong> ${booking.guest_count}</p>
                <p><strong>Package:</strong> ${booking.menu_package || 'Standard'}</p>
            </div>
            <p>Please contact us for alternative dates.</p>
            <p>Phone: 012-345 6789</p>
        </div>
        <div class="footer">
            <p>Arbhi Catering | 012-345 6789 | Keramat, Kuala Lumpur</p>
        </div>
    </div>
</body>
</html>
            `;
            
            return await this.sendEmail(
                booking.email || booking.customer_email,
                `❌ Catering Booking Update - #CAT${booking.id}`,
                htmlContent
            );
            
        } catch (error) {
            console.error('❌ Rejection email failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();