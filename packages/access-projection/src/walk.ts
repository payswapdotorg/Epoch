/**
 * The zod-schema-driven field walk (the W041 dispatch pin: "zod-schema-driven
 * field walks over the W036 record shapes").
 *
 * The walk enumerates the LEAF field paths of one canonical sealed record
 * by walking the record's OWN zod schema (the W036
 * Sealed{ProgramOfWork,DeliveryRecord,SolutionVersion,DistinctionRecord}
 * schemas) side-by-side with its parsed value:
 *
 * - the SCHEMA drives structure (which keys exist, unwrapping
 *   optional/nullable/readonly wrappers, array elements, record values,
 *   union option selection), so a field the W036 schema does not declare
 *   can never be walked — and can never leak;
 * - the VALUE instantiates (present optional keys, array lengths, union
 *   branches), so absent fields produce no entries at all;
 * - every emitted leaf passes through BY REFERENCE (same value, same
 *   digest) when the policy releases it.
 *
 * Path grammar: dot-separated object keys, `[<index>]` for array
 * positions — `workPackages[0].activities[2].title`. Policy allowlists
 * and section registries use TEMPLATES where `[]` matches any index
 * (`workPackages[].activities[].title`).
 *
 * Determinism: object keys are walked in schema-shape order (static);
 * array indices ascending; the resulting entries are sorted by path by
 * the caller when canonical order is required.
 */
import type { ZodType } from 'zod';
import type { JsonValue } from '@epoch/agent-protocol';

/** One walked leaf: a concrete field path and its value (by reference). */
export interface LeafEntry {
  readonly path: string;
  readonly value: JsonValue;
}

/** Unwrap transparent schema wrappers (readonly/optional/nullable/default). */
function unwrapSchema(schema: ZodType): ZodType {
  let current = schema;
  for (let depth = 0; depth < 16; depth += 1) {
    const type = (current as unknown as { _zod: { def: { type: string } } })._zod.def.type;
    if (
      type === 'readonly' ||
      type === 'optional' ||
      type === 'nullable' ||
      type === 'default' ||
      type === 'prefault'
    ) {
      current = (current as unknown as { _zod: { def: { innerType: ZodType } } })._zod.def
        .innerType;
      continue;
    }
    return current;
  }
  return current;
}

/** Whether a value is a plain object (walkable). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Walk (schema, value) into leaf entries. The schema drives the
 * structure; unrecognized structural nodes fall back to a VALUE walk
 * (objects/arrays recursed generically) so the walk is total — every
 * leaf of a schema-parsed record is enumerated exactly once.
 */
export function walkSchemaLeaves(schema: ZodType, value: unknown): readonly LeafEntry[] {
  const entries: LeafEntry[] = [];
  walkInto(schema, value, '', entries);
  return entries;
}

function walkInto(schema: ZodType, value: unknown, prefix: string, out: LeafEntry[]): void {
  const unwrapped = unwrapSchema(schema);
  const def = (unwrapped as unknown as { _zod: { def: Record<string, unknown> } })._zod.def;
  const type = def.type as string;

  if (value === undefined) {
    // An absent optional produces no entry at all (canonical-JSON
    // semantics: undefined never serializes, never walks, never leaks).
    return;
  }
  if (value === null) {
    // An explicit null is a leaf in its own right (a JsonValue).
    if (prefix !== '') out.push({ path: prefix, value: null });
    return;
  }

  switch (type) {
    case 'object': {
      if (!isPlainObject(value)) {
        if (prefix !== '') out.push({ path: prefix, value: value as JsonValue });
        return;
      }
      const shape = def.shape as Record<string, ZodType>;
      for (const key of Object.keys(shape)) {
        if (!(key in value)) continue;
        walkInto(shape[key]!, value[key], prefix === '' ? key : `${prefix}.${key}`, out);
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        if (prefix !== '') out.push({ path: prefix, value: value as JsonValue });
        return;
      }
      const element = def.element as ZodType;
      for (let i = 0; i < value.length; i += 1) {
        walkInto(element, value[i], `${prefix}[${i}]`, out);
      }
      return;
    }
    case 'union': {
      const options = def.options as readonly ZodType[];
      const matching = options.find((option) => option.safeParse(value).success);
      if (matching !== undefined) {
        walkInto(matching, value, prefix, out);
        return;
      }
      valueWalk(value, prefix, out);
      return;
    }
    case 'record': {
      if (!isPlainObject(value)) {
        if (prefix !== '') out.push({ path: prefix, value: value as JsonValue });
        return;
      }
      const valueSchema = def.value as ZodType;
      for (const key of Object.keys(value).sort()) {
        walkInto(valueSchema, value[key], prefix === '' ? key : `${prefix}.${key}`, out);
      }
      return;
    }
    case 'intersection': {
      walkInto(def.left as ZodType, value, prefix, out);
      return;
    }
    default: {
      // Leaves: string/number/boolean/literal/enum/date/bigint/pipe/...
      if (prefix !== '') out.push({ path: prefix, value: value as JsonValue });
      return;
    }
  }
}

