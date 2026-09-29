/**
 * The UNIVERSAL capability-demand compiler (ARCD1.0 step 3, acceptance 1).
 *
 * From ONLY task/world/evidence/constraint input (the provider-neutral
 * {@link DiscoveryInput}), the compiler derives a canonically-ordered set
 * of provider-neutral {@link CapabilityDemand} records through UNIVERSAL
 * rules — one rule family per signal kind, plus constraint attachment,
 * plus domain-pack priors. The compiler:
 *
 * - never names a provider, model or substrate (lock rule 13);
 * - never consults anything outside the input document (zero wall-clock,
 *   zero randomness, zero environment reads — acceptance 8);
 * - treats domain-pack templates as PRIORS that may only ADD demands or
 *   TIGHTEN facets: any attempted relaxation is recorded as a
 *   template-override rejection and IGNORED (the universal compiler owns
 *   the decision — autonomous-discovery invariants; negative test d).
 *
 * Determinism: signals fold in canonical (signalId) order and every facet
 * merge is commutative (union / min / max / OR), so authoring order never
 * leaks into the output (pinned by the determinism battery).
 */
import type {
  CapabilityDemand,
  CapabilityDemandSet,
  ConstraintSignal,
  DiscoveryInput,
  DiscoveryResult,
  DomainPackContribution,
  MoneyAmount,
  OperationRef,
  QualityTarget,
  TaskSignal,
} from './types';
import { DiscoveryInputSchema } from './schema';
import { validationError } from './errors';
import { zodIssuesToDiscoveryIssues } from './errors';
import {
  canonicalOperations,
  canonicalStringUnion,
  contentDigest,
  digestSuffix16,
  operationKey,
} from './canonical';
import { CAPABILITY_DISCOVERY_RECORD_VERSION } from './version';

/** Compile output: the sealed demand set + template rejections. */
export interface DemandCompilation {
  readonly demandSet: CapabilityDemandSet;
  /**
   * Records of every domain-pack template the compiler REFUSED to apply
   * (relaxation attempts here; grouping conflicts are added by the role
   * synthesizer). Mirrored on the run record.
   */
  readonly templateOverrideRejections: readonly string[];
}

/** Mutable working state of one demand under construction. */
interface DemandDraft {
  readonly operation: OperationRef;
  requiredOutcome: string;
  summaryParts: string[];
  inputRepresentations: Set<string>;
  /** Input kinds added EXPLICITLY via hints/templates (defaults yield). */
  explicitInputs: Set<string>;
  outputContract: Map<string, { name: string; kind: string }>;
  /** Output entries added EXPLICITLY via hints/templates (defaults yield). */
  explicitOutputs: Set<string>;
  qualityTargets: QualityTarget[];
  uncertaintyConfidence: number | undefined;
  evidenceRequirements: Set<string>;
  verificationRequired: boolean;
  toolRequirements: Set<string>;
  environmentRequirements: Set<string>;
  latencyBudgetMs: number | undefined;
  costBudgets: MoneyAmount[];
  cosign: boolean;
  authorityNotes: string[];
  dependsOnOperations: Map<string, OperationRef>;
  affectedRefs: Set<string>;
  derivedFromSignals: Set<string>;
  derivedFromTemplates: Set<string>;
  notes: string[];
}

/** The per-invocation compiler state (explicitly threaded; no globals). */
interface CompilerState {
  readonly input: DiscoveryInput;
  readonly drafts: Map<string, DemandDraft>;
  readonly rejections: string[];
  readonly signalKindsPresent: ReadonlySet<TaskSignal['kind']>;
}

function newDraft(operation: OperationRef, summary: string): DemandDraft {
  return {
    operation,
    requiredOutcome: summary,
    summaryParts: [summary],
    inputRepresentations: new Set<string>(),
    explicitInputs: new Set<string>(),
    outputContract: new Map<string, { name: string; kind: string }>(),
    explicitOutputs: new Set<string>(),
    qualityTargets: [],
    uncertaintyConfidence: undefined,
    evidenceRequirements: new Set<string>(),
    verificationRequired: false,
    toolRequirements: new Set<string>(),
    environmentRequirements: new Set<string>(),
    latencyBudgetMs: undefined,
    costBudgets: [],
    cosign: false,
    authorityNotes: [],
    dependsOnOperations: new Map<string, OperationRef>(),
    affectedRefs: new Set<string>(),
    derivedFromSignals: new Set<string>(),
    derivedFromTemplates: new Set<string>(),
    notes: [],
  };
}

