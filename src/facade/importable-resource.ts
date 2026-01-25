import type { Construct } from "./construct.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";
import type { TerraformProvider } from "./terraform-provider.js";

export type IImportableConfig = {
  terraformResourceType: string;
  importId: string;
  provider?: TerraformProvider;
};

export class ImportableResource extends TerraformElement {
  readonly kind: ElementKind = "import";

  private readonly config: IImportableConfig;

  constructor(scope: Construct, name: string, config: IImportableConfig) {
    super(scope, name, config.terraformResourceType);
    this.config = config;
  }

  override toTerraform(): Record<string, unknown> {
    const expectedResourceAddress = `${this.config.terraformResourceType}.${this.friendlyUniqueId}`;
    return {
      import: [
        {
          to: expectedResourceAddress,
          id: this.config.importId,
          provider: this.config.provider?.fqn,
        },
      ],
    };
  }

  override toMetadata(): Record<string, unknown> {
    return {
      importsGeneratingConfiguration: [this.friendlyUniqueId],
    };
  }
}
