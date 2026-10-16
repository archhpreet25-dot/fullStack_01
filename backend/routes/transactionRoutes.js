import { Router } from 'express';
import mongoose from 'mongoose';
import Transaction, { categories } from '../models/Transaction.js';
import { requireAuth } from '../middleware/authMiddleware.js';
const router = Router();
router.use(requireAuth);
const allowed = ['description','amount','type','category','date','notes'];
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
function validateBody(body, partial = false) {
  if (!partial || body.description !== undefined) if (typeof body.description !== 'string' || !body.description.trim() || body.description.trim().length > 100) return 'Description is required and must be 100 characters or fewer.';
  if (!partial || body.amount !== undefined) if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0 || body.amount > 1e12) return 'Amount must be a positive number.';
  if ((!partial || body.type !== undefined) && !['income','expense'].includes(body.type)) return 'Choose income or expense.';
  if ((!partial || body.category !== undefined) && !categories.includes(body.category)) return 'Choose a valid category.';
  if ((!partial || body.date !== undefined) && !validDate(body.date)) return 'Enter a valid date.';
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 500)) return 'Notes must be 500 characters or fewer.';
  return null;
}
router.get('/', async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (['income','expense'].includes(req.query.type)) filter.type = req.query.type;
    if (categories.includes(req.query.category)) filter.category = req.query.category;
    if (req.query.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month)) filter.date = { $regex: `^${req.query.month}` };
    if (req.query.search && String(req.query.search).trim()) filter.description = { $regex: String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    res.json(await Transaction.find(filter).sort({ date: -1, createdAt: -1 }).limit(1000));
  } catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
  try { const message = validateBody(req.body); if (message) return res.status(400).json({ message }); const data = Object.fromEntries(allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]])); const item = await Transaction.create({ ...data, user: req.user._id }); return res.status(201).json(item); }
  catch (error) { next(error); }
});
router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid transaction ID.' });
    const changes = Object.fromEntries(allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]]));
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'No valid fields provided.' });
    const message = validateBody(changes, true); if (message) return res.status(400).json({ message });
    const item = await Transaction.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, changes, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: 'Transaction not found.' }); return res.json(item);
  } catch (error) { next(error); }
});
router.delete('/:id', async (req, res, next) => {
  try { if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid transaction ID.' }); const item = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id }); if (!item) return res.status(404).json({ message: 'Transaction not found.' }); return res.json({ message: 'Transaction deleted.' }); }
  catch (error) { next(error); }
});
export default router;
