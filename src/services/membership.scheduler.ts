import { MyMemberships } from '../models/mymembership.modal.js';

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