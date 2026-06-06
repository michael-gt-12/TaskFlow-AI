import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { SprintService } from './sprint.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validator';
import {
  CreateSprintSchema,
  UpdateSprintSchema,
  ListSprintsSchema,
  CompleteSprintSchema,
  AssignTaskSchema,
} from './sprint.schema';
import { checkCapability } from '../middleware/permission';
import { SprintMapper } from './sprint.mapper';
import { sendOk, sendCreated, sendNoContent, sendPaginated } from '../shared/http';
import { parseOffsetPagination } from '../shared/query';
import { BadRequestError } from '../shared/errors';
import { SprintStatus } from '@prisma/client';

const router = Router();

router.post(
  '/',
  authenticate,
  validateRequest(CreateSprintSchema),
  checkCapability('sprint:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sprint = await SprintService.create(req.user!.id, req.body);
      sendCreated(res, SprintMapper.toDto(sprint));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  authenticate,
  validateRequest(ListSprintsSchema),
  checkCapability('sprint:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.query.projectId as string | undefined;
      if (!projectId) throw new BadRequestError('projectId query parameter is required');
      const { page, pageSize } = parseOffsetPagination(req.query as Record<string, unknown>);
      const result = await SprintService.list(projectId, {
        page,
        pageSize,
        status: req.query.status as SprintStatus | undefined,
      });
      sendPaginated(res, { data: SprintMapper.toDtoList(result.data), meta: result.meta as any });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:sprintId',
  authenticate,
  checkCapability('sprint:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sprint = await SprintService.getById(req.params.sprintId);
      sendOk(res, SprintMapper.toDto(sprint));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:sprintId/summary',
  authenticate,
  checkCapability('sprint:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sprint, stats } = await SprintService.getSummary(req.params.sprintId);
      sendOk(res, SprintMapper.toSummaryDto(sprint, stats));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:sprintId',
  authenticate,
  validateRequest(UpdateSprintSchema),
  checkCapability('sprint:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sprint = await SprintService.update(req.params.sprintId, req.body);
      sendOk(res, SprintMapper.toDto(sprint));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:sprintId/start',
  authenticate,
  checkCapability('sprint:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sprint = await SprintService.start(req.params.sprintId, req.user!.id);
      sendOk(res, SprintMapper.toDto(sprint));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:sprintId/complete',
  authenticate,
  validateRequest(CompleteSprintSchema),
  checkCapability('sprint:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sprint = await SprintService.complete(
        req.params.sprintId,
        req.user!.id,
        req.body.moveUnfinishedToSprintId
      );
      sendOk(res, SprintMapper.toDto(sprint));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:sprintId/cancel',
  authenticate,
  checkCapability('sprint:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sprint = await SprintService.cancel(req.params.sprintId, req.user!.id);
      sendOk(res, SprintMapper.toDto(sprint));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:sprintId/tasks',
  authenticate,
  validateRequest(AssignTaskSchema),
  checkCapability('sprint:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await SprintService.assignTask(req.params.sprintId, req.body.taskId);
      sendCreated(res, { ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:sprintId/tasks/:taskId',
  authenticate,
  checkCapability('sprint:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await SprintService.removeTask(req.params.sprintId, req.params.taskId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
);

export const sprintRouter = router;
