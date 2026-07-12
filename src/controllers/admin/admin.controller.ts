import { Request, Response } from 'express';
import { User } from '../../models/user.models.js';
import { MyMemberships } from '../../models/mymembership.modal.js';
import { Withdrawal } from '../../models/withdrawal.model.js';
import { SupportTicket } from '../../models/support.model.js';
import { RewardAudit } from '../../models/reward-audit.model.js';
import { RewardSchedule } from '../../models/reward-schedule.model.js';
import { Transactions } from '../../models/transactions.modal.js';
import { generatePlanRewards, getPlan } from '../../config/plans.js';
import { sendEth } from '../../services/crypto.service.js';
import RewardHistory from '../../models/rewards.modal.js';
import { todayRewards } from '../../models/todayRewards.model.js';

export const adminOverviewController = async (req: Request, res: Response): Promise<void> => {
	try {
		const totalUsers = await User.countDocuments();
		const activePlans = await MyMemberships.countDocuments({ 'myplans.isActive': true });
		const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
		const openTickets = await SupportTicket.countDocuments({ status: 'open' });

		res.status(200).json({ success: true, data: { users: totalUsers, activePlans, pendingWithdrawals, openTickets } });
	} catch (error) {
		console.error('Error in adminOverviewController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const adminUsersController = async (req: Request, res: Response): Promise<void> => {
	try {
		const users = await User.find({ type: 'user' }).select('-password -passwordResetToken -passwordResetExpires').lean();
		res.status(200).json({ success: true, data: { users } });
	} catch (error) {
		console.error('Error in adminUsersController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const adminUserStatusController = async (req: Request, res: Response): Promise<void> => {
	try {
		const { userId } = req.params;
		const { status } = req.body as { status: string };
		const allowedStatuses: Array<'active' | 'inactive' | 'suspended'> = ['active', 'inactive', 'suspended'];
		if (!allowedStatuses.includes(status as 'active' | 'inactive' | 'suspended')) {
			res.status(400).json({ success: false, message: 'Invalid status' });
			return;
		}

		const user = await User.findById(userId);
		if (!user) {
			res.status(404).json({ success: false, message: 'User not found' });
			return;
		}

		user.status = status as 'active' | 'inactive' | 'suspended';
		await user.save();

		res.status(200).json({ success: true, message: `User status updated to ${status}` });
	} catch (error) {
		console.error('Error in adminUserStatusController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const adminWithdrawalsController = async (req: Request, res: Response): Promise<void> => {
	try {
		const withdrawals = await Withdrawal.find().sort({ createdAt: -1 }).lean();
		res.status(200).json({ success: true, data: { withdrawals } });
	} catch (error) {
		console.error('Error in adminWithdrawalsController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const adminWithdrawalReviewController = async (req: Request, res: Response): Promise<void> => {
	try {
		const { withdrawalId } = req.params;
		const { status, adminNote } = req.body as { status: string; adminNote?: string };
		const allowedStatuses: Array<'processing' | 'paid' | 'rejected'> = ['processing', 'paid', 'rejected'];
		if (!allowedStatuses.includes(status as 'processing' | 'paid' | 'rejected')) {
			res.status(400).json({ success: false, message: 'Invalid status' });
			return;
		}

		const withdrawal = await Withdrawal.findById(withdrawalId);
		if (!withdrawal) {
			res.status(404).json({ success: false, message: 'Withdrawal not found' });
			return;
		}

		withdrawal.status = status as 'processing' | 'paid' | 'rejected';
		if (adminNote) withdrawal.adminNote = adminNote;

		if (status === 'paid') {
			const ethAmount = withdrawal.ethAmount ? Number(withdrawal.ethAmount) : withdrawal.amount / 8416000;
			try {
				const txHash = await sendEth(withdrawal.walletAddress, ethAmount);
				withdrawal.txHash = txHash;
			} catch (error) {
				console.error('ETH send failed:', error);
				res.status(500).json({ success: false, message: 'Failed to send ETH. Verify treasury wallet configuration and try again.' });
				return;
			}
		}

		if (status === 'rejected') {
			const userDoc = await User.findById(withdrawal.userId);
			if (userDoc) {
				userDoc.walletBalance += withdrawal.amount;
				await userDoc.save();
			}
		}

		await withdrawal.save();

		if (status === 'paid' || status === 'rejected') {
			await Transactions.findOneAndUpdate(
				{ userId: withdrawal.userId, 'traData.planId': String(withdrawal._id) },
				{ $set: { 'traData.$.transactionStatus': status === 'paid' ? 'completed' : 'rejected' } },
			);
		}

		res.status(200).json({ success: true, message: `Withdrawal marked as ${status}`, data: { txHash: withdrawal.txHash } });
	} catch (error) {
		console.error('Error in adminWithdrawalReviewController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const adminTreasuryController = async (req: Request, res: Response): Promise<void> => {
	try {
		const userWallets = await User.aggregate([{ $group: { _id: null, total: { $sum: '$walletBalance' } } }]);
		const userRewards = await User.aggregate([{ $group: { _id: null, total: { $sum: '$rewardBalance' } } }]);
		const withdrawableRewards = await User.aggregate([{ $group: { _id: null, total: { $sum: '$withdrawableBalance' } } }]);
		const paidWithdrawals = await Withdrawal.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);

		res
			.status(200)
			.json({
				success: true,
				data: {
					userWallets: userWallets[0]?.total ?? 0,
					userRewards: userRewards[0]?.total ?? 0,
					withdrawableRewards: withdrawableRewards[0]?.total ?? 0,
					paidWithdrawals: paidWithdrawals[0]?.total ?? 0,
					projectedLiability: (withdrawableRewards[0]?.total ?? 0) + (paidWithdrawals[0]?.total ?? 0),
				},
			});
	} catch (error) {
		console.error('Error in adminTreasuryController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const adminAuditController = async (req: Request, res: Response): Promise<void> => {
	try {
		const logs = await RewardAudit.find().sort({ createdAt: -1 }).lean();
		res.status(200).json({ success: true, data: { logs } });
	} catch (error) {
		console.error('Error in adminAuditController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const adminSupportController = async (req: Request, res: Response): Promise<void> => {
	try {
		const tickets = await SupportTicket.find().sort({ createdAt: -1 }).lean();
		res.status(200).json({ success: true, data: { tickets } });
	} catch (error) {
		console.error('Error in adminSupportController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const adminSupportReviewController = async (req: Request, res: Response): Promise<void> => {
	try {
		const { ticketId } = req.params;
		const { status, adminReply } = req.body as { status: string; adminReply?: string };
		const allowedStatuses: Array<'open' | 'in_progress' | 'closed'> = ['open', 'in_progress', 'closed'];
		if (!allowedStatuses.includes(status as 'open' | 'in_progress' | 'closed')) {
			res.status(400).json({ success: false, message: 'Invalid status' });
			return;
		}

		const ticket = await SupportTicket.findById(ticketId);
		if (!ticket) {
			res.status(404).json({ success: false, message: 'Ticket not found' });
			return;
		}

		ticket.status = status as 'open' | 'in_progress' | 'closed';
		if (adminReply !== undefined) ticket.adminReply = adminReply;
		await ticket.save();

		res.status(200).json({ success: true, message: 'Ticket updated' });
	} catch (error) {
		console.error('Error in adminSupportReviewController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const rewardSchedulesUserController = async (req: Request, res: Response): Promise<void> => {
	try {
		const term = String(req.params.term || '')
			.trim()
			.toLowerCase();
		if (!term) {
			res.status(400).json({ success: false, message: 'Search term is required' });
			return;
		}

		const user = await User.findOne({ $or: [{ _id: term }, { email: term }, { payoutWalletAddress: term }, { referralCode: term }] }).lean();

		if (!user) {
			res.status(404).json({ success: false, message: 'User not found' });
			return;
		}

		const memberships = await MyMemberships.find({ userId: String(user._id) }).lean();
		const schedules = await RewardSchedule.find({ userId: String(user._id) }).lean();

		const rewardMemberships = memberships.map((ms) => {
			const schedule = schedules.find((s) => s.membershipId === ms.myplans[0]?.planId);
			const rewards =
				schedule?.slots.map((slot) => ({
					id: slot.slotId,
					dayNumber: slot.dayNumber,
					spinNumber: slot.spinNumber,
					scheduledDate: slot.scheduledDate,
					defaultValue: slot.defaultValue,
					adminValue: slot.adminValue,
					finalValue: slot.finalValue,
					allowedValues: [0, 35, 50, 55, 76, 114, 230],
					source: slot.adminOverride ? 'admin' : 'system',
					isAdminOverride: slot.adminOverride,
					overrideReason: slot.overrideReason,
					status: slot.status,
					visibleToUser: true,
					usedAt: null,
					lockedAt: slot.lockedAt ?? undefined,
					lockReason: slot.lockReason,
				})) ?? [];

			const planConfig = getPlan(ms.myplans[0]?.planId ?? '');
			return {
				_id: `${String(user._id)}-${ms.myplans[0]?.planId}`,
				planName: planConfig?.name ?? ms.myplans[0]?.planId ?? 'Unknown',
				planId: ms.myplans[0]?.planId ?? '',
				price: planConfig?.price ?? ms.myplans[0]?.amount ?? 0,
				dailySpins: planConfig?.dailySpins ?? ms.myplans[0]?.spins ?? 0,
				rewardMin: planConfig?.rewardMin ?? 0,
				rewardMax: planConfig?.rewardMax ?? 0,
				startsAt: ms.myplans[0]?.startDate,
				expiresAt: ms.myplans[0]?.endDate,
				status: ms.myplans[0]?.isActive ? 'active' : 'expired',
				earned: ms.myplans[0]?.totalRewards?.reduce((sum: number, d: any) => sum + d.rewards.reduce((s: number, r: number) => s + r, 0), 0) ?? 0,
				schedules: rewards,
			};
		});

		res
			.status(200)
			.json({
				success: true,
				data: {
					user: { _id: String(user._id), name: user.name, email: user.email, status: user.status, payoutWalletAddress: user.payoutWalletAddress, createdAt: user.createdAt },
					memberships: rewardMemberships,
				},
			});
	} catch (error) {
		console.error('Error in rewardSchedulesUserController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const rewardScheduleUpdateController = async (req: Request, res: Response): Promise<void> => {
	try {
		const { slotId } = req.params;
		const { adminValue, keepDefault, reason } = req.body as { adminValue?: number | null; keepDefault?: boolean; reason?: string };

		const schedule = await RewardSchedule.findOne({ 'slots.slotId': slotId });
		if (!schedule) {
			res.status(404).json({ success: false, message: 'Slot not found' });
			return;
		}

		const slot = schedule.slots.find((s) => s.slotId === slotId);
		if (!slot) {
			res.status(404).json({ success: false, message: 'Slot not found' });
			return;
		}

		if (slot.status === 'locked') {
			res.status(400).json({ success: false, message: 'This slot is locked' });
			return;
		}

		const previousValue = slot.finalValue;
		const newValue = keepDefault ? slot.defaultValue : (adminValue ?? slot.defaultValue);
		slot.finalValue = newValue;
		slot.adminOverride = !keepDefault && adminValue !== undefined && adminValue !== null;
		slot.overrideReason = reason ?? '';

		await schedule.save();

		res.status(200).json({ success: true, message: 'Slot updated', data: { slot: { ...slot, previousValue, newValue } } });
	} catch (error) {
		console.error('Error in rewardScheduleUpdateController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const rewardScheduleLockController = async (req: Request, res: Response): Promise<void> => {
	try {
		const { slotId } = req.params;
		const { locked, reason } = req.body as { locked: boolean; reason?: string };

		const schedule = await RewardSchedule.findOne({ 'slots.slotId': slotId });
		if (!schedule) {
			res.status(404).json({ success: false, message: 'Slot not found' });
			return;
		}

		const slot = schedule.slots.find((s) => s.slotId === slotId);
		if (!slot) {
			res.status(404).json({ success: false, message: 'Slot not found' });
			return;
		}

		slot.status = locked ? 'locked' : 'pending';
		slot.lockedAt = locked ? new Date() : null;
		slot.lockReason = reason ?? '';
		await schedule.save();

		res.status(200).json({ success: true, message: locked ? 'Slot locked' : 'Slot unlocked' });
	} catch (error) {
		console.error('Error in rewardScheduleLockController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const rewardScheduleBulkController = async (req: Request, res: Response): Promise<void> => {
	try {
		const { membershipId } = req.params;
		const { mode, reason } = req.body as { mode: string; reason?: string };

		const schedule = await RewardSchedule.findOne({ membershipId });
		if (!schedule) {
			res.status(404).json({ success: false, message: 'Schedule not found' });
			return;
		}

		const multiplier: Record<string, number> = { zero: 0, low: 0.4, balanced: 0.7, jackpot: 1.3 };

		for (const slot of schedule.slots) {
			if (slot.status === 'locked' || slot.status === 'used') continue;
			const baseValue = slot.defaultValue;
			const factor = multiplier[mode] ?? 1;
			let newValue = Math.round(baseValue * factor);
			if (newValue < 0) newValue = 0;
			slot.finalValue = newValue;
		}

		await schedule.save();

		res.status(200).json({ success: true, message: `Bulk update applied: ${mode}` });
	} catch (error) {
		console.error('Error in rewardScheduleBulkController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const rewardScheduleRegenerateController = async (req: Request, res: Response): Promise<void> => {
	try {
		const { membershipId } = req.params;
		const { reason } = req.body as { reason?: string };

		const schedule = await RewardSchedule.findOne({ membershipId });
		if (!schedule) {
			res.status(404).json({ success: false, message: 'Schedule not found' });
			return;
		}

		const planConfig = getPlan(schedule.planId);
		if (!planConfig) {
			res.status(400).json({ success: false, message: 'Plan configuration not found' });
			return;
		}

		const { dailyRewards } = generatePlanRewards(planConfig);
		const newSlots = schedule.slots.map((slot, dayIndex) => {
			const rewards = dayIndex < dailyRewards.length ? dailyRewards[dayIndex].rewards : [slot.defaultValue];
			const defaultVal = rewards[0] ?? 0;
			return { ...slot, defaultValue: defaultVal, finalValue: defaultVal, adminOverride: false, overrideReason: '', status: 'pending' as const, lockedAt: null, lockReason: '' };
		});

		schedule.slots = newSlots as any;
		schedule.earned = 0;
		await schedule.save();

		res.status(200).json({ success: true, message: 'Schedule regenerated' });
	} catch (error) {
		console.error('Error in rewardScheduleRegenerateController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const rewardAuditController = async (req: Request, res: Response): Promise<void> => {
	try {
		const { membershipId } = req.params;
		const logs = await RewardAudit.find({ rewardScheduleId: membershipId }).sort({ createdAt: -1 }).lean();
		res.status(200).json({ success: true, data: { logs } });
	} catch (error) {
		console.error('Error in rewardAuditController:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const adminGetUserDetail = async (req: Request, res: Response) => {
	const { userId } = req.params;
	if (!userId) {
		res.status(500).json({ success: false, message: 'Please send user Id' });
	}
	const user = await User.findById(userId);
	const memberships = await MyMemberships.findOne({userId : userId});
	const rewardHistory = await RewardHistory.findOne({userId : userId});
	const transactions = await Transactions.findOne({userId : userId});
	const todayrewards = await todayRewards.findOne({userId : userId});
	res.status(200).json({ success: true, data: { user, memberships, rewardHistory , transactions , todayrewards } });
};
