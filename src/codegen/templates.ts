export const resourceTemplate = (
  className: string,
  terraformType: string,
  props: readonly string[],
): string => {
  const propsAssignment = props.map((p) => `    this.${p} = config.${p};`).join("\n");

  return `export class ${className} extends TerraformResource {
  ${props.map((p) => `readonly ${p}: ${className}Config["${p}"];`).join("\n  ")}

  constructor(scope: TerraformStack, id: string, config: ${className}Config) {
    super(scope, id, "${terraformType}", config);
${propsAssignment}
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    return {
      ${props.map((p) => `${p}: this.${p},`).join("\n      ")}
    };
  }
}`;
};

export const providerTemplate = (
  className: string,
  source: string,
  props: readonly string[],
): string => {
  const propsAssignment = props.map((p) => `    this.${p} = config.${p};`).join("\n");

  return `export class ${className}Provider extends TerraformProvider {
  ${props.map((p) => `readonly ${p}: ${className}Config["${p}"];`).join("\n  ")}

  constructor(scope: TerraformStack, id: string, config: ${className}Config = {}) {
    super(scope, id, "${source}", undefined, config);
${propsAssignment}
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    return {
      ${props.map((p) => `${p}: this.${p},`).join("\n      ")}
    };
  }
}`;
};

export const dataSourceTemplate = (
  className: string,
  terraformType: string,
  props: readonly string[],
): string => {
  const propsAssignment = props.map((p) => `    this.${p} = config.${p};`).join("\n");

  return `export class ${className} extends TerraformDataSource {
  ${props.map((p) => `readonly ${p}: ${className}Config["${p}"];`).join("\n  ")}

  constructor(scope: TerraformStack, id: string, config: ${className}Config) {
    super(scope, id, "${terraformType}", config);
${propsAssignment}
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    return {
      ${props.map((p) => `${p}: this.${p},`).join("\n      ")}
    };
  }
}`;
};

export const configInterfaceTemplate = (name: string, lines: readonly string[]): string => {
  if (lines.length === 0) {
    return `export type ${name} = Record<string, never>;`;
  }
  return `export type ${name} = {
${lines.join("\n")}
};`;
};

export const indexTemplate = (
  resources: readonly string[],
  dataSources: readonly string[],
): string => {
  const exports: string[] = [];

  for (const resource of resources) {
    exports.push(`export { ${resource} } from "./${toFileName(resource)}.js";`);
  }

  for (const dataSource of dataSources) {
    exports.push(`export { ${dataSource} } from "./${toFileName(dataSource)}.js";`);
  }

  return exports.join("\n");
};

const toFileName = (className: string): string => {
  return className
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");
};
