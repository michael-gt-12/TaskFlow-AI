import { PrismaClient, OrgRole, SystemRole, TaskStatus, TaskPriority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Database with Rich SaaS Data...');

  // Delete all existing data
  await prisma.searchIndex.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.activityLog.deleteMany({});
  await prisma.taskLabel.deleteMany({});
  await prisma.label.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.orgMember.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.user.deleteMany({});

  const hashedPw = await bcrypt.hash('password123', 10);

  // Users
  const alice = await prisma.user.create({
    data: { email: 'alice@taskflow.ai', name: 'Alice Owner', passwordHash: hashedPw, role: SystemRole.USER }
  });
  const bob = await prisma.user.create({
    data: { email: 'bob@taskflow.ai', name: 'Bob Admin', passwordHash: hashedPw, role: SystemRole.USER }
  });
  const charlie = await prisma.user.create({
    data: { email: 'charlie@taskflow.ai', name: 'Charlie Dev', passwordHash: hashedPw, role: SystemRole.USER }
  });
  const dave = await prisma.user.create({
    data: { email: 'dave@taskflow.ai', name: 'Dave Guest', passwordHash: hashedPw, role: SystemRole.USER }
  });
  const adminUser = await prisma.user.create({
    data: { email: 'admin@taskflow.ai', name: 'System Admin', passwordHash: hashedPw, role: SystemRole.SYSTEM_ADMIN }
  });

  // Organization
  const org = await prisma.organization.create({
    data: { name: 'Acme Corp', slug: 'acme', ownerId: alice.id }
  });

  // Memberships
  await prisma.orgMember.createMany({
    data: [
      { organizationId: org.id, userId: alice.id, role: OrgRole.OWNER },
      { organizationId: org.id, userId: bob.id, role: OrgRole.ADMIN },
      { organizationId: org.id, userId: charlie.id, role: OrgRole.MEMBER },
      { organizationId: org.id, userId: dave.id, role: OrgRole.GUEST }
    ]
  });

  // Projects
  const proj1 = await prisma.project.create({
    data: { name: 'Apollo Core', description: 'Main microservices engine', organizationId: org.id }
  });
  const proj2 = await prisma.project.create({
    data: { name: 'Athena UI', description: 'Next-gen Frontend dashboard', organizationId: org.id }
  });
  const archivedProj = await prisma.project.create({
    data: { name: 'Legacy Migrate', description: 'Deprecated migrations', organizationId: org.id, isArchived: true }
  });

  // Labels
  const bugLabel = await prisma.label.create({
    data: { projectId: proj1.id, name: 'bug', color: '#ff0000' }
  });
  const featLabel = await prisma.label.create({
    data: { projectId: proj1.id, name: 'feature', color: '#00ff00' }
  });

  // Tasks
  const task1 = await prisma.task.create({
    data: {
      projectId: proj1.id,
      title: 'Fix Redis Cache Invalidation bug',
      description: 'Analytics metrics are showing stale reports because cache is not invalidating on bulk actions.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.URGENT,
      creatorId: alice.id,
      assigneeId: charlie.id
    }
  });

  const task2 = await prisma.task.create({
    data: {
      projectId: proj1.id,
      title: 'Review transaction rollback exception',
      description: 'Event-driven publishing exceptions trigger partial commits inside the task service.',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      creatorId: bob.id,
      assigneeId: charlie.id
    }
  });

  const task3 = await prisma.task.create({
    data: {
      projectId: proj1.id,
      title: 'Implement Smart Recommendations engine',
      description: 'Integrate mock LLM module with token statistics tracking.',
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      creatorId: alice.id,
      assigneeId: bob.id
    }
  });

  // Task labels
  await prisma.taskLabel.create({
    data: { taskId: task1.id, labelId: bugLabel.id }
  });
  await prisma.taskLabel.create({
    data: { taskId: task2.id, labelId: bugLabel.id }
  });
  await prisma.taskLabel.create({
    data: { taskId: task3.id, labelId: featLabel.id }
  });

  console.log('Database successfully seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
