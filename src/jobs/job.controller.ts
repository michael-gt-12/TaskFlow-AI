import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { authenticate } from '../middleware/auth';
import { JobRunner } from './job.runner';
import { ForbiddenError } from '../shared/errors';

const router = Router();

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'SYSTEM_ADMIN') {
    return next(new ForbiddenError('Only system administrators can access background jobs'));
  }
  next();
}

router.get('/', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const jobs = JobRunner.getJobs().map(j => ({ name: j.name }));
  res.json({ jobs });
});

router.get('/logs', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const logs = JobRunner.getLogs();
  res.json({ logs });
});

router.post('/:name/run', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const { name } = req.params;
  try {
    await JobRunner.runJob(name);
    res.json({ success: true, message: `Job ${name} executed successfully` });
  } catch (err: any) {
    next(err);
  }
});

router.post('/run-all', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await JobRunner.runAll();
    res.json({ success: true, message: 'All jobs executed' });
  } catch (err) {
    next(err);
  }
});

export const jobRouter = router;
