import mongoose, { Schema, Document } from 'mongoose';

export interface ITransactionData {
	planId: string;
	prvBalance: number;
	newBalance: number;
	amount: number;
	transactionType: string;
	transactionStatus: string;
}

export interface ITransaction extends Document {
	userId: string;
	traData: ITransactionData[];
}

const transactionDataSchema = new Schema<ITransactionData>(
	{
		planId: { type: String, required: true, trim: true },
		prvBalance: { type: Number, required: true },
		newBalance: { type: Number, required: true },
		amount: { type: Number, required: true },
		transactionType: { type: String, required: true, trim: true },
		transactionStatus: { type: String, required: true, trim: true },
	},
	{
		_id: false, 
	},
);

const transactionSchema = new Schema<ITransaction>(
	{
		userId: { type: String, required: true, trim: true, index: true },

		traData: { type: [transactionDataSchema], default: [] },
	},
	{ timestamps: true, versionKey: false },
);

export const Transactions = mongoose.model<ITransaction>('transactions', transactionSchema);
