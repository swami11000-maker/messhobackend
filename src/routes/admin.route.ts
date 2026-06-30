import { Router } from 'express';
import {
	adminAudit,
	adminOverview,
	adminRewardAudit,
	adminRewardScheduleByMembership,
	adminRewardSchedulesByUser,
	adminSupportTickets,
	adminTreasury,
	adminUsers,
	adminWithdrawals,
	bulkUpdateRewardSchedule,
	lockRewardScheduleSlot,
	regenerateRewardSchedule,
	updateRewardScheduleSlot,
	updateSupportTicket,
	updateUserStatus,
	updateWithdrawal,
} from '../controllers/admin.js';
import { adminMiddleware, authMiddleware } from '../middlewares/islogin.js';
import { validateBody } from '../middlewares/validate.js';
import { rewardScheduleBulkSchema, rewardScheduleLockSchema, rewardScheduleUpdateSchema, supportReviewSchema, userStatusSchema, withdrawalReviewSchema } from '../types/index.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);
router.get('/overview', adminOverview);
router.get('/users', adminUsers);
router.patch('/users/:id/status', validateBody(userStatusSchema), updateUserStatus);
router.get('/withdrawals', adminWithdrawals);
router.patch('/withdrawals/:id', validateBody(withdrawalReviewSchema), updateWithdrawal);
router.get('/support', adminSupportTickets);
router.patch('/support/:id', validateBody(supportReviewSchema), updateSupportTicket);
router.get('/treasury', adminTreasury);
router.get('/audit', adminAudit);
router.get('/reward-schedules/users/:userId', adminRewardSchedulesByUser);
router.get('/reward-schedules/:membershipId', adminRewardScheduleByMembership);
router.patch('/reward-schedules/:slotId', validateBody(rewardScheduleUpdateSchema), updateRewardScheduleSlot);
router.patch('/reward-schedules/:membershipId/bulk', validateBody(rewardScheduleBulkSchema), bulkUpdateRewardSchedule);
router.post('/reward-schedules/:membershipId/regenerate', regenerateRewardSchedule);
router.post('/reward-schedules/:slotId/lock', validateBody(rewardScheduleLockSchema), lockRewardScheduleSlot);
router.get('/reward-audit/:membershipId', adminRewardAudit);

export default router;
