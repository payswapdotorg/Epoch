/**
 * @epoch/adapter-mcp — tool discovery: provider catalogs -> typed
 * invocation surfaces + W007 registration documents.
 *
 * Discovery is DETERMINISTIC: identical (tenant, catalog) derive
 * byte-identical surfaces (content-derived digests; provider row order
 * never leaks — surfaces sort by toolRef). The derived W007 capability
 * registrations are registration DOCUMENTS the host registers through
 * the REAL registry (tests pin admission).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { ProviderTool, ProviderToolCatalog } from './provider/payload';
import { neutralToolCapabilityIdOf, neutralToolRefOf, parseProviderCatalog } from './provider/payload';
import type { ToolInvocationSurface } from './types';
import { MCP_ADAPTER_RECORD_VERSION, MCP_ACTION_CONTRACT_ID } from './version';
import type { McpAdapterResult } from './errors';

/** The provider catalog's content digest (canonical JSON, content-addressed). */
export function catalogDigestOf(catalog: ProviderToolCatalog): Sha256Hex {
  return canonicalDigest(catalog as unknown as JsonValue);
}

/** Derive the typed invocation surface of one discovered tool. */
function surfaceOf(tenantId: TenantId, tool: ProviderTool, sourceDigest: Sha256Hex): ToolInvocationSurface {
  const content = {
    schemaVersion: MCP_ADAPTER_RECORD_VERSION,
    tenantId,
    toolRef: neutralToolRefOf(tool.name),
    capabilityId: neutralToolCapabilityIdOf(tool.name),
    displayName: `External tool invocation: ${tool.name.replace(/_/g, '-')}`,
    description: tool.description,
    inputArguments: tool.inputArguments,
    outputSummary: tool.outputSummary,
    sourceDigest,
  };
  return { ...content, surfaceDigest: canonicalDigest(content as unknown as JsonValue) };
}

/** Input of {@link discoverTools}. */
export interface DiscoveryInput {
  readonly tenantId: TenantId;
  readonly payload: unknown;
  /** Optional caller-claimed digest of the discovery payload (tamper detection). */
  readonly claimedDigest?: Sha256Hex | undefined;
}

/**
 * Discover the typed invocation surfaces of a provider tool catalog
 * (idempotent; content-addressed). Malformed catalogs are the typed
 * `unknown-provider-payload` (never a partial load); a claimed digest
 * that does not match the content is the typed `digest-mismatch`.
 * Surfaces sort by toolRef — provider row order never leaks.
 */
export function discoverTools(input: DiscoveryInput): McpAdapterResult<readonly ToolInvocationSurface[]> {
  const parsed = parseProviderCatalog(input.payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'unknown-provider-payload',
        message: 'the payload is not a recognized external-tool catalog',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const digest = catalogDigestOf(parsed.data);
  if (input.claimedDigest !== undefined && input.claimedDigest !== digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'the claimed catalog digest does not match its content (tampered or mismatched payload)',
        expected: digest,
        encountered: input.claimedDigest,
      },
    };
  }
  const surfaces = parsed.data.tools.map((tool) => surfaceOf(input.tenantId, tool, digest));
  surfaces.sort((a, b) => (a.toolRef < b.toolRef ? -1 : a.toolRef > b.toolRef ? 1 : 0));
  return { ok: true, value: surfaces };
}

/**
 * A discovered tool's derived W007 capability registration document (a
 * manifest + the digest claimed for its canonical JSON): tool
 * invocations register under the `action` category, origin
 * `external-software`. The REAL registry admits them verbatim (pinned
 * by the registration parity tests).
 */
export interface ToolCapabilityRegistration {
  readonly manifest: {
    readonly schemaVersion: typeof MCP_ADAPTER_RECORD_VERSION;
    readonly capabilityId: string;
    readonly category: 'action';
    readonly version: string;
    readonly descriptor: {
      readonly displayName: string;
      readonly description: string;
      readonly inputs: readonly {
        readonly name: string;
        readonly kind: 'string' | 'number' | 'boolean';
        readonly required: boolean;
        readonly description: string;
      }[];
      readonly outputs: readonly {
        readonly name: string;
        readonly kind: 'string';
        readonly required: boolean;
        readonly description: string;
      }[];
      readonly assumptions: readonly string[];
    };
    readonly contracts: readonly { readonly contractId: string; readonly contractVersion: string }[];
    readonly trust: { readonly origin: 'external-software'; readonly curator: string };
  };
  readonly digest: Sha256Hex;
}

const TOOL_CAPABILITY_VERSION = '1.0.0' as const;
const CURATOR = 'epoch:reference-adapter-set' as const;

/** Derive the W007 registration document of one discovered tool's invocation surface. */
export function deriveToolRegistration(surface: ToolInvocationSurface): ToolCapabilityRegistration {
  const manifest = {
    schemaVersion: MCP_ADAPTER_RECORD_VERSION,
    capabilityId: surface.capabilityId,
    category: 'action' as const,
    version: TOOL_CAPABILITY_VERSION,
    descriptor: {
      displayName: surface.displayName,
      description: surface.description,
      inputs: surface.inputArguments.map((argument) => ({
        name: argument.name,
        kind: argument.valueKind,
        required: argument.required,
        description: argument.description,
      })),
      outputs: [
        {
          name: 'invocation',
          kind: 'string' as const,
          required: true,
          description: 'The routed invocation record id (the authority decision + outcome).',
        },
        {
          name: 'disposition',
          kind: 'string' as const,
          required: true,
          description: 'The neutral invocation disposition (executed, authority-denied, authority-pending-approval, execution-failed).',
        },
      ],
      assumptions: [
        'The tool invocation is proposed as a W003 action and routed through the W022 action-authority seam (never a direct execution).',
        'The adapter holds no credentials; credential-shaped parameters are rejected before proposal construction.',
      ],
    },
    contracts: [{ contractId: MCP_ACTION_CONTRACT_ID, contractVersion: '1.0.0' }],
    trust: { origin: 'external-software' as const, curator: CURATOR },
  };
  return { manifest, digest: canonicalDigest(manifest as unknown as JsonValue) };
}
