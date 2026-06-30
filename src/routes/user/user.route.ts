import { Router } from 'express';
import { forgotPassword, getUserDetail, login, register, resetPassword } from '../../controllers/auth/user.js';
import { validateBody } from '../../middlewares/validate.js';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../../types/index.js';
import { authMiddleware } from '../../middlewares/islogin.js';
import { rateLimit } from '../../middlewares/rate-limit.js';


const router = Router();

const authRateLimit = rateLimit(20, 15 * 60 * 1000);
const resetRateLimit = rateLimit(5, 15 * 60 * 1000);

router.post('/register', authRateLimit, validateBody(registerSchema), register);
router.post('/login', authRateLimit, validateBody(loginSchema), login);
router.post('/forgot-password', resetRateLimit, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', resetRateLimit, validateBody(resetPasswordSchema), resetPassword);
router.get('/get-user-detail', authMiddleware, getUserDetail);

export default router;
