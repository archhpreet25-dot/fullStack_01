import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { requireAuth } from '../middleware/authMiddleware.js';
const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } });
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
});
function setSession(res, user) { const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' }); res.cookie('spendsmart_token', token, cookieOptions()); }
const safeUser = user => ({ id: user._id, name: user.name, email: user.email });
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const name = String(req.body.name ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    if (name.length < 2 || name.length > 60) return res.status(400).json({ message: 'Name must be 2–60 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ message: 'Password must be 8–72 characters.' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
    setSession(res, user);
    return res.status(201).json({ message: 'Account created successfully.', user: safeUser(user) });
  } catch (error) { if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' }); return next(error); }
});
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    setSession(res, user);
    return res.json({ message: 'Login successful.', user: safeUser(user) });
  } catch (error) { return next(error); }
});
router.post('/logout', (_req, res) => { res.clearCookie('spendsmart_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', path: '/' }); res.json({ message: 'Logged out successfully.' }); });
router.get('/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));
export default router;
