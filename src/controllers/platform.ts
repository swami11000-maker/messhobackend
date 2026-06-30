import crypto from 'node:crypto';
import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { Membership, RewardSchedule, Spin, SupportTicket, Transaction, Withdrawal } from '../models/platform.models.js';
import { User } from '../models/user.models.js';
import { HttpError } from './auth/user.js';
import { MEMBERSHIP_DAYS, MEMBERSHIP_PLANS, WHEEL_VALUES_PAISE, getPlan } from '../config/plans.js';
import { buildRewardSchedule, resolveScheduleValue } from '../services/reward-schedule.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = () => new Date();

const reference = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const today = () => new Date().toISOString().slice(0, 10);
const requireUser = (req: Request) => {
	if (!req.user) throw new HttpError(401, 'Authentication required');
	return req.user;
};

const toPlanResponse = (plan: (typeof MEMBERSHIP_PLANS)[number]) => ({
	id: plan.id,
	name: plan.name,
	price: plan.price / 100,
	dailySpins: plan.dailySpins,
	totalDays: MEMBERSHIP_DAYS,
	totalSpins: plan.dailySpins * MEMBERSHIP_DAYS,
	rewardMin: plan.rewardMin / 100,
	rewardMax: plan.rewardMax / 100,
});

const expireMemberships = async (userId: string) => {
	const memberships = await Membership.find({ user: userId, status: 'active', expiresAt: { $lte: now() } });
	if (!memberships.length) return;

	for (const membership of memberships) {
		await Promise.all([
			Membership.updateOne({ _id: membership.id, status: 'active' }, { $set: { status: 'expired' } }),
			RewardSchedule.updateMany({ membership: membership.id, status: 'pending' }, { $set: { status: 'expired' } }),
		]);
	}

	const unlocked = memberships.reduce((sum, membership) => sum + membership.earned, 0);
	if (unlocked > 0) {
		await User.updateOne({ _id: userId }, { $inc: { withdrawableBalance: unlocked } });
	}
};

export const getPlans = (_req: Request, res: Response) => {
	res.json({ success: true, data: { plans: MEMBERSHIP_PLANS.map(toPlanResponse), wheelValues: WHEEL_VALUES_PAISE } });
};

export const getOverview = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const auth = requireUser(req);
		await expireMemberships(auth.id);
		const [user, memberships, transactions, spinsToday, spinStats, referrals] = await Promise.all([
			User.findById(auth.id),
			Membership.find({ user: auth.id }).sort({ createdAt: -1 }),
			Transaction.find({ user: auth.id }).sort({ createdAt: -1 }).limit(10),
			Spin.countDocuments({ user: auth.id, spinDate: today() }),
			Spin.aggregate([
				{ $match: { user: new mongoose.Types.ObjectId(auth.id) } },
				{ $group: { _id: null, totalSpins: { $sum: 1 }, totalRewards: { $sum: '$reward' }, highestReward: { $max: '$reward' } } },
			]),
			User.countDocuments({ referredBy: auth.id }),
		]);
		if (!user) throw new HttpError(404, 'User not found');

		const active = memberships.filter((membership) => membership.status === 'active');
		const dailySpins = active.reduce((sum, membership) => sum + membership.dailySpins, 0);
		res.json({
			success: true,
			data: {
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
					type: user.type,
					status: user.status,
					walletBalance: user.walletBalance,
					rewardBalance: user.rewardBalance,
					withdrawableBalance: user.withdrawableBalance ?? 0,
					payoutWalletAddress: user.payoutWalletAddress ?? '',
					referralCode: user.referralCode,
				},
				memberships,
				transactions,
				stats: {
					activePlans: active.length,
					dailySpins,
					spinsUsedToday: spinsToday,
					spinsRemaining: Math.max(0, dailySpins - spinsToday),
					totalSpins: spinStats[0]?.totalSpins ?? 0,
					totalRewards: spinStats[0]?.totalRewards ?? 0,
					highestReward: spinStats[0]?.highestReward ?? 0,
					referrals,
				},
				platform: { wheelValues: WHEEL_VALUES_PAISE },
			},
		});
	} catch (error) {
		next(error);
	}
};

export const listTransactions = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const auth = requireUser(req);
		const transactions = await Transaction.find({ user: auth.id }).sort({ createdAt: -1 }).limit(100);
		res.json({ success: true, data: { transactions } });
	} catch (error) {
		next(error);
	}
};

export const listMemberships = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const auth = requireUser(req);
		await expireMemberships(auth.id);
		const memberships = await Membership.find({ user: auth.id }).sort({ createdAt: -1 });
		res.json({ success: true, data: { memberships } });
	} catch (error) {
		next(error);
	}
};

