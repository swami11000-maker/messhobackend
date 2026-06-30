export const MEMBERSHIP_DAYS = 21;

export type PlanConfig = {
	id: string;
	name: string;
	price: number;
	dailySpins: number;
	rewardMin: number;
	rewardMax: number;
};

export const WHEEL_VALUES = [0, 35, 50, 55, 76, 114, 230] as const;
export const WHEEL_VALUES_PAISE = WHEEL_VALUES.map((value) => value * 100);

export const MEMBERSHIP_PLANS: PlanConfig[] = [
	{ id: 'starter', name: 'Starter', price: 49900, dailySpins: 1, rewardMin: 65000, rewardMax: 75000 },
	{ id: 'basic', name: 'Basic', price: 99900, dailySpins: 1, rewardMin: 175000, rewardMax: 190000 },
	{ id: 'standard', name: 'Standard', price: 149900, dailySpins: 2, rewardMin: 280000, rewardMax: 300000 },
	{ id: 'advanced', name: 'Advanced', price: 199900, dailySpins: 3, rewardMin: 390000, rewardMax: 410000 },
	{ id: 'pro', name: 'Pro', price: 300000, dailySpins: 4, rewardMin: 600000, rewardMax: 630000 },
	{ id: 'elite', name: 'Elite', price: 500000, dailySpins: 6, rewardMin: 1050000, rewardMax: 1150000 },
	{ id: 'legend', name: 'Legend', price: 1000000, dailySpins: 13, rewardMin: 2100000, rewardMax: 2250000 },
];

export const getPlan = (planId: string) => MEMBERSHIP_PLANS.find((plan) => plan.id === planId) ?? null;
