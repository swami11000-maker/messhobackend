import { MyMemberships } from '../models/mymembership.modal.js';
import { User } from '../models/user.models.js';
import { Transactions } from '../models/transactions.modal.js';

export const checkExpiredMemberships = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(
      `[Membership Scheduler] Checking memberships at ${today.toISOString()}`
    );

    const memberships = await MyMemberships.find({
      'myplans.isActive': true,
    });

    for (const membership of memberships) {
      let updated = false;

      for (const plan of membership.myplans) {
        if (!plan.isActive) continue;

        const endDate = new Date(plan.endDate);
        endDate.setHours(0, 0, 0, 0);

        // Expire plan
        if (today >= endDate) {
          plan.isActive = false;

          membership.totalSpins = Math.max(
            0,
            membership.totalSpins - plan.spins
          );

          updated = true;

          // Move ONLY this expired membership's 21-day spin earnings
          // from rewardBalance to walletBalance (not the user's total rewardBalance)
          const earned = plan.rewardEarned || 0;
          if (earned > 0) {
            const userDoc = await User.findById(membership.userId);
            if (userDoc) {
              const transfer = Math.min(earned, userDoc.rewardBalance);

              const prevWallet = userDoc.walletBalance;
              userDoc.walletBalance += transfer;
              userDoc.rewardBalance -= transfer;
              await userDoc.save();

              const transactionData = {
                planId: plan.planId,
                prvBalance: prevWallet,
                newBalance: userDoc.walletBalance,
                amount: transfer,
                transactionType: 'membership_reward_credit',
                transactionStatus: 'credited',
              };

              const findTransaction = await Transactions.findOne({ userId: membership.userId });
              if (!findTransaction) {
                await Transactions.create({ userId: membership.userId, traData: [transactionData] });
              } else {
                findTransaction.traData.push(transactionData);
                await findTransaction.save();
              }

              console.log(
                `Credited => User:${membership.userId} | Plan:${plan.planId} | Amount:${transfer}`
              );
            }
          }

          console.log(
            `Expired => User:${membership.userId} | Plan:${plan.planId}`
          );
        }
      }

      if (updated) {
        await membership.save();
      }
    }

    console.log('[Membership Scheduler] Completed');
  } catch (err) {
    console.error('[Membership Scheduler]', err);
  }
};

export const startMembershipScheduler = () => {
  console.log('Membership Scheduler Started');

  // Server start hote hi ek baar check
  checkExpiredMemberships();

  // Har 1 minute check karega
  setInterval(async () => {
    const now = new Date();

    // Sirf 12:00 AM par expire check karega
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      await checkExpiredMemberships();
    }
  }, 60 * 1000);
};