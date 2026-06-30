import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
	await mongoose.connect(env.MONGODB_URI);
	console.log('Connected to MongoDB');
};
