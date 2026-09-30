-- Students Table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(10) CHECK (status IN ('Present', 'Absent')),
    UNIQUE(student_id, subject, date)
);

-- Dummy Data Insert (Testing ke liye)
INSERT INTO students (roll_number, name) VALUES 
('CS101', 'Rahul Sharma'),
('CS102', 'Priya Patel'),
('CS103', 'Aman Verma')
ON CONFLICT DO NOTHING;