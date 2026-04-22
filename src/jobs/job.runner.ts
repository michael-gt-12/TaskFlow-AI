import { Job } from './job.interface';
import { logger } from '../shared/logger';

export interface JobExecutionLog {
  jobName: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  error?: string;
}

export class JobRunner {
  private static jobs = new Map<string, Job>();
  private static executionLogs: JobExecutionLog[] = [];

  static register(job: Job) {
    this.jobs.set(job.name, job);
    logger.info(`Job registered: ${job.name}`);
  }

  static getJobs() {
    return Array.from(this.jobs.values());
  }

  static getLogs() {
    return this.executionLogs;
  }

  static clearLogs() {
    this.executionLogs = [];
  }

  static async runJob(name: string): Promise<void> {
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`Job not found: ${name}`);
    }

    const log: JobExecutionLog = {
      jobName: name,
      startedAt: new Date(),
      status: 'RUNNING'
    };
    this.executionLogs.push(log);
    logger.info(`Background job started: ${name}`);

    try {
      await job.run();
      log.status = 'SUCCESS';
      log.completedAt = new Date();
      logger.info(`Background job completed successfully: ${name}`);
    } catch (err: any) {
      log.status = 'FAILED';
      log.completedAt = new Date();
      log.error = err.message;
      logger.error(`Background job failed: ${name}. Error: ${err.message}`);
      throw err;
    }
  }

  static async runAll(): Promise<void> {
    logger.info(`Running all ${this.jobs.size} registered background jobs...`);
    for (const name of this.jobs.keys()) {
      try {
        await this.runJob(name);
      } catch (err) {
        // Continue with other jobs
      }
    }
  }
}
