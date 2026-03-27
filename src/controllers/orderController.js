const db = require('../config/db');

// Create new order - NOW WITH PAYMENT CHECK
exports.createOrder = async (req, res) => {
  const { table_number, customer_name, items, payment_method, payment_confirmed } = req.body;
  
  try {
    // IMPORTANT: Only allow order creation if payment is confirmed
    // For online payments, this should ONLY be called from payment callback
    // For cash/offline, this should ONLY be called from staff app
    
    if (!payment_confirmed && payment_method !== 'cash' && payment_method !== 'qr') {
      return res.status(400).json({
        success: false,
        error: 'Orders can only be created after payment confirmation'
      });
    }
    
    // Start transaction
    const connection = await db.getConnection();
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
    
    // 2. Create order with payment status
    const [orderResult] = await connection.query(
      `INSERT INTO orders 
       (table_number, customer_name, total_price, payment_status, payment_method) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        table_number, 
        customer_name, 
        total, 
        payment_confirmed ? 'paid' : 'pending',
        payment_method || 'unknown'
      ]
    );
    const orderId = orderResult.insertId;
    
    // 3. Add order items
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
      payment_status: payment_confirmed ? 'paid' : 'pending'
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
    
    // Create order with payment confirmed
    const [orderResult] = await connection.query(
      `INSERT INTO orders 
       (table_number, customer_name, customer_email, customer_phone, total_price, payment_status, payment_method, payment_id) 
       VALUES (?, ?, ?, ?, ?, 'paid', 'toyyibpay', ?)`,
      ['Takeaway', customer_name, customer_email, customer_phone, amount, transaction_id]
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
    
    console.log(`✅ Order #${orderId} created from payment callback`);
    return { success: true, order_id: orderId };
    
  } catch (error) {
    console.error('❌ Failed to create order from payment:', error);
    return { success: false, error: error.message };
  }
};

// Track order by ID (for customers)
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