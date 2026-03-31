const db = require('../config/db');

class AIAnalyticsService {
    
    // Get popular items based on order history
    async getPopularItems(limit = 5) {
        try {
            // Get items with most orders in last 30 days
            const [items] = await db.query(`
                SELECT 
                    mi.id,
                    mi.name,
                    mi.description,
                    mi.price,
                    mi.category,
                    mi.image_url,
                    COUNT(oi.id) as order_count,
                    SUM(oi.quantity) as total_quantity,
                    AVG(DATEDIFF(NOW(), o.created_at)) as days_since_last
                FROM menu_items mi
                LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
                LEFT JOIN orders o ON oi.order_id = o.id
                WHERE mi.is_available = true
                GROUP BY mi.id
                ORDER BY order_count DESC, total_quantity DESC
                LIMIT ?
            `, [limit]);
            
            // Calculate popularity score (0-100)
            const maxOrders = items.length > 0 ? items[0].order_count : 1;
            
            return items.map(item => ({
                ...item,
                popularity_score: Math.round((item.order_count / maxOrders) * 100),
                badge: item.order_count > 5 ? '🔥 Popular' : '⭐ Recommended'
            }));
        } catch (error) {
            console.error('Error getting popular items:', error);
            return [];
        }
    }
    
    // Get estimated preparation time for an order
    async estimatePreparationTime(orderItems) {
        try {
            // Get average preparation time for each item
            let totalTime = 0;
            let itemCount = 0;
            
            for (const item of orderItems) {
                // Get historical preparation time for this menu item
                const [timeData] = await db.query(`
                    SELECT 
                        AVG(TIMESTAMPDIFF(MINUTE, o.created_at, NOW())) as avg_time
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE oi.menu_item_id = ? 
                    AND o.status = 'completed'
                    AND o.updated_at IS NOT NULL
                `, [item.menu_item_id]);
                
                let itemTime = 5; // Default 5 minutes
                
                if (timeData[0] && timeData[0].avg_time) {
                    itemTime = Math.round(timeData[0].avg_time);
                } else {
                    // Default times by category
                    const [menuItem] = await db.query(
                        'SELECT category FROM menu_items WHERE id = ?',
                        [item.menu_item_id]
                    );
                    const category = menuItem[0]?.category || '';
                    
                    if (category.includes('Main')) itemTime = 15;
                    else if (category.includes('Appetizer')) itemTime = 8;
                    else if (category.includes('Beverage')) itemTime = 3;
                    else if (category.includes('Dessert')) itemTime = 5;
                    else itemTime = 10;
                }
                
                totalTime += itemTime * item.quantity;
                itemCount += item.quantity;
            }
            
            // Calculate base time (at least 10 minutes)
            let estimatedTime = Math.max(10, Math.round(totalTime / (itemCount || 1)));
            
            // Add rush hour adjustment
            const hour = new Date().getHours();
            const isRushHour = (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 21);
            if (isRushHour) {
                estimatedTime = Math.round(estimatedTime * 1.5);
            }
            
            // Check current pending orders
            const [pendingOrders] = await db.query(
                'SELECT COUNT(*) as pending FROM orders WHERE status = "pending" OR status = "preparing"'
            );
            if (pendingOrders[0].pending > 3) {
                estimatedTime += Math.min(15, Math.floor(pendingOrders[0].pending / 2) * 5);
            }
            
            return {
                estimated_minutes: estimatedTime,
                estimated_display: estimatedTime < 60 ? 
                    `${estimatedTime} minutes` : 
                    `${Math.floor(estimatedTime / 60)} hour ${estimatedTime % 60} minutes`,
                is_rush_hour: isRushHour,
                orders_ahead: pendingOrders[0].pending
            };
            
        } catch (error) {
            console.error('Error estimating time:', error);
            return {
                estimated_minutes: 15,
                estimated_display: '15 minutes',
                is_rush_hour: false,
                orders_ahead: 0
            };
        }
    }
    
    // Get AI insights for dashboard
    async getDashboardInsights() {
        try {
            // Get today's stats
            const [todayStats] = await db.query(`
                SELECT 
                    COUNT(*) as orders,
                    COALESCE(SUM(total_price), 0) as revenue
                FROM orders 
                WHERE DATE(created_at) = CURDATE()
            `);
            
            // Compare with yesterday
            const [yesterdayStats] = await db.query(`
                SELECT 
                    COUNT(*) as orders,
                    COALESCE(SUM(total_price), 0) as revenue
                FROM orders 
                WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
            `);
            
            const orderChange = yesterdayStats[0].orders > 0 
                ? ((todayStats[0].orders - yesterdayStats[0].orders) / yesterdayStats[0].orders * 100).toFixed(1)
                : 0;
            
            const revenueChange = yesterdayStats[0].revenue > 0
                ? ((todayStats[0].revenue - yesterdayStats[0].revenue) / yesterdayStats[0].revenue * 100).toFixed(1)
                : 0;
            
            // Get peak hours
            const [peakHours] = await db.query(`
                SELECT 
                    HOUR(created_at) as hour,
                    COUNT(*) as orders
                FROM orders 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY HOUR(created_at)
                ORDER BY orders DESC
                LIMIT 3
            `);
            
            return {
                today: {
                    orders: todayStats[0].orders,
                    revenue: todayStats[0].revenue
                },
                trends: {
                    orders_change: orderChange,
                    revenue_change: revenueChange
                },
                peak_hours: peakHours.map(h => ({
                    hour: h.hour,
                    orders: h.orders,
                    time_display: `${h.hour}:00 - ${h.hour + 1}:00`
                }))
            };
            
        } catch (error) {
            console.error('Error getting insights:', error);
            return {
                today: { orders: 0, revenue: 0 },
                trends: { orders_change: 0, revenue_change: 0 },
                peak_hours: []
            };
        }
    }
}

module.exports = new AIAnalyticsService();