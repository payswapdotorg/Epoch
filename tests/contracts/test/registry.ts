// W032 — the CONTRACT CONFORMANCE REGISTRY.
//
// One entry per published manifest-bearing contract tree under contracts/
// (the generated-per-surface conformance runner is built from this table).
// Each entry pins: the tree, its owning package, the pure emission
// function (render*ContractFiles), the published schema surface, and the
// package's exported VERSION CONSTANTS (contract + protocol) the manifest
// must pin exactly.
//
// This is the cross-domain drift net of the harness: any pack, kernel or
// contract that changes its schema surface WITHOUT re-emitting its
// committed contract artifacts fails the per-tree contract-drift battery.
import { renderActionContractFiles, ACTION_PROTOCOL_SCHEMA_SURFACE, ACTION_CONTRACT_VERSION, ACTION_PROTOCOL_VERSION } from '@epoch/action-protocol';
import { renderAgentContractFiles, AGENT_PROTOCOL_SCHEMA_SURFACE, AGENT_CONTRACT_VERSION, AGENT_PROTOCOL_VERSION } from '@epoch/agent-protocol';
import { renderActualizationPublicContractFiles, CORE_RECORD_SURFACE as ACTUALIZATION_CORE_SURFACE, ACTUALIZATION_CONTRACT_VERSION } from '@epoch/actualization';
import { renderExecutionTrackingPublicContractFiles, CORE_RECORD_SURFACE as EXECUTION_CORE_SURFACE, EXECUTION_TRACKING_CONTRACT_VERSION } from '@epoch/execution-tracking';
import { renderExperienceContractFiles, EXPERIENCE_PROTOCOL_SCHEMA_SURFACE, EXPERIENCE_CONTRACT_VERSION, EXPERIENCE_PROTOCOL_VERSION } from '@epoch/experience-protocol';
import { renderExperienceCompilerContractFiles, EXPERIENCE_COMPILER_SCHEMA_SURFACE, EXPERIENCE_COMPILER_CONTRACT_VERSION, RENDER_PLAN_PROTOCOL_VERSION } from '@epoch/experience-compiler';
import { renderProcurementPublicContractFiles, CORE_RECORD_SURFACE as PROCUREMENT_CORE_SURFACE, PROCUREMENT_CONTRACT_VERSION } from '@epoch/procurement';
import { renderRendererContractFiles, RENDERER_RUNTIME_SCHEMA_SURFACE, RENDERER_CONTRACT_VERSION, RENDERER_PROTOCOL_VERSION } from '@epoch/renderer-runtime';
import { renderSolutionDeliveryPublicContractFiles, CORE_RECORD_SURFACE as SOLUTION_DELIVERY_CORE_SURFACE, SOLUTION_DELIVERY_CONTRACT_VERSION } from '@epoch/solution-delivery';

/** One published contract tree's conformance entry. */
export interface ContractTreeEntry {
  /** The contracts/ sub-directory (the tree). */
  readonly tree: string;
  /** The owning workspace package (the emission authority). */
  readonly owner: string;
  /** The pure emission function: renders the complete committed artifact set. */
  readonly render: () => Readonly<Record<string, string>>;
  /** The published schema surface (type -> zod schema), as emitted. */
  readonly surface: readonly { readonly type: string }[];
  /** The package's exported contract-version constant (the manifest must pin it). */
  readonly contractVersion: string;
  /** The package's exported protocol-version constant, when the tree pins one. */
  readonly protocolVersion: string | null;
  /**
   * The renderer-injected versioned-$id prefix (`urn:<prefix>:<type>:<version>`),
   * or null when the tree's schemas carry no $id (the older emission convention).
   */
  readonly schemaIdPrefix: string | null;
  /** The manifest's pinned contract identity (`epoch/<package-name>`). */
  readonly contractId: string;
}

