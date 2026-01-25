# tfts

A TypeScript SDK for defining Terraform infrastructure as code. Drop-in replacement for CDKTF.

## Installation

```bash
bun add tfts
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
bunx tfts get
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
bunx tfts synth
cd cdktf.out/stacks/my-stack
terraform init
terraform apply
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `tfts get` | Generate provider bindings from `cdktf.json` |
| `tfts synth` | Synthesize Terraform JSON configuration |

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

### Automated (using ast-grep)

```bash
# Rewrite imports
ast-grep --pattern 'from "cdktf"' --rewrite 'from "tfts"' --lang ts -U .

# Update package.json
npm remove cdktf
npm add tfts
```

### Manual

1. Update `package.json`:

```diff
- "cdktf": "^0.20.0"
+ "tfts": "^0.3.0"
```

2. Update imports in all `.ts` files:

```diff
- import { App, TerraformStack } from "cdktf";
+ import { App, TerraformStack } from "tfts";
```

3. Regenerate provider bindings:

```bash
tfts get
```

## License

MIT
