import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import routes from './routes/route.js';
import { MembershipPlan } from './models/plan.models.js';
import { MEMBERSHIP_PLANS } from './config/plans.js';
import { connectDB } from './config/dbCon.js';
export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin:env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_req, res) => {
	res.json({ success: true, message: 'SpinGold API is healthy' });
});
async function seedPlans() {
  try {
   connectDB();

    // Delete existing documents
    await MembershipPlan.deleteMany({});

    await MembershipPlan.insertMany(MEMBERSHIP_PLANS);

    console.log('✅ Membership plans seeded successfully');

    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed membership plans:', error);

    process.exit(1);
  }
}
seedPlans();
app.use('/api', routes);

app.use((_req, res) => {
	res.status(404).json({ success: false, message: 'Route not found' });
});

// app.use(errorHandler);
