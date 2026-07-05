import { Request, Response } from 'express';
import { MyMemberships } from '../../models/mymembership.modal.js';
import { Transactions } from '../../models/transactions.modal.js';
import { User } from '../../models/user.models.js';
import { MembershipPlan } from '../../models/plan.models.js';
import { Withdrawal } from '../../models/withdrawal.model.js';
import { SupportTicket } from '../../models/support.model.js';
import { todayRewards } from '../../models/todayRewards.model.js';
import { buyMembership } from '../membership/mambership.controller.js';
import { generatePlanRewards, getPlan, WHEEL_VALUES_PAISE } from '../../config/plans.js';
import type { ITransactionData } from '../../models/transactions.modal.js';
import RewardHistory from '../../models/rewards.modal.js';

export const walletStatusController = async (req: Request, res: Response) => {
	try {
		const userDoc = await User.findById(req.user?.id).lean();
		if (!userDoc) return res.status(404).json({ success: false, message: 'User not found' });

		return res.status(200).json({
			success: true,
			data: {
				walletAddress: userDoc.payoutWalletAddress ?? '',
				verified: Boolean(userDoc.payoutWalletAddress),
			},
		});
	} catch (error) {
		console.error('Error in walletStatusController:', error);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

const publicUser = (user: {
	_id: unknown;
	name: string;
	email: string;
	status: string;
	type: string;
	walletBalance: number;
	rewardBalance: number;
	withdrawableBalance: number;
	payoutWalletAddress?: string | null;
	referralCode?: string | null;
	createdAt: Date;
	updatedAt: Date;
}) => ({
	id: String(user._id),
	name: user.name,
	email: user.email,
	status: user.status,
	type: user.type,
	walletBalance: user.walletBalance,
	rewardBalance: user.rewardBalance,
	withdrawableBalance: user.withdrawableBalance,
	payoutWalletAddress: user.payoutWalletAddress ?? '',
	referralCode: user.referralCode,
	createdAt: user.createdAt,
	updatedAt: user.updatedAt,
});

type TransactionData = { planId: string; prvBalance: number; newBalance: number; amount: number; transactionType: string; transactionStatus: string };

function buildTransaction(
	tra: TransactionData,
	idx: number,
): {
	_id: string;
	type: string;
	amount: number;
	status: string;
	reference: string;
	description: string;
	createdAt: string;
	id?: string;
	planId?: string;
	prvBalance?: number;
	newBalance?: number;
} {
	const txType = tra.transactionType === 'membership_purchase' ? 'membership' : tra.transactionType;
	const amount = tra.amount;
	const description = txType === 'crypto_deposit'
		? `Deposit ${tra.planId.slice(0, 10)}...`
		: tra.planId
			? `Plan ${tra.planId}`
			: txType;
	return {
		_id: `tx-${idx}`,
		type: txType,
		amount,
		status: tra.transactionStatus,
		reference: `TXN${String(idx + 1).padStart(4, '0')}`,
		description,
		createdAt: new Date().toISOString(),
	};
}

export const getPlatformController = async (req: Request, res: Response) => {
	const { user } = req;
	if (!user) return res.status(401).json({ message: 'Authentication required' });

	try {
		const membership = await MyMemberships.findOne({ userId: user.id }).lean() ;
		const transactionsDoc = await Transactions.findOne({ userId: user.id }).lean();
		const userData = await User.findById(user.id).lean();
		const rewardsHistory = await RewardHistory.findOne({ userId: user.id }).lean();
		if (!userData) return res.status(404).json({ message: 'User not found' });

		const memberships: Array<{
			_id: string;
			planId: string;
			planName: string;
			price: number;
			dailySpins: number;
			rewardMin: number;
			rewardMax: number;
			startsAt: string;
			expiresAt: string;
			status: 'active' | 'expired';
			earned: number;
		}> = [];

		let todayRewardsArr: number[] = [];
		if (membership) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const rewards: number[] = [];

			for (const plan of membership.myplans) {
				if (!plan.isActive) continue;
				const startDate = new Date(plan.startDate);
				startDate.setHours(0, 0, 0, 0);
				const currentDay = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
				if (currentDay < 1 || currentDay > plan.totalRewards.length) continue;
				const dayReward = plan.totalRewards.find((r) => r.day === currentDay);
				if (dayReward) rewards.push(...dayReward.rewards);
			}

			// await todayRewards.findOneAndUpdate({ userId: user.id }, { userId: user.id, todayRewords: rewards }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
			// todayRewardsArr = rewards;

			for (const plan of membership.myplans) {
				const planConfig = getPlan(plan.planId);
				const now = new Date();
				const endDate = new Date(plan.endDate);
				const status: 'active' | 'expired' = plan.isActive && now < endDate ? 'active' : 'expired';
				const planEarned = plan.totalRewards.reduce((sum, day) => sum + day.rewards.reduce((s, r) => s + r, 0), 0);
				memberships.push({
					_id: `${user.id}-${plan.planId}-${plan.startDate.toISOString()}`,
					planId: plan.planId,
					planName: planConfig?.name ?? plan.planId,
					price: plan.amount,
					dailySpins: plan.spins,
					rewardMin: planConfig?.rewardMin ?? 0,
					rewardMax: planConfig?.rewardMax ?? 0,
					startsAt: plan.startDate.toISOString(),
					expiresAt: plan.endDate.toISOString(),
					status,
					earned: planEarned,
				});
			}
		}

		const rawTransactions = transactionsDoc?.traData ?? [];
		const transactions = rawTransactions.map((tra, idx) => buildTransaction(tra, idx));

		const activePlans = memberships.filter((m) => m.status === 'active').length;
		const dailySpins = memberships.reduce((sum, m) => sum + (m.status === 'active' ? m.dailySpins : 0), 0);
		const spinsUsedToday = Math.max(0, dailySpins - todayRewardsArr.length);
		const spinsRemaining = todayRewardsArr.length;
		const totalSpins = membership?.totalSpins ?? 0;
		const spinRewardTransactions = rawTransactions.filter((t) => t.transactionType === 'spin_reward');
		const totalRewards = spinRewardTransactions.reduce((sum, t) => sum + t.amount, 0);
		const highestReward = spinRewardTransactions.length > 0 ? Math.max(...spinRewardTransactions.map((t) => t.amount)) : 0;

		const referralUser = await User.findOne({ referredBy: user.id }).lean();
		const referrals = referralUser ? 1 : 0;

		return res
			.status(200)
			.json({
				success: true,
				data: {
					user: publicUser(userData as any) ?? {},
					memberships: memberships ?? [],
					transactions: transactions ?? [],
					rewardsHistory: rewardsHistory?.history?.reverse() ?? [],
					stats: { activePlans: activePlans ?? 0, dailySpins: dailySpins ?? 0, spinsUsedToday: spinsUsedToday ?? 0, spinsRemaining: spinsRemaining ?? 0, totalSpins: totalSpins ?? 0, totalRewards: totalRewards ?? 0, highestReward: highestReward ?? 0, referrals: referrals ?? 0 },
					platform: { wheelValues: WHEEL_VALUES_PAISE },
				},
			});
	} catch (error) {
		console.error('Error in getPlatformController:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

export const transactionsController = async (req: Request, res: Response) => {
	const { user } = req;
	if (!user) return res.status(401).json({ message: 'Authentication required' });

	try {
		const transactionsDoc = await Transactions.findOne({ userId: user.id }).lean();
		const rawTransactions = transactionsDoc?.traData ?? [];
		const txns = rawTransactions.map((tra, idx) => buildTransaction(tra, idx));
		return res.status(200).json({ success: true, data: { transactions: txns } });
	} catch (error) {
		console.error('Error in transactionsController:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

// export const spinController = async (req: Request, res: Response) => {
//   const { user } = req;
//   if (!user) return res.status(401).json({ message: "Authentication required" });

//   try {
//     const spins = await todayRewards.findOne({ userId: user.id });
//     if (!spins || spins.todayRewords.length === 0) {
//       return res.status(404).json({ success: false, message: "No spins available for today" });
//     }

//     const reward = spins.todayRewords.shift();
//     await spins.save();

//     const RewardHistory = (await import("../../models/rewards.modal.js")).default;
//     let rewardHistory = await RewardHistory.findOne({ userId: user.id });
//     const historyItem = { name: "Daily Spin", amount: reward!, type: "SPIN" };
//     if (!rewardHistory) {
//       rewardHistory = await RewardHistory.create({ userId: user.id, history: [historyItem] });
//     } else {
//       rewardHistory.history.push(historyItem);
//       await rewardHistory.save();
//     }

//     return res.status(200).json({ success: true, message: "Spin successful", data: { reward, spinsRemaining: spins.todayRewords.length } });
//   } catch (error) {
//     console.error("Error in spinController:", error);
//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

export const depositController = async (req: Request, res: Response) => {
	try {
		const { user } = req;
		if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

		const { transactionHash, senderAddress, receiverAddress, inrAmount, ethAmount, chainId, rate } = req.body;

		if (!transactionHash || !senderAddress || !inrAmount) {
			return res.status(400).json({ success: false, message: 'Missing required deposit fields' });
		}

		const existingTx = await Transactions.findOne({ userId: user.id, 'traData.planId': transactionHash });
		if (existingTx) {
			return res.status(400).json({ success: false, message: 'Transaction already processed' });
		}

		const userDoc = await User.findById(user.id);
		if (!userDoc) return res.status(404).json({ success: false, message: 'User not found' });

		const inr = Number(inrAmount);
		if (!Number.isFinite(inr) || inr < 100) {
			return res.status(400).json({ success: false, message: 'Minimum deposit is ₹100' });
		}

		const prvBalance = userDoc.walletBalance;
		const newBalance = prvBalance + inr;
		userDoc.walletBalance = newBalance;
		await userDoc.save();

		const depositEntry: ITransactionData = {
			planId: transactionHash,
			prvBalance,
			newBalance,
			amount: inr,
			transactionType: 'crypto_deposit',
			transactionStatus: 'completed',
		};

		const transactionsDoc = await Transactions.findOne({ userId: user.id });
		if (transactionsDoc) {
			transactionsDoc.traData.push(depositEntry);
			await transactionsDoc.save();
		} else {
			await Transactions.create({ userId: user.id, traData: [depositEntry] });
		}

		return res.status(201).json({ success: true, message: 'Deposit credited successfully' });
	} catch (error) {
		console.error('Error in depositController:', error);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};
export const purchaseMembershipController = async (req: Request, res: Response) => {
	const { user } = req;
	if (!user) return res.status(401).json({ message: 'Authentication required' });

	try {
		const { planId } = req.body;
		if (!planId) return res.status(400).json({ success: false, message: 'Plan ID is required' });

		(req as any).params = { membershipId: planId };
		await buyMembership(req as any, res);

		if (!res.headersSent) {
			return res.status(201).json({ success: true, message: 'Membership plan purchased successfully' });
		}
	} catch (error) {
		console.error('Error in purchaseMembershipController:', error);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const withdrawalController = async (req: Request, res: Response) => {
	const { user } = req;
	if (!user) return res.status(401).json({ message: 'Authentication required' });

	try {
		const { amount, walletAddress, ethAmount } = req.body;
		if (!amount || !walletAddress) return res.status(400).json({ success: false, message: 'Amount and wallet address are required' });

		const userDoc = await User.findById(user.id);
		if (!userDoc) return res.status(404).json({ success: false, message: 'User not found' });
		if (userDoc.walletBalance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });

		const withdrawal = await Withdrawal.create({ userId: user.id, amount, walletAddress, ethAmount: ethAmount || '', status: 'pending' });

		userDoc.walletBalance -= amount;
		await userDoc.save();

		const withdrawalEntry: ITransactionData = {
			planId: withdrawal._id.toString(),
			prvBalance: userDoc.walletBalance + amount,
			newBalance: userDoc.walletBalance,
			amount: -amount,
			transactionType: 'withdrawal',
			transactionStatus: 'pending',
		};

		const transactionsDoc = await Transactions.findOne({ userId: user.id });
		if (transactionsDoc) {
			transactionsDoc.traData.push(withdrawalEntry);
			await transactionsDoc.save();
		} else {
			await Transactions.create({ userId: user.id, traData: [withdrawalEntry] });
		}

		return res.status(201).json({ success: true, message: 'Withdrawal request submitted', data: { withdrawal } });
	} catch (error) {
		console.error('Error in withdrawalController:', error);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const profileController = async (req: Request, res: Response) => {
	const { user } = req;
	if (!user) return res.status(401).json({ message: 'Authentication required' });

	try {
		const { name, payoutWalletAddress } = req.body;
		const userDoc = await User.findById(user.id);
		if (!userDoc) return res.status(404).json({ success: false, message: 'User not found' });

		if (name) userDoc.name = name;
		if (payoutWalletAddress !== undefined) userDoc.payoutWalletAddress = payoutWalletAddress;
		await userDoc.save();

		return res.status(200).json({ success: true, message: 'Profile updated', data: { user: publicUser(userDoc as any) } });
	} catch (error) {
		console.error('Error in profileController:', error);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

export const userSupportListController = async (req: Request, res: Response) => {
	const { user } = req;
	if (!user) return res.status(401).json({ message: 'Authentication required' });

	try {
		const tickets = await SupportTicket.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
		return res.status(200).json({ success: true, data: { tickets } });
	} catch (error) {
		console.error('Error in userSupportListController:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

export const createSupportController = async (req: Request, res: Response) => {
	const { user } = req;
	if (!user) return res.status(401).json({ message: 'Authentication required' });

	try {
		const { subject, message } = req.body;
		if (!subject || !message) return res.status(400).json({ success: false, message: 'Subject and message are required' });

		const ticket = await SupportTicket.create({ userId: user.id, subject, message, status: 'open' });
		return res.status(201).json({ success: true, message: 'Support ticket created', data: { ticket } });
	} catch (error) {
		console.error('Error in createSupportController:', error);
		return res.status(500).json({ success: false, message: 'Internal server error' });
	}
};
