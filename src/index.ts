import { env } from './config/env.js';
import { connectDB } from './config/dbCon.js';
import { app } from './server.js';

const start = async () => {
await connectDB();

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SpinGold API is healthy",
  });
});

app.listen(5000, () => {
  console.log("Server is running on http://localhost:5000");
});

};

start().catch((error) => {
	console.error('Failed to start server:', error);
	process.exit(1);
});
