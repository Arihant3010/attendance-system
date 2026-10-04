const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SQLite Local File Database Setup
const db = new sqlite3.Database('./attendance.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to local SQLite database (attendance.db)');
    }
});

// Helper function for DB Queries (Async/Await support)
const queryAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const queryGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const queryRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

// 1. Get All Students
app.get('/api/students', async (req, res) => {
    const { division } = req.query;
    try {
        let sql = 'SELECT * FROM students';
        let params = [];
        if (division && division !== 'ALL') {
            sql += ' WHERE division = ?';
            params.push(division);
        }
        sql += ' ORDER BY roll_number ASC';
        const rows = await queryAll(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching students:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. Get All Subjects
app.get('/api/subjects', async (req, res) => {
    try {
        const rows = await queryAll('SELECT * FROM subjects ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching subjects:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. Mark / Update Attendance
app.post('/api/attendance', async (req, res) => {
    const { student_id, subject_id, date, status } = req.body;
    try {
        await queryRun(`
            INSERT INTO attendance (student_id, subject_id, date, status)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(student_id, subject_id, date)
            DO UPDATE SET status = excluded.status
        `, [student_id, subject_id, date, status]);

        res.json({ message: 'Attendance updated successfully' });
    } catch (err) {
        console.error('Error updating attendance:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 4. Student Portal Dashboard
app.get('/api/student-dashboard/:roll_number', async (req, res) => {
    const { roll_number } = req.params;
    const { date } = req.query;

    try {
        const student = await queryGet('SELECT * FROM students WHERE UPPER(roll_number) = UPPER(?)', [roll_number]);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const subjectsStats = await queryAll(`
            SELECT
                sub.id as subject_id,
                sub.name as subject_name,
                sub.code,
                COUNT(att.id) as total_classes,
                COUNT(CASE WHEN att.status = 'Present' THEN 1 END) as present_count
            FROM subjects sub
            LEFT JOIN attendance att ON att.subject_id = sub.id AND att.student_id = ?
            GROUP BY sub.id, sub.name, sub.code
            ORDER BY sub.id ASC
        `, [student.id]);

        let dateLogSql = `
            SELECT att.date, sub.name as subject_name, att.status
            FROM attendance att
            JOIN subjects sub ON att.subject_id = sub.id
            WHERE att.student_id = ?
        `;
        let params = [student.id];

        if (date) {
            dateLogSql += ` AND att.date = ?`;
            params.push(date);
        }

        dateLogSql += ` ORDER BY att.date DESC, sub.id ASC`;

        const historyLogs = await queryAll(dateLogSql, params);

        res.json({
            student,
            subjectsStats,
            historyLogs
        });
    } catch (err) {
        console.error('Error fetching student dashboard:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 5. Faculty Panel Stats
app.get('/api/faculty-stats', async (req, res) => {
    const { division } = req.query;
    try {
        let totalSql = 'SELECT COUNT(*) as count FROM students';
        let totalParams = [];
        if (division && division !== 'ALL') {
            totalSql += ' WHERE division = ?';
            totalParams.push(division);
        }
        const totalRes = await queryGet(totalSql, totalParams);

        let lowAttSql = `
            SELECT st.id, st.roll_number, st.name, st.division,
                   ROUND((CAST(COUNT(CASE WHEN att.status = 'Present' THEN 1 END) AS FLOAT) / NULLIF(COUNT(att.id), 0)) * 100, 1) as percentage
            FROM students st
            JOIN attendance att ON att.student_id = st.id
        `;
        let lowParams = [];

        if (division && division !== 'ALL') {
            lowAttSql += ` WHERE st.division = ?`;
            lowParams.push(division);
        }

        lowAttSql += `
            GROUP BY st.id, st.roll_number, st.name, st.division
            HAVING (CAST(COUNT(CASE WHEN att.status = 'Present' THEN 1 END) AS FLOAT) / NULLIF(COUNT(att.id), 0)) * 100 < 75
            ORDER BY st.division ASC, percentage ASC
        `;

        const lowAttendanceStudents = await queryAll(lowAttSql, lowParams);

        res.json({
            totalStudents: totalRes ? totalRes.count : 0,
            uniqueLowCount: lowAttendanceStudents.length,
            lowAttendanceStudents
        });
    } catch (err) {
        console.error('Error fetching faculty stats:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running locally on http://localhost:${port}`);
});