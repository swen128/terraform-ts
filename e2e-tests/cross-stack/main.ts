import { App, TerraformOutput, TerraformStack } from "tfts";
import { NullProvider } from "./.gen/providers/hashicorp/null/provider.js";
import { Resource } from "./.gen/providers/hashicorp/null/resources/resource.js";

class SourceStack extends TerraformStack {
  public readonly resource: Resource;

  constructor(scope: App, id: string) {
    super(scope, id);
    new NullProvider(this, "null");

    this.resource = new Resource(this, "source-resource", {
      triggers: {
        timestamp: "initial",
      },
    });

    new TerraformOutput(this, "source-id", {
      value: this.resource.id,
    });
  }
}

class ConsumerStack extends TerraformStack {
  constructor(scope: App, id: string, sourceResource: Resource) {
    super(scope, id);
    new NullProvider(this, "null");

    new Resource(this, "consumer-resource", {
      triggers: {
        source_ref: sourceResource.id,
      },
    });

    new TerraformOutput(this, "consumer-source-ref", {
      value: sourceResource.id,
    });
  }
}

const app = new App();
const source = new SourceStack(app, "source-stack");
new ConsumerStack(app, "consumer-stack", source.resource);
app.synth();
