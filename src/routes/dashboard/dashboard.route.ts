import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authenticate.js';
import { dashboardController, getRewardsHistory } from '../../controllers/dashboard/dashboard.controller.js';


const dashboardRoute = Router();

dashboardRoute.get('/home',authMiddleware, dashboardController);
dashboardRoute.get('/rewards-history',authMiddleware, getRewardsHistory);

export default dashboardRoute;