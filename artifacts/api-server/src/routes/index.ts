import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import workspacesRouter from "./workspaces";
import feedbackRouter from "./feedback";

const router: IRouter = Router();

router.use(healthRouter);
router.use(workspacesRouter);
router.use(projectsRouter);
router.use(feedbackRouter);

export default router;
