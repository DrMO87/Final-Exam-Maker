import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Initialize users table and seed default accounts
async function initAuthDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Staff',
        department TEXT DEFAULT 'Faculty of Pharmacy',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if default accounts exist
    const countRes = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = countRes.rows[0]?.count || 0;

    if (userCount === 0) {
      console.log('🔑 Seeding default authorized user accounts...');
      
      const defaultUsers = [
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
        await pool.query(
          `INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)`,
          [u.username, u.password, u.name, u.role, u.department]
        );
      }
      console.log('✅ Default accounts seeded: admin/admin123, control/control123, pharmacy/pharmacy123');
    }
  } catch (err) {
    console.error('Error initializing Auth DB:', err);
  }
}

initAuthDb();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const result = await pool.query(
      'SELECT id, username, password, name, role, department, created_at FROM users WHERE LOWER(username) = ?',
      [cleanUsername]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const user = result.rows[0];

    // Simple password check (plaintext for seeded demo accounts)
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
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
      error: 'Authentication failed due to server error'
    });
  }
});

// GET /api/auth/users (List accounts)
router.get('/users', async (req, res) => {
  try {
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
    const { username, password, name, role, department } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Username, password, and name are required'
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check existing
    const check = await pool.query('SELECT id FROM users WHERE LOWER(username) = ?', [cleanUsername]);
    if (check.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'An account with this username already exists'
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
