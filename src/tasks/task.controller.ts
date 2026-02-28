import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { TaskService } from './task.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validator';
import { CreateTaskSchema, UpdateTaskSchema } from './task.schema';
import { checkOrgRole } from '../middleware/permission';
import { OrgRole } from '@prisma/client';

const router = Router();

router.post('/', authenticate, validateRequest(CreateTaskSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Org Role checking will be embedded via query parameters or body orgId
    const task = await TaskService.create(req.user!.id, req.body.orgId || '', req.body);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

router.get('/:taskId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await TaskService.getById(req.params.taskId);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

router.put('/:taskId', authenticate, validateRequest(UpdateTaskSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await TaskService.update(req.params.taskId, req.user!.id, req.body.orgId || '', req.body);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

export const taskRouter = router;
