const nodemailer = require('nodemailer');
const fs = require('fs-extra');

class EmailService {
    constructor() {
        this.useEthereal();
    }
    
    async useEthereal() {
        try {
            // Create a test account on Ethereal
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
            
            console.log('📧 Email service using Ethereal (test mode)');
            console.log('   User:', testAccount.user);
            console.log('   Preview URL: https://ethereal.email/login');
            console.log('   Password:', testAccount.pass);
        } catch (error) {
            console.error('❌ Failed to create Ethereal account:', error);
        }
    }

    async sendCateringConfirmation(booking, pdfPath) {
        try {
            console.log(`📧 Sending confirmation email for booking #${booking.id}`);
            console.log(`📧 To: ${booking.email || booking.customer_email}`);
            
            // Read PDF file
            let pdfAttachment = null;
            try {
                pdfAttachment = await fs.readFile(pdfPath);
            } catch (err) {
                console.log('⚠️ PDF not found, sending without attachment');
            }
            
            const eventDate = new Date(booking.event_date).toLocaleDateString('en-MY', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            
            const mailOptions = {
                from: 'Arbhi Catering <noreply@arbhi.com>',
                to: booking.email || booking.customer_email,
                subject: `Catering Booking Received - #CAT${booking.id}`,
                html: `
<!DOCTYPE html>
<html>
<head><style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }
    .header { background: #1a237e; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { padding: 20px; }
    .details { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 Catering Booking Received</h1>
        </div>
        <div class="content">
            <p>Dear <strong>${booking.customer_name}</strong>,</p>
            <p>Thank you for your catering booking request! We have received your details and will review them shortly.</p>
            <p><strong>Status:</strong> <span style="color: #f57c00;">PENDING</span></p>
            <div class="details">
                <h3>📋 Booking Details</h3>
                <p><strong>Booking ID:</strong> #CAT${booking.id}</p>
                <p><strong>Event Date:</strong> ${eventDate}</p>
                <p><strong>Event Time:</strong> ${booking.event_time || 'To be confirmed'}</p>
                <p><strong>Guests:</strong> ${booking.guest_count}</p>
                <p><strong>Package:</strong> ${booking.menu_package || 'Standard'}</p>
                ${booking.special_requests ? `<p><strong>Special Requests:</strong> ${booking.special_requests}</p>` : ''}
            </div>
            <p>We will contact you within <strong>24 hours</strong> to confirm your booking.</p>
            <p>Thank you for choosing Arbhi Catering!</p>
        </div>
        <div class="footer">
            <p>Arbhi Catering | Keramat, Kuala Lumpur | 012-345 6789</p>
            <p>This is an automated message. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
                `
            };
            
            if (pdfAttachment) {
                mailOptions.attachments = [{
                    filename: `Catering_Receipt_${booking.id}.pdf`,
                    content: pdfAttachment,
                    contentType: 'application/pdf'
                }];
            }

            const info = await this.transporter.sendMail(mailOptions);
            
            // Get preview URL for Ethereal
            const previewUrl = nodemailer.getTestMessageUrl(info);
            
            console.log(`✅ Email sent!`);
            console.log(`   Preview URL: ${previewUrl}`);
            console.log(`   To: ${mailOptions.to}`);
            
            return { 
                success: true, 
                messageId: info.messageId,
                previewUrl: previewUrl
            };

        } catch (error) {
            console.error('❌ Email sending failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Placeholder methods for approval/rejection (can be implemented similarly)
    async sendApprovalEmail(booking) {
        console.log(`🎉 Would send approval email for booking #${booking.id}`);
        return { success: true, message: 'Mock approval email' };
    }

    async sendRejectionEmail(booking) {
        console.log(`❌ Would send rejection email for booking #${booking.id}`);
        return { success: true, message: 'Mock rejection email' };
    }
}

module.exports = new EmailService();