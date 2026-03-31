const axios = require('axios');
const db = require('../config/db');
const fs = require('fs');

class ToyyibPayService {
    constructor() {
        this.apiKey = process.env.TOYYIBPAY_API_KEY;
        this.categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;
        this.isSandbox = process.env.TOYYIBPAY_SANDBOX === 'true';
        
        if (!this.apiKey || !this.categoryCode) {
            console.error('❌ ToyyibPay credentials not found in .env');
        }
        
        this.baseUrl = this.isSandbox
            ? 'https://dev.toyyibpay.com'
            : 'https://toyyibpay.com';
            
        console.log(`💳 ToyyibPay initialized (${this.isSandbox ? 'SANDBOX' : 'PRODUCTION'} mode)`);
        
        this.processedCallbacks = new Set();
        
        try {
            fs.accessSync('callbacks.log');
        } catch {
            fs.writeFileSync('callbacks.log', '');
        }
    }

    async createBill(orderData) {
        try {
            const {
                order_id,
                customer_name,
                customer_email,
                customer_phone,
                amount,
                description,
                cart,
                order_type,
                table_number
            } = orderData;

            // Use defaults if not provided
            const finalOrderType = order_type || 'dine_in';
            const finalTableNumber = table_number || 'A1';

            console.log('🧾 Creating ToyyibPay bill for temp ref:', order_id);
            console.log('💰 Amount (cents):', amount);
            console.log('📦 Order type:', finalOrderType);
            console.log('🪑 Table:', finalTableNumber);

            // Prepare cart data with instructions
            const cartWithInstructions = (cart || []).map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                instructions: item.instructions || ''
            }));

            const billData = {
                userSecretKey: this.apiKey,
                categoryCode: this.categoryCode,
                billName: `Order ${order_id}`,
                billDescription: description || 'Restaurant Order',
                billPriceSetting: '1',
                billPayorInfo: '1',
                billAmount: amount.toString(),
                billReturnUrl: `https://web-production-4c9c0.up.railway.app/api/payments/toyyibpay-return`,
                billCallbackUrl: `https://web-production-4c9c0.up.railway.app/api/payments/toyyibpay-callback`,
                billExternalReferenceNo: order_id.toString(),
                billTo: customer_name,
                billEmail: customer_email || 'customer@email.com',
                billPhone: customer_phone || '0123456789',
                billSplitPayment: '0',
                billSplitPaymentArgs: '',
                billPaymentChannel: '0',
                billContentEmail: 'Thank you for your payment!',
                billChargeToCustomer: '1',
                billExpiryDays: '5'
            };

            const response = await axios.post(
                `${this.baseUrl}/index.php/api/createBill`,
                new URLSearchParams(billData).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            if (response.data && Array.isArray(response.data) && response.data[0]) {
                const result = response.data[0];
                
                if (result.BillCode) {
                    const billCode = result.BillCode;
                    const paymentUrl = `${this.baseUrl}/${billCode}`;
                    
                    // Check if this bill code already exists
                    const [existing] = await db.query(
                        'SELECT id FROM temp_payments WHERE bill_code = ?',
                        [billCode]
                    );
                    
                    if (existing.length === 0) {
                        // SINGLE INSERT - store cart with instructions
                        await db.query(
                            `INSERT INTO temp_payments
                             (temp_ref, bill_code, customer_name, customer_email, customer_phone, amount, cart_data, order_type, table_number, status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                            [
                                order_id,
                                billCode,
                                customer_name,
                                customer_email,
                                customer_phone,
                                amount / 100,
                                JSON.stringify(cartWithInstructions),
                                finalOrderType,
                                finalTableNumber
                            ]
                        );

                        console.log(`✅ Temp payment stored with bill code: ${billCode}`);
                        console.log(`   Order type: ${finalOrderType}`);
                        console.log(`   Table: ${finalTableNumber}`);
                        console.log(`   Items with instructions: ${cartWithInstructions.length}`);
                    } else {
                        console.log(`⚠️ Bill code ${billCode} already exists, skipping duplicate`);
                    }

                    return {
                        success: true,
                        billCode: billCode,
                        paymentUrl: paymentUrl,
                        temp_ref: order_id
                    };
                } else {
                    throw new Error(result.msg || 'Failed to create bill');
                }
            } else {
                throw new Error('Invalid response from ToyyibPay');
            }
        } catch (error) {
            console.error('❌ ToyyibPay create bill error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.msg || error.message
            };
        }
    }

async handleCallback(callbackData) {
    console.log('📞 ===== TOYYIBPAY CALLBACK RECEIVED =====');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Raw data:', callbackData);
    
    const logEntry = `\n[${new Date().toISOString()}] ${JSON.stringify(callbackData)}`;
    fs.appendFileSync('callbacks.log', logEntry);

    try {
        const {
            billcode,
            status_id,
            transaction_id,
            order_id,
            paid_at
        } = callbackData;

        // CHECK FOR DUPLICATE CALLBACK
        const callbackKey = `${billcode}_${status_id}_${transaction_id}`;
        
        if (this.processedCallbacks.has(callbackKey)) {
            console.log(`⚠️ Duplicate callback detected for ${callbackKey}, skipping...`);
            return { success: true, status: 'already_processed' };
        }
        
        this.processedCallbacks.add(callbackKey);
        
        // Clean up old keys after 1 hour
        setTimeout(() => {
            this.processedCallbacks.delete(callbackKey);
        }, 60 * 60 * 1000);

        // Find the temp payment
        const [tempPayment] = await db.query(
            'SELECT * FROM temp_payments WHERE bill_code = ?',
            [billcode]
        );

        if (tempPayment.length === 0) {
            console.log('❌ No temp payment found for bill code:', billcode);
            return { success: false, error: 'Temp payment not found' };
        }

        const payment = tempPayment[0];

        // Check if this payment was already processed
        if (payment.status === 'completed' || payment.status === 'failed') {
            console.log(`⚠️ Payment ${billcode} already processed with status: ${payment.status}`);
            return { success: true, status: payment.status };
        }

        // ===== PAYMENT SUCCESSFUL =====
        if (status_id === '1') {
            console.log('✅ Payment successful! Creating order...');
            
            // ===== PARSE CART DATA WITH INSTRUCTIONS =====
            let cart = [];
            try {
                if (payment.cart_data) {
                    if (typeof payment.cart_data === 'string') {
                        cart = JSON.parse(payment.cart_data);
                    } else if (typeof payment.cart_data === 'object') {
                        cart = payment.cart_data;
                    }
                }
                if (!Array.isArray(cart)) cart = [];
                
                // DEBUG: Log what we got
                console.log('📦 CART FROM TEMP_PAYMENTS:', JSON.stringify(cart, null, 2));
                console.log('📦 FIRST ITEM INSTRUCTIONS:', cart[0]?.instructions);
            } catch (e) {
                console.log('⚠️ Error parsing cart data:', e.message);
                cart = [];
            }

            // Check if order already exists
            const [existingOrder] = await db.query(
                'SELECT id FROM orders WHERE payment_id = ?',
                [billcode]
            );

            if (existingOrder.length === 0) {
                // ===== CREATE THE ORDER =====
                const [orderResult] = await db.query(
                    `INSERT INTO orders
                     (table_number, customer_name, customer_email, customer_phone, total_price, order_type, status, payment_status, payment_method, payment_id)
                     VALUES (?, ?, ?, ?, ?, ?, 'pending', 'paid', 'toyyibpay', ?)`,
                    [
                        payment.table_number || 'A1',
                        payment.customer_name,
                        payment.customer_email,
                        payment.customer_phone,
                        payment.amount,
                        payment.order_type || 'dine_in',
                        transaction_id || ('TXN' + Date.now())
                    ]
                );
                
                const orderId = orderResult.insertId;
                console.log(`✅ Order #${orderId} created`);
                console.log(`   Order type: ${payment.order_type || 'dine_in'}`);
                console.log(`   Table: ${payment.table_number || 'A1'}`);
                
                // ===== ADD ORDER ITEMS WITH INSTRUCTIONS =====
                if (cart.length > 0) {
                    for (const item of cart) {
                        // Get instructions from the item
                        const instructions = item.instructions || '';
                        
                        console.log(`📝 Adding item: ${item.name} x${item.quantity} - Instructions: "${instructions}"`);
                        
                        await db.query(
                            `INSERT INTO order_items (order_id, menu_item_id, quantity, price, special_instructions)
                             VALUES (?, ?, ?, ?, ?)`,
                            [orderId, item.id, item.quantity, item.price, instructions]
                        );
                    }
                    console.log(`✅ Added ${cart.length} items to order #${orderId}`);
                } else {
                    console.log('⚠️ No items found in cart for this order!');
                }
                
                // ===== ADD PAYMENT RECORD =====
                await db.query(
                    `INSERT INTO payments
                     (order_id, payment_method, amount, payment_status, transaction_id, bill_code)
                     VALUES (?, 'toyyibpay', ?, 'success', ?, ?)`,
                    [orderId, payment.amount, transaction_id || ('TXN' + Date.now()), billcode]
                );
                
                // ===== UPDATE TEMP PAYMENT STATUS =====
                await db.query(
                    'UPDATE temp_payments SET status = ? WHERE id = ?',
                    ['completed', payment.id]
                );
                
                console.log(`✅ Order #${orderId} completed successfully`);
                
            } else {
                console.log(`⚠️ Order already exists for bill ${billcode}`);
                await db.query(
                    'UPDATE temp_payments SET status = ? WHERE id = ?',
                    ['completed', payment.id]
                );
            }
            
        } else {
            // Payment failed
            console.log(`❌ Payment failed with status_id: ${status_id}`);
            await db.query(
                'UPDATE temp_payments SET status = ? WHERE id = ?',
                ['failed', payment.id]
            );
        }

        return { success: true };

    } catch (error) {
        console.error('❌ Callback handling error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
}

module.exports = new ToyyibPayService();