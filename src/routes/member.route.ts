import { Router } from 'express';

import { buyMembership } from '../controllers/membership/mambership.controller.js';
import { authMiddleware } from '../middlewares/authenticate.js';

const membershipRouter = Router();

membershipRouter.get('/buy-membership/:membershipId',authMiddleware, buyMembership);

export default membershipRouter;