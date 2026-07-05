import { Router } from 'express';
import { authMiddleware } from '../middlewares/authenticate.js';
import { walletStatusController, depositController } from '../controllers/platform/platform.controller.js';

const walletRoute = Router();

walletRoute.use(authMiddleware);

walletRoute.get('/status', walletStatusController);
walletRoute.post('/deposit', depositController);

export default walletRoute;
