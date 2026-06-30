// import { env } from './config/env.js';
// import { connectDB } from './config/dbCon.js';
import { app } from './server.js';

// const start = async () => {
// await connectDB();

app.listen(5000, () => {
	console.log(`Server running at`);
});

app.get('/api/health', (_req, res) => {
	res.json({ success: true, message: 'SpinGold API is healthy' });
});

// };

// start().catch((error) => {
// 	console.error('Failed to start server:', error);
// 	process.exit(1);
// });
