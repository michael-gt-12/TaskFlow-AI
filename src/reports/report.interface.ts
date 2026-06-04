export interface ProjectExportRow {
  taskId: string;
  taskTitle: string;
  status: string;
  priority: string;
  creatorName: string;
  assigneeName: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationExportSummary {
  orgId: string;
  orgName: string;
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  membersCount: number;
  generatedAt: string;
}
