export type PropMapping = {
  readonly tfName: string;
  readonly tsName: string;
};

export type AttributeGetter = {
  readonly tfName: string;
  readonly tsName: string;
};

export const resourceTemplate = (
  className: string,
  terraformType: string,
  props: readonly PropMapping[],
  getters: readonly AttributeGetter[] = [],
): string => {
  const attrsObject = props.map((p) => `      ${p.tfName}: config.${p.tsName},`).join("\n");

  const getterMethods = getters
    .map((g) => {
      return `  get ${g.tsName}(): TokenString {
    return this.getStringAttribute("${g.tfName}");
  }`;
    })
    .join("\n\n");

  const gettersSection = getterMethods.length > 0 ? `\n\n${getterMethods}` : "";

  return `export class ${className} extends TerraformResource {
  constructor(scope: Construct, id: string, config: ${className}Config) {
    super(scope, id, "${terraformType}", {
${attrsObject}
    }, config);
  }${gettersSection}
}`;
};

export const providerTemplate = (
  className: string,
  source: string,
  props: readonly PropMapping[],
): string => {
  const attrsObject = props.map((p) => `      ${p.tfName}: config.${p.tsName},`).join("\n");

  return `export class ${className}Provider extends TerraformProvider {
  constructor(scope: Construct, id: string, config: ${className}ProviderConfig = {}) {
    super(scope, id, "${source}", {
${attrsObject}
    }, config);
  }
}`;
};

export const dataSourceTemplate = (
  className: string,
  terraformType: string,
  props: readonly PropMapping[],
  getters: readonly AttributeGetter[] = [],
): string => {
  const attrsObject = props.map((p) => `      ${p.tfName}: config.${p.tsName},`).join("\n");

  const getterMethods = getters
    .map((g) => {
      return `  get ${g.tsName}(): TokenString {
    return this.getStringAttribute("${g.tfName}");
  }`;
    })
    .join("\n\n");

  const gettersSection = getterMethods.length > 0 ? `\n\n${getterMethods}` : "";

  return `export class ${className} extends TerraformDataSource {
  constructor(scope: Construct, id: string, config: ${className}Config) {
    super(scope, id, "${terraformType}", {
${attrsObject}
    }, config);
  }${gettersSection}
}`;
};

export const configInterfaceTemplate = (
  name: string,
  lines: readonly string[],
  baseType?: string,
): string => {
  const extendsClause = baseType !== undefined ? ` & ${baseType}` : "";
  if (lines.length === 0) {
    return baseType !== undefined
      ? `export type ${name} = ${baseType};`
      : `export type ${name} = Record<string, never>;`;
  }
  return `export type ${name} = {
${lines.join("\n")}
}${extendsClause};`;
};
