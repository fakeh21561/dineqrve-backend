const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');

class PDFGenerator {
    constructor() {
        this.receiptsDir = path.join(__dirname, '../../receipts');
        // Ensure receipts directory exists
        fs.ensureDirSync(this.receiptsDir);
    }

    async generateCateringReceipt(booking) {
        return new Promise(async (resolve, reject) => {
            try {
                const fileName = `catering_receipt_${booking.id}_${Date.now()}.pdf`;
                const filePath = path.join(this.receiptsDir, fileName);
                
                // Create PDF document
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 50,
                    info: {
                        Title: `Catering Receipt - ${booking.customer_name}`,
                        Author: 'Arbhi Catering'
                    }
                });

                // Pipe to file
                const stream = fs.createWriteStream(filePath);
                doc.pipe(stream);

                // Add company logo/header
                doc.fontSize(20)
                   .fillColor('#1a237e')
                   .text('ARBHI CATERING', { align: 'center' })
                   .fontSize(12)
                   .fillColor('#666')
                   .text('Keramat, Kuala Lumpur', { align: 'center' })
                   .text('Tel: 012-345 6789', { align: 'center' })
                   .moveDown();

                // Receipt title
                doc.moveDown()
                   .fontSize(18)
                   .fillColor('#333')
                   .text('CATERING BOOKING RECEIPT', { align: 'center' })
                   .moveDown();

                // Draw line
                doc.strokeColor('#1a237e')
                   .lineWidth(2)
                   .moveTo(50, doc.y)
                   .lineTo(550, doc.y)
                   .stroke()
                   .moveDown();

                // Receipt info
                const receiptNo = `CAT-${booking.id}-${new Date().getFullYear()}`;
                const bookingDate = new Date(booking.created_at).toLocaleDateString('en-MY', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                doc.fontSize(10)
                   .text(`Receipt No: ${receiptNo}`, { continued: true })
                   .text(`Date: ${bookingDate}`, { align: 'right' })
                   .moveDown();

                // Customer details
                doc.fontSize(12)
                   .fillColor('#1a237e')
                   .text('CUSTOMER DETAILS', { underline: true })
                   .fillColor('#333')
                   .fontSize(11)
                   .text(`Name: ${booking.customer_name}`)
                   .text(`Contact: ${booking.contact_number}`)
                   .text(`Email: ${booking.email || 'Not provided'}`)
                   .moveDown();

                // Event details
                doc.fontSize(12)
                   .fillColor('#1a237e')
                   .text('EVENT DETAILS', { underline: true })
                   .fillColor('#333')
                   .fontSize(11);

                const eventDate = new Date(booking.event_date).toLocaleDateString('en-MY', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });

                doc.text(`Event Date: ${eventDate}`)
                   .text(`Event Time: ${booking.event_time || 'To be confirmed'}`)
                   .text(`Number of Guests: ${booking.guest_count}`)
                   .text(`Package: ${booking.menu_package || 'Standard Package'}`)
                   .moveDown();

                // Special requests
                if (booking.special_requests) {
                    doc.fontSize(12)
                       .fillColor('#1a237e')
                       .text('SPECIAL REQUESTS', { underline: true })
                       .fillColor('#333')
                       .fontSize(11)
                       .text(booking.special_requests)
                       .moveDown();
                }

                // Payment & Status
                doc.fontSize(12)
                   .fillColor('#1a237e')
                   .text('BOOKING STATUS', { underline: true })
                   .fillColor('#333')
                   .fontSize(11);

                const statusColor = booking.status === 'approved' ? '#2e7d32' : 
                                   booking.status === 'pending' ? '#f57c00' : '#d32f2f';
                
                doc.text(`Status: `, { continued: true })
                   .fillColor(statusColor)
                   .text(booking.status.toUpperCase())
                   .fillColor('#333')
                   .moveDown();

                // Cost estimate
                const estimatedCost = booking.guest_count * 30; // RM 30 per person estimate
                doc.fontSize(12)
                   .fillColor('#1a237e')
                   .text('COST ESTIMATE', { underline: true })
                   .fillColor('#333')
                   .fontSize(11)
                   .text(`Estimated Total: RM ${estimatedCost.toFixed(2)}`)
                   .text(`* Final price depends on selected menu`)
                   .moveDown();

                // Footer
                doc.moveDown(2)
                   .fontSize(9)
                   .fillColor('#999')
                   .text('This is a computer-generated receipt. No signature required.', { align: 'center' })
                   .text('For any inquiries, please contact us at 012-345 6789', { align: 'center' })
                   .text(`Generated on: ${new Date().toLocaleString('en-MY')}`, { align: 'center' });

                // Finalize PDF
                doc.end();

                // Wait for file to be written
                stream.on('finish', () => {
                    console.log(`✅ PDF generated: ${fileName}`);
                    resolve({
                        success: true,
                        filePath: filePath,
                        fileName: fileName
                    });
                });

                stream.on('error', (error) => {
                    reject(error);
                });

            } catch (error) {
                console.error('❌ PDF generation error:', error);
                reject(error);
            }
        });
    }

    // Clean up old receipts (optional - run as cron job)
    async cleanupOldReceipts(daysOld = 7) {
        try {
            const files = await fs.readdir(this.receiptsDir);
            const now = Date.now();
            
            for (const file of files) {
                const filePath = path.join(this.receiptsDir, file);
                const stats = await fs.stat(filePath);
                const fileAge = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
                
                if (fileAge > daysOld) {
                    await fs.unlink(filePath);
                    console.log(`🗑️ Deleted old receipt: ${file}`);
                }
            }
        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }
}

module.exports = new PDFGenerator();