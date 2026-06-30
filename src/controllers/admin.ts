import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { AdminRewardAuditLog, AuditLog, Membership, RewardSchedule, SupportTicket, Withdrawal } from '../models/platform.models.js';
import { User } from '../models/user.models.js';
import { HttpError } from './auth/user.js';
import { MEMBERSHIP_DAYS, getPlan } from '../config/plans.js';
import { buildRewardSchedule, resolveScheduleValue } from '../services/reward-schedule.service.js';

const writeAudit = async (entry: { admin: string; action: string; module: string; targetId: string; details?: Record<string, unknown> }) => {
	try {
		await AuditLog.create(entry);
	} catch (error) {
		console.error('Failed to write admin audit log:', error);
	}
};

const writeRewardAudit = async (entry: {
	admin: string;
	user: string;
	membership: string;
	scheduleSlot: string;
	previousValue: number;
	newValue: number;
	action: 'update_value' | 'bulk_update' | 'lock_slot' | 'unlock_slot' | 'regenerate_schedule';
	reason?: string;
	ipAddress?: string;
	deviceInfo?: string;
}) => {
	try {
		await AdminRewardAuditLog.create({ ...entry, reason: entry.reason ?? '', ipAddress: entry.ipAddress ?? '', deviceInfo: entry.deviceInfo ?? '' });
	} catch (error) {
		console.error('Failed to write reward audit log:', error);
	}
};

const serializeScheduleSlot = (slot: {
	_id: unknown;
	user: unknown;
	membership: unknown;
	planAmount: number;
	dayNumber: number;
	spinNumber: number;
	scheduledDate: Date;
	defaultValue: number;
	adminValue?: number | null;
	finalValue: number;
	allowedValues?: number[];
	source: string;
	isAdminOverride: boolean;
	overrideReason?: string;
	status: string;
	visibleToUser: boolean;
	usedAt?: Date | null;
	lockedAt?: Date | null;
	lockReason?: string;
	createdAt: Date;
	updatedAt: Date;
}) => ({
	id: String(slot._id),
	user: String(slot.user),
	membership: String(slot.membership),
	planAmount: slot.planAmount,
	dayNumber: slot.dayNumber,
	spinNumber: slot.spinNumber,
	scheduledDate: slot.scheduledDate,
	defaultValue: slot.defaultValue,
	adminValue: slot.adminValue ?? null,
	finalValue: slot.finalValue,
	allowedValues: slot.allowedValues ?? [],
	source: slot.source,
	isAdminOverride: slot.isAdminOverride,
	overrideReason: slot.overrideReason ?? '',
	status: slot.status,
	visibleToUser: slot.visibleToUser,
	usedAt: slot.usedAt ?? null,
	lockedAt: slot.lockedAt ?? null,
	lockReason: slot.lockReason ?? '',
	createdAt: slot.createdAt,
	updatedAt: slot.updatedAt,
});

export const adminOverview = async (_req: Request, res: Response, next: NextFunction) => {
	try {
		const [users, activePlans, pendingWithdrawals, openTickets] = await Promise.all([
			User.countDocuments({ type: 'user' }),
			Membership.countDocuments({ status: 'active' }),
			Withdrawal.countDocuments({ status: { $in: ['pending', 'processing'] } }),
			SupportTicket.countDocuments({ status: { $ne: 'closed' } }),
		]);
		res.json({ success: true, data: { users, activePlans, pendingWithdrawals, openTickets } });
	} catch (error) {
		next(error);
	}
};

export const adminUsers = async (_req: Request, res: Response, next: NextFunction) => {
	try {
		const users = await User.find({ type: 'user' })
			.select('name email status walletBalance rewardBalance withdrawableBalance payoutWalletAddress createdAt')
			.sort({ createdAt: -1 })
			.limit(200);
		res.json({ success: true, data: { users } });
	} catch (error) {
		next(error);
	}
};

export const adminWithdrawals = async (_req: Request, res: Response, next: NextFunction) => {
	try {
		const withdrawals = await Withdrawal.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(200);
		res.json({ success: true, data: { withdrawals } });
	} catch (error) {
		next(error);
	}
};

