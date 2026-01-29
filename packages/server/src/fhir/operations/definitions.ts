import { OperationOutcomeError, serverError } from '@medplum/core';
// import { readJson } from '@medplum/definitions';
import { Bundle, OperationDefinition, ResourceType, StructureDefinition } from '@medplum/fhirtypes';
// @ts-expect-error
import profilesResources from "@medplum/definitions/dist/fhir/r4/profiles-resources.json" with { type: "json" };

const operationDefinitions = (
  profilesResources as Bundle<StructureDefinition | OperationDefinition>
).entry
  ?.filter((e) => e.resource?.resourceType === 'OperationDefinition')
  ?.map((e) => e.resource as OperationDefinition);

export function getOperationDefinition(resourceType: ResourceType, code: string): OperationDefinition {
  const opDef = operationDefinitions?.find((od) => od.resource?.includes(resourceType) && od.code === code);
  if (!opDef) {
    throw new OperationOutcomeError(serverError(new Error('OperationDefinition not found')));
  }
  return opDef;
}
