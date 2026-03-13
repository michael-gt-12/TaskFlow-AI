import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { SearchService } from './search.service';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query.q as string;
    const type = req.query.type as string; // TASK, PROJECT, etc.
    if (!query) {
      res.json([]);
      return;
    }
    const results = await SearchService.search(query, type);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export const searchRouter = router;
