const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// SSL logic added to prevent ECONNRESET on cloud database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/attendance_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function runSeed() {
    try {
        console.log('Connecting to database...');
        
        // Read init.sql schema
        const sqlPath = path.join(__dirname, 'init.sql');
        if (fs.existsSync(sqlPath)) {
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log('Creating tables from init.sql...');
            await pool.query(sql);
            console.log('Tables created successfully!');
        }

        console.log('Database seeded successfully!');
    } catch (err) {
        console.error('Seeding error:', err);
    } finally {
        await pool.end();
    }
}

runSeed();