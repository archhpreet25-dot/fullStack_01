import { Router } from 'express';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import { requireAuth } from '../middleware/authMiddleware.js';
const router = Router();
router.use(requireAuth);
const validMonth = month => typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
router.get('/:month', async (req, res, next) => {
  try {
    const { month } = req.params; if (!validMonth(month)) return res.status(400).json({ message: 'Month must use YYYY-MM format.' });
    const [budget, totals] = await Promise.all([
      Budget.findOne({ user: req.user._id, month }),
      Transaction.aggregate([{ $match: { user: req.user._id, type: 'expense', date: { $regex: `^${month}` } } }, { $group: { _id: null, spent: { $sum: '$amount' }, count: { $sum: 1 } } }])
    ]);
    const income = await Transaction.aggregate([{ $match: { user: req.user._id, type: 'income', date: { $regex: `^${month}` } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    return res.json({ month, amount: budget?.amount ?? 0, spent: totals[0]?.spent ?? 0, expenseCount: totals[0]?.count ?? 0, income: income[0]?.total ?? 0 });
  } catch (error) { next(error); }
});
router.put('/:month', async (req, res, next) => {
  try { const { month } = req.params; const amount = req.body.amount; if (!validMonth(month)) return res.status(400).json({ message: 'Month must use YYYY-MM format.' }); if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1e12) return res.status(400).json({ message: 'Budget must be a positive number.' }); const budget = await Budget.findOneAndUpdate({ user: req.user._id, month }, { amount }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }); return res.json(budget); }
  catch (error) { next(error); }
});
router.delete('/:month', async (req, res, next) => {
  try { if (!validMonth(req.params.month)) return res.status(400).json({ message: 'Month must use YYYY-MM format.' }); await Budget.findOneAndDelete({ user: req.user._id, month: req.params.month }); return res.json({ message: 'Budget removed.' }); }
  catch (error) { next(error); }
});
export default router;
