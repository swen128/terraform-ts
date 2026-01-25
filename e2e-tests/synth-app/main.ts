import { App, Fn, LocalBackend, TerraformOutput, TerraformStack, TerraformVariable } from "tfts";
import { NullProvider } from "./.gen/providers/hashicorp/null/provider.js";
import { Resource } from "./.gen/providers/hashicorp/null/resources/resource.js";

class HelloTerra extends TerraformStack {
  constructor(scope: App, id: string) {
    super(scope, id);

    new LocalBackend(this, {
      path: "terraform.tfstate",
    });

    new NullProvider(this, "null");

    const myVar = new TerraformVariable(this, "my_var", {
      type: "string",
      default: "default-value",
      description: "A test variable",
    });

    const resource1 = new Resource(this, "resource1", {
      triggers: {
        foo: "bar",
        variable: myVar.stringValue,
      },
    });

    resource1.addOverride("triggers.overridden", "true");
    resource1.addOverride("lifecycle", { create_before_destroy: true });

    new Resource(this, "resource2", {
      triggers: {
        ref: resource1.id,
      },
    });

    new TerraformOutput(this, "resource1-id", {
      value: resource1.id,
    });

    new TerraformOutput(this, "variable-value", {
      value: myVar.stringValue,
    });

    new TerraformOutput(this, "joined-value", {
      value: Fn.join("-", ["hello", "world"]),
    });
  }
}

const app = new App();
new HelloTerra(app, "hello-terra");
app.synth();
