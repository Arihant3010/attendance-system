const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL Docker DB Connection String
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://admin:secretpassword@db:5432/attendance_db'
});

// 1. Fetch all students for Faculty page
app.get('/api/students', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students ORDER BY roll_number');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Faculty: Mark or Update Attendance
app.post('/api/attendance', async (req, res) => {
  const { student_id, subject, date, status } = req.body;
  try {
    await pool.query(
      `INSERT INTO attendance (student_id, subject, date, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, subject, date) 
       DO UPDATE SET status = EXCLUDED.status`,
      [student_id, subject, date, status]
    );
    res.json({ message: 'Attendance recorded successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Student: View Attendance Summary
app.get('/api/student/:roll_number', async (req, res) => {
  const { roll_number } = req.params;
  try {
    const query = `
      SELECT s.name, s.roll_number, a.subject, a.date, a.status 
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
      WHERE s.roll_number = $1
    `;
    const result = await pool.query(query, [roll_number]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));