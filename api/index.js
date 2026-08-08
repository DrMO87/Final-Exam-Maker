import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// DB diagnostic endpoint
app.get('/api/health', async (req, res) => {
  try {
    const { default: pool } = await import('../backend/config/database.js');
    const result = await pool.query('SELECT NOW() as time');
    res.json({ 
      status: 'OK', 
      db: 'connected', 
      time: result.rows[0].time,
      env: !!process.env.DATABASE_URL ? 'supabase' : 'sqlite'
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: err.message,
      stack: err.stack 
    });
  }
});

// Import and mount auth routes
try {
  const { default: authRoutes } = await import('../backend/routes/auth.js');
  app.use('/api/auth', authRoutes);
} catch (err) {
  console.error('Failed to load auth routes:', err);
  app.use('/api/auth', (req, res) => {
    res.status(500).json({ success: false, error: 'Auth route load error: ' + err.message });
  });
}

// Import and mount scheduler routes
try {
  const { default: schedulerRoutes } = await import('../backend/routes/scheduler.js');
  app.use('/api/scheduler', schedulerRoutes);
} catch (err) {
  console.error('Failed to load scheduler routes:', err);
  app.use('/api/scheduler', (req, res) => {
    res.status(500).json({ success: false, error: 'Route load error: ' + err.message });
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message });
});

export default app;
