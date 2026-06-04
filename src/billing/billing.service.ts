import { prisma } from '../database/client';
import { OrgSubscriptionTier, TIER_LIMITS, SubscriptionInfo } from './billing.interface';
import { StripeMockClient } from './stripe.mock';
import { logger } from '../shared/logger';
import { ForbiddenError, NotFoundError } from '../shared/errors';
import { CacheService } from '../utils/cache';

export class BillingService {
  /**
   * Retrieves the current subscription details for an organization.
   * Leverages caching to optimize limits lookups on every mutation request.
   */
  static async getSubscription(orgId: string): Promise<SubscriptionInfo> {
    const cacheKey = `billing:org:${orgId}`;
    const cached = await CacheService.get<SubscriptionInfo>(cacheKey);
    if (cached) return cached;

    const billing = await prisma.orgBilling.findUnique({
      where: { organizationId: orgId }
    });

    const info: SubscriptionInfo = {
      tier: (billing?.tier as OrgSubscriptionTier) || 'FREE',
      status: billing?.status || 'ACTIVE',
      endsAt: billing?.endsAt || null,
      limits: TIER_LIMITS[(billing?.tier as OrgSubscriptionTier) || 'FREE']
    };

    // Cache billing information for 5 minutes
    await CacheService.set(cacheKey, info, 300);
    return info;
  }

  /**
   * Invalidates billing caches on changes
   */
  static async clearBillingCache(orgId: string) {
    await CacheService.del(`billing:org:${orgId}`);
  }

  /**
   * Generates upgrade checkout session URL
   */
  static async getCheckoutUrl(orgId: string, tier: OrgSubscriptionTier): Promise<string> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundError('Organization');

    const session = await StripeMockClient.createCheckoutSession(
      orgId,
      tier,
      'http://localhost:3000/api/billing/success',
      'http://localhost:3000/api/billing/cancel'
    );
    return session.url;
  }

  /**
   * Cancels an active subscription
   */
  static async cancelSubscription(orgId: string): Promise<void> {
    const billing = await prisma.orgBilling.findUnique({
      where: { organizationId: orgId }
    });

    if (!billing || !billing.stripeSubscriptionId) {
      throw new ForbiddenError('No active paid subscription found for this organization');
    }

    await StripeMockClient.cancelSubscription(billing.stripeSubscriptionId);

    await prisma.orgBilling.update({
      where: { organizationId: orgId },
      data: {
        tier: 'FREE',
        stripeSubscriptionId: null,
        status: 'CANCELLED',
        endsAt: new Date()
      }
    });

    await this.clearBillingCache(orgId);
    logger.info(`Cancelled subscription for organization ${orgId}`);
  }

  /**
   * Webhook processing from payment gateway (Stripe)
   */
  static async handleStripeWebhook(event: any): Promise<void> {
    const { type, data } = event;
    logger.info(`[Billing Service] Processing Stripe Webhook Event: ${type}`);

    if (type === 'checkout.session.completed') {
      const session = data.object;
      const orgId = session.client_reference_id;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      const tier = session.metadata?.tier || 'PRO';

      await prisma.orgBilling.upsert({
        where: { organizationId: orgId },
        update: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          tier,
          status: 'ACTIVE',
          endsAt: null
        },
        create: {
          organizationId: orgId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          tier,
          status: 'ACTIVE'
        }
      });

      await this.clearBillingCache(orgId);
      logger.info(`[Billing Webhook] Upgraded org ${orgId} to ${tier}`);
    } else if (type === 'customer.subscription.deleted') {
      const subscription = data.object;
      const billing = await prisma.orgBilling.findFirst({
        where: { stripeSubscriptionId: subscription.id }
      });

      if (billing) {
        await prisma.orgBilling.update({
          where: { organizationId: billing.organizationId },
          data: {
            tier: 'FREE',
            stripeSubscriptionId: null,
            status: 'EXPIRED',
            endsAt: new Date()
          }
        });
        await this.clearBillingCache(billing.organizationId);
        logger.info(`[Billing Webhook] Downgraded org ${billing.organizationId} due to subscription deletion`);
      }
    }
  }

  /**
   * Core limits verification gates
   */
  static async checkProjectLimit(orgId: string): Promise<void> {
    const sub = await this.getSubscription(orgId);
    const count = await prisma.project.count({
      where: { organizationId: orgId, isArchived: false }
    });

    if (count >= sub.limits.maxProjects) {
      throw new ForbiddenError(
        `Project limit reached for ${sub.tier} tier (Max: ${sub.limits.maxProjects} projects). Upgrade to add more.`
      );
    }
  }

  static async checkMemberLimit(orgId: string): Promise<void> {
    const sub = await this.getSubscription(orgId);
    const count = await prisma.orgMember.count({
      where: { organizationId: orgId }
    });

    if (count >= sub.limits.maxMembers) {
      throw new ForbiddenError(
        `Member limit reached for ${sub.tier} tier (Max: ${sub.limits.maxMembers} members). Upgrade to add more.`
      );
    }
  }

  static async checkTaskLimit(projectId: string): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    if (!project) throw new NotFoundError('Project');

    const orgId = project.organizationId;
    const sub = await this.getSubscription(orgId);
    
    // Total tasks count across all projects in the organization
    const count = await prisma.task.count({
      where: { project: { organizationId: orgId } }
    });

    if (count >= sub.limits.maxTasks) {
      throw new ForbiddenError(
        `Task limit reached for ${sub.tier} tier (Max: ${sub.limits.maxTasks} tasks). Upgrade to add more.`
      );
    }
  }

  static async checkAiAccess(orgId: string): Promise<void> {
    const sub = await this.getSubscription(orgId);
    if (!sub.limits.aiAssistantAllowed) {
      throw new ForbiddenError(`AI features are not available on the ${sub.tier} tier. Upgrade to PRO to activate.`);
    }
  }

  static async checkAutomationAccess(orgId: string): Promise<void> {
    const sub = await this.getSubscription(orgId);
    if (!sub.limits.automationRulesAllowed) {
      throw new ForbiddenError(`Automation rules are not available on the ${sub.tier} tier. Upgrade to PRO to activate.`);
    }
  }
}
