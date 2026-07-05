import mongoose from 'mongoose';
import { Schema } from 'mongoose';

export interface ITodayrewords {
	userId: string;
	todayRewords: number[];
}

const todayRewords = new Schema<ITodayrewords>(
	{
		userId: { type: String, required: true, trim: true, index: true },

		todayRewords: { type: [], default: [] },
	},
	{ timestamps: true, versionKey: false },
);

export const todayRewards = mongoose.model<ITodayrewords>('todayRewards', todayRewords);