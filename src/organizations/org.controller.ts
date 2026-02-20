import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { OrgService } from './org.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validator';
import { CreateOrgSchema, InviteMemberSchema } from './org.schema';
import { checkOrgRole } from '../middleware/permission';
import { OrgRole } from '@prisma/client';

const router = Router();

router.post('/', authenticate, validateRequest(CreateOrgSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const org = await OrgService.create(req.user!.id, req.body);
    res.status(201).json(org);
  } catch (err) {
    next(err);
  }
});

router.get('/:orgId', authenticate, checkOrgRole([OrgRole.GUEST, OrgRole.MEMBER, OrgRole.ADMIN, OrgRole.OWNER]), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const org = await OrgService.getById(req.params.orgId);
    res.json(org);
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId/invite', authenticate, checkOrgRole([OrgRole.ADMIN, OrgRole.OWNER]), validateRequest(InviteMemberSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await OrgService.inviteMember(
      req.params.orgId,
      req.user!.id,
      req.body.email,
      req.body.role
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export const orgRouter = router;
