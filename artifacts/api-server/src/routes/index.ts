import { Router, type IRouter } from "express";
import healthRouter from "./health";
import decisoesRouter from "./decisoes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(decisoesRouter);

export default router;
