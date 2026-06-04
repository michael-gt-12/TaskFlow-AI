import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { authenticate } from '../middleware/auth';
import { checkOrgPermission } from '../middleware/permission';
import { OrgRole } from '@prisma/client';
import { BillingService } from './billing.service';

const router = Router();

router.get(
  '/:orgId',
  authenticate,
  checkOrgPermission(OrgRole.MEMBER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const info = await BillingService.getSubscription(req.params.orgId);
      res.json(info);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:orgId/checkout',
  authenticate,
  checkOrgPermission(OrgRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tier } = req.body;
      const checkoutUrl = await BillingService.getCheckoutUrl(req.params.orgId, tier || 'PRO');
      res.json({ checkoutUrl });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:orgId/cancel',
  authenticate,
  checkOrgPermission(OrgRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await BillingService.cancelSubscription(req.params.orgId);
      res.json({ success: true, message: 'Subscription successfully cancelled' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/webhook',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await BillingService.handleStripeWebhook(req.body);
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  }
);

export const billingRouter = router;
