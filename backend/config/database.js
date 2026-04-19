const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = pool.promise();

(async () => {
    try {
        await db.query('SELECT 1');
        console.log('✅ MySQL Database connected successfully!');
    } catch (error) {
        console.error('❌ MySQL Database connection failed:', error.message);
    }
})();

module.exports = db;