// Published-surface integrity: the exported vocabularies are exactly the
// architecture-pinned sets, the flavors match the architecture's four
// extension surfaces, and the trust ladder matches spec/
// extension-architecture.md.
import { describe, expect, it } from 'vitest';
import {
  CONTRIBUTION_KINDS,
  EXTENSION_FLAVORS,
  EXTENSION_ID_PATTERN,
  EXTENSION_MANIFEST_VERSION,
  EXTENSION_SDK_CONTRACT_VERSION,
  EXTENSION_SDK_SCHEMA_SURFACE,
  EXTENSION_TRUST_CLASSES,
  EXTENSION_DATA_HANDLINGS,
  EXTENSION_SIDE_EFFECT_KINDS,
  HOST_FUNCTION_IDS,
  HOST_LOG_LEVELS,
  LEGAL_RESOURCE_SCOPES,
  REMOTE_TRANSPORT_KINDS,
  RESOURCE_ACCESSES,
  RESOURCE_DOMAINS,
  TRUST_CLASS_GRANT_CEILINGS,
  UI_SURFACE_KINDS,
  WASM_SECTION_KINDS,
  WASM_VALUE_TYPES,
} from '../src/index';

describe('extension-sdk published surface', () => {
  it('the flavor vocabulary is the architecture extension-surface list', () => {
    // architecture.md, "Extensions" (binding): declarative
    // manifest/schema + TypeScript/React + Wasm Component Model + remote
    // service adapter.
    expect([...EXTENSION_FLAVORS]).toEqual(['declarative', 'ui', 'wasm', 'remote']);
  });

  it('the trust ladder is T0..T4 (spec/extension-architecture.md, "Trust")', () => {
    expect([...EXTENSION_TRUST_CLASSES]).toEqual(['t0', 't1', 't2', 't3', 't4']);
  });

  it('the host-function vocabulary is the narrow closed set', () => {
    expect([...HOST_FUNCTION_IDS]).toEqual([
      'capability.invoke',
      'clock.read',
      'evidence.append',
      'log.write',
      'storage.read',
      'storage.write',
      'world.read',
    ]);
    expect([...HOST_LOG_LEVELS]).toEqual(['debug', 'error', 'info', 'warn']);
  });

  it('resource vocabularies and legal scopes are pinned', () => {
    expect([...RESOURCE_DOMAINS]).toEqual(['world', 'evidence', 'storage', 'capability']);
    expect([...RESOURCE_ACCESSES]).toEqual(['read', 'append', 'write', 'invoke']);
    expect(LEGAL_RESOURCE_SCOPES).toEqual([
      { resource: 'world', access: 'read' },
      { resource: 'evidence', access: 'append' },
      { resource: 'storage', access: 'read' },
      { resource: 'storage', access: 'write' },
      { resource: 'capability', access: 'invoke' },
    ]);
  });

  it('extension ids mirror the agent-protocol AgentId discipline', () => {
    expect('extension:stress-toolkit').toMatch(EXTENSION_ID_PATTERN);
    expect('stress-toolkit').not.toMatch(EXTENSION_ID_PATTERN);
    expect('extension:Bad-Case').not.toMatch(EXTENSION_ID_PATTERN);
  });

  it('the contribution vocabulary matches the architecture contribution list', () => {
    expect([...CONTRIBUTION_KINDS]).toEqual([
      'agent',
      'animation',
      'constraint',
      'connector',
      'evaluator',
      'interaction',
      'mapping',
      'reconstruction',
      'simulator',
      'verification-method',
      'visualization',
      'workflow',
      'world-type',
    ]);
  });

  it('transport, surface-kind, wasm, and declaration vocabularies are pinned', () => {
    expect([...REMOTE_TRANSPORT_KINDS]).toEqual(['custom', 'grpc', 'http', 'mcp']);
    expect([...UI_SURFACE_KINDS]).toEqual(['inspector', 'overlay', 'panel']);
    expect([...WASM_SECTION_KINDS]).toEqual(['adapter', 'core-module', 'custom']);
    expect([...WASM_VALUE_TYPES]).toEqual([
      'bool',
      'char',
      'f32',
      'f64',
      's16',
      's32',
      's64',
      's8',
      'string',
      'u16',
      'u32',
      'u64',
      'u8',
    ]);
    expect([...EXTENSION_DATA_HANDLINGS]).toEqual(['sandbox-only', 'tenant-scoped', 'external-transfer']);
    expect([...EXTENSION_SIDE_EFFECT_KINDS]).toEqual([
      'action-proposal',
      'evidence-append',
      'external-effect',
      'sandbox-state-write',
    ]);
  });

  it('version constants are pinned', () => {
    expect(EXTENSION_SDK_CONTRACT_VERSION).toBe('1.0.0');
    expect(EXTENSION_MANIFEST_VERSION).toBe(1);
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = EXTENSION_SDK_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...types].sort());
    for (const entry of EXTENSION_SDK_SCHEMA_SURFACE) {
      expect(entry.schema, entry.type).toBeDefined();
    }
  });

  it('the trust ceiling table is deterministically ordered and internally consistent', () => {
    expect(TRUST_CLASS_GRANT_CEILINGS.map((ceiling) => ceiling.trustClass)).toEqual([
      't0',
      't1',
      't2',
      't3',
      't4',
    ]);
    for (const ceiling of TRUST_CLASS_GRANT_CEILINGS) {
      expect([...ceiling.hostFunctions]).toEqual([...ceiling.hostFunctions].sort());
      expect(new Set(ceiling.hostFunctions).size).toBe(ceiling.hostFunctions.length);
      expect(new Set(ceiling.resourceScopes.map((s) => `${s.resource}.${s.access}`)).size).toBe(
        ceiling.resourceScopes.length,
      );
    }
  });
});
