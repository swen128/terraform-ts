# tfts Documentation

This directory contains the documentation for [tfts](https://github.com/swen128/terraform-ts), a TypeScript SDK for generating Terraform configurations.

## Local Development

Install the [Mintlify CLI](https://www.npmjs.com/package/mint) to preview documentation changes locally:

```bash
npm i -g mint
```

Run the development server:

```bash
cd docs
mint dev
```

View your local preview at `http://localhost:3000`.

## Documentation Structure

```
docs/
├── index.mdx              # Home page
├── quickstart.mdx         # Getting started guide
├── guides/                # Core guides
│   ├── installation.mdx
│   ├── configuration.mdx
│   ├── core-concepts.mdx
│   ├── references.mdx
│   ├── variables-outputs.mdx
│   ├── functions.mdx
│   ├── backends.mdx
│   └── migration-cdktf.mdx
├── cli-reference/         # CLI command documentation
│   ├── overview.mdx
│   ├── get.mdx
│   ├── synth.mdx
│   ├── diff.mdx
│   ├── deploy.mdx
│   ├── destroy.mdx
│   ├── output.mdx
│   ├── list.mdx
│   └── force-unlock.mdx
├── advanced/              # Advanced topics
│   ├── aspects.mdx
│   ├── iterators.mdx
│   ├── remote-state.mdx
│   ├── assets.mdx
│   ├── modules.mdx
│   └── tokens.mdx
├── api-reference/         # API documentation
│   ├── app.mdx
│   ├── stack.mdx
│   ├── construct.mdx
│   ├── resource.mdx
│   ├── data-source.mdx
│   ├── provider.mdx
│   ├── variable.mdx
│   ├── output.mdx
│   ├── local.mdx
│   ├── backends.mdx
│   ├── functions.mdx
│   ├── operators.mdx
│   ├── iterator.mdx
│   └── remote-state.mdx
├── testing/               # Testing documentation
│   └── overview.mdx
└── examples/              # Example projects
    ├── aws.mdx
    ├── gcp.mdx
    ├── multi-stack.mdx
    └── reusable-constructs.mdx
```

## Configuration

The `docs.json` file configures the documentation site, including navigation, colors, and branding.

## Troubleshooting

- If the dev environment is not running: Run `mint update` to ensure you have the latest CLI version.
- If a page shows 404: Make sure you are running in the `docs/` directory where `docs.json` is located.

## Resources

- [Mintlify Documentation](https://mintlify.com/docs)
- [tfts GitHub Repository](https://github.com/swen128/terraform-ts)
- [tfts npm Package](https://www.npmjs.com/package/tfts)
