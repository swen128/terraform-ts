# tfts

TypeScript-first infrastructure as code for Terraform. A lightweight, type-safe alternative to CDKTF.

## Overview

tfts lets you define Terraform infrastructure using TypeScript with full type safety. It generates Terraform JSON that you can apply with the standard Terraform CLI.

Key differences from CDKTF:

- **Type-safe attribute references** - Computed attributes return `TokenValue<string>` instead of `string`, preventing invalid operations like `.toUpperCase()` at compile time
- **Lightweight** - No JSII, no complex runtime, just TypeScript

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) or Node.js
- [Terraform CLI](https://developer.hashicorp.com/terraform/downloads)

### Installation

```bash
bun add tfts
```

### Project Setup

Create `cdktf.json`:

```json
{
  "language": "typescript",
  "app": "bun main.ts",
  "output": "cdktf.out",
  "codeMakerOutput": ".gen",
  "terraformProviders": [
    {
      "name": "google",
      "source": "hashicorp/google",
      "version": "5.0.0"
    }
  ]
}
```

Generate provider bindings:

```bash
bunx tfts get
```

### Write Infrastructure

Create `main.ts`:

```typescript
import { App, TerraformStack, TerraformOutput } from "tfts";
import { GoogleProvider, GoogleComputeNetwork } from "./.gen/providers/google/index.js";

const app = new App();
const stack = new TerraformStack(app, "my-stack");

new GoogleProvider(stack, "google", {
  project: "my-project",
  region: "us-central1",
});

const network = new GoogleComputeNetwork(stack, "network", {
  name: "my-network",
  autoCreateSubnetworks: true,
});

new TerraformOutput(stack, "network_id", {
  value: network.id,
});

app.synth();
```

### Deploy

```bash
# Synthesize to Terraform JSON
bun main.ts

# Apply with Terraform
cd cdktf.out/stacks/my-stack
terraform init
terraform apply
```

## Migration from CDKTF

### Type-Safe Attributes

The main difference: computed attributes return `TokenValue<string>` instead of `string`.

```typescript
// CDKTF - compiles but broken at runtime
network.id.toUpperCase();

// tfts - compile error (TokenValue<string> has no .toUpperCase())
network.id.toUpperCase(); // Error!

// tfts - template literals work via toString()
`prefix-${network.id}`;
```

### Custom Constructs

If your CDKTF code has custom constructs with string config properties:

```typescript
// CDKTF
interface MyDatabaseConfig {
  name: string;
  vpcId: string;  // Often passed a token like vpc.id
}

class MyDatabase extends Construct {
  constructor(scope: Construct, id: string, config: MyDatabaseConfig) {
    // ...
  }
}

new MyDatabase(stack, "db", {
  name: "mydb",
  vpcId: vpc.id,  // Works in CDKTF because vpc.id is typed as string
});
```

In tfts, update config properties that accept tokens to use `TfString`:

```typescript
import { TfString } from "tfts";

// tfts
interface MyDatabaseConfig {
  name: string;      // Literal only - keep as string
  vpcId: TfString;   // Accepts tokens - use TfString
}
```

### Import Changes

```typescript
// CDKTF
import { App, TerraformStack } from "cdktf";

// tfts
import { App, TerraformStack } from "tfts";
```

### Supported Constructs

| Construct | Status |
|-----------|--------|
| TerraformResource | Supported |
| TerraformDataSource | Supported |
| TerraformProvider | Supported |
| TerraformVariable | Supported |
| TerraformOutput | Supported |
| TerraformLocal | Supported |
| Backends (S3, GCS, Remote, Local) | Supported |
| TerraformModule | Not yet |
| TerraformIterator | Not yet |

## License

MIT
