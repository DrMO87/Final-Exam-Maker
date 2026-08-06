import pool from '../config/database.js';

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Drop existing tables
    await client.query(`
      DROP TABLE IF EXISTS schedules CASCADE;
      DROP TABLE IF EXISTS conflicts CASCADE;
      DROP TABLE IF EXISTS courses CASCADE;
      DROP TABLE IF EXISTS scheduling_sessions CASCADE;
    `);

    // Create scheduling_sessions table
    await client.query(`
      CREATE TABLE scheduling_sessions (
        id SERIAL PRIMARY KEY,
        session_name VARCHAR(255) NOT NULL,
        semester VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create courses table
    await client.query(`
      CREATE TABLE courses (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
        program VARCHAR(50) NOT NULL,
        level INTEGER NOT NULL,
        course_code VARCHAR(50) NOT NULL,
        course_title VARCHAR(255) NOT NULL,
        has_oral_exam BOOLEAN DEFAULT FALSE,
        student_count INTEGER DEFAULT 0,
        credit_hours INTEGER DEFAULT 3,
        is_heavy BOOLEAN DEFAULT TRUE,
        must_be_first BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, program, course_code)
      );
    `);

    // Create conflicts table
    await client.query(`
      CREATE TABLE conflicts (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
        course_a_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        course_b_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        overlap_count INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, course_a_id, course_b_id)
      );
    `);

    // Create schedules table
    await client.query(`
      CREATE TABLE schedules (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        exam_date DATE NOT NULL,
        day_of_week VARCHAR(20) NOT NULL,
        group_type VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, course_id)
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_courses_session ON courses(session_id);
      CREATE INDEX idx_courses_program_level ON courses(program, level);
      CREATE INDEX idx_conflicts_session ON conflicts(session_id);
      CREATE INDEX idx_schedules_session ON schedules(session_id);
      CREATE INDEX idx_schedules_date ON schedules(exam_date);
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables created successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

createTables().catch(console.error);