/**
 * Stricter of two quality targets (same metric + direction assumed).
 * Direction semantics: `min` = the threshold is a MINIMUM acceptable
 * value (a HIGHER threshold is stricter); `max` = the threshold is a
 * MAXIMUM acceptable value (a LOWER threshold is stricter).
 */
function stricterTarget(a: QualityTarget, b: QualityTarget): QualityTarget {
  if (a.direction === 'min') {
    return a.threshold >= b.threshold ? a : b;
  }
  return a.threshold <= b.threshold ? a : b;
}

/** Decimal-aware money comparison (returns the smaller budget). */
function smallerMoney(a: MoneyAmount, b: MoneyAmount): MoneyAmount {
  const toCents = (money: MoneyAmount): bigint => {
    const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(money.amount);
    if (match === null) return 0n;
    const fraction = (match[2] ?? '').padEnd(2, '0').slice(0, 2);
    return BigInt(match[1]!) * 100n + BigInt(fraction || '0');
  };
  return toCents(a) <= toCents(b) ? a : b;
}

/**
 * Compile the capability-demand set from a discovery input (the public
 * entry point; also re-exported as `compileDemands`).
 */
export function compileCapabilityDemands(
  input: DiscoveryInput,
): DiscoveryResult<DemandCompilation> {
  const parsed = DiscoveryInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError(
        'discovery input failed validation',
        zodIssuesToDiscoveryIssues(parsed.error),
      ),
    };
  }
  const admitted = parsed.data;
  const state: CompilerState = {
    input: admitted,
    drafts: new Map<string, DemandDraft>(),
    rejections: [],
    signalKindsPresent: new Set(admitted.taskSignals.map((signal) => signal.kind)),
  };

  // 1. UNIVERSAL signal rules — TWO PASSES so attachment is order-free:
  //    pass 1 creates demands (operation/decision/verification/artifact/
  //    unknown/failure/work/dependency/outcome), pass 2 attaches facets
  //    (quality/budget/environment/authority + verification marking).
  //    Both passes fold in canonical signalId order.
  const signals = [...admitted.taskSignals].sort((a, b) =>
    a.signalId < b.signalId ? -1 : a.signalId > b.signalId ? 1 : 0,
  );
  const CREATING_KINDS = new Set([
    'operation',
    'decision',
    'verification',
    'artifact',
    'unknown',
    'failure',
    'work',
    'dependency',
    'outcome',
  ]);
  for (const signal of signals.filter((candidate) => CREATING_KINDS.has(candidate.kind))) {
    applySignal(state, signal);
  }
  for (const signal of signals.filter((candidate) => !CREATING_KINDS.has(candidate.kind))) {
    applySignal(state, signal);
  }
  // Verification signals mark related demands (a second, order-free sweep).
  for (const signal of signals.filter((candidate) => candidate.kind === 'verification')) {
    for (const related of draftsMatchingSubjects(state, signal.subjectRefs)) {
      related.verificationRequired = true;
    }
  }

  // 2. Constraint attachment (canonical constraintId order).
  const constraints = [...admitted.constraintSignals].sort((a, b) =>
    a.constraintId < b.constraintId ? -1 : a.constraintId > b.constraintId ? 1 : 0,
  );
  for (const constraint of constraints) {
    applyConstraint(state, constraint);
  }

  // 3. Domain-pack priors (canonical packId + templateId order):
  //    add-or-tighten only; relaxations are recorded and ignored.
  const packs = [...admitted.packContributions].sort((a, b) =>
    a.packId < b.packId ? -1 : a.packId > b.packId ? 1 : 0,
  );
  for (const pack of packs) {
    applyPackPriors(state, pack);
  }

  // 4. Seal the demand set (content-addressed ids, canonical order).
  const demands: CapabilityDemand[] = [];
  for (const draft of state.drafts.values()) {
    demands.push(sealDemand(draft, admitted));
  }
  demands.sort((a, b) => (a.demandId < b.demandId ? -1 : 1));
  const setDigest = contentDigest(
    demands.map((demand) => [demand.demandId, demandDigestOf(demand)]),
  );
  return {
    ok: true,
    value: {
      demandSet: { demands, setDigest },
      templateOverrideRejections: [...state.rejections].sort(),
    },
  };
}

/** Alias kept for call-site readability. */
export const compileDemands = compileCapabilityDemands;

/** The body digest of a sealed demand (excludes the derived demandId). */
export function demandDigestOf(demand: CapabilityDemand): string {
  const body = { ...demand, demandId: undefined };
  return contentDigest(body);
}

