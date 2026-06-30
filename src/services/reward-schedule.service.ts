import crypto from 'node:crypto';
import { MEMBERSHIP_DAYS, WHEEL_VALUES } from '../config/plans.js';

const WHEEL_VALUE_SET = [...WHEEL_VALUES];
const WHEEL_MIN = Math.min(...WHEEL_VALUE_SET);
const WHEEL_MAX = Math.max(...WHEEL_VALUE_SET);

const createSeed = (value: string) => crypto.createHash('sha256').update(value).digest();

const nextSeedInt = (seed: Buffer, index: number) => seed[index % seed.length] ?? 0;

const weightedPick = (weights: Array<{ value: number; weight: number }>, seed: Buffer, index: number) => {
	const total = weights.reduce((sum, item) => sum + item.weight, 0);
	const pick = nextSeedInt(seed, index) % total;
	let cursor = 0;

	for (const item of weights) {
		cursor += item.weight;
		if (pick < cursor) return item.value;
	}

	return weights[weights.length - 1]?.value ?? 0;
};

const clampValue = (value: number) => Math.max(WHEEL_MIN, Math.min(WHEEL_MAX, value));

export const buildRewardSchedule = (params: { membershipId: string; userId: string; totalSlots: number; rewardMin: number; rewardMax: number; startsAt: Date }) => {
	const { membershipId, userId, totalSlots, rewardMin, rewardMax, startsAt } = params;
	const seed = createSeed(`${membershipId}:${userId}:${rewardMin}:${rewardMax}:${totalSlots}`);
	const minTarget = Math.round(rewardMin / 100);
	const maxTarget = Math.round(rewardMax / 100);
	const midpointTarget = Math.round((minTarget + maxTarget) / 2);
	const targetAverage = midpointTarget / totalSlots;

	const lowBand = [
		{ value: 0, weight: 8 },
		{ value: 35, weight: 36 },
		{ value: 50, weight: 18 },
		{ value: 55, weight: 16 },
		{ value: 76, weight: 10 },
		{ value: 114, weight: 8 },
		{ value: 230, weight: 4 },
	];
	const midBand = [
		{ value: 0, weight: 4 },
		{ value: 35, weight: 14 },
		{ value: 50, weight: 22 },
		{ value: 55, weight: 24 },
		{ value: 76, weight: 18 },
		{ value: 114, weight: 12 },
		{ value: 230, weight: 6 },
	];
	const highBand = [
		{ value: 0, weight: 2 },
		{ value: 35, weight: 8 },
		{ value: 50, weight: 16 },
		{ value: 55, weight: 18 },
		{ value: 76, weight: 22 },
		{ value: 114, weight: 22 },
		{ value: 230, weight: 12 },
	];

	const band = targetAverage < 45 ? lowBand : targetAverage < 75 ? midBand : highBand;
	const slots = Array.from({ length: totalSlots }, (_, index) => {
		const jitter = nextSeedInt(seed, index + 11) % 5;
		const base = weightedPick(band, seed, index + jitter);
		return clampValue(base);
	});

	let total = slots.reduce((sum, value) => sum + value, 0);

	const increaseSteps = [0, 35, 50, 55, 76, 114, 230];
	const decreaseSteps = [...increaseSteps].reverse();

	const upgradeSlot = (value: number) => {
		const index = increaseSteps.indexOf(value);
		return increaseSteps[Math.min(increaseSteps.length - 1, index + 1)];
	};
	const downgradeSlot = (value: number) => {
		const index = decreaseSteps.indexOf(value);
		return decreaseSteps[Math.min(decreaseSteps.length - 1, index + 1)];
	};

	const raiseTotal = () => {
		let changed = true;
		while (total < minTarget && changed) {
			changed = false;
			for (let index = slots.length - 1; index >= 0 && total < minTarget; index -= 1) {
				const current = slots[index] ?? 0;
				const upgraded = upgradeSlot(current);
				if (upgraded !== current) {
					total += upgraded - current;
					slots[index] = upgraded;
					changed = true;
				}
			}
		}
	};

	const lowerTotal = () => {
		let changed = true;
		while (total > maxTarget && changed) {
			changed = false;
			for (let index = 0; index < slots.length && total > maxTarget; index += 1) {
				const current = slots[index] ?? 0;
				const downgraded = downgradeSlot(current);
				if (downgraded !== current) {
					total -= current - downgraded;
					slots[index] = downgraded;
					changed = true;
				}
			}
		}
	};

	if (total < minTarget) raiseTotal();
	if (total > maxTarget) lowerTotal();
	if (total < minTarget) raiseTotal();

	const values = slots.map((value) => value * 100);
	const schedule = values.map((defaultValue, index) => {
		const dayNumber = Math.floor(index / Math.max(1, totalSlots / MEMBERSHIP_DAYS)) + 1;
		const spinNumber = (index % Math.max(1, totalSlots / MEMBERSHIP_DAYS)) + 1;
		const scheduledDate = new Date(startsAt.getTime() + (dayNumber - 1) * 24 * 60 * 60 * 1000);

		return {
			dayNumber: Math.min(MEMBERSHIP_DAYS, dayNumber),
			spinNumber,
			scheduledDate,
			defaultValue,
			adminValue: null,
			finalValue: defaultValue,
			allowedValues: WHEEL_VALUES.map((value) => value * 100),
			source: 'system' as const,
			isAdminOverride: false,
			overrideReason: '',
			status: 'pending' as const,
			visibleToUser: false,
			usedAt: null,
		};
	});

	return { values, total: values.reduce((sum, value) => sum + value, 0), schedule };
};

export const pickNextRewardValue = (params: { remainingSlots: number; remainingMin: number; remainingMax: number; seed: string }) => {
	const { remainingSlots, remainingMin, remainingMax, seed } = params;
	const seedBytes = createSeed(seed);
	const averageTarget = Math.round((remainingMin + remainingMax) / 2 / Math.max(1, remainingSlots));
	const ranked = [...WHEEL_VALUE_SET].sort((left, right) => Math.abs(right - averageTarget) - Math.abs(left - averageTarget));

	for (const candidate of ranked) {
		const maxFuture = (remainingSlots - 1) * WHEEL_MAX;
		if (candidate <= remainingMax && candidate + maxFuture >= remainingMin) {
			return candidate;
		}
	}

	return WHEEL_VALUE_SET[nextSeedInt(seedBytes, 0) % WHEEL_VALUE_SET.length] ?? 0;
};

export const resolveScheduleValue = (defaultValue: number, adminValue?: number | null) => adminValue ?? defaultValue;
