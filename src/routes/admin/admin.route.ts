import { Router } from 'express';

import { authMiddleware, adminMiddleware } from '../../middlewares/authenticate.js';
import {
  adminOverviewController,
  adminUsersController,
  adminUserStatusController,
  adminWithdrawalsController,
  adminWithdrawalReviewController,
  adminTreasuryController,
  adminAuditController,
  adminSupportController,
  adminSupportReviewController,
  rewardSchedulesUserController,
  rewardScheduleUpdateController,
  rewardScheduleLockController,
  rewardScheduleBulkController,
  rewardScheduleRegenerateController,
  rewardAuditController,
} from '../../controllers/admin/admin.controller.js';

const adminRoute = Router();

adminRoute.use(authMiddleware, adminMiddleware);

adminRoute.get('/overview', adminOverviewController);
adminRoute.get('/users', adminUsersController);
adminRoute.patch('/users/:userId/status', adminUserStatusController);
adminRoute.get('/withdrawals', adminWithdrawalsController);
adminRoute.patch('/withdrawals/:withdrawalId', adminWithdrawalReviewController);
adminRoute.get('/treasury', adminTreasuryController);
adminRoute.get('/audit', adminAuditController);
adminRoute.get('/support', adminSupportController);
adminRoute.patch('/support/:ticketId', adminSupportReviewController);
adminRoute.get('/reward-schedules/users/:term', rewardSchedulesUserController);
adminRoute.patch('/reward-schedules/:slotId', rewardScheduleUpdateController);
adminRoute.post('/reward-schedules/:slotId/lock', rewardScheduleLockController);
adminRoute.patch('/reward-schedules/:membershipId/bulk', rewardScheduleBulkController);
adminRoute.post('/reward-schedules/:membershipId/regenerate', rewardScheduleRegenerateController);
adminRoute.get('/reward-audit/:membershipId', rewardAuditController);

export default adminRoute;
