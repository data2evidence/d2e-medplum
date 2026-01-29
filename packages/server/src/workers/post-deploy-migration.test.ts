// import { getReferenceString } from '@medplum/core';
import { AsyncJob, Parameters } from '@medplum/fhirtypes';
import { closeWorkers, initWorkers } from './index';
import { initAppServices, shutdownApp } from '../app';
import { loadTestConfig } from '../config/loader';
import { MedplumServerConfig } from '../config/types';
import { getSystemRepo } from '../fhir/repo';
import {
  CustomPostDeployMigrationJobData,
} from '../migrations/data/types';
import { getRegisteredServers, ServerRegistryInfo } from '../server-registry';
import { withTestContext } from '../test.setup';
import { getServerVersion } from '../util/version';
import {
  addPostDeployMigrationJobData,
  PostDeployMigrationQueueName,
  prepareCustomMigrationJobData,
  runCustomMigration,
} from './post-deploy-migration';
import { queueRegistry } from './utils';

jest.mock('../server-registry');

describe('Post-Deploy Migration Worker', () => {
  let config: MedplumServerConfig;
  let mockRegisteredServers: ServerRegistryInfo[];

  beforeAll(async () => {
    config = await loadTestConfig();

    // initialize everything but workers
    await initAppServices(config);
    await closeWorkers();
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockRegisteredServers = [
      {
        id: 'test-id',
        firstSeen: '2022-12-29T15:00:00Z',
        lastSeen: '2025-06-27T17:26:00Z',
        version: getServerVersion(),
        fullVersion: getServerVersion() + '-test',
      },
    ];
    (getRegisteredServers as jest.Mock).mockImplementation(() => mockRegisteredServers);
  });

  afterEach(async () => {
    await closeWorkers();
  });

  afterAll(async () => {
    await shutdownApp();
  });

  test('Initialize and close worker', async () => {
    let queue = queueRegistry.get(PostDeployMigrationQueueName);
    expect(queue).toBeUndefined();

    await initWorkers(config);

    queue = queueRegistry.get(PostDeployMigrationQueueName);
    expect(queue).toBeNull(); // Queue is now stubbed out
  });

  test('prepareCustomMigrationJobData and addPostDeployMigrationJobData', async () => {
    await initWorkers(config);

    await withTestContext(async () => {
      const asyncJob = await getSystemRepo().createResource<AsyncJob>({
        resourceType: 'AsyncJob',
        status: 'accepted',
        dataVersion: 123,
        requestTime: new Date().toISOString(),
        request: '/admin/super/migrate',
      });

      const jobData = prepareCustomMigrationJobData(asyncJob);

      const result = await addPostDeployMigrationJobData(jobData);

      expect(result).toBeUndefined(); // Function now runs synchronously and returns undefined
    });
  });

  test('Run custom migration success', async () => {
    const systemRepo = getSystemRepo();
    const asyncJob = await systemRepo.createResource<AsyncJob>({
      resourceType: 'AsyncJob',
      status: 'accepted',
      dataVersion: 123,
      requestTime: new Date().toISOString(),
      request: '/admin/super/migrate',
    });

    const mockCallback = jest.fn().mockResolvedValue([{ name: 'testAction', durationMs: 100 }]);

    const jobData: CustomPostDeployMigrationJobData = {
      type: 'custom',
      asyncJobId: asyncJob.id,
      requestId: '123',
      traceId: '456',
    };
    const result = await runCustomMigration(systemRepo, undefined, jobData, mockCallback);

    expect(result).toBe('finished');
    expect(mockCallback).toHaveBeenCalledWith(undefined, jobData);

    const updatedJob = await systemRepo.readResource<AsyncJob>('AsyncJob', asyncJob.id);
    expect(updatedJob.status).toBe('completed');
    expect(updatedJob.output).toMatchObject<Partial<Parameters>>({
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'testAction',
          part: [{ name: 'durationMs', valueInteger: 100 }],
        },
      ],
    });
  });

  test('Run custom migration with error', async () => {
    const systemRepo = getSystemRepo();
    const asyncJob = await systemRepo.createResource<AsyncJob>({
      resourceType: 'AsyncJob',
      status: 'accepted',
      dataVersion: 123,
      requestTime: new Date().toISOString(),
      request: '/admin/super/migrate',
    });

    const jobData: CustomPostDeployMigrationJobData = {
      type: 'custom',
      asyncJobId: asyncJob.id,
      requestId: '123',
      traceId: '456',
    };
    const mockCallback = jest.fn().mockImplementation(() => {
      throw new Error('Some random error');
    });

    const result = await runCustomMigration(systemRepo, undefined, jobData, mockCallback);
    expect(result).toBe('finished');

    const updatedJob = await systemRepo.readResource<AsyncJob>('AsyncJob', asyncJob.id);
    expect(updatedJob.status).toBe('error');
  });
});
