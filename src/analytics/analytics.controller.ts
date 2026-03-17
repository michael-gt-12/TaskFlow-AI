import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { AnalyticsService } from './analytics.service';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/project/:projectId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const summary = await AnalyticsService.getProjectSummary(req.params.projectId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export const analyticsRouter = router;
