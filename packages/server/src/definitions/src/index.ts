import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
//@ts-ignore
// const __dirname = dirname(fileURLToPath(import.meta.url)).replace(/\/src$/, '/dist');
const __dirname = "/usr/src/data/plugins/@data2evidence/d2e-fhir-server/src/definitions/dist/";

export function readJson(filename: string): any {
  let baseDir: string = "";
  if (typeof __dirname !== 'undefined') {
    baseDir = './dist';
    // @ts-expect-error
  } else if (typeof import.meta !== 'undefined') {
    // @ts-expect-error
    baseDir = dirname(fileURLToPath(import.meta.url));
    baseDir = `/usr/src/data/plugins/@data2evidence/d2e-fhir-server/src/definitions/dist/`;
  }
  return JSON.parse(readFileSync(resolve(__dirname, filename), 'utf8'));
}

/**
 * The list of all known search parameter definition bundle file paths relative to the
 * `@medplum/definitions` package. Typically used in conjunction with `readJson`.
 */
export const SEARCH_PARAMETER_BUNDLE_FILES = [
  'fhir/r4/search-parameters.json',
  'fhir/r4/search-parameters-medplum.json',
  'fhir/r4/search-parameters-uscore.json',
];
