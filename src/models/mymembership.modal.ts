import mongoose, { Schema, Document } from 'mongoose';
export interface DailyReward {
	day: number;
	rewards: number[];
}

interface IMyMembershipData {
	planId: string;
	amount: number;
	startDate: Date;
	endDate: Date;
	spins: number;
	isActive: boolean;
	totalRewards: DailyReward[];
}

interface IMyMembership extends Document {
	userId: string;
	totalSpins: number;
	myplans: IMyMembershipData[];
}

const myMembershipSchema = new Schema<IMyMembership>(
	{
		userId: { type: String, unique: true, required: true, trim: true },
		totalSpins: { type: Number, default: 0 },
		myplans: {
			type: [
				new Schema<IMyMembershipData>(
					{
						planId: { type: String, required: true, trim: true },
						amount: { type: Number, required: true },
						startDate: { type: Date, required: true },
						endDate: { type: Date, required: true },
						spins: { type: Number, required: true },
						isActive: { type: Boolean, default: true },
						totalRewards: { type: [new Schema<DailyReward>({ day: { type: Number, required: true }, rewards: { type: [Number], default: [] } }, { _id: false })], default: [] },
					},
					{ _id: false },
				),
			],
			default: [],
		},
	},
	{ timestamps: true, versionKey: false },
);

export const MyMemberships = mongoose.model<IMyMembership>('MyMemberships', myMembershipSchema);