export const updateWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const withdrawal = await Withdrawal.findOneAndUpdate(
			{ _id: req.params.id, status: { $nin: ['paid', 'rejected'] } },
			{ $set: { status: req.body.status, adminNote: req.body.adminNote ?? '' } },
			{ new: false },
		);
		if (!withdrawal) {
			if (await Withdrawal.exists({ _id: req.params.id })) throw new HttpError(409, 'Withdrawal has already been finalized');
			throw new HttpError(404, 'Withdrawal not found');
		}

		let refunded = false;
		try {
			if (req.body.status === 'rejected') {
				const refundResult = await User.updateOne({ _id: withdrawal.user }, { $inc: { rewardBalance: withdrawal.amount, withdrawableBalance: withdrawal.amount } });
				if (refundResult.matchedCount !== 1) throw new Error('Withdrawal user no longer exists');
				refunded = true;
			}
			const ledgerResult = await Transaction.updateOne(
				{ 'metadata.withdrawalId': withdrawal.id },
				{ $set: { status: req.body.status === 'paid' ? 'completed' : req.body.status } },
			);
			if (ledgerResult.matchedCount !== 1) throw new Error('Withdrawal ledger entry is missing');
		} catch (error) {
			if (refunded) {
				await User.updateOne({ _id: withdrawal.user }, { $inc: { rewardBalance: -withdrawal.amount, withdrawableBalance: -withdrawal.amount } });
			}
			await Withdrawal.updateOne({ _id: withdrawal.id, status: req.body.status }, { $set: { status: withdrawal.status, adminNote: withdrawal.adminNote } });
			throw error;
		}

		await writeAudit({ admin: req.user!.id, action: `Withdrawal ${req.body.status}`, module: 'withdrawals', targetId: withdrawal.id, details: { amount: withdrawal.amount } });
		const updated = await Withdrawal.findById(withdrawal.id);
		res.json({ success: true, message: 'Withdrawal updated', data: { withdrawal: updated } });
	} catch (error) {
		next(error);
	}
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const user = await User.findOneAndUpdate({ _id: req.params.id, type: 'user' }, { $set: { status: req.body.status } }, { new: true });
		if (!user) throw new HttpError(404, 'User not found');
		await writeAudit({ admin: req.user!.id, action: `User ${req.body.status}`, module: 'users', targetId: user.id, details: { email: user.email } });
		res.json({ success: true, message: 'User status updated', data: { user } });
	} catch (error) {
		next(error);
	}
};

export const adminSupportTickets = async (_req: Request, res: Response, next: NextFunction) => {
	try {
		const tickets = await SupportTicket.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(200);
		res.json({ success: true, data: { tickets } });
	} catch (error) {
		next(error);
	}
};

export const updateSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
		if (!ticket) throw new HttpError(404, 'Support ticket not found');
		await writeAudit({ admin: req.user!.id, action: `Ticket ${req.body.status}`, module: 'support', targetId: ticket.id });
		res.json({ success: true, message: 'Support ticket updated', data: { ticket } });
	} catch (error) {
		next(error);
	}
};

export const adminTreasury = async (_req: Request, res: Response, next: NextFunction) => {
	try {
		const [balances, paidWithdrawals, rewardLiability] = await Promise.all([
			User.aggregate([
				{ $match: { type: 'user' } },
				{ $group: { _id: null, wallet: { $sum: '$walletBalance' }, rewards: { $sum: '$rewardBalance' }, withdrawable: { $sum: '$withdrawableBalance' } } },
			]),
			Withdrawal.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
			Membership.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$rewardMax' } } }]),
		]);
		res.json({
			success: true,
			data: {
				userWallets: balances[0]?.wallet ?? 0,
				userRewards: balances[0]?.rewards ?? 0,
				withdrawableRewards: balances[0]?.withdrawable ?? 0,
				paidWithdrawals: paidWithdrawals[0]?.total ?? 0,
				projectedLiability: rewardLiability[0]?.total ?? 0,
			},
		});
	} catch (error) {
		next(error);
	}
};

export const adminAudit = async (_req: Request, res: Response, next: NextFunction) => {
	try {
		const logs = await AuditLog.find().populate('admin', 'name email').sort({ createdAt: -1 }).limit(200);
		res.json({ success: true, data: { logs } });
	} catch (error) {
		next(error);
	}
};

