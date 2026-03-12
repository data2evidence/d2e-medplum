import {
  accepted,
  AccessPolicyInteraction,
  concatUrls,
  getResourceTypes,
  Operator,
  protectedResourceTypes,
  SearchRequest,
  singularize,
} from '@medplum/core';
import { FhirRequest, FhirResponse } from '@medplum/fhir-router';
import { AsyncJob, Project, Resource, ResourceType } from '@medplum/fhirtypes';
import { getConfig } from '../../config/loader';
import { getAuthenticatedContext } from '../../context';
import { globalLogger } from '../../logger';
import { getSystemRepo } from '../repo';
import { getPatientResourceTypes } from '../patient';
import { BulkExporter } from './utils/bulkexporter';

/**
 * Handles a bulk export request.
 *
 * Endpoint
 *   [fhir base]/$export
 *
 * See: https://hl7.org/fhir/uv/bulkdata/export.html
 * See: https://hl7.org/fhir/R4/async.html
 * @param req - The FHIR request.
 * @returns The FHIR response.
 */
export async function bulkExportHandler(req: FhirRequest): Promise<FhirResponse> {
  return startExport(req, 'System');
}

/**
 * Handles a Patient export request.
 *
 * Endpoint
 *   [fhir base]/Patient/$export
 *
 * See: https://hl7.org/fhir/uv/bulkdata/export.html#endpoint---all-patients
 * See: https://hl7.org/fhir/R4/async.html
 * @param req - The FHIR request.
 * @returns The FHIR response.
 */
export async function patientExportHandler(req: FhirRequest): Promise<FhirResponse> {
  return startExport(req, 'Patient');
}

async function startExport(req: FhirRequest, exportType: string): Promise<FhirResponse> {
  const ctx = getAuthenticatedContext();
  const { baseUrl } = getConfig();
  const since = singularize(req.query._since);
  const types = singularize(req.query._type)?.split(',');

  const exporter = new BulkExporter(ctx.repo);
  const bulkDataExport = await exporter.start(concatUrls(baseUrl, 'fhir/R4' + req.pathname));

  globalLogger.info('Bulk export started', {
    exportType,
    jobId: bulkDataExport.id,
    projectId: ctx.project.id,
    types: types ?? 'all',
    since: since ?? 'none',
  });

  exportResources(exporter, ctx.project, types, exportType, since)
    .then(() => globalLogger.info('Bulk export completed', { exportType, jobId: bulkDataExport.id, projectId: ctx.project.id }))
    .catch(async (err) => {
      globalLogger.error('Bulk export failed', {
        exportType,
        jobId: bulkDataExport.id,
        projectId: ctx.project.id,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      try {
        const systemRepo = getSystemRepo();
        await systemRepo.updateResource<AsyncJob>({
          ...bulkDataExport,
          status: 'error',
          transactionTime: new Date().toISOString(),
        });
        globalLogger.info('Bulk export job marked as error', { jobId: bulkDataExport.id });
      } catch (updateErr) {
        globalLogger.error('Failed to mark bulk export job as error', {
          jobId: bulkDataExport.id,
          error: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
      }
    });

  return [accepted(concatUrls(baseUrl, `fhir/R4/bulkdata/export/${bulkDataExport.id}`))];
}

export async function exportResources(
  exporter: BulkExporter,
  project: Project,
  types: string[] | undefined,
  exportLevel: string,
  since?: string
): Promise<void> {
  const resourceTypes = getResourceTypesByExportLevel(exportLevel);
  const pageSize = 1000;

  for (const resourceType of resourceTypes) {
    if (
      !canBeExported(resourceType) ||
      (types && !types.includes(resourceType)) ||
      !exporter.repo.supportsInteraction(AccessPolicyInteraction.SEARCH, resourceType)
    ) {
      continue;
    }
    globalLogger.info('Bulk export: exporting resource type', { resourceType, projectId: project.id });
    await exportResourceType(exporter, resourceType, pageSize, since);
    globalLogger.info('Bulk export: finished resource type', {
      resourceType,
      projectId: project.id,
      count: exporter.resourceSet.size,
    });
  }

  globalLogger.info('Bulk export: closing exporter', { projectId: project.id, totalResources: exporter.resourceSet.size });
  await exporter.close(project);
  globalLogger.info('Bulk export: exporter closed successfully', { projectId: project.id });
}

export async function exportResourceType<T extends Resource>(
  exporter: BulkExporter,
  resourceType: T['resourceType'],
  count: number,
  since?: string
): Promise<void> {
  const repo = exporter.repo;
  const searchRequest: SearchRequest<T> | undefined = {
    resourceType,
    count,
    filters: since ? [{ code: '_lastUpdated', operator: Operator.GREATER_THAN_OR_EQUALS, value: since }] : undefined,
    sortRules: [{ code: '_lastUpdated', descending: false }],
  };
  await repo.processAllResources(searchRequest, async (resource) => {
    await exporter.writeResource(resource);
  });
}

function getResourceTypesByExportLevel(exportLevel: string): ResourceType[] {
  if (exportLevel === 'Patient') {
    return getPatientResourceTypes();
  }

  return getResourceTypes();
}

const unexportedResourceTypes = [
  'Binary',
  'CodeSystem',
  'SearchParameter',
  'StructureDefinition',
  'ValueSet',
  'BulkDataExport',
  'AsyncJob',
  'AuditEvent',
];

function canBeExported(resourceType: string): boolean {
  return !unexportedResourceTypes.includes(resourceType) && !protectedResourceTypes.includes(resourceType);
}
