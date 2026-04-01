import express from 'express';
import cors from 'cors';
import { authRouter } from './auth/auth.controller';
import { orgRouter } from './organizations/org.controller';
import { projectRouter } from './projects/project.controller';
import { taskRouter } from './tasks/task.controller';
import { analyticsRouter } from './analytics/analytics.controller';
import { searchRouter } from './search/search.controller';
import { aiRouter } from './ai/ai.controller';
import { errorHandler } from './middleware/error';
import { setupActivityListeners } from './activity/activity.listener';
import { setupNotificationListeners } from './notifications/notification.listener';
import { setupSearchListeners } from './search/search.listener';
import { AnalyticsService } from './analytics/analytics.service';

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

// Register event listeners
setupActivityListeners();
setupNotificationListeners();
setupSearchListeners();
AnalyticsService.setupCacheListeners();

// Error handler
app.use(errorHandler);

export default app;
