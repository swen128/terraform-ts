export type TftsError =
  | { readonly kind: "validation"; readonly errors: readonly ValidationError[] }
  | { readonly kind: "synthesis"; readonly message: string; readonly path: readonly string[] }
  | { readonly kind: "circular_dependency"; readonly cycle: readonly string[] }
  | { readonly kind: "config"; readonly message: string }
  | { readonly kind: "codegen"; readonly message: string; readonly provider: string }
  | { readonly kind: "io"; readonly message: string; readonly path: string };

export type ValidationError = {
  readonly path: readonly string[];
  readonly message: string;
  readonly code: ValidationErrorCode;
};

export type ValidationErrorCode =
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_FIELD_TYPE"
  | "INVALID_REFERENCE"
  | "DUPLICATE_ID"
  | "INVALID_LIFECYCLE"
  | "INVALID_PROVIDER"
  | "CIRCULAR_DEPENDENCY"
  | "UNKNOWN";
