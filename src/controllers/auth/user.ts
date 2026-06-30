import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { User } from '../../models/user.models.js';
import { isEmailConfigured, sendPasswordResetEmail } from '../../services/email.js';

class HttpError extends Error {
	constructor(
		public statusCode: number,
		message: string,
	) {
		super(message);
	}
}

type PublicUserSource = {
	id: string;
	name: string;
	email: string;
	status: 'active' | 'inactive' | 'suspended';
	type: 'admin' | 'user';
	walletBalance: number;
	rewardBalance: number;
	withdrawableBalance: number;
	payoutWalletAddress?: string | null;
	referralCode?: string | null;
	createdAt: Date;
	updatedAt: Date;
};

const createAccessToken = (user: Pick<PublicUserSource, 'id' | 'email' | 'type'>) =>
	jwt.sign({ sub: user.id, email: user.email, type: user.type }, env.JWT_SECRET, { expiresIn: '7d' });

const publicUser = (user: PublicUserSource) => ({
	id: user.id,
	name: user.name,
	email: user.email,
	status: user.status,
	type: user.type,
	walletBalance: user.walletBalance,
	rewardBalance: user.rewardBalance,
	withdrawableBalance: user.withdrawableBalance ?? 0,
	payoutWalletAddress: user.payoutWalletAddress ?? '',
	referralCode: user.referralCode,
	createdAt: user.createdAt,
	updatedAt: user.updatedAt,
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { name, email, password, referralCode: submittedReferralCode } = req.body;

		if (await User.exists({ email })) {
			throw new HttpError(409, 'An account with this email already exists');
		}

		const referralCode = `${name
			.replace(/[^a-z0-9]/gi, '')
			.slice(0, 8)
			.toLowerCase()}${crypto.randomBytes(3).toString('hex')}`;
		const referrer = submittedReferralCode ? await User.findOne({ referralCode: submittedReferralCode, type: 'user', status: 'active' }).select('_id') : null;
		if (submittedReferralCode && !referrer) {
			throw new HttpError(400, 'Referral code is invalid');
		}
		const user = await User.create({
			name,
			email,
			password: await bcrypt.hash(password, 12),
			referralCode,
			referredBy: referrer?._id ?? null,
			type: 'user',
			walletBalance: env.NODE_ENV === 'development' ? Math.max(0, Math.round(env.INITIAL_WALLET_BALANCE * 100)) : 0,
		});

		res.status(201).json({ success: true, message: 'Registration successful', accessToken: createAccessToken(user), user: publicUser(user) });
	} catch (error) {
		next(error);
	}
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { email, password } = req.body;
		const user = await User.findOne({ email }).select('+password');

		if (!user || !(await bcrypt.compare(password, user.password))) {
			throw new HttpError(401, 'Invalid email or password');
		}

		if (user.status !== 'active') {
			throw new HttpError(403, 'This account is not active');
		}

		res.status(200).json({ success: true, message: 'Login successful', accessToken: createAccessToken(user), user: publicUser(user) });
	} catch (error) {
		next(error);
	}
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
	try {
		if (env.NODE_ENV === 'production' && !isEmailConfigured()) {
			throw new HttpError(503, 'Password reset email service is not configured');
		}
		const user = await User.findOne({ email: req.body.email }).select('+passwordResetToken +passwordResetExpires');

		let resetToken: string | undefined;

		if (user) {
			resetToken = crypto.randomBytes(32).toString('hex');
			user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
			user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
			await user.save();
			if (env.NODE_ENV === 'production') {
				await sendPasswordResetEmail(user.email, `${env.FRONTEND_URL}/reset-password?token=${resetToken}`);
			}
		}

		const data = env.NODE_ENV === 'development' && resetToken ? { resetToken, resetUrl: `${env.FRONTEND_URL}/reset-password?token=${resetToken}` } : undefined;

		res.status(200).json({ success: true, message: 'If that email is registered, password reset instructions have been generated', ...(data && { data }) });
	} catch (error) {
		next(error);
	}
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');

		const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } }).select('+password +passwordResetToken +passwordResetExpires');

		if (!user) {
			throw new HttpError(400, 'Reset token is invalid or has expired');
		}

		user.password = await bcrypt.hash(req.body.password, 12);
		user.passwordResetToken = undefined;
		user.passwordResetExpires = undefined;
		await user.save();

		res.status(200).json({ success: true, message: 'Password reset successful' });
	} catch (error) {
		next(error);
	}
};

export { HttpError };

export const getUserDetail = async (req: Request, res: Response, next: NextFunction) => {
	try {
		if (!req.user) {
			throw new HttpError(401, 'Authentication required');
		}

		const user = await User.findById(req.user.id);

		if (!user) {
			throw new HttpError(404, 'User not found');
		}

		res.status(200).json({ success: true, data: { user: publicUser(user as unknown as PublicUserSource) } });
	} catch (error) {
		next(error);
	}
};
