import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { authenticate } from '../middleware/auth';
import { checkOrgPermission } from '../middleware/permission';
import { OrgRole } from '@prisma/client';
import { ReportService } from './report.service';

const router = Router();

// Exposes CSV task downloads for members
router.get(
  '/project/:projectId/csv',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const csvData = await ReportService.exportProjectTasksToCSV(req.params.projectId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=project_${req.params.projectId}_tasks.csv`
      );
      res.status(200).send(csvData);
    } catch (err) {
      next(err);
    }
  }
);

// Exposes JSON compliance summaries for organization administrators
router.get(
  '/org/:orgId/summary',
  authenticate,
  checkOrgPermission(OrgRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await ReportService.exportOrganizationSummary(req.params.orgId);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }
);

export const reportRouter = router;
