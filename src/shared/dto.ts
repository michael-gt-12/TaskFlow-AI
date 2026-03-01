export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: {
    id: string;
    name: string;
    email: string;
  } | null;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  labels: string[];
  createdAt: string;
}

export class DtoMapper {
  static mapTask(task: any): TaskDto {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      assignee: task.assignee ? {
        id: task.assignee.id,
        name: task.assignee.name,
        email: task.assignee.email
      } : null,
      creator: {
        id: task.creator.id,
        name: task.creator.name,
        email: task.creator.email
      },
      labels: task.labels ? task.labels.map((tl: any) => tl.label.name) : [],
      createdAt: task.createdAt.toISOString()
    };
  }
}
