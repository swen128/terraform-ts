# tfts

A TypeScript SDK for defining Terraform infrastructure as code. Drop-in replacement for CDKTF.

**[Documentation](https://tfts.mintlify.app/)**

## Installation

```bash
npm install tfts
```

## Quick Start

### Create configuration file

Create `cdktf.json` in your project root:

```json
{
  "language": "typescript",
  "app": "bun run main.ts",
  "terraformProviders": ["hashicorp/google@~>6.0"]
}
```

### Generate provider bindings

```bash
npx tfts get
```

### Define your infrastructure

```typescript
// main.ts
import { App, TerraformStack, TerraformOutput } from "tfts";
import { GoogleProvider } from "./.gen/providers/hashicorp/google/provider.js";
import { ComputeInstance } from "./.gen/providers/hashicorp/google/resources/compute-instance.js";

class MyStack extends TerraformStack {
  constructor(scope: App, id: string) {
    super(scope, id);

    new GoogleProvider(this, "google", {
      project: "my-project",
      region: "us-central1",
    });

    const instance = new ComputeInstance(this, "vm", {
      name: "my-instance",
      machineType: "e2-micro",
      zone: "us-central1-a",
      bootDisk: {
        initializeParams: {
          image: "debian-cloud/debian-11",
        },
      },
      networkInterface: [{ network: "default" }],
    });

    new TerraformOutput(this, "instance-ip", {
      value: instance.networkInterface.get(0).networkIp,
    });
  }
}

const app = new App();
new MyStack(app, "my-stack");
app.synth();
```

### Synthesize and deploy

```bash
npx tfts synth
cd cdktf.out/stacks/my-stack
terraform init
terraform apply
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `tfts get` | Generate provider bindings from `cdktf.json` |
| `tfts synth` | Synthesize Terraform JSON configuration |
| `tfts diff` | Show planned changes (terraform plan) |
| `tfts deploy` | Deploy the stack (terraform apply) |
| `tfts destroy` | Destroy the stack (terraform destroy) |
| `tfts output` | Show stack outputs (terraform output) |
| `tfts list` | List all stacks |
| `tfts force-unlock` | Release a stuck state lock |

## Core Concepts

### App & Stack

```typescript
const app = new App();
new MyStack(app, "production");
new MyStack(app, "staging");
app.synth();
```

### Variables & Outputs

```typescript
const region = new TerraformVariable(this, "region", {
  type: "string",
  default: "us-central1",
});

new TerraformOutput(this, "url", {
  value: instance.selfLink,
  sensitive: true,
});
```

### References

Resource attributes automatically create Terraform references:

```typescript
const bucket = new StorageBucket(this, "bucket", { name: "my-bucket" });
new ComputeInstance(this, "vm", {
  metadata: { bucket: bucket.name }, // Creates ${google_storage_bucket.bucket.name}
});
```

### Functions

```typescript
import { Fn } from "tfts";

Fn.join("-", ["hello", "world"]);
Fn.lookup(myMap, "key", "default");
Fn.base64encode("hello");
```

### Backends

```typescript
import { GcsBackend, S3Backend, RemoteBackend } from "tfts";

new GcsBackend(this, { bucket: "my-tf-state", prefix: "prod" });
```

## Migrating from CDKTF

See the [Migration Guide](https://tfts.mintlify.app/guides/migration-cdktf) for detailed instructions.

Quick start:

```bash
# Remove CDKTF, add tfts
npm remove cdktf cdktf-cli @cdktf/provider-aws @cdktf/provider-google
npm install tfts

# Run migration script (rewrites imports)
curl -O https://raw.githubusercontent.com/swen128/terraform-ts/main/scripts/migrate-from-cdktf.ts
bun migrate-from-cdktf.ts .

# Regenerate provider bindings
npx tfts get
```

## License

MIT
