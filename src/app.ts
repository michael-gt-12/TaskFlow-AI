import express from 'express';
import cors from 'cors';
import { authRouter } from './auth/auth.controller';
import { orgRouter } from './organizations/org.controller';
import { projectRouter } from './projects/project.controller';
import { taskRouter } from './tasks/task.controller';
import { analyticsRouter } from './analytics/analytics.controller';
import { searchRouter } from './search/search.controller';
import { aiRouter } from './ai/ai.controller';
import { jobRouter } from './jobs/job.controller';
import { errorHandler } from './middleware/error';
import { setupActivityListeners } from './activity/activity.listener';
import { setupNotificationListeners } from './notifications/notification.listener';
import { setupSearchListeners } from './search/search.listener';
import { AnalyticsService } from './analytics/analytics.service';
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
app.use('/api/analytics', analyticsRouter);
app.use('/api/search', searchRouter);
app.use('/api/ai', aiRouter);
app.use('/api/jobs', jobRouter);

// Register event listeners
setupActivityListeners();
setupNotificationListeners();
setupSearchListeners();
AnalyticsService.setupCacheListeners();

// Register background jobs
JobRunner.register(new AnalyticsRefreshJob());
JobRunner.register(new SearchIndexMaintenanceJob());
JobRunner.register(new NotificationCleanupJob());
JobRunner.register(new ArchivalMaintenanceJob());

// Error handler
app.use(errorHandler);

export default app;
