import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export const isEmailConfigured = () => Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);

export const sendPasswordResetEmail = async (email: string, resetUrl: string) => {
	if (!isEmailConfigured()) {
		throw new Error('SMTP is not configured');
	}

	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		secure: env.SMTP_SECURE,
		auth: {
			user: env.SMTP_USER,
			pass: env.SMTP_PASSWORD,
		},
	});

	await transporter.sendMail({
		from: env.MAIL_FROM,
		to: email,
		subject: 'Reset your SpinGold password',
		text: `Use this link within 15 minutes to reset your password: ${resetUrl}`,
		html: `<p>Use the link below within 15 minutes to reset your SpinGold password.</p><p><a href="${resetUrl}">Reset password</a></p>`,
	});
};
