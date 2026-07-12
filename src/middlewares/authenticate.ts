import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.models.js';
import { ApiError } from '../utils/api-error.js';
import { getBearerToken } from '../utils/helperFunctions.js';

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

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
	try {
		// Extract token from Authorization header or Cookie
		const token = getBearerToken(req.headers.authorization);
		// console.log('tokennnn=>>>	',token)
		const BearerToken = token?.startsWith('Bearer');
		// console.log('ttttt ====>>>>>>>>>>>',BearerToken)
		if (!token) {
			throw new ApiError(401, 'Auth error');
		}
		let decoded: JwtPayload;
		try {
			decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
			console.log(decoded)
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError) {
				throw new ApiError(401, 'Authentication token expired');
			}
			if (error instanceof jwt.JsonWebTokenError) {
				throw new ApiError(401, `Invalid authentication token`);
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
