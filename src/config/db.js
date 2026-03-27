const mysql = require('mysql2/promise');

console.log('🔌 Initializing database connection...');

// Check if running on Railway
const isRailway = !!process.env.RAILWAY_ENVIRONMENT || !!process.env.MYSQL_URL;

let pool;

if (isRailway) {
    // Use Railway's MySQL URL (this is the CORRECT way)
    const connectionUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
    
    console.log('🚀 Running on Railway!');
    console.log('📡 Using MySQL URL:', connectionUrl ? 'URL exists' : 'URL missing');
    
    if (!connectionUrl) {
        console.error('❌ MYSQL_URL environment variable not found!');
        console.log('📋 Available env vars:', Object.keys(process.env).filter(k => k.includes('MYSQL') || k.includes('DATABASE')));
    }
    
    pool = mysql.createPool({
        uri: connectionUrl,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    });
} else {
    // Local development
    console.log('💻 Running locally');
    
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'dineqrve_db',
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0
    });
}

// Test connection function
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully!');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('   Error Code:', error.code);
        console.error('   Error Details:', error);
        return false;
    }
};

// Export both pool and testConnection
module.exports = {
    pool,
    query: async (sql, params) => {
        try {
            const [rows] = await pool.query(sql, params);
            return [rows];
        } catch (error) {
            console.error('❌ Query error:', error);
            throw error;
        }
    },
    getConnection: async () => {
        return pool.getConnection();
    },
    testConnection
};