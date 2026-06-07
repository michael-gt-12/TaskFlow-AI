import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { MilestoneService } from './milestone.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validator';
import {
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  ListMilestonesSchema,
  ReachMilestoneSchema,
  AssignTaskSchema,
} from './milestone.schema';
import { checkCapability } from '../middleware/permission';
import { MilestoneMapper } from './milestone.mapper';
import { sendOk, sendCreated, sendNoContent, sendPaginated } from '../shared/http';
import { parseOffsetPagination } from '../shared/query';
import { BadRequestError } from '../shared/errors';
import { MilestoneStatus } from '@prisma/client';

const router = Router();

router.post(
  '/',
  authenticate,
  validateRequest(CreateMilestoneSchema),
  checkCapability('milestone:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const milestone = await MilestoneService.create(req.user!.id, req.body);
      sendCreated(res, MilestoneMapper.toDto(milestone));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  authenticate,
  validateRequest(ListMilestonesSchema),
  checkCapability('milestone:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.query.projectId as string | undefined;
      if (!projectId) throw new BadRequestError('projectId query parameter is required');
      const { page, pageSize } = parseOffsetPagination(req.query as Record<string, unknown>);
      const result = await MilestoneService.list(projectId, {
        page,
        pageSize,
        status: req.query.status as MilestoneStatus | undefined,
      });
      sendPaginated(res, { data: MilestoneMapper.toDtoList(result.data), meta: result.meta as any });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:milestoneId',
  authenticate,
  checkCapability('milestone:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const milestone = await MilestoneService.getById(req.params.milestoneId);
      sendOk(res, MilestoneMapper.toDto(milestone));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:milestoneId/summary',
  authenticate,
  checkCapability('milestone:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { milestone, stats } = await MilestoneService.getSummary(req.params.milestoneId);
      sendOk(res, MilestoneMapper.toSummaryDto(milestone, stats));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:milestoneId',
  authenticate,
  validateRequest(UpdateMilestoneSchema),
  checkCapability('milestone:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const milestone = await MilestoneService.update(req.params.milestoneId, req.body);
      sendOk(res, MilestoneMapper.toDto(milestone));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:milestoneId/reach',
  authenticate,
  validateRequest(ReachMilestoneSchema),
  checkCapability('milestone:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const milestone = await MilestoneService.markReached(
        req.params.milestoneId,
        req.user!.id,
        req.body.force === true
      );
      sendOk(res, MilestoneMapper.toDto(milestone));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:milestoneId/miss',
  authenticate,
  checkCapability('milestone:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const milestone = await MilestoneService.markMissed(req.params.milestoneId, req.user!.id);
      sendOk(res, MilestoneMapper.toDto(milestone));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:milestoneId/reopen',
  authenticate,
  checkCapability('milestone:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const milestone = await MilestoneService.reopen(req.params.milestoneId);
      sendOk(res, MilestoneMapper.toDto(milestone));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:milestoneId/tasks',
  authenticate,
  validateRequest(AssignTaskSchema),
  checkCapability('milestone:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await MilestoneService.assignTask(req.params.milestoneId, req.body.taskId);
      sendCreated(res, { ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:milestoneId/tasks/:taskId',
  authenticate,
  checkCapability('milestone:manage'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await MilestoneService.removeTask(req.params.milestoneId, req.params.taskId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
);

export const milestoneRouter = router;
