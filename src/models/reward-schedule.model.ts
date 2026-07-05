import { Schema, model, type Document } from 'mongoose';

export interface IRewardSlot {
	slotId: string;
	dayNumber: number;
	spinNumber: number;
	scheduledDate: Date;
	defaultValue: number;
	adminValue: number | null;
	finalValue: number;
	adminOverride: boolean;
	overrideReason: string;
	status: 'pending' | 'used' | 'skipped' | 'expired' | 'locked';
	lockedAt: Date | null;
	lockReason: string;
}

export interface IRewardSchedule extends Document {
	userId: string;
	membershipId: string;
	membershipName: string;
	planId: string;
	startDate: Date;
	endDate: Date;
	earned: number;
	slots: IRewardSlot[];
}

const rewardSlotSchema = new Schema<IRewardSlot>(
	{
		slotId: { type: String, required: true, unique: true },
		dayNumber: { type: Number, required: true },
		spinNumber: { type: Number, required: true },
		scheduledDate: { type: Date, required: true },
		defaultValue: { type: Number, required: true },
		adminValue: { type: Number, default: null },
		finalValue: { type: Number, required: true },
		adminOverride: { type: Boolean, default: false },
		overrideReason: { type: String, trim: true, maxlength: 200, default: '' },
		status: { type: String, enum: ['pending', 'used', 'skipped', 'expired', 'locked'], default: 'pending' },
		lockedAt: { type: Date, default: null },
		lockReason: { type: String, trim: true, maxlength: 200, default: '' },
	},
	{ _id: false },
);

const rewardScheduleSchema = new Schema<IRewardSchedule>(
	{
		userId: { type: String, required: true, trim: true, index: true },
		membershipId: { type: String, required: true, trim: true, index: true },
		membershipName: { type: String, required: true, trim: true },
		planId: { type: String, required: true, trim: true },
		startDate: { type: Date, required: true },
		endDate: { type: Date, required: true },
		earned: { type: Number, default: 0 },
		slots: { type: [rewardSlotSchema], default: [] },
	},
	{ timestamps: true, versionKey: false },
);

rewardScheduleSchema.index({ userId: 1, membershipId: 1 }, { unique: true });

export const RewardSchedule = model<IRewardSchedule>('RewardSchedule', rewardScheduleSchema);
