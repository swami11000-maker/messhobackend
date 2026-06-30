import { env } from './config/env.js';
import { connectDB } from './config/dbCon.js';
import { app } from './server.js';

// const start = async () => {
	// await connectDB();

	app.listen(env.PORT, () => {
		console.log(`Server running at`);
	});
// };

// start().catch((error) => {
// 	console.error('Failed to start server:', error);
// 	process.exit(1);
// });
