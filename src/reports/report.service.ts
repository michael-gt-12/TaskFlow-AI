import { prisma } from '../database/client';
import { NotFoundError } from '../shared/errors';
import { ProjectExportRow, OrganizationExportSummary } from './report.interface';
import { CSVExporter } from './csv.exporter';
import { logger } from '../shared/logger';

export class ReportService {
  /**
   * Generates a detailed CSV list of all tasks in a project.
   */
  static async exportProjectTasksToCSV(projectId: string): Promise<string> {
    logger.info(`Generating project export CSV for project ${projectId}...`);
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        creator: true,
        assignee: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const exportRows: ProjectExportRow[] = tasks.map(t => ({
      taskId: t.id,
      taskTitle: t.title,
      status: t.status,
      priority: t.priority,
      creatorName: t.creator.name,
      assigneeName: t.assignee?.name || 'Unassigned',
      dueDate: t.dueDate ? t.dueDate.toISOString() : 'None',
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString()
    }));

    return CSVExporter.export(exportRows);
  }

  /**
   * Generates a structural metrics JSON summary of an organization.
   */
  static async exportOrganizationSummary(orgId: string): Promise<OrganizationExportSummary> {
    logger.info(`Generating organization export summary for org ${orgId}...`);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        projects: {
          include: {
            tasks: true
          }
        },
        members: true
      }
    });

    if (!org) {
      throw new NotFoundError('Organization');
    }

    let totalTasksCount = 0;
    let completedTasksCount = 0;

    for (const project of org.projects) {
      totalTasksCount += project.tasks.length;
      completedTasksCount += project.tasks.filter(t => t.status === 'DONE').length;
    }

    return {
      orgId: org.id,
      orgName: org.name,
      totalProjects: org.projects.length,
      totalTasks: totalTasksCount,
      completedTasks: completedTasksCount,
      membersCount: org.members.length,
      generatedAt: new Date().toISOString()
    };
  }
}
