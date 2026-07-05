import { Schema, model, type Document } from 'mongoose';

export interface IWithdrawal extends Document {
	userId: string;
	amount: number;
	ethAmount?: string;
	walletAddress: string;
	status: 'pending' | 'processing' | 'paid' | 'rejected';
	txHash?: string;
	adminNote?: string;
}

const withdrawalSchema = new Schema<IWithdrawal>(
	{
		userId: { type: String, required: true, trim: true, index: true },
		amount: { type: Number, required: true, min: 10000 },
		ethAmount: { type: String, trim: true, default: '' },
		walletAddress: { type: String, required: true, lowercase: true, trim: true },
		status: { type: String, enum: ['pending', 'processing', 'paid', 'rejected'], default: 'pending' },
		txHash: { type: String, trim: true, default: '' },
		adminNote: { type: String, trim: true, maxlength: 500, default: '' },
	},
	{ timestamps: true, versionKey: false },
);

export const Withdrawal = model<IWithdrawal>('Withdrawal', withdrawalSchema);
