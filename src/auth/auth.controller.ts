import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { validateRequest } from '../middleware/validator';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from './auth.schema';

const router = Router();

router.post('/register', validateRequest(RegisterSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', validateRequest(LoginSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await AuthService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', validateRequest(RefreshTokenSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await AuthService.refreshToken(req.body.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export const authRouter = router;
