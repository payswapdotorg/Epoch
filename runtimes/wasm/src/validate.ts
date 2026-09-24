/**
 * Structural validation machinery for the Wasm component layout: a
 * generic rule-table walker (strict objects — unknown keys are rejected
 * with precise paths; the host boundary never trusts author-side
 * tooling) plus the canonical-ordering semantic layer (sorted +
 * duplicate-free arrays with the offending index and key field in the
 * issue path).
 *
 * Total: validation never throws; failures are typed `validation`
 * errors with flattened dotted-path issues (the W006/W007 issue style).
 */
import { WASM_LAYOUT_RULES } from './rules';
import { fail, ok, validationError, type WasmLayoutIssue, type WasmLayoutResult } from './errors';
import type { ComponentLayoutDescriptor } from './types';

type Path = (string | number)[];

const dotted = (path: Path): string => path.map(String).join('.');

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Walk one rule over `input`, accumulating issues at precise paths. */
function walk(rule: import('./rules').WasmRule, input: unknown, path: Path, issues: WasmLayoutIssue[]): void {
  switch (rule.kind) {
    case 'literal':
      if (input !== rule.value) {
        issues.push({ path: dotted(path), message: `must equal ${JSON.stringify(rule.value)}` });
      }
      return;
    case 'pattern':
      if (typeof input !== 'string' || !rule.pattern.test(input)) {
        issues.push({ path: dotted(path), message: `must match the pattern ${rule.pattern}` });
      }
      return;
    case 'enum':
      if (typeof input !== 'string' || !rule.values.includes(input)) {
        issues.push({
          path: dotted(path),
          message: `must be one of: ${rule.values.map((value) => JSON.stringify(value)).join(', ')}`,
        });
      }
      return;
    case 'integer':
      if (typeof input !== 'number' || !Number.isInteger(input) || input < rule.minimum) {
        issues.push({
          path: dotted(path),
          message: `must be an integer >= ${rule.minimum}`,
        });
      }
      return;
    case 'array': {
      if (!Array.isArray(input)) {
        issues.push({ path: dotted(path), message: 'must be an array' });
        return;
      }
      if (input.length < rule.minItems) {
        issues.push({ path: dotted(path), message: `must contain at least ${rule.minItems} item(s)` });
      }
      input.forEach((item, index) => walk(rule.item, item, [...path, index], issues));
      return;
    }
    case 'object': {
      if (!isPlainObject(input)) {
        issues.push({ path: dotted(path), message: 'must be an object' });
        return;
      }
      for (const field of rule.fields) {
        const value = input[field.name];
        if (value === undefined) {
          if (field.optional !== true) {
            issues.push({ path: dotted([...path, field.name]), message: 'is required' });
          }
          continue;
        }
        walk(field.rule, value, [...path, field.name], issues);
      }
      const known = new Set(rule.fields.map((field) => field.name));
      for (const key of Object.keys(input)) {
        if (!known.has(key)) {
          issues.push({
            path: dotted([...path, key]),
            message: `unrecognized key "${key}" — strict layout objects reject unknown fields`,
          });
        }
      }
      return;
    }
  }
}

/** Check a string array is sorted ascending and duplicate-free. */
function checkSortedStrings(
  values: readonly unknown[],
  keyOf: (value: unknown) => string | undefined,
  keyField: string,
  basePath: Path,
  label: string,
  issues: WasmLayoutIssue[],
): void {
  for (let index = 1; index < values.length; index += 1) {
    const previous = keyOf(values[index - 1]);
    const current = keyOf(values[index]);
    if (previous === undefined || current === undefined) continue; // element-level issues already reported
    if (current === previous) {
      issues.push({
        path: dotted([...basePath, index, keyField]),
        message: `${label} must be duplicate-free ("${current}" repeats) — set-typed arrays are sorted ascending`,
      });
    } else if (current < previous) {
      issues.push({
        path: dotted([...basePath, index, keyField]),
        message: `${label} must be sorted ascending ("${current}" follows "${previous}") — set-typed arrays have one canonical order`,
      });
    }
  }
}

/**
 * Canonical-ordering semantic layer over the descriptor arrays:
 * imports/exports by interfaceName, functions by functionName, params
 * by name, sections by name.
 */
function checkCanonicalOrdering(
  descriptor: Record<string, unknown>,
  issues: WasmLayoutIssue[],
): void {
  for (const field of ['imports', 'exports'] as const) {
    const interfaces = descriptor[field];
    if (!Array.isArray(interfaces)) continue;
    checkSortedStrings(
      interfaces,
      (value) => (isPlainObject(value) ? String(value.interfaceName) : undefined),
      'interfaceName',
      [field],
      `component ${field}`,
      issues,
    );
    interfaces.forEach((iface, ifaceIndex) => {
      if (!isPlainObject(iface)) return;
      const functions = iface.functions;
      if (!Array.isArray(functions)) return;
      checkSortedStrings(
        functions,
        (value) => (isPlainObject(value) ? String(value.functionName) : undefined),
        'functionName',
        [field, ifaceIndex, 'functions'],
        'interface functions',
        issues,
      );
      functions.forEach((fn, fnIndex) => {
        if (!isPlainObject(fn)) return;
        const params = fn.params;
        if (!Array.isArray(params)) return;
        checkSortedStrings(
          params,
          (value) => (isPlainObject(value) ? String(value.name) : undefined),
          'name',
          [field, ifaceIndex, 'functions', fnIndex, 'params'],
          'function params',
          issues,
        );
      });
    });
  }
  const sections = descriptor.sections;
  if (Array.isArray(sections)) {
    checkSortedStrings(
      sections,
      (value) => (isPlainObject(value) ? String(value.name) : undefined),
      'name',
      ['sections'],
      'component sections',
      issues,
    );
  }
}

/**
 * Validate a Wasm component layout descriptor (structural + canonical
 * ordering). Total, never throws. The result value is the typed
 * descriptor (the validated input).
 */
export function validateComponentLayoutDescriptor(
  input: unknown,
): WasmLayoutResult<ComponentLayoutDescriptor> {
  const issues: WasmLayoutIssue[] = [];
  walk(WASM_LAYOUT_RULES.ComponentLayoutDescriptor, input, [], issues);
  if (isPlainObject(input)) {
    checkCanonicalOrdering(input, issues);
  }
  if (issues.length > 0) {
    return fail(validationError(issues));
  }
  return ok(input as ComponentLayoutDescriptor);
}

/** Validate any single published wasm-layout type (rule-table walk). */
export function validateWasmLayoutType(
  typeName: import('./rules').WasmLayoutTypeName,
  input: unknown,
): WasmLayoutResult<unknown> {
  const rule = WASM_LAYOUT_RULES[typeName];
  if (rule === undefined) {
    return fail({
      code: 'validation',
      message: `unknown wasm-layout type "${String(typeName)}"`,
      issues: [],
    });
  }
  const issues: WasmLayoutIssue[] = [];
  walk(rule, input, [], issues);
  if (issues.length > 0) {
    return fail(validationError(issues));
  }
  return ok(input);
}
