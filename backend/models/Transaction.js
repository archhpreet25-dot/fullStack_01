import mongoose from 'mongoose';
export const categories = ['Food','Transport','Shopping','Bills','Entertainment','Health','Education','Salary','Freelance','Investment','Other'];
const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 100 },
  amount: { type: Number, required: true, min: 0.01, max: 1e12 },
  type: { type: String, enum: ['income','expense'], required: true },
  category: { type: String, enum: categories, required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  notes: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true, versionKey: false });
transactionSchema.index({ user: 1, date: -1 });
export default mongoose.model('Transaction', transactionSchema);
