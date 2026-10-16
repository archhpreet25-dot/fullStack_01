import mongoose from 'mongoose';
const budgetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  amount: { type: Number, required: true, min: 0.01, max: 1e12 }
}, { timestamps: true, versionKey: false });
budgetSchema.index({ user: 1, month: 1 }, { unique: true });
export default mongoose.model('Budget', budgetSchema);