/** The complete registry: every published manifest-bearing contracts/* tree. */
export const CONTRACT_TREES: readonly ContractTreeEntry[] = [
  {
    tree: 'actions',
    owner: '@epoch/action-protocol',
    render: renderActionContractFiles,
    surface: ACTION_PROTOCOL_SCHEMA_SURFACE,
    contractVersion: ACTION_CONTRACT_VERSION,
    protocolVersion: ACTION_PROTOCOL_VERSION,
    schemaIdPrefix: null,
    contractId: 'epoch/actions',
  },
  {
    tree: 'actualization',
    owner: '@epoch/actualization',
    render: renderActualizationPublicContractFiles,
    surface: ACTUALIZATION_CORE_SURFACE,
    contractVersion: ACTUALIZATION_CONTRACT_VERSION,
    protocolVersion: null,
    schemaIdPrefix: 'urn:epoch:actualization',
    contractId: 'epoch/actualization',
  },
  {
    tree: 'agent',
    owner: '@epoch/agent-protocol',
    render: renderAgentContractFiles,
    surface: AGENT_PROTOCOL_SCHEMA_SURFACE,
    contractVersion: AGENT_CONTRACT_VERSION,
    protocolVersion: AGENT_PROTOCOL_VERSION,
    schemaIdPrefix: null,
    contractId: 'epoch/agent',
  },
  {
    tree: 'execution',
    owner: '@epoch/execution-tracking',
    render: renderExecutionTrackingPublicContractFiles,
    surface: EXECUTION_CORE_SURFACE,
    contractVersion: EXECUTION_TRACKING_CONTRACT_VERSION,
    protocolVersion: null,
    schemaIdPrefix: 'urn:epoch:execution-tracking',
    contractId: 'epoch/execution-tracking',
  },
  {
    tree: 'experience',
    owner: '@epoch/experience-protocol',
    render: renderExperienceContractFiles,
    surface: EXPERIENCE_PROTOCOL_SCHEMA_SURFACE,
    contractVersion: EXPERIENCE_CONTRACT_VERSION,
    protocolVersion: EXPERIENCE_PROTOCOL_VERSION,
    schemaIdPrefix: null,
    contractId: 'epoch/experience',
  },
  {
    tree: 'experience-compiler',
    owner: '@epoch/experience-compiler',
    render: renderExperienceCompilerContractFiles,
    surface: EXPERIENCE_COMPILER_SCHEMA_SURFACE,
    contractVersion: EXPERIENCE_COMPILER_CONTRACT_VERSION,
    protocolVersion: RENDER_PLAN_PROTOCOL_VERSION,
    schemaIdPrefix: null,
    contractId: 'epoch/experience-compiler',
  },
  {
    tree: 'procurement',
    owner: '@epoch/procurement',
    render: renderProcurementPublicContractFiles,
    surface: PROCUREMENT_CORE_SURFACE,
    contractVersion: PROCUREMENT_CONTRACT_VERSION,
    protocolVersion: null,
    schemaIdPrefix: 'urn:epoch:procurement',
    contractId: 'epoch/procurement',
  },
  {
    tree: 'renderers',
    owner: '@epoch/renderer-runtime',
    render: renderRendererContractFiles,
    surface: RENDERER_RUNTIME_SCHEMA_SURFACE,
    contractVersion: RENDERER_CONTRACT_VERSION,
    protocolVersion: RENDERER_PROTOCOL_VERSION,
    schemaIdPrefix: null,
    contractId: 'epoch/renderers',
  },
  {
    tree: 'solution-delivery',
    owner: '@epoch/solution-delivery',
    render: renderSolutionDeliveryPublicContractFiles,
    surface: SOLUTION_DELIVERY_CORE_SURFACE,
    contractVersion: SOLUTION_DELIVERY_CONTRACT_VERSION,
    protocolVersion: null,
    schemaIdPrefix: 'urn:epoch:solution-delivery',
    contractId: 'epoch/solution-delivery',
  },
];

/** Repository path of the contracts root (relative to this test file). */
export const CONTRACTS_ROOT = '../../../contracts';

/** The registry keyed by tree name. */
export const CONTRACT_TREES_BY_NAME: ReadonlyMap<string, ContractTreeEntry> = new Map(
  CONTRACT_TREES.map((entry) => [entry.tree, entry]),
);
