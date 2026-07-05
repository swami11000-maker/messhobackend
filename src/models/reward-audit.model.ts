import { Schema, model, type Document } from 'mongoose';

export interface IRewardAudit extends Document {
	rewardScheduleId: string;
	adminId: string;
	adminName: string;
	adminEmail: string;
	action: string;
	slotId?: string;
	previousValue?: number;
	newValue?: number;
	reason: string;
	bulkMode?: string;
}

const rewardAuditSchema = new Schema<IRewardAudit>(
	{
		rewardScheduleId: { type: String, required: true, trim: true, index: true },
		adminId: { type: String, required: true, trim: true },
		adminName: { type: String, required: true, trim: true },
		adminEmail: { type: String, required: true, trim: true, lowercase: true },
		action: { type: String, required: true, trim: true },
		slotId: { type: String, trim: true, default: '' },
		previousValue: { type: Number, default: null },
		newValue: { type: Number, default: null },
		reason: { type: String, trim: true, maxlength: 200, default: '' },
		bulkMode: { type: String, trim: true, default: '' },
	},
	{ timestamps: true, versionKey: false },
);

export const RewardAudit = model<IRewardAudit>('RewardAudit', rewardAuditSchema);
