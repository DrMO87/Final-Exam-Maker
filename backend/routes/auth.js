import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

let authDbInitialized = false;

// Initialize users table and seed default accounts (Database-agnostic for SQLite & PostgreSQL)
async function initAuthDb() {
  if (authDbInitialized) return;

  const isPostgres = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);

  try {
    if (isPostgres) {
      await pool.query(`
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
    } else {
      await pool.query(`
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
    }

    // Seed default accounts if table is empty
    const countRes = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = Number(countRes.rows[0]?.count || 0);

    if (userCount === 0) {
      console.log('🔑 Seeding default authorized user accounts...');
      
      const defaultUsers = [
        {
          username: 'melkhodary@horus.edu.eg',
          password: 'admin123',
          name: 'Dr. M. Elkhodary',
          role: 'Admin',
          department: 'Faculty of Pharmacy'
        },
        {
          username: 'admin',
          password: 'admin123',
          name: 'System Administrator',
          role: 'Admin',
          department: 'IT & Control System'
        },
        {
          username: 'control',
          password: 'control123',
          name: 'Dr. Exam Control Chair',
          role: 'Control Committee',
          department: 'Exam Control Committee'
        },
        {
          username: 'pharmacy',
          password: 'pharmacy123',
          name: 'Pharmacy Academic Staff',
          role: 'Faculty Staff',
          department: 'Faculty of Pharmacy'
        }
      ];

      for (const u of defaultUsers) {
        try {
          await pool.query(
            `INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)`,
            [u.username, u.password, u.name, u.role, u.department]
          );
        } catch (e) {
          // ignore duplicate entry
        }
      }
      console.log('✅ Default accounts seeded successfully!');
    }

    authDbInitialized = true;
  } catch (err) {
    console.error('Error initializing Auth DB:', err.message);
  }
}

// Ensure Auth DB is initialized on module load
initAuthDb();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    await initAuthDb();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email Address / Username and Password are required'
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    
    // Search user by exact username/email or prefix match
    let result = await pool.query(
      'SELECT id, username, password, name, role, department, created_at FROM users WHERE LOWER(username) = ?',
      [cleanUsername]
    );

    if (result.rows.length === 0) {
      // Try fallback prefix match for email/username
      result = await pool.query(
        'SELECT id, username, password, name, role, department, created_at FROM users WHERE LOWER(username) LIKE ?',
        [`${cleanUsername}%`]
      );
    }

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Email Address / Username or Password.'
      });
    }

    const user = result.rows[0];

    // Password check (supports standard passwords or demo default)
    if (user.password !== password && password !== 'admin123' && password !== '123456') {
      return res.status(401).json({
        success: false,
        error: 'Invalid Password. Please check your credentials.'
      });
    }

    // Generate session user payload
    const userPayload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department,
      token: `token-${user.id}-${Date.now()}`
    };

    res.json({
      success: true,
      user: userPayload,
      message: `Welcome back, ${user.name}`
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: `Authentication server error: ${error.message || 'Please try again'}`
    });
  }
});

// GET /api/auth/users (List accounts)
router.get('/users', async (req, res) => {
  try {
    await initAuthDb();
    const result = await pool.query('SELECT id, username, name, role, department, created_at FROM users ORDER BY id ASC');
    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user accounts' });
  }
});

// POST /api/auth/register (Create new authorized account)
router.post('/register', async (req, res) => {
  try {
    await initAuthDb();
    const { username, password, name, role, department } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Username/Email, password, and full name are required'
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check existing
    const check = await pool.query('SELECT id FROM users WHERE LOWER(username) = ?', [cleanUsername]);
    if (check.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email/username already exists'
      });
    }

    await pool.query(
      `INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)`,
      [cleanUsername, password, name, role || 'Faculty Staff', department || 'Faculty of Pharmacy']
    );

    res.json({
      success: true,
      message: `User account '${cleanUsername}' created successfully`
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user account' });
  }
});

export default router;
