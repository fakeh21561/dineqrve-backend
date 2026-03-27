const db = require('../config/db');

// Get sales report by date range
const getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, type } = req.query;
        
        console.log(`📊 Generating ${type} report from ${startDate} to ${endDate}`);
        
        let dateFilter = '';
        let groupBy = '';
        
        // Set grouping based on report type
        if (type === 'daily') {
            groupBy = 'DATE(o.created_at)';
        } else if (type === 'weekly') {
            groupBy = 'YEARWEEK(o.created_at)';
        } else if (type === 'monthly') {
            groupBy = 'DATE_FORMAT(o.created_at, "%Y-%m")';
        } else {
            groupBy = 'DATE(o.created_at)';
        }
        
        // Add date filter if provided
        if (startDate && endDate) {
            dateFilter = `AND DATE(o.created_at) BETWEEN '${startDate}' AND '${endDate}'`;
        }
        
        // Get sales data
        const [salesData] = await db.query(`
            SELECT 
                ${groupBy} as period,
                COUNT(DISTINCT o.id) as order_count,
                SUM(o.total_price) as total_sales,
                AVG(o.total_price) as average_order_value,
                SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_price ELSE 0 END) as paid_sales,
                COUNT(DISTINCT CASE WHEN o.payment_status = 'paid' THEN o.id END) as paid_orders
            FROM orders o
            WHERE 1=1 ${dateFilter}
            GROUP BY period
            ORDER BY period DESC
        `);
        
        // Get payment method breakdown
        const [paymentMethods] = await db.query(`
            SELECT 
                payment_method,
                COUNT(*) as count,
                SUM(total_price) as total
            FROM orders
            WHERE payment_method IS NOT NULL ${dateFilter ? `AND DATE(created_at) BETWEEN '${startDate}' AND '${endDate}'` : ''}
            GROUP BY payment_method
        `);
        
        // Get top selling items
        const [topItems] = await db.query(`
            SELECT 
                mi.name,
                mi.category,
                COUNT(oi.id) as order_count,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.quantity * mi.price) as revenue
            FROM order_items oi
            JOIN menu_items mi ON oi.menu_item_id = mi.id
            JOIN orders o ON oi.order_id = o.id
            WHERE 1=1 ${dateFilter ? `AND DATE(o.created_at) BETWEEN '${startDate}' AND '${endDate}'` : ''}
            GROUP BY mi.id, mi.name, mi.category
            ORDER BY total_quantity DESC
            LIMIT 10
        `);
        
        // Get summary stats
        const [summary] = await db.query(`
            SELECT 
                COUNT(DISTINCT o.id) as total_orders,
                SUM(o.total_price) as total_revenue,
                AVG(o.total_price) as avg_order,
                COUNT(DISTINCT o.customer_name) as unique_customers,
                COUNT(DISTINCT DATE(o.created_at)) as active_days
            FROM orders o
            WHERE 1=1 ${dateFilter}
        `);
        
        // Get catering report
        const [cateringData] = await db.query(`
            SELECT 
                COUNT(*) as total_bookings,
                SUM(guest_count) as total_guests,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_bookings,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings
            FROM catering_bookings
            WHERE 1=1 ${dateFilter ? `AND DATE(event_date) BETWEEN '${startDate}' AND '${endDate}'` : ''}
        `);
        
        res.json({
            success: true,
            data: {
                sales: salesData,
                summary: summary[0] || {
                    total_orders: 0,
                    total_revenue: 0,
                    avg_order: 0,
                    unique_customers: 0,
                    active_days: 0
                },
                payment_methods: paymentMethods,
                top_items: topItems,
                catering: cateringData[0] || {
                    total_bookings: 0,
                    total_guests: 0,
                    approved_bookings: 0,
                    pending_bookings: 0
                },
                date_range: {
                    start: startDate,
                    end: endDate,
                    type: type
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Report error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Export report as CSV
const exportReportCSV = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const [orders] = await db.query(`
            SELECT 
                o.id,
                o.table_number,
                o.customer_name,
                o.total_price,
                o.status,
                o.payment_status,
                o.payment_method,
                o.created_at,
                GROUP_CONCAT(CONCAT(mi.name, ' (', oi.quantity, ')') SEPARATOR ', ') as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE DATE(o.created_at) BETWEEN ? AND ?
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `, [startDate, endDate]);
        
        // Create CSV header
        let csv = 'Order ID,Table,Customer,Total,Status,Payment,Payment Method,Date,Items\n';
        
        // Add rows
        orders.forEach(order => {
            csv += `${order.id},${order.table_number || 'N/A'},${order.customer_name || 'N/A'},${order.total_price},${order.status},${order.payment_status},${order.payment_method || 'N/A'},${new Date(order.created_at).toLocaleString()},${order.items || ''}\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-to-${endDate}.csv`);
        res.send(csv);
        
    } catch (error) {
        console.error('❌ Export error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get dashboard summary (quick stats)
const getDashboardSummary = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Today's stats
        const [todayStats] = await db.query(`
            SELECT 
                COUNT(*) as orders_today,
                SUM(total_price) as revenue_today
            FROM orders
            WHERE DATE(created_at) = ?
        `, [today]);
        
        // Pending orders
        const [pendingStats] = await db.query(`
            SELECT COUNT(*) as pending_orders
            FROM orders
            WHERE status = 'pending'
        `);
        
        // This month
        const [monthStats] = await db.query(`
            SELECT 
                COUNT(*) as orders_month,
                SUM(total_price) as revenue_month
            FROM orders
            WHERE MONTH(created_at) = MONTH(CURDATE()) 
            AND YEAR(created_at) = YEAR(CURDATE())
        `);
        
        res.json({
            success: true,
            data: {
                today: {
                    orders: todayStats[0]?.orders_today || 0,
                    revenue: todayStats[0]?.revenue_today || 0
                },
                pending: pendingStats[0]?.pending_orders || 0,
                month: {
                    orders: monthStats[0]?.orders_month || 0,
                    revenue: monthStats[0]?.revenue_month || 0
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Dashboard summary error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getSalesReport,
    exportReportCSV,
    getDashboardSummary
};