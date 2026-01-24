import type { IConstruct } from "./construct.js";

export enum AnnotationMetadataEntryType {
  INFO = "@tfts/info",
  WARN = "@tfts/warn",
  ERROR = "@tfts/error",
}

export const DISABLE_STACK_TRACE_IN_METADATA = "@tfts/disable_stack_trace_in_metadata";

export class Annotations {
  static of(scope: IConstruct): Annotations {
    return new Annotations(scope);
  }

  private constructor(private readonly scope: IConstruct) {}

  addInfo(message: string): void {
    this.addMessage(AnnotationMetadataEntryType.INFO, message);
  }

  addWarning(message: string): void {
    this.addMessage(AnnotationMetadataEntryType.WARN, message);
  }

  addError(message: string): void {
    this.addMessage(AnnotationMetadataEntryType.ERROR, message);
  }

  private addMessage(level: AnnotationMetadataEntryType, message: string): void {
    this.scope.node.addMetadata(level, message);
  }
}
