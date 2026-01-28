import { Operator, WithId } from '@medplum/core';
// import { readJson } from '@medplum/definitions';
// @ts-expect-error
import v2Tables from "@medplum/definitions/dist/fhir/r4/v2-tables.json" with { type: "json" };
// @ts-expect-error
import v3CodeSystems from "@medplum/definitions/dist/fhir/r4/v3-codesystems.json" with { type: "json" };
// @ts-expect-error
import valuesets from "@medplum/definitions/dist/fhir/r4/valuesets.json" with { type: "json" };
// @ts-expect-error
import valuesetsMedplum from "@medplum/definitions/dist/fhir/r4/valuesets-medplum.json" with { type: "json" };
// @ts-expect-error
import valuesetsMedplumGenerated from "@medplum/definitions/dist/fhir/r4/valuesets-medplum-generated.json" with { type: "json" };

import { Bundle, BundleEntry, CodeSystem, ValueSet } from '@medplum/fhirtypes';
import { r4ProjectId } from '../constants';
import { Repository } from '../fhir/repo';

/**
 * Imports all built-in ValueSets and CodeSystems into the database.
 * @param systemRepo - The system repository to use
 */
export async function rebuildR4ValueSets(systemRepo: Repository): Promise<void> {
  const files = [
    v2Tables,
    v3CodeSystems,
    valuesets,
    valuesetsMedplum,
    valuesetsMedplumGenerated,
  ];
  for (const file of files) {
    const bundle = file as Bundle<CodeSystem | ValueSet>;
    for (const entry of bundle.entry as BundleEntry<CodeSystem | ValueSet>[]) {
      const resource = entry.resource as CodeSystem | ValueSet;
      await deleteExisting(systemRepo, resource, r4ProjectId);
      await systemRepo.createResource({
        ...resource,
        meta: {
          ...resource.meta,
          project: r4ProjectId,
          lastUpdated: undefined,
          versionId: undefined,
        },
      });
    }
  }
}

async function deleteExisting(
  systemRepo: Repository,
  resource: CodeSystem | ValueSet,
  projectId: string
): Promise<void> {
  const bundle = await systemRepo.search({
    resourceType: resource.resourceType,
    filters: [
      { code: 'url', operator: Operator.EQUALS, value: resource.url as string },
      { code: '_project', operator: Operator.EQUALS, value: projectId },
    ],
  });
  if (bundle.entry && bundle.entry.length > 0) {
    for (const entry of bundle.entry) {
      const existing = entry.resource as WithId<CodeSystem | ValueSet>;
      await systemRepo.deleteResource(existing.resourceType, existing.id);
    }
  }
}
