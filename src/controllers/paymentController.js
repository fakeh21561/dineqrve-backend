const db = require('../config/db');
const toyyibpayService = require('../services/toyyibpay_service');
const Busboy = require('busboy');

// Create ToyyibPay bill (NO ORDER CREATED)
// Create ToyyibPay bill (NO ORDER CREATED)
const createToyyibPayBill = async (req, res) => {
    try {
        // IMPORTANT: Add order_type and table_number here
        const { order_id, customer_name, customer_email, customer_phone, amount, cart, order_type, table_number } = req.body;
        
        console.log('🧾 Creating ToyyibPay bill for temp ref:', order_id);
        console.log('📦 Received order_type:', order_type);
        console.log('🪑 Received table_number:', table_number);

        if (!order_id || !customer_name || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Check if this temp ref already has a pending payment
        const [existing] = await db.query(
            'SELECT * FROM temp_payments WHERE temp_ref = ? AND status = "pending"',
            [order_id]
        );

        if (existing.length > 0) {
            console.log(`⚠️ Pending payment already exists for temp ref: ${order_id}`);
            if (existing[0].bill_code) {
                return res.json({
                    success: true,
                    payment_url: `https://dev.toyyibpay.com/${existing[0].bill_code}`,
                    bill_code: existing[0].bill_code,
                    temp_ref: order_id
                });
            }
        }

        const amountInCents = Math.round(amount * 100);

        const result = await toyyibpayService.createBill({
            order_id: order_id,
            customer_name: customer_name,
            customer_email: customer_email,
            customer_phone: customer_phone,
            amount: amountInCents,
            description: `Payment for Order`,
            cart: cart || [],
            order_type: order_type,      // ADD THIS
            table_number: table_number    // ADD THIS
        });

        if (result.success) {
            res.json({
                success: true,
                payment_url: result.paymentUrl,
                bill_code: result.billCode,
                temp_ref: order_id
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error || 'Failed to create bill'
            });
        }

    } catch (error) {
        console.error('❌ Error creating bill:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Handle ToyyibPay callback
const handleToyyibPayCallback = async (req, res) => {
    try {
        console.log('📞 Payment callback received');
        
        const busboy = Busboy({ headers: req.headers });
        const fields = {};
        
        busboy.on('field', (fieldname, val) => {
            console.log(`📝 ${fieldname}: ${val}`);
            fields[fieldname] = val;
        });
        
        busboy.on('finish', async () => {
            console.log('✅ Parsed all fields:', fields);
            
            if (fields.billcode && fields.status_id) {
                const result = await toyyibpayService.handleCallback(fields);
                console.log('Callback processed:', result);
            } else {
                console.log('⚠️ Missing required fields:', { 
                    billcode: fields.billcode, 
                    status_id: fields.status_id 
                });
            }
            
            res.status(200).send('OK');
        });
        
        busboy.on('error', (err) => {
            console.error('❌ Busboy error:', err);
            res.status(200).send('OK');
        });
        
        req.pipe(busboy);
        
    } catch (error) {
        console.error('❌ Callback error:', error);
        res.status(200).send('OK');
    }
};

// Handle ToyyibPay return (user redirect)
const handleToyyibPayReturn = async (req, res) => {
    try {
        const { billcode, order_id, status_id } = req.query;
        
        console.log('🔄 Payment return:', { billcode, order_id, status_id });

        const frontendUrl = 'https://dineqrve-website.web.app';

        // If payment successful, create the order NOW
        if (status_id === '1') {
            console.log('✅ Payment successful! Creating order from return URL...');
            
            // Find the temp payment
            const [tempPayment] = await db.query(
                'SELECT * FROM temp_payments WHERE bill_code = ?',
                [billcode]
            );

            if (tempPayment.length > 0) {
                const payment = tempPayment[0];
                
                // Check if order already exists for this payment
                const [existingOrder] = await db.query(
                    'SELECT id FROM orders WHERE payment_id = ?',
                    [billcode]
                );
                
                let orderId;
                
                if (existingOrder.length === 0) {
                    // Parse cart data safely
                    let cart = [];
                    try {
                        if (payment.cart_data) {
                            if (typeof payment.cart_data === 'string') {
                                cart = JSON.parse(payment.cart_data);
                            } else if (typeof payment.cart_data === 'object') {
                                cart = payment.cart_data;
                            }
                        }
                        if (!Array.isArray(cart)) {
                            cart = [];
                        }
                    } catch (e) {
                        console.log('⚠️ Error parsing cart data, using empty array:', e.message);
                        cart = [];
                    }
                    
                    // Create the order WITH order_type and table_number
                    const [orderResult] = await db.query(
                        `INSERT INTO orders
                        (table_number, customer_name, customer_email, customer_phone, total_price, order_type, status, payment_status, payment_method, payment_id)
                        VALUES (?, ?, ?, ?, ?, ?, 'pending', 'paid', 'toyyibpay', ?)`,
                        [
                            payment.table_number || 'Takeaway',     // Use stored table_number
                            payment.customer_name,
                            payment.customer_email,
                            payment.customer_phone,
                            payment.amount,
                            payment.order_type || 'dine_in',        // Use stored order_type
                            billcode
                        ]
                    );
                    
                    orderId = orderResult.insertId;
                    
                    
                    // Add order items
// Add order items with price and instructions
if (cart.length > 0) {
    for (const item of cart) {
        if (item.id && item.quantity) {
            const instructions = item.instructions || '';
            const price = item.price || 0;
            
            console.log(`📝 Adding: ${item.name} x${item.quantity} - Instructions: "${instructions}"`);
            
            await db.query(
                `INSERT INTO order_items (order_id, menu_item_id, quantity, price, special_instructions)
                 VALUES (?, ?, ?, ?, ?)`,
                [orderId, item.id, item.quantity, price, instructions]
            );
        }
    }
    console.log(`✅ Added ${cart.length} items to order #${orderId} with instructions`);
}
                    
                    // Insert into payments table
                    await db.query(
                        `INSERT INTO payments
                         (order_id, payment_method, amount, payment_status, transaction_id, bill_code)
                         VALUES (?, 'toyyibpay', ?, 'success', ?, ?)`,
                        [orderId, payment.amount, 'TXN' + Date.now(), billcode]
                    );
                    
                    // Update temp payment status
                    await db.query(
                        'UPDATE temp_payments SET status = ? WHERE id = ?',
                        ['completed', payment.id]
                    );
                    
                    console.log(`✅ Order #${orderId} created from return URL!`);
                } else {
                    orderId = existingOrder[0].id;
                    console.log(`⚠️ Order already exists for bill ${billcode}, ID: ${orderId}`);
                }
                
                // Redirect with the order ID
                return res.redirect(`${frontendUrl}/payment-success.html?order=${orderId}&amount=${payment.amount}&method=toyyibpay`);
                
            } else {
                console.log('❌ No temp payment found for bill:', billcode);
                return res.redirect(`${frontendUrl}/payment-success.html?order=unknown&amount=0&method=unknown`);
            }
        } else {
            return res.redirect(`${frontendUrl}/payment-failed.html`);
        }

    } catch (error) {
        console.error('❌ Return error:', error);
        res.redirect('https://dineqrve-website.web.app/payment-failed.html');
    }
};

// Cash payment (manual)
const processCashPayment = async (req, res) => {
    try {
        const { order_id, amount, received_amount } = req.body;

        // Check if order already has payment
        const [order] = await db.query(
            'SELECT payment_status FROM orders WHERE id = ?',
            [order_id]
        );

        if (order.length > 0 && order[0].payment_status === 'paid') {
            return res.status(400).json({
                success: false,
                error: 'Order already paid'
            });
        }

        // Update order
        await db.query(
            `UPDATE orders
             SET payment_status = 'paid',
                 payment_method = 'cash',
                 paid_at = NOW()
             WHERE id = ?`,
            [order_id]
        );

        // Insert payment record
        const [result] = await db.query(
            `INSERT INTO payments
             (order_id, payment_method, amount, payment_status, transaction_id)
             VALUES (?, 'cash', ?, 'success', ?)`,
            [order_id, amount, `CASH${Date.now()}`]
        );

        const change = received_amount ? received_amount - amount : 0;

        res.json({
            success: true,
            message: 'Cash payment recorded',
            order_id: order_id,
            amount: amount,
            change: change > 0 ? change : 0
        });

    } catch (error) {
        console.error('❌ Cash payment error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Test endpoint to manually trigger order creation
const testCallback = async (req, res) => {
    try {
        const { billcode } = req.params;
        console.log('🧪 MANUAL TEST: Creating order for bill:', billcode);
        
        const fakeCallback = {
            billcode: billcode,
            status_id: '1',
            transaction_id: 'TXN' + Date.now(),
            paid_at: new Date().toISOString()
        };
        
        const result = await toyyibpayService.handleCallback(fakeCallback);
        
        res.json({ 
            success: true, 
            message: 'Test callback processed',
            result 
        });
    } catch (error) {
        console.error('❌ Test callback error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createToyyibPayBill,
    handleToyyibPayCallback,
    handleToyyibPayReturn,
    processCashPayment,
    testCallback
};