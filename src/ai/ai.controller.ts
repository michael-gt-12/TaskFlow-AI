import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { AiService } from './ai.service';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/summarize', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, description } = req.body;
    const summary = await AiService.getTaskSummary(title, description || '');
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.post('/suggest-description', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title } = req.body;
    const suggestion = await AiService.suggestTaskDescription(title);
    res.json(suggestion);
  } catch (err) {
    next(err);
  }
});

router.get('/accounting', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(AiService.getAccounting());
  } catch (err) {
    next(err);
  }
});

export const aiRouter = router;
