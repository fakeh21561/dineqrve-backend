const nodemailer = require('nodemailer');
const fs = require('fs-extra');
const path = require('path');

class EmailService {
    constructor() {
        this.user = process.env.EMAIL_USER;
        this.pass = process.env.EMAIL_PASS;
        this.from = process.env.EMAIL_FROM || 'Arbhi Catering <catering@arbhi.com>';
        
        console.log('📧 Email service configured for:', this.user);
        
        // Add timeout and better options
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: this.user,
                pass: this.pass
            },
            timeout: 30000, // 30 seconds timeout
            connectionTimeout: 30000,
            greetingTimeout: 30000,
            socketTimeout: 30000
        });
    }

    // Create test account for development (no real emails sent)
    async createTestAccount() {
        try {
            const testAccount = await nodemailer.createTestAccount();
            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            console.log('📧 Test email account created:', testAccount.user);
            console.log('🔗 Preview URL: https://ethereal.email/login');
        } catch (error) {
            console.error('❌ Failed to create test account:', error);
        }
    }

async sendCateringConfirmation(booking, pdfPath) {
        try {
            console.log(`📧 Sending confirmation email for booking #${booking.id} to ${booking.email || booking.customer_email}`);
            console.log(`📧 Using sender: ${this.from}`);

                    // Check if email exists
            if (!booking.email && !booking.customer_email) {
                console.log('⚠️ No email address provided, skipping email');
                return { success: false, error: 'No email address' };
            }

            // Read PDF file
            const pdfAttachment = await fs.readFile(pdfPath);

            // Email content
            const mailOptions = {
                from: this.from,  // Uses your email from .env
                to: booking.email || booking.customer_email,
                cc: this.user,    // CC yourself
                subject: `Catering Booking Confirmation - #CAT${booking.id}`,
                html: this.getEmailTemplate(booking),
                attachments: [
                    {
                        filename: `Catering_Receipt_${booking.id}.pdf`,
                        content: pdfAttachment,
                        contentType: 'application/pdf'
                    }
                ]
            };

            // Send email
            const info = await this.transporter.sendMail(mailOptions);
            
            console.log(`✅ Email sent to ${mailOptions.to}`);
            console.log(`✅ CC sent to ${mailOptions.cc}`);
            
            return {
                success: true,
                messageId: info.messageId,
                to: mailOptions.to,
                cc: mailOptions.cc
            };

        } catch (error) {
            console.error('❌ Email sending failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getEmailTemplate(booking) {
        const status = booking.status || 'pending';
        const statusColor = status === 'approved' ? '#2e7d32' : 
                          status === 'pending' ? '#f57c00' : '#d32f2f';
        const eventDate = new Date(booking.event_date).toLocaleDateString('en-MY', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .header p {
            margin: 10px 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .status-badge {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 25px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 14px;
            background: ${statusColor}15;
            color: ${statusColor};
            border: 1px solid ${statusColor};
            margin: 20px 0;
        }
        .details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .details h3 {
            color: #1a237e;
            margin-top: 0;
            border-bottom: 2px solid #1a237e;
            padding-bottom: 10px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .detail-label {
            font-weight: bold;
            color: #666;
        }
        .detail-value {
            color: #333;
        }
        .total {
            font-size: 18px;
            font-weight: bold;
            color: #2e7d32;
            text-align: right;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px dashed #1a237e;
        }
        .footer {
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #666;
        }
        .button {
            display: inline-block;
            padding: 12px 30px;
            background: #1a237e;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .button:hover {
            background: #283593;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍽️ Arbhi Catering</h1>
            <p>Booking Confirmation</p>
        </div>
        
        <div class="content">
            <p>Dear <strong>${booking.customer_name}</strong>,</p>
            
            <p>Thank you for choosing Arbhi Catering! Your booking request has been received and is being processed.</p>
            
            <div style="text-align: center;">
                <span class="status-badge">${status}</span>
            </div>
            
            <div class="details">
                <h3>📋 Booking Details</h3>
                
                <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value">#CAT${booking.id}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Event Date:</span>
                    <span class="detail-value">${eventDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Event Time:</span>
                    <span class="detail-value">${booking.event_time || 'To be confirmed'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Number of Guests:</span>
                    <span class="detail-value">${booking.guest_count}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Package:</span>
                    <span class="detail-value">${booking.menu_package || 'Standard Package'}</span>
                </div>
                
                <h3 style="margin-top: 20px;">👤 Contact Information</h3>
                <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${booking.customer_name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value">${booking.contact_number}</span>
                </div>
                ${booking.email ? `
                <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">${booking.email}</span>
                </div>
                ` : ''}
                
                ${booking.special_requests ? `
                <h3 style="margin-top: 20px;">📝 Special Requests</h3>
                <p>${booking.special_requests}</p>
                ` : ''}
                
                <div class="total">
                    Estimated Total: RM ${(booking.guest_count * 30).toFixed(2)}
                    <div style="font-size: 12px; font-weight: normal; color: #666;">
                        * Final price depends on selected menu
                    </div>
                </div>
            </div>
            
            <p>Your booking receipt is attached to this email. Please keep it for your reference.</p>
            
            <p>We will contact you within <strong>24 hours</strong> to confirm your booking details. If you have any questions, please don't hesitate to reach out.</p>
            
            <div style="text-align: center;">
                <a href="tel:0123456789" class="button">📞 Call Us</a>
                <a href="https://wa.me/60123456789" class="button" style="background: #25D366;">💬 WhatsApp</a>
            </div>
        </div>
        
        <div class="footer">
            <p>Arbhi Catering Enterprise</p>
            <p>No. 23, Jalan Keramat, 54000 Kuala Lumpur</p>
            <p>Tel: 012-345 6789 | Email: catering@arbhi.com</p>
            <p style="margin-top: 15px; font-size: 12px;">
                This is an automated message. Please do not reply directly to this email.
            </p>
        </div>
    </div>
</body>
</html>
        `;
    }

// Send approval confirmation (when admin approves)
async sendApprovalConfirmation(booking) {
    try {
        console.log(`🎉 Sending APPROVAL email for booking #${booking.id}`);

        const mailOptions = {
            from: this.from,
            to: booking.email || booking.customer_email,
            cc: this.user,
            subject: `✅ Booking CONFIRMED! - #CAT${booking.id}`,
            html: this.getApprovalTemplate(booking),
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Approval email sent to ${mailOptions.to}`);
        
        return {
            success: true,
            messageId: info.messageId
        };

    } catch (error) {
        console.error('❌ Approval email failed:', error);
        return { success: false, error: error.message };
    }
}

// Send rejection email (when admin rejects)
async sendRejectionConfirmation(booking) {
    try {
        console.log(`❌ Sending REJECTION email for booking #${booking.id}`);

        const mailOptions = {
            from: this.from,
            to: booking.email || booking.customer_email,
            cc: this.user,
            subject: `❌ Booking Update - #CAT${booking.id}`,
            html: this.getRejectionTemplate(booking),
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Rejection email sent to ${mailOptions.to}`);
        
        return {
            success: true,
            messageId: info.messageId
        };

    } catch (error) {
        console.error('❌ Rejection email failed:', error);
        return { success: false, error: error.message };
    }
}

getApprovalTemplate(booking) {
    const eventDate = new Date(booking.event_date).toLocaleDateString('en-MY', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', sans-serif; }
        .container { max-width: 600px; margin: 20px auto; }
        .header { background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; background: #fff; border: 1px solid #ddd; }
        .badge { background: #e8f5e9; color: #2e7d32; padding: 15px; border-radius: 50px; font-size: 24px; text-align: center; margin: 20px 0; }
        .details { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #2e7d32; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 BOOKING CONFIRMED!</h1>
            <p>Your catering is ready to go!</p>
        </div>
        
        <div class="content">
            <div class="badge">
                ✅ APPROVED
            </div>
            
            <p>Dear <strong>${booking.customer_name}</strong>,</p>
            
            <p>Great news! Your catering booking has been <strong style="color: #2e7d32;">CONFIRMED</strong>. We're excited to serve you!</p>
            
            <div class="details">
                <h3 style="color: #2e7d32;">📋 Event Details</h3>
                <p><strong>Date:</strong> ${eventDate}</p>
                <p><strong>Time:</strong> ${booking.event_time || 'To be confirmed'}</p>
                <p><strong>Guests:</strong> ${booking.guest_count}</p>
                <p><strong>Package:</strong> ${booking.menu_package || 'Standard'}</p>
                
                <h3 style="color: #2e7d32; margin-top: 20px;">👤 Your Contact Person</h3>
                <p><strong>Name:</strong> Ahmad (Event Coordinator)</p>
                <p><strong>Phone:</strong> 012-345 6789</p>
                <p><strong>WhatsApp:</strong> <a href="https://wa.me/60123456789">Click to chat</a></p>
                
                <h3 style="color: #2e7d32; margin-top: 20px;">💳 Payment</h3>
                <p>We will contact you within 2 days for payment details.</p>
                <p><strong>Estimated Total:</strong> RM ${(booking.guest_count * 30).toFixed(2)}</p>
            </div>
            
            <div style="text-align: center;">
                <a href="tel:0123456789" class="button">📞 Call Us</a>
                <a href="https://wa.me/60123456789" class="button" style="background: #25D366;">💬 WhatsApp</a>
            </div>
            
            <p style="margin-top: 20px;">Thank you for choosing Arbhi Catering! We'll make your event special.</p>
        </div>
        
        <div class="footer">
            <p>Arbhi Catering Enterprise | 012-345 6789 | catering@arbhi.com</p>
        </div>
    </div>
</body>
</html>
    `;
}


getRejectionTemplate(booking) {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', sans-serif; }
        .container { max-width: 600px; margin: 20px auto; }
        .header { background: #d32f2f; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; background: #fff; border: 1px solid #ddd; }
        .badge { background: #ffebee; color: #d32f2f; padding: 15px; border-radius: 50px; text-align: center; margin: 20px 0; }
        .details { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #d32f2f; color: white; text-decoration: none; border-radius: 5px; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Booking Update</h1>
        </div>
        
        <div class="content">
            <div class="badge">
                ❌ UNAVAILABLE
            </div>
            
            <p>Dear <strong>${booking.customer_name}</strong>,</p>
            
            <p>Thank you for your interest in Arbhi Catering. Unfortunately, we are unable to accommodate your booking for ${eventDate}.</p>
            
            <div class="details">
                <h3>📋 Reason</h3>
                <p>We are fully booked on your requested date. However, we would love to serve you on another date!</p>
                
                <h3 style="margin-top: 20px;">💡 Alternative Dates</h3>
                <p>We still have availability on:</p>
                <p>• Day before your event<br>• Day after your event<br>• Next weekend</p>
            </div>
            
            <p>Please contact us to discuss alternatives or find another suitable date.</p>
            
            <div style="text-align: center;">
                <a href="tel:0123456789" class="button">📞 Call Us</a>
            </div>
        </div>
        
        <div class="footer">
            <p>Arbhi Catering Enterprise | 012-345 6789</p>
        </div>
    </div>
</body>
</html>
    `;
}

// Send rejection email (when admin rejects)
async sendRejectionEmail(booking) {
    try {
        console.log(`❌ Sending REJECTION email for booking #${booking.id} to ${booking.email || booking.customer_email}`);

        const mailOptions = {
            from: this.from,
            to: booking.email || booking.customer_email,
            cc: this.user,
            subject: `❌ Catering Booking Update - #CAT${booking.id}`,
            html: this.getRejectionTemplate(booking),
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Rejection email sent to ${mailOptions.to}`);
        
        return {
            success: true,
            messageId: info.messageId
        };

    } catch (error) {
        console.error('❌ Rejection email failed:', error);
        return { success: false, error: error.message };
    }
}

getRejectionTemplate(booking) {
    const eventDate = new Date(booking.event_date).toLocaleDateString('en-MY', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: #d32f2f;
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .header p {
            margin: 10px 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .status-badge {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 25px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 14px;
            background: #ffebee;
            color: #d32f2f;
            border: 1px solid #d32f2f;
            margin: 20px 0;
        }
        .details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .details h3 {
            color: #d32f2f;
            margin-top: 0;
            border-bottom: 2px solid #d32f2f;
            padding-bottom: 10px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .detail-label {
            font-weight: bold;
            color: #666;
        }
        .detail-value {
            color: #333;
        }
        .alternative-box {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
        }
        .alternative-box h3 {
            color: #1976d2;
            margin-top: 0;
        }
        .button {
            display: inline-block;
            padding: 12px 30px;
            background: #1976d2;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px;
        }
        .button:hover {
            background: #1565c0;
        }
        .footer {
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
        .contact-info {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍽️ Arbhi Catering</h1>
            <p>Booking Status Update</p>
        </div>
        
        <div class="content">
            <p>Dear <strong>${booking.customer_name}</strong>,</p>
            
            <div style="text-align: center;">
                <span class="status-badge">❌ NOT AVAILABLE</span>
            </div>
            
            <p>Thank you for your interest in Arbhi Catering. Unfortunately, we are <strong>unable to accommodate</strong> your booking request at this time.</p>
            
            <div class="details">
                <h3>📋 Your Request</h3>
                
                <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value">#CAT${booking.id}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Event Date:</span>
                    <span class="detail-value">${eventDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Event Time:</span>
                    <span class="detail-value">${booking.event_time || 'Not specified'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Number of Guests:</span>
                    <span class="detail-value">${booking.guest_count}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Package:</span>
                    <span class="detail-value">${booking.menu_package || 'Standard Package'}</span>
                </div>
            </div>
            
            <div class="alternative-box">
                <h3>💡 Alternative Options</h3>
                <p>We would still love to serve you! Here are some alternatives:</p>
                <p>• <strong>Different Date:</strong> We have availability on other dates</p>
                <p>• <strong>Smaller Event:</strong> We can accommodate smaller groups (under 30 pax)</p>
                <p>• <strong>Dine-in Option:</strong> Visit our restaurant for individual dining</p>
                
                <div style="margin-top: 20px;">
                    <a href="tel:0123456789" class="button">📞 Call to Discuss</a>
                    <a href="https://wa.me/60123456789" class="button" style="background: #25D366;">💬 WhatsApp Us</a>
                </div>
            </div>
            
            <div class="contact-info">
                <p style="margin: 5px 0;"><strong>📞 Phone:</strong> 012-345 6789</p>
                <p style="margin: 5px 0;"><strong>📧 Email:</strong> catering@arbhi.com</p>
                <p style="margin: 5px 0;"><strong>📍 Address:</strong> No. 23, Jalan Keramat, 54000 Kuala Lumpur</p>
            </div>
            
            <p>We hope to serve you in the future. Please don't hesitate to contact us if you have any questions or would like to discuss alternatives.</p>
            
            <p>Thank you for considering Arbhi Catering.</p>
            
            <p>Best regards,<br>
            <strong>Arbhi Catering Team</strong></p>
        </div>
        
        <div class="footer">
            <p>Arbhi Catering Enterprise</p>
            <p>No. 23, Jalan Keramat, 54000 Kuala Lumpur</p>
            <p>Tel: 012-345 6789 | Email: catering@arbhi.com</p>
            <p style="margin-top: 15px; font-size: 10px;">
                This is an automated message. If you didn't request this booking, please ignore.
            </p>
        </div>
    </div>
</body>
</html>
    `;
}

}

module.exports = new EmailService();