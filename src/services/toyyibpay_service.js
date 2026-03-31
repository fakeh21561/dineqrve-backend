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
                        // SINGLE INSERT - only once!
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
                                JSON.stringify(cart || []),
                                finalOrderType,
                                finalTableNumber
                            ]
                        );

                        console.log(`✅ Temp payment stored with bill code: ${billCode}`);
                        console.log(`   Order type: ${finalOrderType}`);
                        console.log(`   Table: ${finalTableNumber}`);
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

            const callbackKey = `${billcode}_${status_id}_${transaction_id}`;
            
            if (this.processedCallbacks.has(callbackKey)) {
                console.log(`⚠️ Duplicate callback detected for ${callbackKey}, skipping...`);
                return { success: true, status: 'already_processed' };
            }
            
            this.processedCallbacks.add(callbackKey);
            
            setTimeout(() => {
                this.processedCallbacks.delete(callbackKey);
            }, 60 * 60 * 1000);

            const [tempPayment] = await db.query(
                'SELECT * FROM temp_payments WHERE bill_code = ?',
                [billcode]
            );

            if (tempPayment.length === 0) {
                console.log('❌ No temp payment found for bill code:', billcode);
                return { success: false, error: 'Temp payment not found' };
            }

            const payment = tempPayment[0];

            if (payment.status === 'completed' || payment.status === 'failed') {
                console.log(`⚠️ Payment ${billcode} already processed with status: ${payment.status}`);
                return { success: true, status: payment.status };
            }

            if (status_id === '1') {
                console.log('✅ Payment successful! Creating order from callback...');
                console.log(`   Order type from temp: ${payment.order_type || 'dine_in'}`);
                console.log(`   Table from temp: ${payment.table_number || 'A1'}`);
                
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
                } catch (e) {
                    console.log('⚠️ Error parsing cart data:', e.message);
                    cart = [];
                }

                const [existingOrder] = await db.query(
                    'SELECT id FROM orders WHERE payment_id = ?',
                    [billcode]
                );

                if (existingOrder.length === 0) {
                    // CREATE ORDER WITH BOTH TABLE NUMBER AND ORDER TYPE
                    const [orderResult] = await db.query(
                        `INSERT INTO orders
                         (table_number, customer_name, customer_email, customer_phone, total_price, order_type, status, payment_status, payment_method, payment_id)
                         VALUES (?, ?, ?, ?, ?, ?, 'pending', 'paid', 'toyyibpay', ?)`,
                        [
                            payment.table_number || 'A1',           // ALWAYS store table number
                            payment.customer_name,
                            payment.customer_email,
                            payment.customer_phone,
                            payment.amount,
                            payment.order_type || 'dine_in',        // Store order type (dine_in/takeaway)
                            transaction_id || ('TXN' + Date.now())
                        ]
                    );
                    
                    const orderId = orderResult.insertId;
                    console.log(`✅ Created Order #${orderId}: ${payment.order_type || 'dine_in'} at table ${payment.table_number || 'A1'}`);
                    
                    // Add order items with special instructions
                    if (cart.length > 0) {
                        for (const item of cart) {
                            if (item.id && item.quantity) {
                                await db.query(
                                    `INSERT INTO order_items (order_id, menu_item_id, quantity, price, special_instructions)
                                     VALUES (?, ?, ?, ?, ?)`,
                                    [orderId, item.id, item.quantity, item.price, item.instructions || '']
                                );
                                if (item.instructions) {
                                    console.log(`   Item: ${item.name} - Instructions: ${item.instructions}`);
                                }
                            }
                        }
                    }
                    
                    await db.query(
                        `INSERT INTO payments
                         (order_id, payment_method, amount, payment_status, transaction_id, bill_code)
                         VALUES (?, 'toyyibpay', ?, 'success', ?, ?)`,
                        [orderId, payment.amount, transaction_id || ('TXN' + Date.now()), billcode]
                    );
                    
                    await db.query(
                        'UPDATE temp_payments SET status = ? WHERE id = ?',
                        ['completed', payment.id]
                    );
                    
                    console.log(`✅ Order #${orderId} complete - ${cart.length} items`);
                } else {
                    console.log(`⚠️ Order already exists for bill ${billcode}`);
                    await db.query(
                        'UPDATE temp_payments SET status = ? WHERE id = ?',
                        ['completed', payment.id]
                    );
                }
            } else {
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