import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.models.js';
import { ApiError } from '../utils/api-error.js';

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
	try {
		console.log('Headers:', req.headers);
		console.log('Authorization:', req.headers.authorization);
		console.log('Cookie:', req.headers.cookie);
		const authHeader = req.headers.authorization;
		const cookieHeader = req.headers.cookie;
		const cookieToken = cookieHeader
			?.split(';')
			.map((part) => part.trim())
			.find((part) => part.startsWith('token='))
			?.slice('token='.length);

		if (!authHeader && !cookieToken) {
			throw new ApiError(401, 'Authentication required');
		}

		const token = authHeader ? authHeader.trim().split(/\s+/)[1] : cookieToken;
		const scheme = authHeader ? authHeader.trim().split(/\s+/)[0] : 'bearer';

		if (scheme?.toLowerCase() !== 'bearer' || !token) throw new ApiError(401, 'Authentication required');

		const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
		if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.email !== 'string' || (decoded.type !== 'admin' && decoded.type !== 'user')) {
			throw new ApiError(401, 'Authentication required');
		}

		const user = await User.findById(decoded.sub).select('email type status');
		if (!user) {
			throw new ApiError(404, 'User not found');
		}

		if (user.status !== 'active') {
			throw new ApiError(403, 'This account is not active');
		}

		if (user.type !== decoded.type) {
			throw new ApiError(401, 'Authentication required');
		}

		req.user = { id: user.id, role: user.type, type: user.type, email: user.email };

		next();
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
			next(new ApiError(401, 'Authentication required'));
			return;
		}

		next(error);
	}
};

export const adminMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
	if (req.user?.role !== 'admin') {
		next(new ApiError(403, 'Administrator access required'));
		return;
	}

	next();
};
