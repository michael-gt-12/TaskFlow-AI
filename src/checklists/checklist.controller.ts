import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { ChecklistService } from './checklist.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validator';
import {
  CreateChecklistSchema,
  UpdateChecklistSchema,
  AddChecklistItemSchema,
  UpdateChecklistItemSchema,
} from './checklist.schema';
import { checkCapability } from '../middleware/permission';
import { ChecklistMapper } from './checklist.mapper';
import { sendOk, sendCreated, sendNoContent } from '../shared/http';

const router = Router();

router.post(
  '/',
  authenticate,
  validateRequest(CreateChecklistSchema),
  checkCapability('task:update'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const checklist = await ChecklistService.create(req.body);
      sendCreated(res, ChecklistMapper.toDto(checklist));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/tasks/:taskId',
  authenticate,
  checkCapability('task:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const checklists = await ChecklistService.listForTask(req.params.taskId);
      sendOk(res, ChecklistMapper.toDtoList(checklists));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/tasks/:taskId/progress',
  authenticate,
  checkCapability('task:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const progress = await ChecklistService.getTaskProgress(req.params.taskId);
      sendOk(res, progress);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:checklistId',
  authenticate,
  validateRequest(UpdateChecklistSchema),
  checkCapability('task:update'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const checklist = await ChecklistService.rename(req.params.checklistId, req.body.title);
      sendOk(res, ChecklistMapper.toDto({ ...checklist, items: [] } as any));
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:checklistId',
  authenticate,
  checkCapability('task:update'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ChecklistService.remove(req.params.checklistId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:checklistId/items',
  authenticate,
  validateRequest(AddChecklistItemSchema),
  checkCapability('task:update'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const item = await ChecklistService.addItem(req.params.checklistId, req.body);
      sendCreated(res, ChecklistMapper.toItemDto(item));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/items/:itemId',
  authenticate,
  validateRequest(UpdateChecklistItemSchema),
  checkCapability('task:update'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const item = await ChecklistService.updateItem(req.params.itemId, req.body);
      sendOk(res, ChecklistMapper.toItemDto(item));
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/items/:itemId',
  authenticate,
  checkCapability('task:update'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ChecklistService.removeItem(req.params.itemId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
);

export const checklistRouter = router;
