import { Router } from 'express';
import { forgotPassword, getUserDetail, login, register, resetPassword } from '../../controllers/user/user.js';

import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../../types/index.js';
import { authMiddleware } from '../../middlewares/islogin.js';


const router = Router();

router.post('/register', register);
router.post('/login', authMiddleware, login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/get-user-detail', authMiddleware, getUserDetail);

export default router;
