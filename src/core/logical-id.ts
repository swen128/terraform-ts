import { createHash } from "crypto";

const HIDDEN_ID = "Default";
const HIDDEN_FROM_HUMAN_ID = "Resource";
const PATH_SEP = "/";
const UNIQUE_SEP = "_";
const HASH_LEN = 8;
const MAX_HUMAN_LEN = 240;
const MAX_ID_LEN = 255;

const removeNonAlphanumeric = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, "");

const pathHash = (path: readonly string[]): string => {
  const md5 = createHash("md5").update(path.join(PATH_SEP)).digest("hex");
  return md5.slice(0, HASH_LEN).toUpperCase();
};

const removeDupes = (path: readonly string[]): readonly string[] => {
  const ret: string[] = [];
  for (const component of path) {
    const last = ret[ret.length - 1];
    if (last === undefined || !last.endsWith(component)) {
      ret.push(component);
    }
  }
  return ret;
};

export const generateLogicalId = (path: readonly string[]): string => {
  const components = path.slice(1).filter((x) => x !== HIDDEN_ID);

  if (components.length === 0) {
    return "";
  }

  if (components.length === 1) {
    const first = components[0];
    if (first === undefined) {
      return "";
    }
    const candidate = removeNonAlphanumeric(first);
    if (candidate.length <= MAX_ID_LEN) {
      return candidate;
    }
  }

  const hash = pathHash(components);
  const human = removeDupes(components)
    .filter((x) => x !== HIDDEN_FROM_HUMAN_ID)
    .map(removeNonAlphanumeric)
    .join(UNIQUE_SEP)
    .slice(0, MAX_HUMAN_LEN);

  return human + UNIQUE_SEP + hash;
};

export const generateFqn = (resourceType: string, logicalId: string): string =>
  `${resourceType}.${logicalId}`;
