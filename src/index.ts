import { env } from './config/env.js';
import { connectDB } from './config/dbCon.js';
import { app } from './server.js';
import { MembershipPlan } from './models/plan.models.js';
import { MEMBERSHIP_PLANS } from './config/plans.js';
import { startMembershipScheduler } from './services/membership.scheduler.js';

const start = async () => {
	await connectDB();

	app.get('/', (req, res) => {
		res.json({ success: true, message: 'SpinGold API is healthy' });
	});

	// try {
	// 	await MembershipPlan.collection.dropIndex('id_1');
	// 	console.log('Dropped stale id_1 index');
	// } catch (err) {
	// 	console.warn('Index cleanup skipped:', err.message);
	// }

	// for (const plan of MEMBERSHIP_PLANS) {
	// 	await MembershipPlan.updateOne({ mid: plan.mid }, { $set: plan }, { upsert: true });
	// }
	// console.log('Membership plans seeded successfully.');
// startMembershipScheduler();
	app.listen(5000, () => {
		console.log('Server is running on http://localhost:5000');
	});
};

start().catch((error) => {
	console.error('Failed to start server:', error);
	process.exit(1);
});
