import { Schema, model, type HydratedDocument, Types } from 'mongoose';

export interface UserData {
	name: string;
	email: string;
	password: string;
	status: 'active' | 'inactive' | 'suspended';
	type: 'admin' | 'user';
	walletBalance: number;
	rewardBalance: number;
	withdrawableBalance: number;
	payoutWalletAddress?: string;
	referralCode?: string;
	referredBy?: Types.ObjectId | null;
	passwordResetToken?: string;
	passwordResetExpires?: Date;
}

const userSchema = new Schema(
	{
		name: { type: String, required: true, trim: true, maxlength: 100 },
		email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
		password: { type: String, required: true, select: false },
		status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
		type: { type: String, enum: ['admin', 'user'], default: 'user' },
		walletBalance: { type: Number, min: 0, default: 0 },
		rewardBalance: { type: Number, min: 0, default: 0 },
		withdrawableBalance: { type: Number, min: 0, default: 0 },
		payoutWalletAddress: { type: String, lowercase: true, trim: true, default: undefined },
		referralCode: { type: String, unique: true, sparse: true, index: true },
		referredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
		passwordResetToken: { type: String, select: false },
		passwordResetExpires: { type: Date, select: false },
	},
	{ timestamps: true, versionKey: false },
);

export type UserDocument = HydratedDocument<UserData>;

export const User = model('User', userSchema);
