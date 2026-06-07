import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { DependencyService } from './dependency.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validator';
import { CreateDependencySchema } from './dependency.schema';
import { checkCapability } from '../middleware/permission';
import { DependencyMapper } from './dependency.mapper';
import { sendCreated, sendNoContent, sendOk } from '../shared/http';

const router = Router();

router.post(
  '/',
  authenticate,
  validateRequest(CreateDependencySchema),
  checkCapability('task:update'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dependency = await DependencyService.create(req.user!.id, req.body);
      sendCreated(res, DependencyMapper.toDto(dependency));
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
      const graph = await DependencyService.listForTask(req.params.taskId);
      sendOk(res, DependencyMapper.toGraphDto(graph));
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:dependencyId',
  authenticate,
  checkCapability('task:update'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await DependencyService.remove(req.params.dependencyId, req.user!.id);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
);

export const dependencyRouter = router;
