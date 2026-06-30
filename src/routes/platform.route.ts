import { Router } from 'express';
import {
	createSupportTicket,
	getOverview,
	getPlans,
	listMemberships,
	listSupportTickets,
	listTransactions,
	purchaseMembership,
	requestWithdrawal,
	spin,
	updateProfile,
} from '../controllers/platform.js';
import { authMiddleware } from '../middlewares/islogin.js';
import { validateBody } from '../middlewares/validate.js';
import { profileSchema, purchaseMembershipSchema, supportSchema, withdrawalSchema } from '../types/index.js';

const router = Router();

router.get('/plans', getPlans);
router.use(authMiddleware);
router.get('/overview', getOverview);
router.get('/transactions', listTransactions);
router.get('/memberships', listMemberships);
router.post('/memberships', validateBody(purchaseMembershipSchema), purchaseMembership);
router.post('/spin', spin);
router.post('/withdrawals', validateBody(withdrawalSchema), requestWithdrawal);
router.patch('/profile', validateBody(profileSchema), updateProfile);
router.post('/support', validateBody(supportSchema), createSupportTicket);
router.get('/support', listSupportTickets);

export default router;
