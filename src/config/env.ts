import dotenv from 'dotenv';

dotenv.config();

const mongodbUri = process.env.MONGODB_URL ?? process.env.MONGODB_URL;
if (!mongodbUri) {
  throw new Error('Missing environment variable: MONGODB_URL');
}

if (!process.env.JWT_SECRET) {
  throw new Error('Missing environment variable: JWT_SECRET');
}

export const env = {
  PORT: Number(process.env.PORT ?? 5000),
  MONGODB_URL: mongodbUri,
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL?.trim().toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  INITIAL_WALLET_BALANCE: Number(process.env.INITIAL_WALLET_BALANCE ?? 0),
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  MAIL_FROM: process.env.MAIL_FROM ?? 'SpinGold <no-reply@spingold.local>',
};
