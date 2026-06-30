import type { NextFunction, Request, Response } from 'express';

type Entry = { count: number; resetAt: number };
const attempts = new Map<string, Entry>();

export const rateLimit = (limit: number, windowMs: number) => (req: Request, res: Response, next: NextFunction) => {
	const now = Date.now();
	if (attempts.size > 10_000) {
		for (const [key, entry] of attempts) {
			if (entry.resetAt <= now) attempts.delete(key);
		}
	}
	const key = `${req.ip}:${req.method}:${req.baseUrl}${req.path}`;
	const current = attempts.get(key);

	if (!current || current.resetAt <= now) {
		attempts.set(key, { count: 1, resetAt: now + windowMs });
		next();
		return;
	}

	if (current.count >= limit) {
		res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
		return;
	}

	current.count += 1;
	next();
};
