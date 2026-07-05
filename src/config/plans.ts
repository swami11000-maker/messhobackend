export const MEMBERSHIP_DAYS = 21;

export type PlanConfig = {
  mid: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  dailySpins: number;
  rewardMin: number;
  rewardMax: number;
  durationDays: number;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
};

export const WHEEL_VALUES = [0, 35, 50, 55, 76, 114, 230] as const;
export const WHEEL_VALUES_PAISE = WHEEL_VALUES.map((value) => value * 100);

export const MEMBERSHIP_PLANS: PlanConfig[] = [
  { mid: 'starter', name: 'Starter', slug: 'starter', category: 'membership', price: 49900, dailySpins: 1, rewardMin: 65000, rewardMax: 75000, durationDays: 21, features: [], isPopular: false, isActive: true, sortOrder: 1 },
  { mid: 'basic', name: 'Basic', slug: 'basic', category: 'membership', price: 99900, dailySpins: 1, rewardMin: 175000, rewardMax: 190000, durationDays: 21, features: [], isPopular: false, isActive: true, sortOrder: 2 },
  { mid: 'standard', name: 'Standard', slug: 'standard', category: 'membership', price: 149900, dailySpins: 2, rewardMin: 280000, rewardMax: 300000, durationDays: 21, features: [], isPopular: false, isActive: true, sortOrder: 3 },
  { mid: 'advanced', name: 'Advanced', slug: 'advanced', category: 'membership', price: 199900, dailySpins: 3, rewardMin: 390000, rewardMax: 410000, durationDays: 21, features: [], isPopular: false, isActive: true, sortOrder: 4 },
  { mid: 'pro', name: 'Pro', slug: 'pro', category: 'membership', price: 300000, dailySpins: 4, rewardMin: 600000, rewardMax: 630000, durationDays: 21, features: [], isPopular: false, isActive: true, sortOrder: 5 },
  { mid: 'elite', name: 'Elite', slug: 'elite', category: 'membership', price: 500000, dailySpins: 6, rewardMin: 1050000, rewardMax: 1150000, durationDays: 21, features: [], isPopular: false, isActive: true, sortOrder: 6 },
  { mid: 'legend', name: 'Legend', slug: 'legend', category: 'membership', price: 1000000, dailySpins: 13, rewardMin: 2100000, rewardMax: 2250000, durationDays: 21, features: [], isPopular: false, isActive: true, sortOrder: 7 },
];

export const getPlan = (planId: string) => MEMBERSHIP_PLANS.find((plan) => plan.mid === planId) ?? null;


export interface DailyReward {
  day: number;
  rewards: number[];
}

export function generatePlanRewards(plan: PlanConfig): {
  dailyRewards: DailyReward[];
  totalReward: number;
} {
  const min = plan.rewardMin / 100;
  const max = plan.rewardMax / 100;

  while (true) {
    const dailyRewards: DailyReward[] = [];
    let total = 0;

    for (let day = 1; day <= plan.durationDays; day++) {
      const rewards: number[] = [];

      for (let spin = 0; spin < plan.dailySpins; spin++) {
        const reward =
          WHEEL_VALUES[Math.floor(Math.random() * WHEEL_VALUES.length)];

        rewards.push(reward);
        total += reward;
      }

      dailyRewards.push({
        day,
        rewards,
      });
    }

    if (total >= min && total <= max) {
      return {
        dailyRewards,
        totalReward: total,
      };
    }
  }
}