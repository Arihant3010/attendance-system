const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SSL Configuration added for Render / Cloud Postgres Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/attendance_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.get('/api/students', async (req, res) => {
    const { division } = req.query;
    try {
        let query = 'SELECT * FROM students';
        let params = [];
        if (division && division !== 'ALL') {
            query += ' WHERE division = $1';
            params.push(division);
        }
        query += ' ORDER BY roll_number ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/subjects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM subjects ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/attendance', async (req, res) => {
    const { student_id, subject_id, date, status } = req.body;
    try {
        await pool.query(`
            INSERT INTO attendance (student_id, subject_id, date, status)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (student_id, subject_id, date)
            DO UPDATE SET status = EXCLUDED.status
        `, [student_id, subject_id, date, status]);
        
        res.json({ message: 'Attendance updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/student-dashboard/:roll_number', async (req, res) => {
    const { roll_number } = req.params;
    const { date } = req.query;

    try {
        const studentRes = await pool.query('SELECT * FROM students WHERE UPPER(roll_number) = UPPER($1)', [roll_number]);
        if (studentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        const student = studentRes.rows[0];

        const statsRes = await pool.query(`
            SELECT 
                sub.id as subject_id,
                sub.name as subject_name,
                sub.code,
                COUNT(att.id) as total_classes,
                COUNT(CASE WHEN att.status = 'Present' THEN 1 END) as present_count
            FROM subjects sub
            LEFT JOIN attendance att ON att.subject_id = sub.id AND att.student_id = $1
            GROUP BY sub.id, sub.name, sub.code
            ORDER BY sub.id ASC
        `, [student.id]);

        let dateLogQuery = `
            SELECT att.date, sub.name as subject_name, att.status
            FROM attendance att
            JOIN subjects sub ON att.subject_id = sub.id
            WHERE att.student_id = $1
        `;
        let params = [student.id];

        if (date) {
            dateLogQuery += ` AND att.date = $2`;
            params.push(date);
        }

        dateLogQuery += ` ORDER BY att.date DESC, sub.id ASC`;

        const logsRes = await pool.query(dateLogQuery, params);

        res.json({
            student,
            subjectsStats: statsRes.rows,
            historyLogs: logsRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FIXED FACULTY STATS (Unique Low Attendance Student Count)
app.get('/api/faculty-stats', async (req, res) => {
    const { division } = req.query;
    try {
        let totalQuery = 'SELECT COUNT(*) FROM students';
        let totalParams = [];
        if (division && division !== 'ALL') {
            totalQuery += ' WHERE division = $1';
            totalParams.push(division);
        }
        const totalStudents = await pool.query(totalQuery, totalParams);

        // Fetch students overall percentage (Filtered by division)
        let lowAttQuery = `
            SELECT st.id, st.roll_number, st.name, st.division, 
                   ROUND((COUNT(CASE WHEN att.status = 'Present' THEN 1 END)::decimal / NULLIF(COUNT(att.id), 0)) * 100, 1) as percentage
            FROM students st
            JOIN attendance att ON att.student_id = st.id
        `;
        let lowParams = [];

        if (division && division !== 'ALL') {
            lowAttQuery += ` WHERE st.division = $1`;
            lowParams.push(division);
        }

        lowAttQuery += `
            GROUP BY st.id, st.roll_number, st.name, st.division
            HAVING (COUNT(CASE WHEN att.status = 'Present' THEN 1 END)::decimal / NULLIF(COUNT(att.id), 0)) * 100 < 75
            ORDER BY st.division ASC, percentage ASC
        `;

        const lowAttendance = await pool.query(lowAttQuery, lowParams);

        res.json({
            totalStudents: parseInt(totalStudents.rows[0].count || 0),
            uniqueLowCount: lowAttendance.rows.length,
            lowAttendanceStudents: lowAttendance.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});