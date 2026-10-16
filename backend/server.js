import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';

const app = express();
const port = Number(process.env.PORT || 5000);
const { MONGODB_URI, JWT_SECRET } = process.env;
if (!MONGODB_URI || !JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('Set MONGODB_URI and a JWT_SECRET of at least 32 characters in backend/.env');
  process.exit(1);
}
app.disable('x-powered-by');
app.use(cors({
  origin: 'https://spendsmart-frontend-pearl.vercel.app',
  credentials: true
}));

app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

// Existing API routes yahin rahenge
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ message: 'Submitted data is invalid.' });
  if (error.name === 'SyntaxError' && 'body' in error) return res.status(400).json({ message: 'Invalid JSON request body.' });
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});
try {
  await mongoose.connect(MONGODB_URI);
  app.listen(port, () => console.log(`SpendSmart API running at http://localhost:${port}`));
} catch (error) {
  console.error('Could not connect to MongoDB:', error.message);
  process.exit(1);
}