export const purchaseMembership = async (req: Request, res: Response, next: NextFunction) => {
	let membershipId: string | undefined;
	let referralCredited = false;
	let referralReward = 0;
	let referrerId: string | undefined;
	try {
		const auth = requireUser(req);
		const plan = getPlan(req.body.planId);
		if (!plan) throw new HttpError(404, 'Membership plan not found');

		const user = await User.findOneAndUpdate({ _id: auth.id, walletBalance: { $gte: plan.price } }, { $inc: { walletBalance: -plan.price } }, { new: true });
		if (!user) throw new HttpError(400, 'Insufficient wallet balance');

		try {
			const startsAt = new Date();
			const membership = await Membership.create({
				user: auth.id,
				planId: plan.id,
				planName: plan.name,
				price: plan.price,
				dailySpins: plan.dailySpins,
				rewardMin: plan.rewardMin,
				rewardMax: plan.rewardMax,
				startsAt,
				expiresAt: new Date(startsAt.getTime() + MEMBERSHIP_DAYS * DAY_MS),
			});
			membershipId = membership.id;
			const schedule = buildRewardSchedule({
				membershipId: membership.id,
				userId: auth.id,
				totalSlots: plan.dailySpins * MEMBERSHIP_DAYS,
				rewardMin: plan.rewardMin,
				rewardMax: plan.rewardMax,
				startsAt,
			});
			await RewardSchedule.insertMany(schedule.schedule.map((slot) => ({ ...slot, user: auth.id, membership: membership.id, planAmount: plan.price })));
			await Transaction.create({
				user: auth.id,
				type: 'membership',
				amount: -plan.price,
				status: 'completed',
				reference: reference('MEM'),
				description: `${plan.name} membership purchased`,
				metadata: { membershipId: membership.id, planId: plan.id },
			});
			const buyer = await User.findById(auth.id).select('referredBy');
			if (buyer?.referredBy) {
				referralReward = Math.round(plan.price * 0.05);
				referrerId = buyer.referredBy.toString();
				await User.updateOne({ _id: buyer.referredBy }, { $inc: { rewardBalance: referralReward, withdrawableBalance: referralReward } });
				referralCredited = true;
				await Transaction.create({
					user: buyer.referredBy,
					type: 'referral',
					amount: referralReward,
					status: 'completed',
					reference: reference('REF'),
					description: `Referral bonus from ${plan.name} membership`,
					metadata: { referredUserId: auth.id, membershipId: membership.id },
				});
			}
			res.status(201).json({ success: true, message: 'Membership purchased successfully', data: { membership, walletBalance: user.walletBalance } });
		} catch (error) {
			if (membershipId) {
				await Promise.all([
					Membership.deleteOne({ _id: membershipId }),
					RewardSchedule.deleteMany({ membership: membershipId }),
					Transaction.deleteMany({ 'metadata.membershipId': membershipId }),
				]);
			}
			if (referralCredited && referrerId) {
				await User.updateOne({ _id: referrerId }, { $inc: { rewardBalance: -referralReward, withdrawableBalance: -referralReward } });
			}
			await User.updateOne({ _id: auth.id }, { $inc: { walletBalance: plan.price } });
			throw error;
		}
	} catch (error) {
		next(error);
	}
};

