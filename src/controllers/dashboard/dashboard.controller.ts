import { Request, Response } from 'express';
import { MyMemberships } from '../../models/mymembership.modal.js';
import { todayRewards } from '../../models/todayRewards.model.js';
import RewardHistory from '../../models/rewards.modal.js';

export const dashboardController = async (req: Request, res: Response) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: 'Authentication required' });
		}

		const userId = req.user.id;

		const membership = await MyMemberships.findOne({ userId }).lean();

		if (!membership) {
			return res.status(404).json({ message: 'No membership found' });
		}

		const rewards: number[] = [];

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		for (const plan of membership.myplans) {
			if (!plan.isActive) continue;

			const startDate = new Date(plan.startDate);
			startDate.setHours(0, 0, 0, 0);

			const currentDay = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

			if (currentDay < 1 || currentDay > plan.totalRewards.length) {
				continue;
			}

			const todayReward = plan.totalRewards.find((reward) => reward.day === currentDay);

			if (todayReward) {
				rewards.push(...todayReward.rewards);
			}
		}

		// Save / Update today's rewards
		await todayRewards.findOneAndUpdate({ userId }, { userId, todayRewords: rewards }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });

		return res.status(200).json(rewards);
	} catch (error) {
		console.error('Error in dashboardController:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

export const getRewardsHistory = async (req: Request, res: Response) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: 'Authentication required' });
		}
		
		const userId = req.user.id;

		const rewardsHistory = await RewardHistory.findOne({ userId }).lean();

		if (!rewardsHistory) {
			return res.status(404).json({ message: 'No rewards history found' });
		}
		
		return res.status(200).json(rewardsHistory.history);
	}
	catch (error) {
		console.error('Error in getRewardsHistory:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
};