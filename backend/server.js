import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import schedulerRoutes from './routes/scheduler.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/scheduler', schedulerRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Exam Scheduler API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error' 
  });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}`);
  });
}

export default app;

