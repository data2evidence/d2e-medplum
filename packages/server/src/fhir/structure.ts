import { indexSearchParameterBundle, indexStructureDefinitionBundle } from '@medplum/core';
// import { readJson, SEARCH_PARAMETER_BUNDLE_FILES } from '@medplum/definitions';
import { Bundle, SearchParameter } from '@medplum/fhirtypes';
// @ts-expect-error
import profiles from "@medplum/definitions/dist/fhir/r4/profiles-types.json" assert { type: "json" };
// @ts-expect-error
import profilesResources from "@medplum/definitions/dist/fhir/r4/profiles-resources.json" assert { type: "json" };
// @ts-expect-error
import profilesMedplum from "@medplum/definitions/dist/fhir/r4/profiles-medplum.json" assert { type: "json" };
// @ts-expect-error
import searchParameters from "@medplum/definitions/dist/fhir/r4/search-parameters.json" assert { type: "json" };
// @ts-expect-error
import searchParametersMedplum from "@medplum/definitions/dist/fhir/r4/search-parameters-medplum.json" assert { type: "json" };
// @ts-expect-error
import searchParametersUSCore from "@medplum/definitions/dist/fhir/r4/search-parameters-uscore.json" assert { type: "json" };

let loaded = false;

export function loadStructureDefinitions(): void {
  if (!loaded) {
    indexStructureDefinitionBundle(profiles as Bundle);
    indexStructureDefinitionBundle(profilesResources as Bundle);
    indexStructureDefinitionBundle(profilesMedplum as Bundle);
    const SEARCH_PARAMETER_BUNDLE_FILES = [
      searchParameters as Bundle<SearchParameter>,
      searchParametersMedplum as Bundle<SearchParameter>,
      searchParametersUSCore as Bundle<SearchParameter>,
    ];

    for (const file of SEARCH_PARAMETER_BUNDLE_FILES) {
      indexSearchParameterBundle(file as Bundle<SearchParameter>);
    }
    loaded = true;
  }
}
