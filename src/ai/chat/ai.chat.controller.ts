import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types';
import { authenticate } from '../../middleware/auth';
import { AIChatService } from './ai.chat.service';

const router = Router();

router.post(
  '/:projectId',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { orgId, question, history } = req.body;
      
      const reply = await AIChatService.askQuestion(
        req.user!.id,
        orgId,
        projectId,
        question,
        history || []
      );
      
      res.json(reply);
    } catch (err) {
      next(err);
    }
  }
);

export const aiChatRouter = router;
