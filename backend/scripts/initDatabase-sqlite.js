import db from '../config/database-sqlite.js';

console.log('🔧 Initializing SQLite Database...\n');

async function initDatabase() {
  try {
    // Drop existing tables
    console.log('Dropping existing tables...');
    db.db.exec('DROP TABLE IF EXISTS schedules');
    db.db.exec('DROP TABLE IF EXISTS conflicts');
    db.db.exec('DROP TABLE IF EXISTS courses');
    db.db.exec('DROP TABLE IF EXISTS scheduling_sessions');
    console.log('✅ Existing tables dropped\n');

    // Create scheduling_sessions table
    console.log('Creating scheduling_sessions table...');
    db.db.exec(`
      CREATE TABLE scheduling_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_name TEXT NOT NULL,
        semester TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ scheduling_sessions table created\n');

    // Create courses table
    console.log('Creating courses table...');
    db.db.exec(`
      CREATE TABLE courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        program TEXT,
        level INTEGER NOT NULL,
        course_code TEXT NOT NULL,
        course_title TEXT NOT NULL,
        has_oral_exam INTEGER DEFAULT 0,
        student_count INTEGER,
        credit_hours INTEGER,
        is_heavy INTEGER DEFAULT 0,
        is_large INTEGER DEFAULT 0,
        must_be_first INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES scheduling_sessions(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ courses table created\n');

    // Create conflicts table
    console.log('Creating conflicts table...');
    db.db.exec(`
      CREATE TABLE conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        course_a_id INTEGER NOT NULL,
        course_b_id INTEGER NOT NULL,
        overlap_count INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (course_a_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (course_b_id) REFERENCES courses(id) ON DELETE CASCADE,
        UNIQUE(session_id, course_a_id, course_b_id)
      )
    `);
    console.log('✅ conflicts table created\n');

    // Create schedules table
    console.log('Creating schedules table...');
    db.db.exec(`
      CREATE TABLE schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        exam_date DATE NOT NULL,
        day_of_week TEXT,
        group_type TEXT,
        period INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ schedules table created\n');

    // Create indexes for better performance
    console.log('Creating indexes...');
    db.db.exec('CREATE INDEX idx_courses_session ON courses(session_id)');
    db.db.exec('CREATE INDEX idx_courses_level ON courses(level)');
    db.db.exec('CREATE INDEX idx_conflicts_session ON conflicts(session_id)');
    db.db.exec('CREATE INDEX idx_schedules_session ON schedules(session_id)');
    db.db.exec('CREATE INDEX idx_schedules_date ON schedules(exam_date)');
    console.log('✅ Indexes created\n');

    console.log('========================================');
    console.log('✅ Database initialized successfully!');
    console.log('========================================');
    console.log('\nTables created:');
    console.log('  - scheduling_sessions');
    console.log('  - courses');
    console.log('  - conflicts');
    console.log('  - schedules');
    console.log('\n📊 Database ready to use!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    console.error(error);
    process.exit(1);
  }
}

initDatabase();