export const adminRewardSchedulesByUser = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const identifier = req.params.userId.trim();
		const user = mongoose.Types.ObjectId.isValid(identifier)
			? await User.findById(identifier).select('name email status type payoutWalletAddress createdAt updatedAt')
			: await User.findOne({
					$or: [
						{ email: identifier.toLowerCase() },
						{ payoutWalletAddress: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
						{ referralCode: identifier },
						{ name: new RegExp(identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
					],
				}).select('name email status type payoutWalletAddress createdAt updatedAt');
		if (!user) throw new HttpError(404, 'User not found');

		const [memberships, schedules] = await Promise.all([
			Membership.find({ user: user.id }).sort({ createdAt: -1 }),
			RewardSchedule.find({ user: user.id }).sort({ scheduledDate: 1, dayNumber: 1, spinNumber: 1 }),
		]);

		const grouped = memberships.map((membership) => ({
			...membership.toObject(),
			schedules: schedules.filter((slot) => slot.membership.toString() === membership.id).map(serializeScheduleSlot),
		}));

		res.json({ success: true, data: { user, memberships: grouped } });
	} catch (error) {
		next(error);
	}
};

export const adminRewardScheduleByMembership = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const membership = await Membership.findById(req.params.membershipId);
		if (!membership) throw new HttpError(404, 'Membership not found');

		const schedules = await RewardSchedule.find({ membership: membership.id }).sort({ scheduledDate: 1, dayNumber: 1, spinNumber: 1 });
		const summary = schedules.reduce(
			(acc, slot) => {
				acc.total += 1;
				if (slot.status === 'used') acc.used += 1;
				if (slot.status === 'pending') acc.pending += 1;
				if (slot.status === 'locked') acc.locked += 1;
				acc.finalTotal += slot.finalValue;
				return acc;
			},
			{ total: 0, used: 0, pending: 0, locked: 0, finalTotal: 0 },
		);

		res.json({ success: true, data: { membership, summary, schedules: schedules.map(serializeScheduleSlot) } });
	} catch (error) {
		next(error);
	}
};

export const updateRewardScheduleSlot = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const slot = await RewardSchedule.findById(req.params.slotId);
		if (!slot) throw new HttpError(404, 'Reward schedule slot not found');
		if (slot.status === 'used') throw new HttpError(409, 'Used slots cannot be modified');

		const adminValue = typeof req.body.adminValue === 'number' ? req.body.adminValue : null;
		const keepDefault = req.body.keepDefault === true;
		const previousValue = slot.finalValue;
		const nextValue = keepDefault ? slot.defaultValue : resolveScheduleValue(slot.defaultValue, adminValue);

		slot.adminValue = keepDefault ? null : adminValue;
		slot.finalValue = nextValue;
		slot.source = keepDefault || adminValue === null ? 'system' : 'admin';
		slot.isAdminOverride = !keepDefault && adminValue !== null && adminValue !== slot.defaultValue;
		slot.overrideReason = typeof req.body.reason === 'string' ? req.body.reason : slot.overrideReason;
		slot.updatedBy = req.user!.id;
		await slot.save();

		await writeRewardAudit({
			admin: req.user!.id,
			user: slot.user.toString(),
			membership: slot.membership.toString(),
			scheduleSlot: slot.id,
			previousValue,
			newValue: nextValue,
			action: 'update_value',
			reason: slot.overrideReason,
			ipAddress: req.ip ?? '',
			deviceInfo: req.headers['user-agent'] ?? '',
		});

		res.json({ success: true, message: 'Reward schedule updated', data: { slot: serializeScheduleSlot(slot) } });
	} catch (error) {
		next(error);
	}
};

