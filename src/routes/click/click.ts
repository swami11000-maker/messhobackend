import { Router } from 'express';

import { clickSpin } from '../../controllers/sipns/spins.controller.js';
import { authMiddleware } from '../../middlewares/authenticate.js';

const clickRouter = Router();

clickRouter.get('/spin', authMiddleware, clickSpin);

export default clickRouter;
