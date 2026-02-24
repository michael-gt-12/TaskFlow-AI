import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { ProjectService } from './project.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validator';
import { CreateProjectSchema } from './project.schema';
import { checkOrgRole } from '../middleware/permission';
import { OrgRole } from '@prisma/client';

const router = Router();

router.post('/', authenticate, validateRequest(CreateProjectSchema), checkOrgRole([OrgRole.ADMIN, OrgRole.OWNER]), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await ProjectService.create(req.body.orgId, req.body);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await ProjectService.getById(req.params.projectId);
    res.json(project);
  } catch (err) {
    next(err);
  }
});

router.post('/:projectId/archive', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await ProjectService.archive(req.params.projectId);
    res.json(project);
  } catch (err) {
    next(err);
  }
});

export const projectRouter = router;
