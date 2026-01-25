export type Mapper = (x: unknown) => unknown;

function identity(x: unknown): unknown {
  return x;
}

export const stringToTerraform: Mapper = identity;
export const booleanToTerraform: Mapper = identity;
export const anyToTerraform: Mapper = identity;
export const numberToTerraform: Mapper = identity;

export const stringToHclTerraform: Mapper = identity;
export const booleanToHclTerraform: Mapper = identity;
export const anyToHclTerraform: Mapper = identity;
export const numberToHclTerraform: Mapper = identity;

export function listMapper(elementMapper: Mapper, _isBlockType?: boolean): Mapper {
  return (x: unknown): unknown => {
    if (!canInspect(x)) {
      return x;
    }
    if (!Array.isArray(x)) {
      return x;
    }
    return x.map(elementMapper);
  };
}

export function listMapperHcl(elementMapper: Mapper, _isBlockType?: boolean): Mapper {
  return (x: unknown): unknown => {
    if (!canInspect(x)) {
      return x;
    }
    if (!Array.isArray(x)) {
      return x;
    }
    return x.map(elementMapper);
  };
}

export function hashMapper(elementMapper: Mapper): Mapper {
  return (x: unknown): unknown => {
    if (!canInspect(x) || typeof x === "string" || typeof x !== "object" || x === null) {
      return x;
    }
    return Object.fromEntries(Object.entries(x).map(([key, value]) => [key, elementMapper(value)]));
  };
}

export function hashMapperHcl(elementMapper: Mapper): Mapper {
  return (x: unknown): unknown => {
    if (!canInspect(x) || typeof x === "string" || typeof x !== "object" || x === null) {
      return x;
    }
    return Object.fromEntries(Object.entries(x).map(([key, value]) => [key, elementMapper(value)]));
  };
}

export function canInspect(x: unknown): boolean {
  return x !== null && x !== undefined;
}

export function isComplexElement(_x: unknown): boolean {
  return false;
}