/** The total fallback: walk an arbitrary JSON value structurally. */
function valueWalk(value: unknown, prefix: string, out: LeafEntry[]): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      valueWalk(value[i], `${prefix}[${i}]`, out);
    }
    return;
  }
  if (isPlainObject(value)) {
    if (prefix === '') {
      for (const key of Object.keys(value).sort()) {
        valueWalk(value[key], key, out);
      }
      return;
    }
    out.push({ path: prefix, value: value as unknown as JsonValue });
    return;
  }
  if (prefix !== '') out.push({ path: prefix, value: value as JsonValue });
}

// --------------------------------------------------------------------------------
// Template matching (policy data -> concrete walk paths).
// --------------------------------------------------------------------------------

/** Escape one literal for use inside a RegExp. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One template segment as a regex source: `workPackages[]` -> `workPackages\[\d+\]`. */
function templateSegmentSource(segment: string): string {
  if (segment === '[]') return '\\[\\d+\\]';
  if (segment.endsWith('[]')) return `${escapeRegExp(segment.slice(0, -2))}\\[\\d+\\]`;
  return escapeRegExp(segment);
}

/** The regex source of a whole template (dot-separated segments). */
function templateSource(template: string): string {
  return template
    .split('.')
    .map((segment) => templateSegmentSource(segment))
    .join('\\.');
}

/**
 * Compile one field-path template into a matcher over concrete LEAF walk
 * paths: `[]` matches any single array position, so
 * `workPackages[].activities[].title` matches
 * `workPackages[0].activities[2].title`.
 */
export function templateMatcher(template: string): (path: string) => boolean {
  const pattern = new RegExp(`^${templateSource(template)}$`);
  return (path: string): boolean => pattern.test(path);
}

/** Precompile a leaf-template list (the policy hot path). */
export function compileTemplates(
  templates: readonly string[],
): readonly ((path: string) => boolean)[] {
  return templates.map(templateMatcher);
}

/** Whether one concrete leaf path matches any of the given templates. */
export function matchesAnyTemplate(
  path: string,
  matchers: readonly ((path: string) => boolean)[],
): boolean {
  return matchers.some((match) => match(path));
}

/**
 * The ancestor prefixes of one concrete walk path, longest first:
 * `a[0].b[1].c` -> [`a[0].b[1]`, `a[0].b`, `a[0]`]. Ancestors are the
 * OBJECT/ELEMENT nodes governing a leaf — the granularity of
 * element-scoped sections (evidence).
 */
export function ancestorPrefixes(path: string): readonly string[] {
  const ancestors: string[] = [];
  let current = path;
  for (let depth = 0; depth < 64; depth += 1) {
    const dot = current.lastIndexOf('.');
    const bracket = current.lastIndexOf('[');
    let cut: number;
    if (dot < 0 && bracket < 0) break;
    if (dot > bracket) {
      cut = dot;
    } else {
      cut = bracket;
    }
    current = current.slice(0, cut);
    if (current === '') break;
    ancestors.push(current);
  }
  return ancestors;
}

/**
 * Compile one ELEMENT template (a template whose last segment is an
 * array position, e.g. `workPackages[].activities[].evidence[]`) into a
 * matcher over concrete element paths. Used by element-scoped sections:
 * a leaf is governed by the section when one of its ancestor prefixes
 * matches, and the governing element carries its own identity leaf
 * (e.g. `digest`) the scope can resolve.
 */
export function elementMatcher(template: string): (elementPath: string) => boolean {
  const pattern = new RegExp(`^${templateSource(template)}$`);
  return (elementPath: string): boolean => pattern.test(elementPath);
}

/** Precompile an element-template list. */
export function compileElementMatchers(
  templates: readonly string[],
): readonly ((elementPath: string) => boolean)[] {
  return templates.map(elementMatcher);
}

/**
 * Whether one template COVERS a concrete path: the path equals the
 * template instance, or lives strictly below it (`workPackages[]`
 * covers `workPackages[0].title`). This is the redaction-rule lookup:
 * a rule on an enclosing template governs everything beneath it.
 */
export function templateCovers(template: string, path: string): boolean {
  return new RegExp(`^${templateSource(template)}(?:\\.|\\[|$)`).test(path);
}
