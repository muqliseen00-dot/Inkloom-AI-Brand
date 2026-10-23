import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inkloomRouter from "./inkloom";

const router: IRouter = Router();

router.use(healthRouter);
router.use(inkloomRouter);

export default router;
