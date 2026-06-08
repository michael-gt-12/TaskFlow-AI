import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { TimeEntryService } from './time-entry.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validator';
import {
  LogTimeSchema,
  UpdateTimeEntrySchema,
  ListTimeEntriesSchema,
} from './time-entry.schema';
import { checkCapability } from '../middleware/permission';
import { TimeEntryMapper } from './time-entry.mapper';
import { sendOk, sendCreated, sendNoContent, sendPaginated } from '../shared/http';
import { parseOffsetPagination } from '../shared/query';

const router = Router();

router.post(
  '/',
  authenticate,
  validateRequest(LogTimeSchema),
  checkCapability('time:log'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entry = await TimeEntryService.log(req.user!.id, req.body);
      sendCreated(res, TimeEntryMapper.toDto(entry));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/tasks/:taskId',
  authenticate,
  validateRequest(ListTimeEntriesSchema),
  checkCapability('time:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, pageSize } = parseOffsetPagination(req.query as Record<string, unknown>);
      const result = await TimeEntryService.list({
        taskId: req.params.taskId,
        userId: req.query.userId as string | undefined,
        page,
        pageSize,
      });
      sendPaginated(res, {
        data: TimeEntryMapper.toDtoList(result.data),
        meta: result.meta as any,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/tasks/:taskId/summary',
  authenticate,
  checkCapability('time:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await TimeEntryService.getTaskSummary(req.params.taskId);
      sendOk(res, TimeEntryMapper.toSummaryDto(summary));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:entryId',
  authenticate,
  validateRequest(UpdateTimeEntrySchema),
  checkCapability('time:log'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entry = await TimeEntryService.update(req.params.entryId, req.user!.id, req.body);
      sendOk(res, TimeEntryMapper.toDto(entry));
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:entryId',
  authenticate,
  checkCapability('time:log'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await TimeEntryService.remove(req.params.entryId, req.user!.id);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
);

export const timeEntryRouter = router;
