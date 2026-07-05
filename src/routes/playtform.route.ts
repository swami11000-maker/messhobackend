import { Router } from 'express';

import { authMiddleware } from '../middlewares/authenticate.js';
import {
  getPlatformController,
  transactionsController,
  purchaseMembershipController,
  withdrawalController,
  profileController,
  userSupportListController,
  createSupportController,
} from '../controllers/platform/platform.controller.js';
import { clickSpin } from '../controllers/sipns/spins.controller.js';

const playtfrom = Router();

playtfrom.get('/overview', authMiddleware, getPlatformController);
playtfrom.get('/transactions', authMiddleware, transactionsController);
playtfrom.post('/spin', authMiddleware, clickSpin);
playtfrom.post('/memberships', authMiddleware, purchaseMembershipController);
playtfrom.post('/withdrawals', authMiddleware, withdrawalController);
playtfrom.patch('/profile', authMiddleware, profileController);
playtfrom.get('/support', authMiddleware, userSupportListController);
playtfrom.post('/support', authMiddleware, createSupportController);

export default playtfrom;
