const db = require('../config/db');
const aiAnalyticsService = require('../services/aiAnalyticsService');

// Create new order - NOW WITH PAYMENT CHECK & ORDER TYPE
exports.createOrder = async (req, res) => {
  const { table_number, customer_name, items, payment_method, payment_confirmed, order_type } = req.body;
  
  let connection;
  try {
    // IMPORTANT: Only allow order creation if payment is confirmed
    if (!payment_confirmed && payment_method !== 'cash' && payment_method !== 'qr') {
      return res.status(400).json({
        success: false,
        error: 'Orders can only be created after payment confirmation'
      });
    }
    
    // Start transaction
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    // 1. Calculate total price
    let total = 0;
    for (const item of items) {
      const [menuItem] = await connection.query(
        'SELECT price FROM menu_items WHERE id = ?',
        [item.menu_item_id]
      );
      total += menuItem[0].price * item.quantity;
    }

    // 2. Get estimated preparation time using AI
    const estimation = await aiAnalyticsService.estimatePreparationTime(items);
    const estimatedMinutes = estimation.estimated_minutes;

    // 3. Set table number based on order type
    const finalTableNumber = order_type === 'takeaway' ? 'Takeaway' : (table_number || 'Takeaway');

    // 4. Create order with payment status, estimated time, AND order_type
    const [orderResult] = await connection.query(
      `INSERT INTO orders 
       (table_number, customer_name, total_price, payment_status, payment_method, status, estimated_time, order_type) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        finalTableNumber, 
        customer_name, 
        total, 
        payment_confirmed ? 'paid' : 'pending',
        payment_method || 'unknown',
        estimatedMinutes,
        order_type || 'dine_in'  // Default to dine_in if not provided
      ]
    );
    const orderId = orderResult.insertId;
    
    // 5. Add order items
    for (const item of items) {
      await connection.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, special_instructions) VALUES (?, ?, ?, ?)',
        [orderId, item.menu_item_id, item.quantity, item.special_instructions || '']
      );
    }
    
    // Commit transaction
    await connection.commit();
    connection.release();
    
    res.json({
      success: true,
      message: 'Order created successfully',
      order_id: orderId,
      total: total,
      estimated_time: estimatedMinutes,
      payment_status: payment_confirmed ? 'paid' : 'pending',
      order_type: order_type || 'dine_in'  // Return order type in response
    });
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
};

// Get all orders (for management)
exports.getAllOrders = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT o.*, 
             GROUP_CONCAT(mi.name) as items,
             COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
};

// Get single order by ID
exports.getOrderById = async (req, res) => {
  try {
    const [orderRows] = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    
    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const [itemRows] = await db.query(`
      SELECT oi.*, mi.name, mi.price 
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ?
    `, [req.params.id]);
    
    res.json({
      success: true,
      data: {
        ...orderRows[0],
        items: itemRows
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'preparing', 'completed', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid status. Use: pending, preparing, completed, cancelled' 
    });
  }
  
  try {
    const [result] = await db.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    // If order is completed, record actual ready time
    if (status === 'completed') {
      await db.query(
        'UPDATE orders SET actual_ready_time = NOW() WHERE id = ?',
        [req.params.id]
      );
    }
    
    res.json({
      success: true,
      message: `Order status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, error: 'Failed to update order' });
  }
};

// NEW: Create order from successful payment callback (for ToyyibPay)
exports.createOrderFromPayment = async (paymentData) => {
  const { customer_name, customer_email, customer_phone, amount, cart, transaction_id } = paymentData;
  
  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();
    
    // Get AI estimated time for this order
    const items = cart.map(item => ({
      menu_item_id: item.id,
      quantity: item.quantity
    }));
    const estimation = await aiAnalyticsService.estimatePreparationTime(items);
    const estimatedMinutes = estimation.estimated_minutes;
    
    // Create order with payment confirmed
    const [orderResult] = await connection.query(
      `INSERT INTO orders 
       (table_number, customer_name, customer_email, customer_phone, total_price, payment_status, payment_method, payment_id, status, estimated_time) 
       VALUES (?, ?, ?, ?, ?, 'paid', 'toyyibpay', ?, 'pending', ?)`,
      ['Takeaway', customer_name, customer_email, customer_phone, amount, transaction_id, estimatedMinutes]
    );
    
    const orderId = orderResult.insertId;
    
    // Add order items
    for (const item of cart) {
      await connection.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.id, item.quantity, item.price]
      );
    }
    
    await connection.commit();
    connection.release();
    
    console.log(`✅ Order #${orderId} created from payment callback with estimated time: ${estimatedMinutes} min`);
    return { success: true, order_id: orderId, estimated_time: estimatedMinutes };
    
  } catch (error) {
    console.error('❌ Failed to create order from payment:', error);
    return { success: false, error: error.message };
  }
};

// Track order by ID (for customers) - INCLUDES ESTIMATED TIME
exports.trackOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get order details
    const [orderRows] = await db.query(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );
    
    if (orderRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }
    
    const order = orderRows[0];
    
    // Get order items with menu item details
    const [itemRows] = await db.query(`
      SELECT 
        oi.*, 
        mi.name, 
        mi.price,
        mi.image_url
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ?
    `, [orderId]);
    
    // Calculate remaining time based on order age and estimated time
    let remainingMinutes = null;
    if (order.estimated_time) {
      const createdAt = new Date(order.created_at);
      const now = new Date();
      const minutesPassed = Math.floor((now - createdAt) / 60000);
      remainingMinutes = Math.max(0, order.estimated_time - minutesPassed);
    }
    
    // Format response for customer
    res.json({
      success: true,
      data: {
        order_id: order.id,
        customer_name: order.customer_name,
        created_at: order.created_at,
        total_price: order.total_price,
        status: order.status,
        payment_status: order.payment_status,
        estimated_time: order.estimated_time,
        remaining_minutes: remainingMinutes,
        items: itemRows.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image: item.image_url
        }))
      }
    });
    
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to track order' 
    });
  }
};