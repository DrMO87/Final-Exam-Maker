import pg from 'pg';

let dbPool;

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (connectionString) {
  console.log('⚡ Connected to Supabase Cloud PostgreSQL database!');
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  let initialized = false;

  const initPostgres = async () => {
    if (initialized) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scheduling_sessions (
            id SERIAL PRIMARY KEY,
            session_name VARCHAR(255) NOT NULL,
            semester VARCHAR(100) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS courses (
            id SERIAL PRIMARY KEY,
            session_id INT REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
            program VARCHAR(100) NOT NULL,
            level INT NOT NULL DEFAULT 1,
            course_code VARCHAR(50) NOT NULL,
            course_title VARCHAR(255) NOT NULL,
            has_oral_exam BOOLEAN DEFAULT FALSE,
            student_count INT DEFAULT 0,
            credit_hours INT DEFAULT 3,
            is_heavy BOOLEAN DEFAULT FALSE,
            must_be_first BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Fix any old table column leftover from 'lvl'
        ALTER TABLE courses DROP COLUMN IF EXISTS lvl;
        ALTER TABLE courses ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 1;

        CREATE TABLE IF NOT EXISTS conflicts (
            id SERIAL PRIMARY KEY,
            session_id INT REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
            course_a_id INT REFERENCES courses(id) ON DELETE CASCADE,
            course_b_id INT REFERENCES courses(id) ON DELETE CASCADE,
            overlap_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_conflict_pair UNIQUE(session_id, course_a_id, course_b_id)
        );

        CREATE TABLE IF NOT EXISTS saved_schedules (
            id SERIAL PRIMARY KEY,
            session_id INT REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            schedule_data JSONB NOT NULL,
            locked_assignments JSONB DEFAULT '{}'::jsonb,
            violation_count INT DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS schedules (
            id SERIAL PRIMARY KEY,
            session_id INT REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
            course_id INT REFERENCES courses(id) ON DELETE CASCADE,
            exam_date DATE NOT NULL,
            day_of_week VARCHAR(50),
            group_type VARCHAR(50),
            period VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(100) NOT NULL DEFAULT 'Staff',
            department VARCHAR(255) DEFAULT 'Faculty of Pharmacy',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Seed default accounts if empty
      try {
        const countRes = await pool.query('SELECT COUNT(*) as count FROM users');
        if (Number(countRes.rows[0]?.count || 0) === 0) {
          await pool.query(`
            INSERT INTO users (username, password, name, role, department) VALUES
            ('melkhodary@horus.edu.eg', 'admin123', 'Dr. M. Elkhodary', 'Admin', 'Faculty of Pharmacy'),
            ('admin', 'admin123', 'System Administrator', 'Admin', 'IT & Control System'),
            ('control', 'control123', 'Dr. Exam Control Chair', 'Control Committee', 'Exam Control Committee'),
            ('pharmacy', 'pharmacy123', 'Pharmacy Academic Staff', 'Faculty Staff', 'Faculty of Pharmacy')
            ON CONFLICT DO NOTHING;
          `);
        }
      } catch (e) {}

      initialized = true;
      console.log('✅ Supabase PostgreSQL schema verified & auto-migrated successfully!');
    } catch (err) {
      console.error('⚠️ Auto-migration notice:', err.message);
    }
  };

  dbPool = {
    query: async (text, params = []) => {
      await initPostgres();
      let paramIndex = 1;
      const pgText = text.replace(/\?/g, () => `$${paramIndex++}`);
      const res = await pool.query(pgText, params);
      return res;
    },
    connect: async () => {
      await initPostgres();
      const client = await pool.connect();
      return {
        query: async (text, params = []) => {
          let paramIndex = 1;
          const pgText = text.replace(/\?/g, () => `$${paramIndex++}`);
          const res = await client.query(pgText, params);
          return res;
        },
        release: () => client.release()
      };
    }
  };
} else {
  console.log('✅ Using local SQLite database (no DATABASE_URL provided)');
  const sqliteDb = (await import('./database-sqlite.js')).default;
  dbPool = sqliteDb;
}

export default dbPool;
