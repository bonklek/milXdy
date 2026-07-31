import { jsonPointerGet } from "./lib.mjs";

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value === "object" ? "object" : typeof value;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function joinPath(base, key) {
  if (/^[0-9]+$/.test(String(key))) return `${base}[${key}]`;
  return base === "$" ? `$.${key}` : `${base}.${key}`;
}

function matchesFormat(value, format) {
  if (typeof value !== "string") return false;
  if (format === "date") {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  }
  if (format === "date-time") {
    return !Number.isNaN(Date.parse(value)) && /T/.test(value);
  }
  return true;
}

export function validateWithSchema(value, schema, rootSchema = schema, instancePath = "$") {
  const errors = [];
  if (!schema || typeof schema !== "object") return errors;

  if (schema.$ref) {
    const resolved = jsonPointerGet(rootSchema, schema.$ref);
    errors.push(...validateWithSchema(value, resolved, rootSchema, instancePath));
  }

  if (schema.allOf) {
    for (const candidate of schema.allOf) {
      errors.push(...validateWithSchema(value, candidate, rootSchema, instancePath));
    }
  }

  if (schema.anyOf) {
    const matches = schema.anyOf.filter((candidate) =>
      validateWithSchema(value, candidate, rootSchema, instancePath).length === 0
    );
    if (matches.length === 0) errors.push(`${instancePath}: must satisfy at least one anyOf branch`);
  }

  if (schema.oneOf) {
    const matches = schema.oneOf.filter((candidate) =>
      validateWithSchema(value, candidate, rootSchema, instancePath).length === 0
    );
    if (matches.length !== 1) errors.push(`${instancePath}: must satisfy exactly one oneOf branch`);
  }

  if (schema.not) {
    const matchesForbiddenSchema = validateWithSchema(value, schema.not, rootSchema, instancePath).length === 0;
    if (matchesForbiddenSchema) errors.push(`${instancePath}: matches forbidden schema`);
  }

  if (schema.if) {
    const conditionMatches = validateWithSchema(value, schema.if, rootSchema, instancePath).length === 0;
    if (conditionMatches && schema.then) {
      errors.push(...validateWithSchema(value, schema.then, rootSchema, instancePath));
    } else if (!conditionMatches && schema.else) {
      errors.push(...validateWithSchema(value, schema.else, rootSchema, instancePath));
    }
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push(`${instancePath}: must equal ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    errors.push(`${instancePath}: must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}`);
  }

  if (schema.type) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = typeOf(value);
    const typeMatches = expectedTypes.some((expected) => {
      if (expected === "number") return actualType === "number" || actualType === "integer";
      return actualType === expected;
    });
    if (!typeMatches) {
      errors.push(`${instancePath}: expected ${expectedTypes.join("|")}, got ${actualType}`);
      return errors;
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${instancePath}: must contain at least ${schema.minLength} characters`);
    }
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) {
      errors.push(`${instancePath}: must match ${schema.pattern}`);
    }
    if (schema.format && !matchesFormat(value, schema.format)) {
      errors.push(`${instancePath}: must use ${schema.format} format`);
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${instancePath}: must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${instancePath}: must be <= ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${instancePath}: must contain at least ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${instancePath}: must contain at most ${schema.maxItems} items`);
    }
    if (schema.uniqueItems) {
      const unique = new Set(value.map((item) => JSON.stringify(item)));
      if (unique.size !== value.length) errors.push(`${instancePath}: items must be unique`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateWithSchema(item, schema.items, rootSchema, joinPath(instancePath, index)));
      });
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!Object.hasOwn(value, key)) errors.push(`${joinPath(instancePath, key)}: is required`);
      }
    }
    if (schema.properties) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (Object.hasOwn(value, key)) {
          errors.push(...validateWithSchema(value[key], propertySchema, rootSchema, joinPath(instancePath, key)));
        }
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${joinPath(instancePath, key)}: additional property is not allowed`);
      }
    }
  }

  return errors;
}
