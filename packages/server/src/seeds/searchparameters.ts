// import { readJson, SEARCH_PARAMETER_BUNDLE_FILES } from '@medplum/definitions';
import { Bundle, BundleEntry, SearchParameter } from '@medplum/fhirtypes';
import { r4ProjectId } from '../constants';
import { DatabaseMode } from '../database';
import { Repository } from '../fhir/repo';
import { globalLogger } from '../logger';
// @ts-expect-error
import searchParameters from "@medplum/definitions/dist/fhir/r4/search-parameters.json" assert { type: "json" };
// @ts-expect-error
import searchParametersMedplum from "@medplum/definitions/dist/fhir/r4/search-parameters-medplum.json" assert { type: "json" };
// @ts-expect-error
import searchParametersUSCore from "@medplum/definitions/dist/fhir/r4/search-parameters-uscore.json" assert { type: "json" };

/**
 * Creates all SearchParameter resources.
 * @param systemRepo - The system repository to use
 */
export async function rebuildR4SearchParameters(systemRepo: Repository): Promise<void> {
  const client = systemRepo.getDatabaseClient(DatabaseMode.WRITER);
  await client.query('DELETE FROM "SearchParameter" WHERE "projectId" = $1', [r4ProjectId]);
  const SEARCH_PARAMETER_BUNDLE_FILES = [
    searchParameters as Bundle<SearchParameter>,
    searchParametersMedplum as Bundle<SearchParameter>,
    searchParametersUSCore as Bundle<SearchParameter>,
  ];

  for (const filename of SEARCH_PARAMETER_BUNDLE_FILES) {
    for (const entry of filename.entry as BundleEntry[]) {
      await createParameter(systemRepo, entry.resource as SearchParameter);
    }
  }
}

async function createParameter(systemRepo: Repository, param: SearchParameter): Promise<void> {
  globalLogger.debug('SearchParameter: ' + param.name);
  await systemRepo.createResource<SearchParameter>({
    ...param,
    meta: {
      ...param.meta,
      project: r4ProjectId,
      lastUpdated: undefined,
      versionId: undefined,
    },
    text: undefined,
  });
}
