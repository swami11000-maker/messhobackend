import { Router } from "express";
import authRoutes from "./user/user.route.js";
import adminRoutes from "./admin.route.js";
import platformRoutes from "./platform.route.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/platform", platformRoutes);
router.use("/admin", adminRoutes);

export default router;
