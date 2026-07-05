import { Router } from "express";
import authRoutes from "./user/user.route.js";
import membershipRouter from "./member.route.js";
import dashboardRoute from "./dashboard/dashboard.route.js";
import clickRouter from "./click/click.js";
import playtfrom from "./playtform.route.js";
import adminRouter from "./admin/admin.route.js";
import walletRouter from "./wallet.route.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/membership", membershipRouter);
router.use("/dashboard", dashboardRoute);
router.use("/click", clickRouter);
router.use("/platform", playtfrom);
router.use("/wallet", walletRouter);
router.use("/admin", adminRouter);

export default router;
