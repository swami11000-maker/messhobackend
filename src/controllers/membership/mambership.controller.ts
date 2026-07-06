import { Request, Response } from 'express';
import { User } from '../../models/user.models.js';
import { MembershipPlan } from '../../models/plan.models.js';
import { MyMemberships } from '../../models/mymembership.modal.js';
import { generatePlanRewards, getPlan, MEMBERSHIP_DAYS } from '../../config/plans.js';
import { Transactions } from '../../models/transactions.modal.js';
import { todayRewards } from '../../models/todayRewards.model.js';

export const buyMembership = async (req: Request, res: Response) => {
	try {
		console.log('Request received for buying membership:', req);
		if (!req.user) {
			return res.status(401).json({ success:false, message: 'Authentication required' });
		}
		const id = req.user.id;
		const membershipId = String(req.params.membershipId);

		if (!membershipId) {
			return res.status(400).json({ success:false, message: 'Membership ID is required' });
		}
		const user = await User.findById(id);
		if (!user) {
			return res.status(404).json({ success:false, message: 'User not found' });
		}

		const fm = await MembershipPlan.findOne({ mid: membershipId });
		if (!fm) {
			return res.status(404).json({ success:false, message: 'MembershipPlan not found' });
		}

		if (user.walletBalance < fm.price) {
			return res.status(400).json({ success:false, message: 'Insufficient balance' });
		}

		user.walletBalance -= fm.price;
		await user.save();
		const starter = getPlan(membershipId)!;
		const rewards = generatePlanRewards(starter);

		// console.log(rewards);
		const findMembership = await MyMemberships.findOne({ userId: id });
		if (findMembership) {
			await MyMemberships.updateOne(
				{ userId: id },
				{
					$inc: { totalSpins: +fm.dailySpins },
					$push: {
						myplans: {
							planId: fm.mid,
							amount: fm.price,
							totalRewards: rewards.dailyRewards,
							startDate: new Date(),
							endDate: new Date(Date.now() + MEMBERSHIP_DAYS * 21 * 60 * 60 * 1000),
							spins: fm.dailySpins,
							isActive: true,
						},
					},
				},
			);
		} else {
			await MyMemberships.create({
				userId: id,
				totalSpins: fm.dailySpins,
				myplans: [
					{
						planId: fm.mid,
						amount: fm.price,
						startDate: new Date(),
						endDate: new Date(Date.now() + MEMBERSHIP_DAYS * 24 * 60 * 60 * 1000),
						totalRewards: rewards.dailyRewards,
						spins: fm.dailySpins,
						isActive: true,
					},
				],
			});
		}

		const transactionData = {
			planId: fm.mid,
			prvBalance: user.walletBalance + fm.price,
			newBalance: user.walletBalance,
			amount: fm.price,
			transactionType: 'membership_purchase',
			transactionStatus: 'debited',
		};
		const findTransaction = await Transactions.findOne({ userId: id });
		if (!findTransaction) {
			const newTransaction = new Transactions({ userId: id, traData: [transactionData] });
			await newTransaction.save();
			const saveTodayReward = await todayRewards.create({ userId: id, todayRewords: rewards.dailyRewards[0].rewards as any });

			if (!saveTodayReward) {
				return res.status(500).json({ success:false, message: 'Failed to save today reward' });
			}
		} else {
			findTransaction.traData.push(transactionData);
			const updatedTodayReward = await todayRewards.findOneAndUpdate(
				{ userId: id },
				{ $push: { todayRewords: { $each: rewards.dailyRewards[0].rewards } } },
				{ upsert: true, new: true },
			);
			await findTransaction.save();
		}

		return res.status(201).json({ success:true, message: 'MembershipPlan purchased successfully' });
	} catch (error) {
		console.error('Error purchasing membership:', error);
		return res.status(500).json({ success:false, message: 'Internal server error', error });
	}
};
