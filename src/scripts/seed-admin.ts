import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/user.models.js';

if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12) {
	throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (minimum 12 characters) before seeding');
}

await mongoose.connect(env.MONGODB_URI);

const password = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
const existing = await User.findOne({ email: env.ADMIN_EMAIL }).select('+password');

if (existing) {
	existing.type = 'admin';
	existing.status = 'active';
	existing.password = password;
	await existing.save();
	console.log(`Updated admin account: ${env.ADMIN_EMAIL}`);
} else {
	await User.create({
		name: 'SpinGold Admin',
		email: env.ADMIN_EMAIL,
		password,
		type: 'admin',
		status: 'active',
		referralCode: `admin${crypto.randomBytes(4).toString('hex')}`,
	});
	console.log(`Created admin account: ${env.ADMIN_EMAIL}`);
}

await mongoose.disconnect();
