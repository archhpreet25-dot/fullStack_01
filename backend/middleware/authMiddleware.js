import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.spendsmart_token;
    if (!token) return res.status(401).json({ message: 'Please log in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.sub || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ message: 'Your session is invalid. Please log in again.' });
    }
    const user = await User.findById(payload.sub).select('_id name email');
    if (!user) return res.status(401).json({ message: 'Your session is no longer valid. Please log in again.' });
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: error.name === 'TokenExpiredError' ? 'Your session has expired. Please log in again.' : 'Your session is invalid. Please log in again.' });
  }
}
