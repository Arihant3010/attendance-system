const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/attendance_db'
});

async function seed() {
    try {
        console.log("Seeding database with calibrated low attendance counts...");

        await pool.query(`
            DROP TABLE IF EXISTS attendance CASCADE;
            DROP TABLE IF EXISTS students CASCADE;
            DROP TABLE IF EXISTS subjects CASCADE;
            DROP TABLE IF EXISTS events CASCADE;
        `);

        await pool.query(`
            CREATE TABLE students (
                id SERIAL PRIMARY KEY,
                roll_number VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                division VARCHAR(5) NOT NULL
            );

            CREATE TABLE subjects (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(20) NOT NULL,
                type VARCHAR(20) DEFAULT 'Theory'
            );

            CREATE TABLE attendance (
                id SERIAL PRIMARY KEY,
                student_id INT REFERENCES students(id) ON DELETE CASCADE,
                subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                status VARCHAR(10) NOT NULL,
                UNIQUE(student_id, subject_id, date)
            );

            CREATE TABLE events (
                id SERIAL PRIMARY KEY,
                title VARCHAR(150) NOT NULL,
                date DATE NOT NULL,
                category VARCHAR(50) NOT NULL
            );
        `);

        const subjects = [
            ['Data Structures & Algorithms', 'CS401', 'Theory'],
            ['Database Management Systems', 'CS402', 'Theory'],
            ['Operating Systems', 'CS403', 'Theory'],
            ['Computer Networks', 'CS404', 'Theory'],
            ['Software Engineering', 'CS405', 'Theory']
        ];

        const subIds = [];
        for (let sub of subjects) {
            const res = await pool.query('INSERT INTO subjects (name, code, type) VALUES ($1, $2, $3) RETURNING id', sub);
            subIds.push(res.rows[0].id);
        }

        // Target low count per division: Div A = 8, Div B = 10, Div C = 9 (Total = 27)
        const lowTargets = { 'A': 8, 'B': 10, 'C': 9 };
        const studentList = [];
        let rollCounter = 101;

        for (let div of ['A', 'B', 'C']) {
            for (let i = 1; i <= 20; i++) {
                const roll = `CS${rollCounter++}`;
                const name = `Student ${div}-${i}`;
                const res = await pool.query('INSERT INTO students (roll_number, name, division) VALUES ($1, $2, $3) RETURNING id', [roll, name, div]);
                
                // Mark specified number of students as low attendance (<75%)
                const isLow = i <= lowTargets[div]; 
                studentList.push({ id: res.rows[0].id, isLow });
            }
        }

        console.log("Generating 1-Month September attendance logs...");
        for (let day = 1; day <= 30; day++) {
            const dateStr = `2026-09-${day < 10 ? '0' + day : day}`;
            const dateObj = new Date(dateStr);
            if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;

            for (let s of studentList) {
                for (let subId of subIds) {
                    // Low attendance students get ~65% attendance rate, Good students get ~88%
                    const chanceOfPresent = s.isLow ? 0.65 : 0.88;
                    const status = Math.random() < chanceOfPresent ? 'Present' : 'Absent';
                    await pool.query(
                        'INSERT INTO attendance (student_id, subject_id, date, status) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
                        [s.id, subId, dateStr, status]
                    );
                }
            }
        }

        console.log("Database seeded successfully! Exact Target ~27 Low Attendance Students.");
        process.exit(0);
    } catch (err) {
        console.error("Seeding error:", err);
        process.exit(1);
    }
}

seed();