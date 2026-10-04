const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./attendance.db');

db.serialize(() => {
    console.log('Resetting and seeding SQLite database for September 2026...');

    // Clean old tables
    db.run(`DROP TABLE IF EXISTS attendance`);
    db.run(`DROP TABLE IF EXISTS students`);
    db.run(`DROP TABLE IF EXISTS subjects`);

    // Create Tables
    db.run(`
        CREATE TABLE students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_number TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            division TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL,
            UNIQUE(student_id, subject_id, date),
            FOREIGN KEY (student_id) REFERENCES students(id),
            FOREIGN KEY (subject_id) REFERENCES subjects(id)
        )
    `);

    // 1. Insert 5 Theory Subjects
    const subjects = [
        ['Mathematics', 'MATH101'],
        ['Data Structures', 'CS201'],
        ['Database Systems', 'CS301'],
        ['Operating Systems', 'CS302'],
        ['Computer Networks', 'CS303']
    ];

    const stmtSub = db.prepare(`INSERT INTO subjects (name, code) VALUES (?, ?)`);
    subjects.forEach(sub => stmtSub.run(sub));
    stmtSub.finalize();

    // 2. Insert 60 Students (Div A: 20, Div B: 20, Div C: 20)
    const stmtStud = db.prepare(`INSERT INTO students (roll_number, name, division) VALUES (?, ?, ?)`);
    const divisions = ['A', 'B', 'C'];
    
    divisions.forEach(div => {
        for (let i = 1; i <= 20; i++) {
            const rollNum = `${div}${i.toString().padStart(3, '0')}`;
            const name = `Student ${div}-${i}`;
            stmtStud.run([rollNum, name, div]);
        }
    });
    stmtStud.finalize();

    // Low Attendance Students (<75% Target):
    // Div A = 5 students | Div B = 6 students | Div C = 8 students => Total = 19
    const lowAttStudentsDivA = [2, 5, 9, 15, 18];
    const lowAttStudentsDivB = [1, 4, 8, 11, 14, 19];
    const lowAttStudentsDivC = [3, 6, 7, 10, 12, 15, 17, 20];

    // 3. Generate Daily Attendance with UNIQUE Breakdown for all 60 Students
    console.log('Generating full September 2026 attendance with unique percentages...');

    db.all(`SELECT id, roll_number, division FROM students`, [], (err, students) => {
        if (err) {
            console.error(err);
            return;
        }

        db.run('BEGIN TRANSACTION');
        const stmtAtt = db.prepare(`INSERT INTO attendance (student_id, subject_id, date, status) VALUES (?, ?, ?, ?)`);

        students.forEach(student => {
            const rollNumSeq = parseInt(student.roll_number.replace(/[^0-9]/g, ''), 10);
            let isLowAttendance = false;

            if (student.division === 'A' && lowAttStudentsDivA.includes(rollNumSeq)) isLowAttendance = true;
            if (student.division === 'B' && lowAttStudentsDivB.includes(rollNumSeq)) isLowAttendance = true;
            if (student.division === 'C' && lowAttStudentsDivC.includes(rollNumSeq)) isLowAttendance = true;

            // Target base percentage per student
            // Low attendance students get target between ~50% and ~70%
            // Regular students get target between ~80% and ~96%
            const studentBaseTarget = isLowAttendance 
                ? 0.50 + ((student.id * 7) % 20) / 100 
                : 0.80 + ((student.id * 11) % 17) / 100;

            for (let subjectId = 1; subjectId <= 5; subjectId++) {
                // Unique variance per subject for this student (adds -6% to +6%)
                const subjectOffset = (((student.id * 13 + subjectId * 19) % 13) - 6) / 100;
                let finalSubjectTarget = studentBaseTarget + subjectOffset;

                // Ensure boundaries
                if (isLowAttendance) {
                    finalSubjectTarget = Math.min(0.72, Math.max(0.45, finalSubjectTarget));
                } else {
                    finalSubjectTarget = Math.min(0.98, Math.max(0.78, finalSubjectTarget));
                }

                for (let day = 1; day <= 30; day++) {
                    const dayStr = day.toString().padStart(2, '0');
                    const date = `2026-09-${dayStr}`;

                    // Pseudo-random deterministic hash to check against finalSubjectTarget
                    const hash = (day * 37 + subjectId * 53 + student.id * 79) % 100;
                    const status = (hash / 100) < finalSubjectTarget ? 'Present' : 'Absent';

                    stmtAtt.run([student.id, subjectId, date, status]);
                }
            }
        });

        stmtAtt.finalize();
        db.run('COMMIT', (commitErr) => {
            if (commitErr) {
                console.error('Error committing transaction:', commitErr.message);
            } else {
                console.log('SUCCESS: Seeded September 2026 with unique attendance breakdowns!');
            }
        });
    });
});