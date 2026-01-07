import { BackgroundJobContext, WithId } from '@medplum/core';
import { Resource } from '@medplum/fhirtypes';
import { MedplumServerConfig } from '../config/types';
import { getLogger, globalLogger } from '../logger';
import { initBatchWorker } from './batch';
import { addCronJobs, initCronWorker } from './cron';
import { addDownloadJobs, initDownloadWorker } from './download';
import { initReindexWorker } from './reindex';
import { addSubscriptionJobs, initSubscriptionWorker } from './subscription';
import { queueRegistry, WorkerInitializer } from './utils';

/**
 * Initializes all background job queues.
 * Note: Worker processes are no longer initialized here. Only queues are created.
 * @param config - The config to initialize the queues with. Should contain `redis` and optionally `bullmq` fields.
 */
export function initWorkers(config: MedplumServerConfig): void {
  globalLogger.debug('Initializing job queues...');
  const initializers: WorkerInitializer[] = [
    initSubscriptionWorker,
    initDownloadWorker,
    initCronWorker,
    initReindexWorker,
    initBatchWorker,
  ];

  for (const initializer of initializers) {
    const { name, queue } = initializer(config);
    queueRegistry.add(name, queue);
  }
  globalLogger.debug('Job queues initialized');
}

/**
 * Shuts down all background job queues.
 */
export async function closeWorkers(): Promise<void> {
  await Promise.all(queueRegistry.closeAll());
}

/**
 * Adds all background jobs for a given resource.
 * @param resource - The resource that was created or updated.
 * @param previousVersion - The previous version of the resource, if available.
 * @param context - The background job context.
 */
export async function addBackgroundJobs(
  resource: WithId<Resource>,
  previousVersion: Resource | undefined,
  context: BackgroundJobContext
): Promise<void> {
  try {
    await addSubscriptionJobs(resource, previousVersion, context);
  } catch (err) {
    getLogger().error('Error adding subscription jobs', {
      resourceType: resource.resourceType,
      resource: resource.id,
      err,
    });
  }

  try {
    await addDownloadJobs(resource, context);
  } catch (err) {
    getLogger().error('Error adding download jobs', {
      resourceType: resource.resourceType,
      resource: resource.id,
      err,
    });
  }

  try {
    await addCronJobs(resource, previousVersion, context);
  } catch (err) {
    getLogger().error('Error adding cron jobs', {
      resourceType: resource.resourceType,
      resource: resource.id,
      err,
    });
  }
}
