import express from 'express';
import cors from 'cors';
import { authRouter } from './auth/auth.controller';
import { orgRouter } from './organizations/org.controller';
import { projectRouter } from './projects/project.controller';
import { taskRouter } from './tasks/task.controller';
import { sprintRouter } from './sprints/sprint.controller';
import { analyticsRouter } from './analytics/analytics.controller';
import { searchRouter } from './search/search.controller';
import { aiRouter } from './ai/ai.controller';
import { aiChatRouter } from './ai/chat/ai.chat.controller';
import { jobRouter } from './jobs/job.controller';
import { billingRouter } from './billing/billing.controller';
import { reportRouter } from './reports/report.controller';
import { errorHandler } from './middleware/error';
import { setupActivityListeners } from './activity/activity.listener';
import { setupNotificationListeners } from './notifications/notification.listener';
import { setupSearchListeners } from './search/search.listener';
import { AnalyticsService } from './analytics/analytics.service';
import { setupIntegrationListeners } from './integrations/integration.listener';
import { JobRunner } from './jobs/job.runner';
import { AnalyticsRefreshJob } from './jobs/analytics-refresh.job';
import { SearchIndexMaintenanceJob } from './jobs/search-index-maintenance.job';
import { NotificationCleanupJob } from './jobs/notification-cleanup.job';
import { ArchivalMaintenanceJob } from './jobs/archival-maintenance.job';

const app = express();

app.use(cors());
app.use(express.json());

// Mount routers
app.use('/api/auth', authRouter);
app.use('/api/organizations', orgRouter);
app.use('/api/projects', projectRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/sprints', sprintRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/search', searchRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ai/chat', aiChatRouter);
app.use('/api/jobs', jobRouter);
app.use('/api/billing', billingRouter);
app.use('/api/reports', reportRouter);

// Register event listeners
setupActivityListeners();
setupNotificationListeners();
setupSearchListeners();
AnalyticsService.setupCacheListeners();
setupIntegrationListeners();

// Register background jobs
JobRunner.register(new AnalyticsRefreshJob());
JobRunner.register(new SearchIndexMaintenanceJob());
JobRunner.register(new NotificationCleanupJob());
JobRunner.register(new ArchivalMaintenanceJob());

// Error handler
app.use(errorHandler);

export default app;