// ---------------------------------------------------------------------------
// Draft helpers.
// ---------------------------------------------------------------------------

function upsert(state: CompilerState, operation: OperationRef, summary: string): DemandDraft {
  const key = operationKey(operation);
  const existing = state.drafts.get(key);
  if (existing !== undefined) {
    existing.summaryParts = [...existing.summaryParts, summary].sort();
    return existing;
  }
  const draft = newDraft(operation, summary);
  state.drafts.set(key, draft);
  return draft;
}

/**
 * Drafts matching the subject refs — empty subjectRefs means TASK-WIDE
 * (matches every draft accumulated so far).
 */
function draftsMatchingSubjects(
  state: CompilerState,
  subjectRefs: readonly string[],
): DemandDraft[] {
  if (subjectRefs.length === 0) return [...state.drafts.values()];
  const subjects = new Set(subjectRefs);
  return [...state.drafts.values()].filter((draft) =>
    [...draft.affectedRefs].some((ref) => subjects.has(ref)),
  );
}

// ---------------------------------------------------------------------------
// 1. Universal signal rules.
// ---------------------------------------------------------------------------

function applySignal(state: CompilerState, signal: TaskSignal): void {
  const attach = (draft: DemandDraft): void => {
    for (const ref of signal.subjectRefs) draft.affectedRefs.add(ref);
    draft.derivedFromSignals.add(signal.signalId);
  };
  const addInputs = (draft: DemandDraft): void => {
    const hints = signal.representationHints;
    if (hints === undefined || hints.length === 0) {
      if (draft.inputRepresentations.size === 0) draft.inputRepresentations.add('structured');
      return;
    }
    for (const kind of hints) {
      draft.inputRepresentations.add(kind);
      draft.explicitInputs.add(kind);
    }
  };
  const addOutputs = (
    draft: DemandDraft,
    hints: readonly string[] | undefined,
    fallbackName: string,
  ): void => {
    if (hints === undefined || hints.length === 0) {
      if (!draft.outputContract.has(`${fallbackName}#structured`)) {
        draft.outputContract.set(`${fallbackName}#structured`, {
          name: fallbackName,
          kind: 'structured',
        });
      }
      return;
    }
    hints.forEach((kind, index) => {
      const name = index === 0 ? fallbackName : `${fallbackName}-${index + 1}`;
      const key = `${name}#${kind}`;
      if (!draft.outputContract.has(key)) {
        draft.outputContract.set(key, { name, kind });
      }
      draft.explicitOutputs.add(key);
    });
  };
  const ensureMinimalShape = (draft: DemandDraft, fallbackOutput: string): void => {
    addInputs(draft);
    addOutputs(draft, signal.outputHints, fallbackOutput);
  };

  switch (signal.kind) {
    case 'operation': {
      const draft = upsert(state, signal.operationRef!, signal.summary);
      addInputs(draft);
      ensureMinimalShape(draft, 'result');
      attach(draft);
      break;
    }
    case 'decision': {
      const operation: OperationRef = signal.operationRef ?? {
        id: 'reasoning.decision-analysis',
        versionConstraint: '*',
      };
      const draft = upsert(state, operation, signal.summary);
      ensureMinimalShape(draft, 'decision');
      attach(draft);
      break;
    }
    case 'verification': {
      const operation: OperationRef = signal.operationRef ?? {
        id: 'verification.evidence-verification',
        versionConstraint: '*',
      };
      const draft = upsert(state, operation, signal.summary);
      draft.verificationRequired = true;
      ensureMinimalShape(draft, 'verification-report');
      attach(draft);
      break;
    }
    case 'artifact': {
      const operation: OperationRef = signal.operationRef ?? {
        id: 'delivery.artifact-production',
        versionConstraint: '*',
      };
      const draft = upsert(state, operation, signal.summary);
      ensureMinimalShape(draft, signal.artifactKind ?? 'artifact');
      attach(draft);
      break;
    }
    case 'quality': {
      const target = signal.qualityTarget;
      if (target === undefined) break;
      const matches = draftsMatchingSubjects(state, signal.subjectRefs);
      if (matches.length > 0) {
        for (const draft of matches) {
          draft.qualityTargets = [...draft.qualityTargets, target];
          attach(draft);
        }
      } else {
        const operation: OperationRef = signal.operationRef ?? {
          id: 'delivery.quality-assurance',
          versionConstraint: '*',
        };
        const draft = upsert(state, operation, signal.summary);
        draft.qualityTargets = [...draft.qualityTargets, target];
        ensureMinimalShape(draft, 'quality-report');
        attach(draft);
      }
      break;
    }
    case 'unknown': {
      const operation: OperationRef = signal.operationRef ?? {
        id: 'investigation.unknown-resolution',
        versionConstraint: '*',
      };
      const draft = upsert(state, operation, signal.summary);
      const floor = signal.uncertaintyConfidence ?? 0.5;
      draft.uncertaintyConfidence =
        draft.uncertaintyConfidence === undefined
          ? floor
          : Math.max(draft.uncertaintyConfidence, floor);
      ensureMinimalShape(draft, 'resolution');
      attach(draft);
      break;
    }
    case 'failure': {
      const draft = upsert(state, signal.operationRef!, signal.summary);
      draft.notes = [...draft.notes, `failure evidence observed: ${signal.signalId}`].sort();
      ensureMinimalShape(draft, 'result');
      attach(draft);
      break;
    }
    case 'work': {
      const operation: OperationRef = signal.operationRef ?? {
        id: 'delivery.work-execution',
        versionConstraint: '*',
      };
      const draft = upsert(state, operation, signal.summary);
      ensureMinimalShape(draft, 'work-product');
      attach(draft);
      break;
    }
    case 'budget': {
      for (const draft of draftsMatchingSubjects(state, signal.subjectRefs)) {
        if (signal.latencyBudgetMs !== undefined) {
          draft.latencyBudgetMs =
            draft.latencyBudgetMs === undefined
              ? signal.latencyBudgetMs
              : Math.min(draft.latencyBudgetMs, signal.latencyBudgetMs);
        }
        if (signal.costBudget !== undefined) {
          draft.costBudgets = [...draft.costBudgets, signal.costBudget];
        }
        attach(draft);
      }
      break;
    }
    case 'environment': {
      for (const draft of draftsMatchingSubjects(state, signal.subjectRefs)) {
        for (const slug of signal.requirementSlugs ?? []) {
          draft.environmentRequirements.add(slug);
        }
        attach(draft);
      }
      break;
    }
    case 'authority': {
      for (const draft of draftsMatchingSubjects(state, signal.subjectRefs)) {
        draft.cosign = true;
        draft.authorityNotes = [...draft.authorityNotes, signal.summary].sort();
        attach(draft);
      }
      break;
    }
    case 'dependency': {
      const draft = upsert(state, signal.operationRef!, signal.summary);
      draft.dependsOnOperations.set(
        operationKey(signal.dependsOnOperation!),
        signal.dependsOnOperation!,
      );
      ensureMinimalShape(draft, 'result');
      attach(draft);
      break;
    }
    case 'outcome': {
      const operation: OperationRef = signal.operationRef ?? {
        id: 'delivery.outcome-verification',
        versionConstraint: '*',
      };
      const draft = upsert(state, operation, signal.summary);
      ensureMinimalShape(draft, 'outcome');
      attach(draft);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Constraint attachment.
// ---------------------------------------------------------------------------

function applyConstraint(state: CompilerState, constraint: ConstraintSignal): void {
  const matches = draftsMatchingSubjects(state, constraint.subjectRefs);
  switch (constraint.kind) {
    case 'authority': {
      for (const draft of matches) {
        draft.cosign = true;
        draft.authorityNotes = [...draft.authorityNotes, constraint.summary].sort();
      }
      break;
    }
    case 'budget': {
      const latency = constraint.parameters?.['latencyMs'];
      const currency = constraint.parameters?.['currency'];
      const amount = constraint.parameters?.['amount'];
      for (const draft of matches) {
        if (typeof latency === 'number' && Number.isFinite(latency) && latency >= 0) {
          draft.latencyBudgetMs =
            draft.latencyBudgetMs === undefined
              ? Math.floor(latency)
              : Math.min(draft.latencyBudgetMs, Math.floor(latency));
        }
        if (typeof currency === 'string' && typeof amount === 'string') {
          draft.costBudgets = [...draft.costBudgets, { currency, amount }];
        }
      }
      break;
    }
    case 'interface': {
      const dependsOn = constraint.parameters?.['depends-on'];
      if (typeof dependsOn === 'string') {
        for (const draft of matches) {
          draft.dependsOnOperations.set(dependsOn, { id: dependsOn, versionConstraint: '*' });
        }
      }
      break;
    }
    case 'quality': {
      const metric = constraint.parameters?.['metric'];
      const threshold = constraint.parameters?.['threshold'];
      const unit = constraint.parameters?.['unit'];
      const direction = constraint.parameters?.['direction'];
      if (
        typeof metric === 'string' &&
        typeof threshold === 'number' &&
        Number.isFinite(threshold) &&
        typeof unit === 'string' &&
        (direction === 'min' || direction === 'max')
      ) {
        for (const draft of matches) {
          draft.qualityTargets = [...draft.qualityTargets, { metric, threshold, unit, direction }];
        }
      }
      break;
    }
    case 'hard':
    case 'soft': {
      for (const draft of matches) {
        draft.notes = [
          ...draft.notes,
          `${constraint.kind}-constraint ${constraint.constraintId}: ${constraint.summary}`,
        ].sort();
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Domain-pack priors (add-or-tighten only — never a second compiler).
// ---------------------------------------------------------------------------

function templateApplies(
  template: DomainPackContribution['demandTemplates'][number],
  state: CompilerState,
): boolean {
  const applicability = template.applicability;
  if (
    applicability.signalKinds !== undefined &&
    !applicability.signalKinds.some((kind) => state.signalKindsPresent.has(kind))
  ) {
    return false;
  }
  if (
    applicability.domainRefs !== undefined &&
    !applicability.domainRefs.some((domain) => state.input.task.domainRefs.includes(domain))
  ) {
    return false;
  }
  if (
    applicability.lifecycleStages !== undefined &&
    !applicability.lifecycleStages.includes(state.input.task.lifecycleStage)
  ) {
    return false;
  }
  return true;
}

function applyPackPriors(state: CompilerState, pack: DomainPackContribution): void {
  const templatesById = new Map(
    pack.demandTemplates.map((template) => [template.templateId, template]),
  );
  // Signal bindings propose templates for matching signal kinds.
  const proposedTemplateIds = new Set<string>();
  const bindings = [...pack.taskSignalBindings].sort((a, b) =>
    a.bindingId < b.bindingId ? -1 : 1,
  );
  for (const binding of bindings) {
    if (!state.signalKindsPresent.has(binding.signalKind)) continue;
    if (
      binding.domainRef !== undefined &&
      !state.input.task.domainRefs.includes(binding.domainRef)
    ) {
      continue;
    }
    if (templatesById.has(binding.impliesDemandTemplate)) {
      proposedTemplateIds.add(binding.impliesDemandTemplate);
    }
  }

  const templates = [...pack.demandTemplates].sort((a, b) =>
    a.templateId < b.templateId ? -1 : 1,
  );
  for (const template of templates) {
    if (!proposedTemplateIds.has(template.templateId)) continue;
    if (!templateApplies(template, state)) continue;
    const key = operationKey(template.operation);
    const existing = state.drafts.get(key);
    if (existing === undefined) {
      // ADD: the prior contributes a demand the universal rules did not
      // derive. Facets come from the template; provenance names it.
      const draft = upsert(state, template.operation, template.summary);
      for (const kind of template.inputRepresentations ?? []) {
        draft.inputRepresentations.add(kind);
        draft.explicitInputs.add(kind);
      }
      if (template.outputKinds !== undefined && template.outputKinds.length > 0) {
        template.outputKinds.forEach((kind, index) => {
          const name = index === 0 ? 'result' : `result-${index + 1}`;
          const key = `${name}#${kind}`;
          draft.outputContract.set(key, { name, kind });
          draft.explicitOutputs.add(key);
        });
      } else if (draft.outputContract.size === 0) {
        draft.outputContract.set('result#structured', { name: 'result', kind: 'structured' });
      }
      if (template.qualityTarget !== undefined) {
        draft.qualityTargets = [...draft.qualityTargets, template.qualityTarget];
      }
      for (const requirement of template.evidenceRequirements ?? []) {
        draft.evidenceRequirements.add(requirement);
      }
      if (template.requiresHumanCosign === true) {
        draft.cosign = true;
      }
      draft.derivedFromTemplates.add(template.templateId);
      continue;
    }

    // TIGHTEN-ONLY merge into the existing universal demand.
    let relaxed = false;
    if (template.requiresHumanCosign === false && existing.cosign) {
      state.rejections.push(
        `demand-template ${template.templateId} attempted to relax human-cosign on ${key}; universal derivation retained`,
      );
      relaxed = true;
    } else if (template.requiresHumanCosign === true) {
      existing.cosign = true;
    }
    if (template.qualityTarget !== undefined) {
      const sameMetric = existing.qualityTargets.find(
        (target) => target.metric === template.qualityTarget!.metric,
      );
      if (sameMetric === undefined) {
        // Additional metric on a universal demand: recorded as a note
        // (one target per demand); never an override.
        existing.notes = [
          ...existing.notes,
          `template ${template.templateId} proposed additional quality metric ${template.qualityTarget.metric}`,
        ].sort();
      } else {
        const tightened = stricterTarget(sameMetric, template.qualityTarget);
        if (tightened === sameMetric) {
          state.rejections.push(
            `demand-template ${template.templateId} attempted to relax quality target ${template.qualityTarget.metric} on ${key}; universal derivation retained`,
          );
          relaxed = true;
        } else {
          existing.qualityTargets = existing.qualityTargets.map((target) =>
            target.metric === tightened.metric ? tightened : target,
          );
        }
      }
    }
    for (const requirement of template.evidenceRequirements ?? []) {
      existing.evidenceRequirements.add(requirement);
    }
    if (!relaxed) {
      existing.derivedFromTemplates.add(template.templateId);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Sealing.
// ---------------------------------------------------------------------------

function sealDemand(draft: DemandDraft, input: DiscoveryInput): CapabilityDemand {
  // Quality target: deterministic pick — the alphabetically-smallest
  // metric; same-metric targets fold to the strictest.
  const byMetric = new Map<string, QualityTarget>();
  for (const target of draft.qualityTargets) {
    const existing = byMetric.get(target.metric);
    byMetric.set(target.metric, existing === undefined ? target : stricterTarget(existing, target));
  }
  const chosenTarget =
    [...byMetric.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))[0]?.[1] ?? undefined;

  // Cost budget: same-currency folds to the minimum; mixed currencies
  // keep the alphabetically-first currency (conflict recorded as a note).
  let costBudget: MoneyAmount | undefined;
  if (draft.costBudgets.length > 0) {
    const currencies = [...new Set(draft.costBudgets.map((money) => money.currency))].sort();
    const currency = currencies[0]!;
    const same = draft.costBudgets.filter((money) => money.currency === currency);
    costBudget = same.reduce((acc, money) => smallerMoney(acc, money));
    if (currencies.length > 1) {
      draft.notes = [
        ...draft.notes,
        `mixed-currency budgets declared; ${currency} budget retained`,
      ].sort();
    }
  }

  // Explicit hints/templates beat default shapes: once any explicit input
  // or output exists, the default 'structured' placeholders yield.
  const finalInputKinds =
    draft.explicitInputs.size > 0 ? [...draft.explicitInputs] : [...draft.inputRepresentations];
  const finalOutputEntries =
    draft.explicitOutputs.size > 0
      ? [...draft.explicitOutputs].map((key) => draft.outputContract.get(key)!)
      : [...draft.outputContract.values()];
  const outputContract = finalOutputEntries
    .map((entry) => ({
      name: entry.name,
      kind: entry.kind as CapabilityDemand['outputContract'][number]['kind'],
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.kind < b.kind ? -1 : 1));

  const demand: CapabilityDemand = {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    demandId: 'demand:0000000000000000',
    operation: draft.operation,
    summary: draft.summaryParts.join('; '),
    requiredOutcome: draft.requiredOutcome,
    inputRepresentations: [...finalInputKinds].sort() as CapabilityDemand['inputRepresentations'],
    outputContract,
    qualityTarget: chosenTarget,
    acceptableUncertaintyConfidence: draft.uncertaintyConfidence,
    evidenceRequirements: [...draft.evidenceRequirements].sort(),
    verificationRequired: draft.verificationRequired,
    toolRequirements: [...draft.toolRequirements].sort(),
    environmentRequirements: [...draft.environmentRequirements].sort(),
    latencyBudgetMs: draft.latencyBudgetMs,
    costBudget,
    authorityConstraints: {
      executionAuthority: 'none',
      requiresHumanCosign: draft.cosign,
      notes: [...draft.authorityNotes].sort(),
    },
    dependsOnOperations: canonicalOperations([...draft.dependsOnOperations.values()]),
    lifecycleStage: input.task.lifecycleStage,
    domainRefs: canonicalStringUnion(input.task.domainRefs),
    affectedRefs: [...draft.affectedRefs].sort(),
    derivedFromSignals: [...draft.derivedFromSignals].sort(),
    derivedFromTemplates: [...draft.derivedFromTemplates].sort(),
  };
  const digest = contentDigest({ ...demand, demandId: undefined });
  return { ...demand, demandId: `demand:${digestSuffix16(digest)}` };
}
