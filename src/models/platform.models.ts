import { Schema, model } from 'mongoose';

const membershipSchema = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		planId: { type: String, required: true },
		planName: { type: String, required: true },
		price: { type: Number, required: true, min: 0 },
		dailySpins: { type: Number, required: true, min: 1 },
		rewardMin: { type: Number, required: true, min: 0 },
		rewardMax: { type: Number, required: true, min: 0 },
		startsAt: { type: Date, required: true },
		expiresAt: { type: Date, required: true, index: true },
		status: { type: String, enum: ['active', 'expired'], default: 'active', index: true },
		earned: { type: Number, min: 0, default: 0 },
	},
	{ timestamps: true, versionKey: false },
);

const rewardScheduleSchema = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		membership: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
		planAmount: { type: Number, required: true, min: 0 },
		dayNumber: { type: Number, required: true, min: 1, max: 21 },
		spinNumber: { type: Number, required: true, min: 1 },
		scheduledDate: { type: Date, required: true, index: true },
		defaultValue: { type: Number, required: true, min: 0 },
		adminValue: { type: Number, default: null },
		finalValue: { type: Number, required: true, min: 0 },
		allowedValues: [{ type: Number, min: 0 }],
		source: { type: String, enum: ['system', 'admin'], default: 'system' },
		isAdminOverride: { type: Boolean, default: false },
		overrideReason: { type: String, trim: true, default: '' },
		status: { type: String, enum: ['pending', 'used', 'skipped', 'expired', 'locked'], default: 'pending', index: true },
		visibleToUser: { type: Boolean, default: false },
		usedAt: { type: Date, default: null },
		createdBy: { type: Schema.Types.Mixed, default: 'system' },
		updatedBy: { type: Schema.Types.Mixed, default: null },
		lockedAt: { type: Date, default: null },
		lockReason: { type: String, trim: true, default: '' },
	},
	{ timestamps: true, versionKey: false },
);
rewardScheduleSchema.index({ membership: 1, dayNumber: 1, spinNumber: 1 }, { unique: true });
rewardScheduleSchema.index({ user: 1, status: 1, scheduledDate: 1 });

const adminRewardAuditLogSchema = new Schema(
	{
		admin: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		membership: { type: Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
		scheduleSlot: { type: Schema.Types.ObjectId, ref: 'RewardSchedule', required: true, index: true },
		previousValue: { type: Number, required: true },
		newValue: { type: Number, required: true },
		action: { type: String, enum: ['update_value', 'bulk_update', 'lock_slot', 'unlock_slot', 'regenerate_schedule'], required: true, index: true },
		reason: { type: String, trim: true, default: '' },
		ipAddress: { type: String, trim: true, default: '' },
		deviceInfo: { type: String, trim: true, default: '' },
	},
	{ timestamps: true, versionKey: false },
);

const transactionSchema = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		type: { type: String, enum: ['deposit', 'membership', 'spin_reward', 'withdrawal', 'referral'], required: true, index: true },
		amount: { type: Number, required: true },
		status: { type: String, enum: ['pending', 'completed', 'processing', 'rejected'], default: 'completed', index: true },
		reference: { type: String, required: true, unique: true, index: true },
		description: { type: String, required: true },
		metadata: { type: Schema.Types.Mixed, default: {} },
	},
	{ timestamps: true, versionKey: false },
);
transactionSchema.index({ 'metadata.txHash': 1 }, { unique: true, sparse: true });

const spinSchema = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		membership: { type: Schema.Types.ObjectId, ref: 'Membership', required: true },
		rewardSchedule: { type: Schema.Types.ObjectId, ref: 'RewardSchedule', default: null, index: true },
		spinDate: { type: String, required: true },
		slot: { type: Number, required: true },
		reward: { type: Number, required: true, min: 0 },
	},
	{ timestamps: true, versionKey: false },
);
spinSchema.index({ user: 1, spinDate: 1, slot: 1 }, { unique: true });

const withdrawalSchema = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		amount: { type: Number, required: true, min: 100 },
		walletAddress: { type: String, required: true, trim: true },
		status: { type: String, enum: ['pending', 'processing', 'paid', 'rejected'], default: 'pending', index: true },
		adminNote: { type: String, trim: true, default: '' },
	},
	{ timestamps: true, versionKey: false },
);

const supportTicketSchema = new Schema(
	{
		user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		subject: { type: String, required: true, trim: true },
		message: { type: String, required: true, trim: true },
		status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open', index: true },
		adminReply: { type: String, trim: true, default: '' },
	},
	{ timestamps: true, versionKey: false },
);

const auditLogSchema = new Schema(
	{
		admin: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		action: { type: String, required: true, trim: true },
		module: { type: String, required: true, trim: true, index: true },
		targetId: { type: String, required: true, trim: true },
		details: { type: Schema.Types.Mixed, default: {} },
	},
	{ timestamps: true, versionKey: false },
);

export const Membership = model('Membership', membershipSchema);
export const RewardSchedule = model('RewardSchedule', rewardScheduleSchema);
export const AdminRewardAuditLog = model('AdminRewardAuditLog', adminRewardAuditLogSchema);
export const Transaction = model('Transaction', transactionSchema);
export const Spin = model('Spin', spinSchema);
export const Withdrawal = model('Withdrawal', withdrawalSchema);
export const SupportTicket = model('SupportTicket', supportTicketSchema);
export const AuditLog = model('AuditLog', auditLogSchema);
