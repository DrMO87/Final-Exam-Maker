import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create database file in backend directory
const dbPath = path.join(__dirname, '..', 'exam_scheduler.db');

// Initialize SQLite database
const db = new Database(dbPath, { verbose: console.log });

// Enable foreign keys
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS scheduling_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_name TEXT NOT NULL,
    semester TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    excluded_dates TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    program TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    course_code TEXT NOT NULL,
    course_title TEXT NOT NULL,
    has_oral_exam INTEGER DEFAULT 0,
    student_count INTEGER DEFAULT 0,
    credit_hours INTEGER DEFAULT 3,
    is_heavy INTEGER DEFAULT 0,
    must_be_first INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES scheduling_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    course_a_id INTEGER,
    course_b_id INTEGER,
    overlap_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, course_a_id, course_b_id),
    FOREIGN KEY (session_id) REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (course_a_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (course_b_id) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS saved_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    schedule_data TEXT NOT NULL,
    locked_assignments TEXT DEFAULT '{}',
    violation_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES scheduling_sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    course_id INTEGER,
    exam_date DATE NOT NULL,
    day_of_week TEXT,
    group_type TEXT,
    period TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES scheduling_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Staff',
    department TEXT DEFAULT 'Faculty of Pharmacy',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec("ALTER TABLE scheduling_sessions ADD COLUMN excluded_dates TEXT DEFAULT '[]'");
} catch (e) {}

// Seed default accounts if empty
try {
  const userCheck = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCheck && userCheck.count === 0) {
    const insertStmt = db.prepare('INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)');
    insertStmt.run('melkhodary@horus.edu.eg', 'admin123', 'Dr. M. Elkhodary', 'Admin', 'Faculty of Pharmacy');
    insertStmt.run('admin', 'admin123', 'System Administrator', 'Admin', 'IT & Control System');
    insertStmt.run('control', 'control123', 'Dr. Exam Control Chair', 'Control Committee', 'Exam Control Committee');
    insertStmt.run('pharmacy', 'pharmacy123', 'Pharmacy Academic Staff', 'Faculty Staff', 'Faculty of Pharmacy');
    console.log('✅ Default authorized users seeded into local SQLite!');
  }
} catch (e) {
  console.error('User seeding error:', e.message);
}

console.log(`📊 SQLite database initialized at: ${dbPath}`);

// Wrapper to make SQLite work like PostgreSQL pool.query()
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      // Handle transaction commands
      if (sql.trim().toUpperCase() === 'BEGIN') {
        try { db.prepare('BEGIN').run(); } catch (e) {}
        resolve({ rows: [] });
        return;
      }
      if (sql.trim().toUpperCase() === 'COMMIT') {
        try { db.prepare('COMMIT').run(); } catch (e) {}
        resolve({ rows: [] });
        return;
      }
      if (sql.trim().toUpperCase() === 'ROLLBACK') {
        try { db.prepare('ROLLBACK').run(); } catch (e) {}
        resolve({ rows: [] });
        return;
      }

      // Check if it's a SELECT query
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const stmt = db.prepare(sql);
        const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
        resolve({ rows });
      }
      // INSERT with RETURNING
      else if (sql.toUpperCase().includes('RETURNING')) {
        // SQLite doesn't support RETURNING, so we handle it by fetching lastInsertRowid
        const cleanSql = sql.split(/RETURNING/i)[0].trim();

        const stmt = db.prepare(cleanSql);
        const info = params.length > 0 ? stmt.run(...params) : stmt.run();

        // Get the inserted row
        const lastId = info.lastInsertRowid;
        const tableName = extractTableName(cleanSql);
        const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
        const rows = [selectStmt.get(lastId)];
        resolve({ rows });
      }
      // INSERT, UPDATE, DELETE
      else {
        // SQLite supports ON CONFLICT DO NOTHING natively, so we don't need to strip it.
        const stmt = db.prepare(sql);
        const info = params.length > 0 ? stmt.run(...params) : stmt.run();
        resolve({
          rows: [],
          rowCount: info.changes,
          lastInsertRowid: info.lastInsertRowid
        });
      }
    } catch (error) {
      reject(error);
    }
  });
};

// Helper function to extract table name from INSERT statement
function extractTableName(sql) {
  const match = sql.match(/INSERT INTO\s+(\w+)/i);
  return match ? match[1] : null;
}

// Mimic PostgreSQL's client.connect() - returns a client-like object
const connect = async () => {
  return {
    query,
    release: () => {}, // SQLite doesn't need connection pooling
  };
};

// Close database connection
const close = () => {
  db.close();
};

export default {
  query,
  connect,
  close,
  db // Export raw db for direct access if needed
};

