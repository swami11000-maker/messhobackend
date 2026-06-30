import { isAddress } from 'viem';
import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Invalid email address');
const password = z.string().min(8, 'Password must be at least 8 characters long').max(72, 'Password must be at most 72 characters long');
const walletAddress = z
	.string()
	.trim()
	.refine((value) => isAddress(value), 'Enter a valid EVM wallet address');

export const registerSchema = z.object({
	name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(100),
	email,
	password,
	referralCode: z.string().trim().min(3).max(50).optional(),
});

export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ token: z.string().min(1, 'Reset token is required'), password });

export const purchaseMembershipSchema = z.object({ planId: z.string().trim().min(1) });

export const withdrawalSchema = z.object({ amount: z.number().int().min(10000, 'Minimum withdrawal is ₹100').max(1_000_000_000, 'Maximum withdrawal is ₹1 crore'), walletAddress });

export const profileSchema = z.object({ name: z.string().trim().min(2).max(100), payoutWalletAddress: z.union([z.literal(''), walletAddress]).optional() });

export const supportSchema = z.object({ subject: z.string().trim().min(3).max(150), message: z.string().trim().min(10).max(3000) });

export const userStatusSchema = z.object({ status: z.enum(['active', 'suspended']) });

export const supportReviewSchema = z.object({ status: z.enum(['open', 'in_progress', 'closed']), adminReply: z.string().trim().max(2000).optional() });

export const withdrawalReviewSchema = z.object({ status: z.enum(['processing', 'paid', 'rejected']), adminNote: z.string().trim().max(500).optional() });

export const rewardScheduleUpdateSchema = z.object({
	adminValue: z.number().int().min(0).max(1_000_000).nullable().optional(),
	keepDefault: z.boolean().optional(),
	reason: z.string().trim().max(200).optional(),
});

export const rewardScheduleBulkSchema = z.object({ mode: z.enum(['zero', 'low', 'balanced', 'jackpot']).default('balanced'), reason: z.string().trim().max(200).optional() });

export const rewardScheduleLockSchema = z.object({ locked: z.boolean().default(true), reason: z.string().trim().max(200).optional() });
