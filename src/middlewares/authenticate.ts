import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.models.js';
import { ApiError } from '../utils/api-error.js';

interface JwtPayload {
	sub: string;
	email: string;
	type: 'admin' | 'user';
	iat: number;
	exp: number;
}

declare global {
	namespace Express {
		interface Request {
			user?: { id: string; role: 'admin' | 'user'; type: 'admin' | 'user'; email: string };
		}
	}
}

const extractTokenFromCookie = (cookieHeader?: string): string | null => {
	if (!cookieHeader) return null;

	const tokenCookie = cookieHeader
		.split(';')
		.map((part) => part.trim())
		.find((part) => part.startsWith('token='));

	return tokenCookie ? tokenCookie.split('=')[1] : null;
};

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
	try {
		// Extract token from Authorization header or Cookie
		const authHeader = req.headers.authorization;
		const cookieHeader = req.headers.cookie;

		let token: string | null = null;
		let scheme: string | null = null;

		if (authHeader) {
			const parts = authHeader.trim().split(/\s+/);
			scheme = parts[0];
			token = parts[1] || null;
		}

		// Fallback to cookie if no Authorization header
		if (!token) {
			token = extractTokenFromCookie(cookieHeader);
			scheme = 'bearer'; // Default for cookie-based auth
		}

		// Validate token presence and scheme
		if (!token || scheme?.toLowerCase() !== 'bearer') {
			throw new ApiError(401, 'Authentication token required');
		}

		// Verify JWT
		let decoded: JwtPayload;
		try {
			decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError) {
				throw new ApiError(401, 'Authentication token expired');
			}
			if (error instanceof jwt.JsonWebTokenError) {
				throw new ApiError(401, 'Invalid authentication token');
			}
			throw error;
		}

		// Validate payload structure
		if (!decoded.sub || !decoded.email || !['admin', 'user'].includes(decoded.type)) {
			throw new ApiError(401, 'Invalid token structure');
		}

		// Fetch and validate user
		const user = await User.findById(decoded.sub).select('email type status');
		if (!user) {
			throw new ApiError(404, 'User not found');
		}

		if (user.status !== 'active') {
			throw new ApiError(403, 'Account is inactive');
		}

		// Optional: Verify user type matches token (extra security)
		if (user.type !== decoded.type) {
			throw new ApiError(401, 'Authentication required');
		}

		// Attach user to request
		req.user = { id: user.id, role: user.type, type: user.type, email: user.email };

		next();
	} catch (error) {
		// Ensure all errors are properly handled
		if (error instanceof ApiError) {
			next(error);
		} else {
			next(new ApiError(500, 'Authentication service error'));
		}
	}
};

export const adminMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
	if (!req.user) {
		next(new ApiError(401, 'Authentication required'));
		return;
	}

	if (req.user.role !== 'admin') {
		next(new ApiError(403, 'Administrator access required'));
		return;
	}

	next();
};
