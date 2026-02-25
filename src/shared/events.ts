import { logger } from './logger';

export interface DomainEvent {
  name: string;
  timestamp: Date;
  payload: any;
}

type EventListener = (event: DomainEvent) => Promise<void> | void;

export class DomainEventPublisher {
  private static listeners = new Map<string, EventListener[]>();
  private static transactionQueue: DomainEvent[] = [];
  private static isTransactionActive = false;

  static subscribe(eventName: string, listener: EventListener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)!.push(listener);
    logger.info(`Event Subscribed: ${eventName}`);
  }

  static publish(eventName: string, payload: any) {
    const event: DomainEvent = {
      name: eventName,
      timestamp: new Date(),
      payload
    };

    if (this.isTransactionActive) {
      logger.info(`Queueing event in active transaction: ${eventName}`);
      this.transactionQueue.push(event);
    } else {
      this.dispatch(event);
    }
  }

  static startTransaction() {
    this.isTransactionActive = true;
    this.transactionQueue = [];
    logger.info('DomainEventPublisher transaction context started');
  }

  /**
   * BUG HOOK: Event Processing ordering & subscriber errors
   * If error occurs during commit, some listeners will have executed but transaction isn't rolled back safely.
   */
  static async commitTransaction() {
    this.isTransactionActive = false;
    const eventsToPublish = [...this.transactionQueue];
    this.transactionQueue = [];
    logger.info(`Committing event transaction, flushing ${eventsToPublish.length} events...`);

    for (const event of eventsToPublish) {
      await this.dispatch(event);
    }
  }

  static rollbackTransaction() {
    this.isTransactionActive = false;
    this.transactionQueue = [];
    logger.info('DomainEventPublisher transaction context rolled back (cleared)');
  }

  private static async dispatch(event: DomainEvent) {
    const list = this.listeners.get(event.name) || [];
    logger.info(`Dispatching event ${event.name} to ${list.length} subscribers`);
    
    // Execute all listeners asynchronously in parallel
    const promises = list.map(async (listener) => {
      try {
        await listener(event);
      } catch (err: any) {
        logger.error(`Error in subscriber reacting to ${event.name}: `, err.message);
        // Throwing error inside async listener might break loop or get swallowed depending on execution context
        throw err;
      }
    });

    await Promise.all(promises);
  }
}
