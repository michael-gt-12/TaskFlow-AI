// TaskFlow AI - Production SaaS Core Bootstrapper
import app from './app';
import { logger } from './shared/logger';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`TaskFlow AI SaaS backend server running on port ${PORT}`);
});
