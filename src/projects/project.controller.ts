import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { ProjectService } from './project.service';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validator';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ListProjectsSchema,
  TransferLeadSchema,
  AddProjectMemberSchema,
} from './project.schema';
import { checkCapability } from '../middleware/permission';
import { ProjectMapper } from './project.mapper';
import { sendOk, sendCreated, sendNoContent, sendPaginated } from '../shared/http';
import { parseOffsetPagination } from '../shared/query';
import { ProjectRole } from '@prisma/client';

const router = Router();

router.post(
  '/',
  authenticate,
  validateRequest(CreateProjectSchema),
  checkCapability('project:create'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const project = await ProjectService.create(req.body.orgId, req.user!.id, req.body);
      sendCreated(res, ProjectMapper.toDto(project));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  authenticate,
  validateRequest(ListProjectsSchema),
  checkCapability('project:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, pageSize } = parseOffsetPagination(req.query as Record<string, unknown>);
      const result = await ProjectService.list(req.orgMember!.orgId, {
        page,
        pageSize,
        includeArchived: req.query.includeArchived === 'true',
        search: req.query.search as string | undefined,
        leadId: req.query.leadId as string | undefined,
      });
      sendPaginated(res, { data: ProjectMapper.toDtoList(result.data), meta: result.meta as any });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:projectId',
  authenticate,
  checkCapability('project:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const project = await ProjectService.getDetail(req.params.projectId);
      sendOk(res, ProjectMapper.toDetailDto(project));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:projectId',
  authenticate,
  validateRequest(UpdateProjectSchema),
  checkCapability('project:update'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const project = await ProjectService.update(req.params.projectId, req.user!.id, req.body);
      sendOk(res, ProjectMapper.toDto(project));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:projectId/archive',
  authenticate,
  checkCapability('project:archive'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const project = await ProjectService.archive(req.params.projectId, req.user!.id);
      sendOk(res, ProjectMapper.toDto(project));
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:projectId/restore',
  authenticate,
  checkCapability('project:archive'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const project = await ProjectService.restore(req.params.projectId, req.user!.id);
      sendOk(res, ProjectMapper.toDto(project));
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:projectId',
  authenticate,
  checkCapability('project:delete'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ProjectService.softDelete(req.params.projectId, req.user!.id);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:projectId/transfer-lead',
  authenticate,
  validateRequest(TransferLeadSchema),
  checkCapability('project:manage_members'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const project = await ProjectService.transferLead(
        req.params.projectId,
        req.user!.id,
        req.body.newLeadId
      );
      sendOk(res, ProjectMapper.toDto(project));
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:projectId/members',
  authenticate,
  checkCapability('project:read'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const members = await ProjectService.listMembers(req.params.projectId);
      sendOk(res, members);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:projectId/members',
  authenticate,
  validateRequest(AddProjectMemberSchema),
  checkCapability('project:manage_members'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ProjectService.addMember(
        req.params.projectId,
        req.body.userId,
        req.body.role ?? ProjectRole.CONTRIBUTOR
      );
      sendCreated(res, { ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:projectId/members/:userId',
  authenticate,
  checkCapability('project:manage_members'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ProjectService.removeMember(req.params.projectId, req.params.userId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
);

export const projectRouter = router;
