import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import workspacesRouter from "./workspaces";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workspacesRouter);
router.use(projectsRouter);

export default router;
