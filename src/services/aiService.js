const db = require('../config/db');

class AIService {
    
    // Calculate item popularity scores
    static async calculatePopularity() {
        try {
            // Get all orders with items
            const [orderItems] = await db.query(`
                SELECT 
                    oi.menu_item_id,
                    COUNT(DISTINCT o.id) as order_count,
                    SUM(oi.quantity) as total_quantity,
                    MAX(o.created_at) as last_ordered
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY oi.menu_item_id
            `);

            // Get total orders for normalization
            const [totalOrders] = await db.query(
                'SELECT COUNT(*) as total FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
            );
            
            const totalOrderCount = totalOrders[0].total || 1;

            // Update popularity scores
            for (const item of orderItems) {
                // Calculate score: (order_frequency * 0.6) + (quantity * 0.4)
                const frequency = item.order_count / totalOrderCount;
                const popularityScore = (frequency * 60) + (item.total_quantity * 0.4);
                
                await db.query(`
                    INSERT INTO item_popularity 
                    (menu_item_id, order_count, total_quantity, last_ordered, popularity_score)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        order_count = VALUES(order_count),
                        total_quantity = VALUES(total_quantity),
                        last_ordered = VALUES(last_ordered),
                        popularity_score = VALUES(popularity_score)
                `, [item.menu_item_id, item.order_count, item.total_quantity, 
                     item.last_ordered, popularityScore]);
            }

            console.log('✅ Popularity scores updated');
            return true;
        } catch (error) {
            console.error('❌ Error calculating popularity:', error);
            return false;
        }
    }

    // Find item associations (people who bought X also bought Y)
    static async findRecommendations() {
        try {
            // Clear old recommendations
            await db.query('TRUNCATE item_recommendations');

            // Find orders with multiple items
            const [orderPairs] = await db.query(`
                SELECT 
                    a.menu_item_id as item_a,
                    b.menu_item_id as item_b,
                    COUNT(*) as times_together
                FROM order_items a
                JOIN order_items b ON a.order_id = b.order_id AND a.menu_item_id < b.menu_item_id
                GROUP BY a.menu_item_id, b.menu_item_id
                HAVING times_together >= 2
            `);

            // Calculate confidence and store recommendations
            for (const pair of orderPairs) {
                // Get total orders for item_a
                const [itemACount] = await db.query(
                    'SELECT COUNT(*) as count FROM order_items WHERE menu_item_id = ?',
                    [pair.item_a]
                );
                
                const confidence = (pair.times_together / itemACount[0].count) * 100;
                
                // Store bidirectional recommendations
                if (confidence > 20) { // Only store if confidence > 20%
                    await db.query(
                        'INSERT INTO item_recommendations (menu_item_id, recommended_item_id, confidence) VALUES (?, ?, ?)',
                        [pair.item_a, pair.item_b, confidence]
                    );
                    
                    await db.query(
                        'INSERT INTO item_recommendations (menu_item_id, recommended_item_id, confidence) VALUES (?, ?, ?)',
                        [pair.item_b, pair.item_a, confidence]
                    );
                }
            }

            console.log('✅ Recommendations updated');
            return true;
        } catch (error) {
            console.error('❌ Error finding recommendations:', error);
            return false;
        }
    }

    // Analyze peak hours
    static async analyzePeakHours() {
        try {
            // Clear old data
            await db.query('TRUNCATE peak_hours');

            // Analyze by hour and day
            for (let day = 0; day < 7; day++) {
                for (let hour = 0; hour < 24; hour++) {
                    const [result] = await db.query(`
                        SELECT 
                            COUNT(*) as order_count,
                            AVG(HOUR(created_at)) as avg_hour
                        FROM orders 
                        WHERE DAYOFWEEK(created_at) = ? 
                        AND HOUR(created_at) = ?
                        AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
                    `, [day + 1, hour]);

                    const avgOrders = result[0].order_count / 60; // Average per day

                    if (avgOrders > 0.5) { // At least 0.5 orders per hour on average
                        await db.query(
                            'INSERT INTO peak_hours (hour_of_day, day_of_week, avg_orders, confidence) VALUES (?, ?, ?, ?)',
                            [hour, day, avgOrders, Math.min(avgOrders * 20, 95)]
                        );
                    }
                }
            }

            console.log('✅ Peak hours analyzed');
            return true;
        } catch (error) {
            console.error('❌ Error analyzing peak hours:', error);
            return false;
        }
    }

    // Predict next day's sales
    static async predictSales() {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            const dayOfWeek = tomorrow.getDay();

            // Get average sales for this day of week
            const [history] = await db.query(`
                SELECT 
                    AVG(total_price) as avg_sales,
                    STDDEV(total_price) as std_dev
                FROM orders 
                WHERE DAYOFWEEK(created_at) = ?
                AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            `, [dayOfWeek + 1]);

            // Get recent trend (last 7 days)
            const [trend] = await db.query(`
                SELECT AVG(total_price) as recent_avg
                FROM orders 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            `);

            // Combine historical avg (70%) with recent trend (30%)
            const predictedSales = (history[0].avg_sales * 0.7) + (trend[0].recent_avg * 0.3);
            
            // Calculate confidence based on standard deviation
            const confidence = history[0].std_dev 
                ? Math.max(0, 100 - (history[0].std_dev / history[0].avg_sales * 50))
                : 50;

            // Store prediction
            await db.query(
                'INSERT INTO sales_predictions (prediction_date, predicted_sales) VALUES (?, ?)',
                [tomorrowStr, predictedSales || 0]
            );

            return {
                date: tomorrowStr,
                predicted_sales: predictedSales || 0,
                confidence: Math.min(confidence, 95)
            };
        } catch (error) {
            console.error('❌ Error predicting sales:', error);
            return null;
        }
    }

    // Get popular items
    static async getPopularItems(limit = 10) {
        try {
            const [items] = await db.query(`
                SELECT 
                    p.*,
                    m.name,
                    m.description,
                    m.price,
                    m.category,
                    m.image_url
                FROM item_popularity p
                JOIN menu_items m ON p.menu_item_id = m.id
                WHERE m.is_available = true
                ORDER BY p.popularity_score DESC
                LIMIT ?
            `, [limit]);

            return items;
        } catch (error) {
            console.error('❌ Error getting popular items:', error);
            return [];
        }
    }

    // Get recommendations for an item
    static async getRecommendations(itemId, limit = 3) {
        try {
            const [recommendations] = await db.query(`
                SELECT 
                    r.*,
                    m.name,
                    m.description,
                    m.price,
                    m.image_url
                FROM item_recommendations r
                JOIN menu_items m ON r.recommended_item_id = m.id
                WHERE r.menu_item_id = ?
                ORDER BY r.confidence DESC
                LIMIT ?
            `, [itemId, limit]);

            return recommendations;
        } catch (error) {
            console.error('❌ Error getting recommendations:', error);
            return [];
        }
    }

    // Get peak hours for display
    static async getPeakHours() {
        try {
            const [hours] = await db.query(`
                SELECT * FROM peak_hours 
                ORDER BY avg_orders DESC 
                LIMIT 10
            `);

            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            
            return hours.map(h => ({
                ...h,
                day_name: days[h.day_of_week],
                time_range: `${h.hour_of_day}:00 - ${h.hour_of_day + 1}:00`
            }));
        } catch (error) {
            console.error('❌ Error getting peak hours:', error);
            return [];
        }
    }
}

module.exports = AIService;