export const bulkUpdateRewardSchedule = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const membership = await Membership.findById(req.params.membershipId);
		if (!membership) throw new HttpError(404, 'Membership not found');

		const mode = (req.body.mode ?? 'balanced') as 'zero' | 'low' | 'balanced' | 'jackpot';
		const templates: Record<'zero' | 'low' | 'balanced' | 'jackpot', number[]> = { zero: [0], low: [0, 35, 35, 50], balanced: [35, 50, 55, 76], jackpot: [114, 230, 76, 114] };
		const slots = await RewardSchedule.find({ membership: membership.id, status: { $in: ['pending', 'locked'] } }).sort({ scheduledDate: 1, dayNumber: 1, spinNumber: 1 });
		const template = templates[mode];
		const updates: string[] = [];

		for (const [index, slot] of slots.entries()) {
			const previousValue = slot.finalValue;
			const nextValue = template[index % template.length] * 100;
			slot.adminValue = nextValue;
			slot.finalValue = nextValue;
			slot.source = 'admin';
			slot.isAdminOverride = true;
			slot.overrideReason = req.body.reason ?? `bulk:${mode}`;
			slot.updatedBy = req.user!.id;
			await slot.save();
			updates.push(slot.id);

			await writeRewardAudit({
				admin: req.user!.id,
				user: slot.user.toString(),
				membership: slot.membership.toString(),
				scheduleSlot: slot.id,
				previousValue,
				newValue: nextValue,
				action: 'bulk_update',
				reason: slot.overrideReason,
				ipAddress: req.ip ?? '',
				deviceInfo: req.headers['user-agent'] ?? '',
			});
		}

		res.json({ success: true, message: `Bulk schedule update applied to ${updates.length} slots`, data: { updatedSlots: updates.length } });
	} catch (error) {
		next(error);
	}
};

export const regenerateRewardSchedule = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const membership = await Membership.findById(req.params.membershipId);
		if (!membership) throw new HttpError(404, 'Membership not found');

		const usedCount = await RewardSchedule.countDocuments({ membership: membership.id, status: 'used' });
		if (usedCount > 0) {
			throw new HttpError(409, 'Regeneration is only allowed before the membership has been used');
		}

		await RewardSchedule.deleteMany({ membership: membership.id });
		const plan = getPlan(membership.planId);
		if (!plan) throw new HttpError(404, 'Plan configuration not found');

		const schedule = buildRewardSchedule({
			membershipId: membership.id,
			userId: membership.user.toString(),
			totalSlots: membership.dailySpins * MEMBERSHIP_DAYS,
			rewardMin: membership.rewardMin,
			rewardMax: membership.rewardMax,
			startsAt: membership.startsAt,
		});

		const inserted = await RewardSchedule.insertMany(
			schedule.schedule.map((slot) => ({ ...slot, user: membership.user, membership: membership.id, planAmount: membership.price })),
		);

		await writeRewardAudit({
			admin: req.user!.id,
			user: membership.user.toString(),
			membership: membership.id,
			scheduleSlot: inserted[0]?.id ?? membership.id,
			previousValue: 0,
			newValue: schedule.total,
			action: 'regenerate_schedule',
			reason: req.body.reason ?? 'regenerate',
			ipAddress: req.ip ?? '',
			deviceInfo: req.headers['user-agent'] ?? '',
		});

		res.json({ success: true, message: 'Reward schedule regenerated', data: { totalReward: schedule.total } });
	} catch (error) {
		next(error);
	}
};

export const lockRewardScheduleSlot = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const slot = await RewardSchedule.findById(req.params.slotId);
		if (!slot) throw new HttpError(404, 'Reward schedule slot not found');

		const locked = req.body.locked !== false;
		slot.status = locked ? 'locked' : 'pending';
		slot.lockedAt = locked ? new Date() : null;
		slot.lockReason = req.body.reason ?? '';
		slot.updatedBy = req.user!.id;
		await slot.save();

		await writeRewardAudit({
			admin: req.user!.id,
			user: slot.user.toString(),
			membership: slot.membership.toString(),
			scheduleSlot: slot.id,
			previousValue: slot.finalValue,
			newValue: slot.finalValue,
			action: locked ? 'lock_slot' : 'unlock_slot',
			reason: slot.lockReason,
			ipAddress: req.ip ?? '',
			deviceInfo: req.headers['user-agent'] ?? '',
		});

		res.json({ success: true, message: locked ? 'Slot locked' : 'Slot unlocked', data: { slot: serializeScheduleSlot(slot) } });
	} catch (error) {
		next(error);
	}
};

export const adminRewardAudit = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const membershipId = req.params.membershipId;
		const logs = await AdminRewardAuditLog.find({ membership: membershipId }).populate('admin', 'name email').sort({ createdAt: -1 }).limit(200);
		res.json({ success: true, data: { logs } });
	} catch (error) {
		next(error);
	}
};