export const spin = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const auth = requireUser(req);
		await expireMemberships(auth.id);
		const activeMemberships = await Membership.find({ user: auth.id, status: 'active' }).sort({ expiresAt: 1, createdAt: 1 });
		const dailyLimit = activeMemberships.reduce((sum, membership) => sum + membership.dailySpins, 0);
		if (!dailyLimit) throw new HttpError(400, 'Buy an active membership before spinning');

		const slot = await RewardSchedule.findOneAndUpdate(
			{ user: auth.id, status: 'pending', scheduledDate: { $lte: now() } },
			{ $set: { status: 'locked' } },
			{ sort: { scheduledDate: 1, dayNumber: 1, spinNumber: 1 }, new: false },
		);
		if (!slot) {
			throw new HttpError(429, 'No available spins right now. Please come back when the next slot unlocks.');
		}

		const membership = await Membership.findOne({ _id: slot.membership, user: auth.id, status: 'active' });
		if (!membership) {
			await RewardSchedule.updateOne({ _id: slot.id, status: 'locked' }, { $set: { status: 'expired' } });
			throw new HttpError(409, 'This membership is no longer active');
		}

		const reward = resolveScheduleValue(slot.defaultValue, slot.adminValue);
		const remainingSlots = await RewardSchedule.countDocuments({ user: auth.id, status: 'pending', scheduledDate: { $lte: now() } });
		const projectedTotal = membership.earned + reward;
		if (projectedTotal > membership.rewardMax) {
			await RewardSchedule.updateOne({ _id: slot.id, status: 'locked' }, { $set: { status: 'pending' } });
			throw new HttpError(409, 'This spin would exceed the configured reward range');
		}

		let createdSpinId: string | undefined;
		let userCredited = false;
		let membershipCredited = false;
		try {
			const createdSpin = await Spin.create({ user: auth.id, membership: membership.id, rewardSchedule: slot.id, spinDate: today(), slot: slot.spinNumber, reward });
			createdSpinId = createdSpin.id;
			await RewardSchedule.updateOne({ _id: slot.id, status: 'locked' }, { $set: { status: 'used', usedAt: now(), finalValue: reward } });
			await User.updateOne({ _id: auth.id }, { $inc: { rewardBalance: reward } });
			userCredited = true;
			await Membership.updateOne({ _id: membership.id }, { $inc: { earned: reward } });
			membershipCredited = true;
			await Transaction.create({
				user: auth.id,
				type: 'spin_reward',
				amount: reward,
				status: 'completed',
				reference: reference('SPIN'),
				description: 'Daily spin reward',
				metadata: { spinId: createdSpin.id, membershipId: membership.id },
			});
		} catch (error: unknown) {
			if (createdSpinId) {
				await Promise.all([Spin.deleteOne({ _id: createdSpinId }), Transaction.deleteMany({ 'metadata.spinId': createdSpinId })]);
			}
			if (userCredited) await User.updateOne({ _id: auth.id }, { $inc: { rewardBalance: -reward } });
			if (membershipCredited) await Membership.updateOne({ _id: membership.id }, { $inc: { earned: -reward } });
			if (slot?._id) await RewardSchedule.updateOne({ _id: slot._id, status: 'locked' }, { $set: { status: 'pending', usedAt: null } });
			console.log(error);																																																																																																																																																																																			
			
			if ((error as { code?: number }).code === 11000) throw new HttpError(409, 'This spin slot has already been used');
			throw error;
		}

		res.json({
			success: true,
			message: reward ? `You won ₹${(reward / 100).toLocaleString('en-IN')}!` : 'No reward this time. Try again tomorrow!',
			data: { reward, spinsRemaining: remainingSlots, scheduleSlotId: slot.id, finalValue: reward },
		});
	} catch (error) {
		next(error);
	}
};

export const requestWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const auth = requireUser(req);
		const { amount, walletAddress } = req.body;
		const user = await User.findOneAndUpdate(
			{ _id: auth.id, rewardBalance: { $gte: amount }, withdrawableBalance: { $gte: amount } },
			{ $inc: { rewardBalance: -amount, withdrawableBalance: -amount }, $set: { payoutWalletAddress: walletAddress } },
			{ new: true },
		);
		if (!user) throw new HttpError(400, 'Insufficient withdrawable balance. Membership rewards unlock after expiry.');

		let withdrawalId: string | undefined;
		try {
			const withdrawal = await Withdrawal.create({ user: auth.id, amount, walletAddress });
			withdrawalId = withdrawal.id;
			await Transaction.create({
				user: auth.id,
				type: 'withdrawal',
				amount: -amount,
				status: 'pending',
				reference: reference('WDR'),
				description: 'Withdrawal request submitted',
				metadata: { withdrawalId: withdrawal.id },
			});
			res.status(201).json({ success: true, message: 'Withdrawal request submitted', data: { withdrawal, rewardBalance: user.rewardBalance } });
		} catch (error) {
			if (withdrawalId) {
				await Promise.all([Withdrawal.deleteOne({ _id: withdrawalId }), Transaction.deleteMany({ 'metadata.withdrawalId': withdrawalId })]);
			}
			await User.updateOne({ _id: auth.id }, { $inc: { rewardBalance: amount, withdrawableBalance: amount } });
			throw error;
		}
	} catch (error) {
		next(error);
	}
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const auth = requireUser(req);
		const payoutWalletAddress = req.body.payoutWalletAddress ?? '';
		const update = { name: req.body.name, payoutWalletAddress: payoutWalletAddress || undefined };
		const user = await User.findByIdAndUpdate(auth.id, { $set: update }, { new: true, runValidators: true });
		if (!user) throw new HttpError(404, 'User not found');
		res.json({ success: true, message: 'Profile updated', data: { user: { name: user.name, email: user.email, payoutWalletAddress: user.payoutWalletAddress ?? '' } } });
	} catch (error) {
		next(error);
	}
};

export const createSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const auth = requireUser(req);
		const ticket = await SupportTicket.create({ user: auth.id, ...req.body });
		res.status(201).json({ success: true, message: 'Support ticket created', data: { ticket } });
	} catch (error) {
		next(error);
	}
};

export const listSupportTickets = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const auth = requireUser(req);
		const tickets = await SupportTicket.find({ user: auth.id }).sort({ createdAt: -1 }).limit(100);
		res.json({ success: true, data: { tickets } });
	} catch (error) {
		next(error);
	}
};
