import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
	try {
		await mongoose.connect(env.MONGODB_URL);
		console.log('Connected to MongoDB');
	} catch (error) {
		console.error('Error connecting to MongoDB:', error);
		process.exit(1);
	}
};
