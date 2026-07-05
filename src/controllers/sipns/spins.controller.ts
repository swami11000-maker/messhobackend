import { Request, Response } from 'express';
import { todayRewards } from '../../models/todayRewards.model.js';
import RewardHistory from '../../models/rewards.modal.js';

export const clickSpin = async (req: Request, res: Response) => {
	try {
		const { user } = req;

		if (!user) {
			return res.status(401).json({ message: 'Authentication required' });
		}

		const spins = await todayRewards.findOne({ userId: user.id });

		if (!spins || spins.todayRewords.length === 0) {
			return res.status(404).json({
				message: 'No spins available for today',
			});
		}

		// First reward
		const reward = spins.todayRewords[0];

		// Reward History
		let rewardHistory = await RewardHistory.findOne({
			userId: user.id,
		});

		const historyItem = {
			name: 'Daily Spin',
			amount: reward,
			type: 'SPIN',
		};

		if (!rewardHistory) {
			await RewardHistory.create({
				userId: user.id,
				history: [historyItem],
			});
		} else {
			rewardHistory.history.push(historyItem);
			await rewardHistory.save();
		}

		// Remove first reward from array
		await todayRewards.updateOne(
			{ userId: user.id },
			{
				$set: {
					todayRewords: spins.todayRewords.slice(1),
				},
			}
		);

		return res.status(200).json({
			success: true,
			message: 'Spin successful',
			data: {
				reward,
				spinsRemaining: spins.todayRewords.length - 1,
			},
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({
			message: 'Internal server error',
		});
	}
};