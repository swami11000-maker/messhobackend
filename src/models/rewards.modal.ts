import { model, Schema, Document } from 'mongoose';

export interface HReward {
	name: string;
	amount: number;
	type: string;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface IReward extends Document {
	userId: string;
	history: HReward[];
}

const historySchema = new Schema<HReward>(
	{ name: { type: String, required: true, trim: true }, amount: { type: Number, required: true }, type: { type: String, required: true, trim: true } },
	{ _id: false, timestamps: true },
);

const rewardSchema = new Schema<IReward>(
	{ userId: { type: String, required: true, unique: true, index: true, trim: true }, history: { type: [historySchema], default: [] } },
	{ timestamps: true, versionKey: false },
);

const RewardHistory = model<IReward>('RewardHistory', rewardSchema);

export default RewardHistory;
