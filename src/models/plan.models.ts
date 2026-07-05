import mongoose, { model } from 'mongoose';

const membershipPlanSchema = new mongoose.Schema(
  {
    mid: { type: String, required: true, unique: true, trim: true },

    name: { type: String, required: true, unique: true, trim: true },

    slug: { type: String, required: true, unique: true, lowercase: true },

    category: { type: String, required: true },

    price: { type: Number, required: true },

    dailySpins: { type: Number, required: true },

    rewardMin: { type: Number, required: true },

    rewardMax: { type: Number, required: true },

    durationDays: { type: Number, default: 21 },

    features: [{ type: String }],

    isPopular: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true },

    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const MembershipPlan = model('MembershipPlan', membershipPlanSchema);
