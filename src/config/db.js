const mysql = require('mysql2');

const config = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'dineqrve_db',
};

console.log('🔌 Testing database connection to:', config.database);

const pool = mysql.createPool(config);
const promisePool = pool.promise();

// Enhanced test with error details
promisePool.getConnection()
  .then(connection => {
    console.log('✅ MySQL Connection Successful!');
    
    // Test 1: Check if table exists
    return connection.query("SHOW TABLES LIKE 'menu_items'");
  })
  .then(([rows]) => {
    if (rows.length === 0) {
      console.log('❌ Table "menu_items" does NOT exist!');
    } else {
      console.log('✅ Table "menu_items" exists');
    }
    
    // Test 2: Count menu items
    return promisePool.query('SELECT COUNT(*) as count FROM menu_items');
  })
  .then(([rows]) => {
    console.log(`📊 Found ${rows[0].count} menu items in database`);
    
    // Test 3: Get first 3 items
    return promisePool.query('SELECT id, name FROM menu_items LIMIT 3');
  })
  .then(([rows]) => {
    console.log('📝 Sample menu items:', rows);
  })
  .catch(err => {
    console.error('❌ DATABASE ERROR DETAILS:');
    console.error('   Error Code:', err.code);
    console.error('   Error Message:', err.message);
    console.error('   SQL State:', err.sqlState || 'N/A');
    console.error('   Full Error:', err);
  });

module.exports = promisePool;