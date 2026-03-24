import { Router, type IRouter } from "express";
import healthRouter from "./health";
import decisoesRouter from "./decisoes";
import agendaRouter from "./agenda";

const router: IRouter = Router();

router.use(healthRouter);
router.use(decisoesRouter);
router.use(agendaRouter);

export default router;
