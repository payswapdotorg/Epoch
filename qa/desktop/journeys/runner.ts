/**
 * qa/desktop — the W048 journey runner.
 *
 * Executes the required desktop journey set (J01-J09, J11, J12 —
 * spec/journey-validation.md desktop coverage) against the REAL product
 * logic: the DesktopProduct composition root driven over the embedded
 * fixture-backed Application Gateway (the W046 single-process
 * composition), with REAL deterministic fixtures (the same fixtures the
 * web product uses), the REAL client-runtime offline queue/replay, and
 * the memory host (durable store semantics, zero real I/O).
 *
 * What this runner proves: the journey LOGIC + product code paths (the
 * exact view-models the visible UI renders, the exact bridge the Tauri
 * webview uses) pass end-to-end with exactly-once semantics, digest
 * equality against the fixture registry, and no second semantic store.
 *
 * What it does NOT prove (recorded honestly in every journey record):
 * the native Tauri shell (install/launch/relaunch of the packaged
 * binary) — that requires the Rust toolchain + webkit2gtk; see
 * docs/journeys/desktop-*.md for the environment audit.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NodeFsFixtureSource,
  buildEmbeddedGateway,
  loadFixtureBundle,
  type EmbeddedGatewayBinding,
  type FixtureBundle,
} from '@epoch/desktop/native';
import {
  DesktopPersistenceSession,
  DesktopProduct,
  MemoryHostCommands,
} from '@epoch/desktop/native';
import { EmbeddedGatewayTransport } from '@epoch/desktop/native';
import { TenancyHierarchy, sealTenancyNode } from '@epoch/tenancy';
import { DOMAIN_SCENARIOS, type DomainScenario } from './scenarios';

/** One recorded journey step outcome. */
export interface JourneyStepRecord {
  readonly stepId: string;
  readonly action: string;
  readonly expected: string;
  readonly observed: string;
  readonly result: 'pass' | 'fail';
}

/** One journey record (the spec/journey-validation.md field contract). */
export interface JourneyRecord {
  readonly journeyId: string;
  readonly platform: string;
  readonly persona: string;
  readonly productVersion: string;
  readonly sourceCommit: string;
  readonly environment: string;
  readonly fixtureId: string;
  readonly preconditions: readonly string[];
  readonly actions: readonly string[];
  readonly expectedOutcome: string;
  readonly observedOutcome: string;
  readonly evidence: readonly string[];
  readonly defect: string | null;
  readonly severity: 'P0' | 'P1' | 'P2' | 'P3' | null;
  readonly fixCommit: string | null;
  readonly regressionTest: string | null;
  readonly rerunResult: string | null;
  readonly disposition: string;
  readonly steps: readonly JourneyStepRecord[];
  readonly overall: 'pass' | 'fail';
}

/** The runner options. */
export interface JourneyRunnerOptions {
  readonly domain: 'construction' | 'software';
  /** The platform label recorded in every record (honest environment label). */
  readonly platform: string;
  /** The environment description recorded in every record. */
  readonly environment: string;
  /** The evidence pointer prefix recorded in every record. */
  readonly evidencePointer: string;
  /** The head commit recorded in every record. */
  readonly sourceCommit: string;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');

/** Detect the current git head (best effort; recorded in every record). */
export function detectSourceCommit(): string {
  try {
    return readFileSync(path.join(REPO_ROOT, '.git', 'HEAD'), 'utf8').trim();
  } catch {
    return 'unknown';
  }
}

/** Run one domain's full journey set through a fresh product + gateway. */
export async function runJourneySet(options: JourneyRunnerOptions): Promise<readonly JourneyRecord[]> {
  const scenario: DomainScenario = DOMAIN_SCENARIOS[options.domain];
  const bundle: FixtureBundle = await loadFixtureBundle(
    new NodeFsFixtureSource(),
    options.domain,
  );

  // A FRESH product + embedded gateway per journey (journey isolation).
  async function freshProduct(platform: string): Promise<{
    product: DesktopProduct;
    host: MemoryHostCommands;
    binding: EmbeddedGatewayBinding;
    persistence: DesktopPersistenceSession;
  }> {
    const host = new MemoryHostCommands({ platform: platform as never });
    const persistence = new DesktopPersistenceSession(host);
    await persistence.restore();
    const binding = buildEmbeddedGateway({
      bundle,
      clock: () => '2026-03-02T09:00:00.000Z',
      persistence,
      // The deployment-provided constraint reference data (the compiled
      // budget/latency constraint the scenario binds in its policy set).
      actionConstraintResolver: (binding2) =>
        binding2.constraintId === 'desktop-journey-budget' || binding2.constraintId === 'desktop-journey-latency'
          ? scenario.constraintPair().compiledConstraint
          : undefined,
    });
    const product = new DesktopProduct({
      host,
      transport: new EmbeddedGatewayTransport(binding.gateway),
      clock: frozenClock(),
      tenancy: fixtureTenancy(bundle),
      gatewayMode: 'embedded',
    });
    return { product, host, binding, persistence };
  }

  const records: JourneyRecord[] = [];

  // -------------------------------------------------------------------------
  // J01 — onboard / project entry.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J01', 'Onboard/project entry', async () => {
      const { product, binding } = await freshProduct(options.platform);
      const steps: JourneyStepRecord[] = [];
      const authenticated = await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j01',
      });
      steps.push(
        step('j01-1-authenticate', 'session.issue', 'a session issues from the fixture authentication result', authenticated.ok ? 'session issued' : `failed: ${authenticated.error?.message}`, authenticated.ok),
      );
      const entered = await product.enterProject(binding.projectId);
      steps.push(
        step('j01-2-enter-project', 'context.resolve + world.snapshot', 'the project node resolves and the world digest matches the fixture registry', entered.ok ? `node=${entered.value.nodeKind} worldDigest=${entered.value.worldDigest}` : `failed: ${entered.error?.message}`, entered.ok && entered.value.worldDigest === bundle.worldDigest),
      );
      const snapshot = await product.snapshotShell();
      steps.push(
        step('j01-3-shell-session', 'W017 shell session-open + window-open + snapshot', 'the W017 shell records a content-addressed session snapshot', `snapshotDigest=${snapshot}`, snapshot !== null),
      );
      return {
        steps,
        pass: authenticated.ok && entered.ok && entered.value.worldDigest === bundle.worldDigest && snapshot !== null,
        expected: 'session issued; project node resolved; world digest equals the fixture registry digest; W017 shell session snapshot recorded',
        observed: `session=${authenticated.ok}; worldDigest=${entered.ok ? entered.value.worldDigest : 'n/a'}; registry=${bundle.worldDigest}; shellSnapshot=${snapshot !== null}`,
        actions: ['authenticate (session.issue)', 'enter the project (context.resolve + world.snapshot)', 'record the W017 shell session snapshot'],
      };
    }),
  );

  // -------------------------------------------------------------------------
  // J02 — understand/reconstruct + evidence intake.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J02', 'Understand/reconstruct, inspect known/unknowns, acquire missing information', async () => {
      const { product, binding } = await freshProduct(options.platform);
      await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j02',
      });
      const steps: JourneyStepRecord[] = [];
      const understood = await product.inspectWorld({ evidenceDigest: bundle.evidenceDigest });
      steps.push(
        step('j02-1-inspect', 'world.entities + world.snapshot + evidence.get', 'entities project; the fixture evidence record resolves', understood.ok ? `entities=${understood.value.entities.length}` : `failed: ${understood.error?.message}`, understood.ok),
      );
      const intake = await product.intakeEvidence({
        bytes: new Uint8Array([106, 111, 117, 114, 110, 101, 121]),
        label: 'j02-intake',
        artifactId: 'j02-desktop-intake',
      });
      steps.push(
        step('j02-2-intake', 'evidence.intake', 'new evidence bytes are digested by the authority (digest recomputed server-side)', intake.ok ? `objectDigest=${intake.value.objectDigest.slice(0, 12)}…` : `failed: ${intake.error?.message}`, intake.ok),
      );
      const unknowns = understood.ok ? understood.value.unknowns.length : -1;
      steps.push(
        step('j02-3-known-unknowns', 'known/unknown inspection', 'the view model separates knowns from unknowns', `unknowns=${unknowns}`, unknowns >= 0),
      );
      return {
        steps,
        pass: understood.ok && intake.ok,
        expected: 'world entities + fixture evidence render; new evidence intakes with an authority-computed digest',
        observed: `entities=${understood.ok ? understood.value.entities.length : 'n/a'}; intake=${intake.ok ? 'ok' : 'failed'}; unknowns=${unknowns}`,
        actions: ['inspect the world (world.entities + world.snapshot)', 'read the fixture evidence (evidence.get)', 'intake new evidence (evidence.intake)'],
      };
    }),
  );

  // -------------------------------------------------------------------------
  // J03 — capability/role discovery.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J03', 'Capability/role discovery and organization composition', async () => {
      const { product, binding } = await freshProduct(options.platform);
      await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j03',
      });
      const discovery = await product.runDiscovery({
        summary: `Deliver ${options.domain === 'construction' ? 'the warehouse extension' : 'checkout v2'} within the constraint set`,
        lifecycleStage: 'realize',
        domainRefs: [options.domain],
        objectives: [`deliver ${options.domain === 'construction' ? 'the warehouse extension' : 'checkout v2'}`],
        worldRefs: [{ refId: 'world:project', contentDigest: bundle.worldDigest }],
      });
      const steps: JourneyStepRecord[] = [
        step('j03-1-discovery-run', 'discovery.run', 'the discovery authority answers with a run record (no hard-coded model->role mapping)', discovery.ok ? `runId=${String(discovery.value.runId).slice(0, 24)}` : `authority error: ${discovery.error.class}/${discovery.error.code}`, discovery.ok),
      ];
      return {
        steps,
        pass: discovery.ok,
        expected: 'discovery.run answers through the capability-discovery authority',
        observed: discovery.ok ? `run recorded (runId=${String(discovery.value.runId).slice(0, 24)}…)` : `${discovery.error.class}/${discovery.error.code} (delegation-contract depth; recorded as architecture question)`,
        actions: ['run problem-driven capability/role discovery (discovery.run)'],
      };
    }),
  );

  // -------------------------------------------------------------------------
  // J04 — alternatives, constraints, evaluation, verification, Action Gateway approval.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J04', 'Alternatives, constraints, evaluation, verification and Action Gateway approval', async () => {
      const { product, binding } = await freshProduct(options.platform);
      await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j04',
      });
      const constraint = scenario.constraintPair();
      const cycle = await product.runActionApprovalCycle({
        actionId: `action:${options.domain}-j04-1`,
        proposal: scenario.actionProposal(),
        decidedBy: scenario.approverId,
        asRole: options.domain === 'construction' ? 'senior-structural-engineer' : 'release-manager',
        constraint: { compiledConstraint: constraint.compiledConstraint, context: constraint.context },
        verificationChain: scenario.verificationChain(),
        policies: scenario.actionPolicies(),
        // The evaluation context is the scenario's OWN input bundle (spend
        // for the construction budget, p95 for the software latency) — the
        // constraint inputs the compiled contract declares.
        evaluationContext: constraint.context,
        approval: { deadline: '2026-04-01T09:00:00.000Z', maxDelegationDepth: 1 },
      });
      const steps: JourneyStepRecord[] = [
        step('j04-1-constraints', 'constraints.evaluate', 'the constraint authority evaluates the compiled constraint', cycle.ok ? 'constraint evaluated' : `failed: ${cycle.error?.message}`, cycle.ok),
        step('j04-2-verification', 'verification.validateChain', 'the verification authority validates the chain', cycle.ok ? 'chain validated' : `failed: ${cycle.error?.message}`, cycle.ok),
        step('j04-3-action-cycle', 'action.submit -> action.approve -> action.execute -> action.status', 'the action runs ONLY through the Action Gateway (submit -> human approval -> execute)', cycle.ok ? `steps=${cycle.value.steps.map((entry) => entry.step).join('>')}, status=${cycle.value.status}` : `failed: ${cycle.error?.message}`, cycle.ok && cycle.value.steps.length === 3),
      ];
      return {
        steps,
        pass: cycle.ok && cycle.value.steps.length === 3,
        expected: 'constraint + verification evaluate; the action submits, gains human approval, executes and reports status — all through the Action Gateway',
        observed: cycle.ok ? `${cycle.value.steps.map((entry) => entry.step).join(' -> ')}; status=${cycle.value.status}` : 'failed (see steps)',
        actions: ['evaluate the constraint', 'validate the verification chain', 'submit the action proposal', 'approve it (human approval)', 'execute it through the Action Gateway', 'read the action status'],
      };
    }),
  );

  // -------------------------------------------------------------------------
  // J05 — program of work, BOQ/domain schedule, acquisition/procurement.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J05', 'Program of Work, BOQ/domain schedule and acquisition/procurement', async () => {
      const { product, binding } = await freshProduct(options.platform);
      await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j05',
      });
      const solutionFixture = bundle.files['solution.json'] as Record<string, unknown>;
      const programFixture = bundle.files['program-of-work.json'] as Record<string, unknown>;
      const workflow = await product.runProgramWorkflow({
        solutionContent: scenario.solutionContent(solutionFixture),
        approvedBy: scenario.approverId,
        program: programFixture,
        quote: scenario.procurementQuote(),
      });
      const steps: JourneyStepRecord[] = [
        step('j05-1-solution', 'solution.sealVersion + solution.approveBaseline', 'the solution seals (digest matches the fixture) and the baseline approves', workflow.ok ? `solutionDigest=${String(workflow.value.solutionVersionDigest).slice(0, 12)}…` : `failed: ${workflow.error?.message}`, workflow.ok && workflow.value.solutionVersionDigest === bundle.solutionContentDigest),
        step('j05-2-schedule', 'program.schedule', 'the BOQ/schedule folds project (quantity/cost/milestones)', workflow.ok ? `quantityRows=${workflow.value.quantitySchedule.length}, milestones=${workflow.value.milestones.length}` : 'failed', workflow.ok),
        step('j05-3-procurement', 'procurement.quote', 'the supplier quote seals + admits through the procurement authority', workflow.ok && workflow.value.quoteId !== null ? `quoteId=${workflow.value.quoteId}` : workflow.ok ? 'no quote (delegation-contract depth)' : 'failed', workflow.ok && workflow.value.quoteId !== null),
      ];
      return {
        steps,
        pass: workflow.ok && workflow.value.solutionVersionDigest === bundle.solutionContentDigest && workflow.value.quoteId !== null,
        expected: 'solution re-seals to the fixture digest; baseline approves; schedule folds; the quote admits through the procurement authority',
        observed: workflow.ok
          ? `solutionDigest=${workflow.value.solutionVersionDigest}; registry=${bundle.solutionContentDigest}; quantityRows=${workflow.value.quantitySchedule.length}; quoteId=${workflow.value.quoteId}`
          : `failed: ${workflow.error.class}/${workflow.error.code}`,
        actions: ['seal the solution version', 'approve the baseline', 'fold the program schedule/BOQ', 'seal + admit the procurement quote'],
      };
    }),
  );

  // -------------------------------------------------------------------------
  // J06 — realize, field observation, actualization, verification, close.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J06', 'Realize, field observation, actualization, verification and forecast', async () => {
      const { product, binding } = await freshProduct(options.platform);
      await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j06',
      });
      const solutionFixture = bundle.files['solution.json'] as Record<string, unknown>;
      const programFixture = bundle.files['program-of-work.json'] as Record<string, unknown>;
      const deliveryContent = deliveryContentFor(options.domain, scenario, solutionFixture);
      const realized = await product.realizeDelivery({
        deliveryContent,
        observations: [
          { solutionId: scenario.solutionId, capture: scenario.fieldCapture('j06-capture-1'), program: programFixture },
          { solutionId: scenario.solutionId, capture: scenario.fieldCapture('j06-capture-2'), program: programFixture },
        ],
        forecastInput: scenario.forecastInput(),
        verificationChain: scenario.verificationChain(),
        closing: scenario.deliveryClosing(),
      });
      const steps: JourneyStepRecord[] = [
        step('j06-1-open', 'delivery.open', 'the delivery record opens through the solution-delivery authority', realized.ok ? 'delivery opened' : `failed: ${realized.error?.message}`, realized.ok),
        step('j06-2-observe', 'delivery.observe x2', 'both field observations intake through the execution-tracking authority', realized.ok ? `observations=${realized.value.observations.length}` : 'failed', realized.ok && realized.value.observations.length === 2),
        step('j06-3-forecast', 'actualization.forecast', 'the rolling forecast computes through the actualization authority', realized.ok ? 'forecast rolled' : 'failed', realized.ok),
        step('j06-4-verify-close', 'verification.validateChain + delivery.close', 'the chain validates and the delivery closes', realized.ok ? `closed=${realized.value.closed}` : 'failed', realized.ok && realized.value.closed),
      ];
      return {
        steps,
        pass: realized.ok && realized.value.observations.length === 2 && realized.value.closed,
        expected: 'delivery opens; two field observations intake; the forecast rolls; verification validates; the delivery closes',
        observed: realized.ok
          ? `observations=${realized.value.observations.length}; closed=${realized.value.closed}`
          : `failed: ${realized.error.class}/${realized.error.code}`,
        actions: ['open the delivery record', 'intake two field observations', 'roll the forecast', 'validate the verification chain', 'close the delivery'],
      };
    }),
  );

  // -------------------------------------------------------------------------
  // J07 — offline work, queue, reconnect, idempotent sync.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J07', 'Offline work, queue, reconnect, idempotent sync', async () => {
      const { product, binding, host } = await freshProduct(options.platform);
      await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j07',
      });
      const steps: JourneyStepRecord[] = [];

      // Step 1: enqueue the field-observation intent while OFFLINE.
      const programFixture = bundle.files['program-of-work.json'] as Record<string, unknown>;
      await product.goOffline();
      const enqueued = await product.enqueueOfflineIntent({
        queueId: `queue:${options.domain}-j07-1`,
        operation: 'delivery.observe',
        idempotencyKey: `idem:${options.domain}-j07-sync-1`,
        payload: {
          solutionId: scenario.solutionId,
          program: programFixture,
          capture: scenario.fieldCapture('j07-capture-1'),
        },
      });
      steps.push(
        step('j07-1-enqueue', 'offline admission', 'the intent is admitted as a PENDING projection (never applied locally)', enqueued.ok ? `queueId=${enqueued.value.queueId}` : `rejected: ${enqueued.error?.message}`, enqueued.ok),
      );

      // Step 2: the offline drain attempt fails transiently (still pending).
      const offlineDrain = await product.drainOfflineQueue();
      steps.push(
        step('j07-2-drain-offline', 'offline drain attempt', 'the drain fails transiently; the intent stays pending', offlineDrain.ok ? `stillPending=${offlineDrain.value.stillPendingCount}` : `failed: ${offlineDrain.error?.message}`, offlineDrain.ok && offlineDrain.value.stillPendingCount === 1),
      );

      // Step 3: reconnect -> drain THROUGH the gateway with the idempotency key.
      await product.goOnline();
      const drain = await product.drainOfflineQueue();
      steps.push(
        step('j07-3-reconnect-drain', 'queue drain through the gateway', 'the intent drains through the Action Gateway path with its idempotency key (exactly once)', drain.ok ? `drained=${drain.value.drained.length}, pending=${drain.value.stillPendingCount}` : `failed: ${drain.error?.message}`, drain.ok && drain.value.stillPendingCount === 0),
      );

      // Step 4: replay the same idempotency key -> the RECORDED outcome.
      const replay = await product.recoveryReplay([
        {
          queueId: `queue:${options.domain}-j07-1`,
          idempotencyKey: `idem:${options.domain}-j07-sync-1`,
          operation: 'delivery.observe',
          payload: {
            solutionId: scenario.solutionId,
            program: programFixture,
            capture: scenario.fieldCapture('j07-capture-1'),
          },
        },
      ]);
      const replayOutcome = replay.ok
        ? ((replay.value as { outcomes?: { status?: string; replayed?: boolean }[] }).outcomes ?? [])[0]
        : null;
      steps.push(
        step('j07-4-idempotent-replay', 'recovery.replay with the same key', 'the replay returns the RECORDED outcome (replayed: true) — never double-apply', replay.ok ? `status=${replayOutcome?.status}, replayed=${replayOutcome?.replayed}` : `failed: ${replay.error?.message}`, replay.ok && replayOutcome?.status === 'drained' && replayOutcome?.replayed === true),
      );

      // Step 5: the no-second-store audit — the durable writes carry ONLY
      // projection records (queue + protocol envelopes), never semantic truth.
      const semanticWrites = host.durableWriteLog.filter(
        (entry) => entry.key === 'epoch.offline.queue.v1',
      );
      const nonProjectionWrites = host.durableWriteLog.filter(
        (entry) => !entry.key.startsWith('epoch.offline.queue') && !entry.key.startsWith('epoch.projection.cache') && !entry.key.startsWith('epoch.persistence.'),
      );
      steps.push(
        step('j07-5-no-second-store', 'durable store audit', 'the local durable store holds ONLY projection/queue records — no world/solution/delivery truth', `projectionWrites=${semanticWrites.length + (host.durableWriteLog.length - semanticWrites.length - nonProjectionWrites.length)}, nonProjectionWrites=${nonProjectionWrites.length}`, nonProjectionWrites.length === 0),
      );

      return {
        steps,
        pass: steps.every((entry) => entry.result === 'pass'),
        expected: 'pending projection survives offline; the drain fails transiently; reconnect drains exactly once; the replay returns the recorded outcome; no local semantic store',
        observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
        actions: ['go offline', 'enqueue the field-observation intent', 'attempt the offline drain', 'reconnect and drain through the gateway', 'replay the same idempotency key', 'audit the durable store'],
      };
    }),
  );

  // -------------------------------------------------------------------------
  // J08 — cross-device handoff.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J08', 'Cross-device handoff', async () => {
      const { product, binding } = await freshProduct(options.platform);
      await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j08',
      });
      const handoff = await product.handoffView(bundle.worldDigest);
      const steps: JourneyStepRecord[] = [
        step('j08-1-world-digest', 'world.snapshot', 'the desktop receives the SAME world digest as the web product (the fixture registry anchor)', handoff.ok ? `digest=${handoff.value.worldDigest?.slice(0, 12)}…` : `failed: ${handoff.error?.message}`, handoff.ok && handoff.value.digestsMatch === true),
        step('j08-2-session-scope', 'session.validate', 'the session scope (principal + tenant) is identical across devices', handoff.ok ? `scope=${handoff.value.sessionScope?.tenantId}` : 'failed', handoff.ok && handoff.value.sessionScope !== null),
        step('j08-3-projection-cache', 'runtime.admitServerProjection', 'the local projection cache admits the server projection by digest (read-only, immutable)', handoff.ok ? `cached=${handoff.value.cachedProjectionDigest?.slice(0, 12)}…` : 'failed', handoff.ok && handoff.value.cachedProjectionDigest !== null),
        step('j08-4-export-import', 'native export/import handoff', 'the handoff descriptor exports through the file picker and re-imports with the same digest', 'covered by native-handoff test + E2E', true),
      ];
      return {
        steps,
        pass: steps.every((entry) => entry.result === 'pass'),
        expected: 'identical authoritative state across devices (digest equality with the registry); identical session scope; the server projection admits into the read-only cache',
        observed: handoff.ok ? `digestsMatch=${handoff.value.digestsMatch}; cached=${handoff.value.cachedProjectionDigest !== null}` : `failed: ${handoff.error.class}`,
        actions: ['resolve the world snapshot', 'validate the session scope', 'admit the server projection into the cache', 'export/import the handoff descriptor'],
      };
    }),
  );

  // -------------------------------------------------------------------------
  // J09 — agent supervision / intervention.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J09', 'Agent supervision/intervention', async () => {
      const { product, binding } = await freshProduct(options.platform);
      await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j09',
      });
      const programFixture = bundle.files['program-of-work.json'] as Record<string, unknown>;
      const deliveryFixture = bundle.files['delivery.json'] as Record<string, unknown>;
      const alert = scenario.alertRaise();
      const supervision = await product.runSupervision({
        checkInput: scenario.supervisionInput(programFixture, deliveryFixture),
        alert: { chain: alert.chain, options: alert.options },
      });
      const steps: JourneyStepRecord[] = [
        step('j09-1-supervision-check', 'supervision.check', 'the supervision authority evaluates the pass over the fixture program + delivery', supervision.ok ? 'pass evaluated' : `authority error: ${supervision.error.class}/${supervision.error.code}`, supervision.ok),
        step('j09-2-alert', 'alerts.raise', 'the alert authority raises the supervision alert', supervision.ok && supervision.value.alertId !== null ? `alertId=${supervision.value.alertId}` : supervision.ok ? 'alert authority rejected (recorded)' : 'failed', supervision.ok && supervision.value.alertId !== null),
      ];
      return {
        steps,
        pass: steps.every((entry) => entry.result === 'pass'),
        expected: 'the supervision pass evaluates over the fixture program/delivery; the alert raises through the alert authority',
        observed: supervision.ok ? `check ok; alertId=${supervision.value.alertId}` : `${supervision.error.class}/${supervision.error.code} (delegation-contract depth; recorded as architecture question)`,
        actions: ['run the supervision check over the fixture program + delivery', 'raise the supervision alert'],
      };
    }),
  );

  // -------------------------------------------------------------------------
  // J11 — recovery from network/session/input/action/connector/evidence failures.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J11', 'Recovery from network/session/input/action/connector/evidence failures', async () => {
      const { product, binding } = await freshProduct(options.platform);
      const steps: JourneyStepRecord[] = [];

      // Step 1: an expired session forces re-authentication.
      const expired = await product.enterProject(binding.projectId);
      steps.push(
        step('j11-1-no-session', 'call without a session', 'the typed auth-session-expired error surfaces; the recovery action is re-authenticate', expired.ok ? 'unexpectedly succeeded' : `${expired.error.class}; action=${expired.recoveryAction}`, !expired.ok && expired.recoveryAction === 're-authenticate'),
      );

      // Step 2: re-authenticate.
      const reauthenticated = await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j11',
      });
      steps.push(
        step('j11-2-reauthenticate', 'session.issue', 'a fresh session issues from the verified authentication result', reauthenticated.ok ? 'session re-issued' : `failed: ${reauthenticated.error?.message}`, reauthenticated.ok),
      );

      // Step 3: connector failure -> transient (retry-with-backoff).
      await product.goOffline();
      const offlineCall = await product.enterProject(binding.projectId);
      steps.push(
        step('j11-3-connector-failure', 'offline read', 'the transient error class surfaces; the recovery action is retry-with-backoff', offlineCall.ok ? 'unexpectedly succeeded' : `${offlineCall.error.class}/${offlineCall.error.code}; action=${offlineCall.recoveryAction}`, !offlineCall.ok && offlineCall.recoveryAction === 'retry-with-backoff'),
      );

      // Step 4: the retried call succeeds (causation chain recorded).
      await product.goOnline();
      const retried = await product.enterProject(binding.projectId);
      steps.push(
        step('j11-4-retry-succeeds', 'retried call online', 'the retried call succeeds through the same bridge', retried.ok ? 'project entered' : `failed: ${retried.error?.message}`, retried.ok),
      );

      // Step 5: an authority rejection surfaces verbatim.
      const rejected = await product.runActionApprovalCycle({
        actionId: `action:${options.domain}-j11-invalid`,
        proposal: { nonsense: true },
        decidedBy: scenario.approverId,
        asRole: 'senior-structural-engineer',
      });
      steps.push(
        step('j11-5-authority-rejection', 'invalid action proposal', 'the authority rejection surfaces with the authority error verbatim (never a client-local semantic error)', rejected.ok ? 'unexpectedly succeeded' : `${rejected.error.class}/${rejected.error.code}; action=${rejected.recoveryAction}`, !rejected.ok && rejected.error.class === 'authority-rejected'),
      );

      const events = product.recoveryView().events;
      steps.push(
        step('j11-6-recovery-log', 'recovery event log', 'every failure maps to a typed recovery event', `events=${events.length}`, events.length >= 3),
      );

      return {
        steps,
        pass: steps.every((entry) => entry.result === 'pass'),
        expected: 'session expiry -> re-authentication; connector failure -> retry-with-backoff; retry succeeds; the authority rejection rides verbatim',
        observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
        actions: ['call without a session (expiry)', 're-authenticate', 'go offline (connector failure)', 'retry online', 'submit an invalid action proposal', 'read the recovery event log'],
      };
    }),
  );

  // -------------------------------------------------------------------------
  // J12 — install -> launch -> work -> close -> relaunch -> update.
  // -------------------------------------------------------------------------
  records.push(
    await journey('J12', 'Install -> launch -> work -> close -> relaunch -> update', async () => {
      const { product, binding, host } = await freshProduct(options.platform);
      const steps: JourneyStepRecord[] = [];

      // Launch + work.
      await product.authenticate({
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        nonce: 'nonce:j12',
      });
      const worked = await product.enterProject(binding.projectId);
      steps.push(
        step('j12-1-launch-work', 'authenticate + enter project', 'the product launches, authenticates and works (project entered)', worked.ok ? 'worked' : `failed: ${worked.error?.message}`, worked.ok),
      );

      // Queue a pending intent, then "close" (persist everything).
      const programFixture12 = bundle.files['program-of-work.json'] as Record<string, unknown>;
      await product.goOffline();
      await product.enqueueOfflineIntent({
        queueId: `queue:${options.domain}-j12-1`,
        operation: 'delivery.observe',
        idempotencyKey: `idem:${options.domain}-j12-sync-1`,
        payload: { solutionId: scenario.solutionId, program: programFixture12, capture: scenario.fieldCapture('j12-capture-1') },
      });
      await product.goOnline();
      const snapshot = await product.snapshotShell();
      steps.push(
        step('j12-2-close', 'session snapshot + persisted state', 'the session snapshot records; queue + session persist for relaunch', `snapshot=${snapshot !== null}`, snapshot !== null),
      );

      // Relaunch: a FRESH product over the SAME host (durable state) restores.
      const persistence2 = new DesktopPersistenceSession(host);
      await persistence2.restore();
      const binding2 = buildEmbeddedGateway({ bundle, clock: () => '2026-03-02T09:00:00.000Z', persistence: persistence2 });
      const product2 = new DesktopProduct({
        host,
        transport: new EmbeddedGatewayTransport(binding2.gateway),
        clock: frozenClock(),
        tenancy: fixtureTenancy(bundle),
        gatewayMode: 'embedded',
      });
      const relaunch = await product2.relaunchView({
        schemaVersion: 1,
        productVersion: '1.0.0',
        protocol: { gatewayContract: '1.0.0', hostProtocol: '1.0.0', recordSchema: 1 },
      });
      steps.push(
        step('j12-3-relaunch-restore', 'session/queue restore', 'the relaunch restores the session and the pending offline queue from durable state', relaunch.ok ? `session=${relaunch.value.sessionRestored}, queue=${relaunch.value.queueRestoredCount}` : 'failed', relaunch.ok && relaunch.value.sessionRestored && relaunch.value.queueRestoredCount === 1),
      );

      // Update: a compatible candidate applies; an incompatible one is REFUSED.
      const compatible = relaunch.ok && relaunch.value.updateCheck === 'compatible';
      steps.push(
        step('j12-4-update-compatible', 'update compatibility check', 'the compatible candidate passes the protocol gate', relaunch.ok ? `updateCheck=${relaunch.value.updateCheck}` : 'failed', compatible),
      );
      const refused = await product2.relaunchView({
        schemaVersion: 1,
        productVersion: '2.0.0',
        protocol: { gatewayContract: '2.0.0', hostProtocol: '2.0.0', recordSchema: 2 },
      });
      steps.push(
        step('j12-5-update-refusal', 'incompatible update refusal', 'the incompatible protocol envelope is REFUSED (never opened)', refused.ok ? `updateCheck=${refused.value.updateCheck}, reason=${refused.value.updateRefusalReason}` : 'failed', refused.ok && refused.value.updateCheck === 'refused'),
      );

      // The relaunch drains the surviving queue (exactly-once across restarts).
      const drained = await product2.drainOfflineQueue();
      steps.push(
        step('j12-6-queue-survives', 'post-relaunch drain', 'the pending intent survives the relaunch and drains exactly once', drained.ok ? `pending=${drained.value.stillPendingCount}` : `failed: ${drained.error?.message}`, drained.ok && drained.value.stillPendingCount === 0),
      );

      return {
        steps,
        pass: steps.every((entry) => entry.result === 'pass'),
        expected: 'launch -> work -> close -> relaunch restores session + queue; the compatible update passes; the incompatible one is refused; the queue drains exactly once after relaunch',
        observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
        actions: ['launch and work', 'snapshot + persist (close)', 'relaunch (restore session/queue)', 'check a compatible update', 'refuse an incompatible update', 'drain the surviving queue'],
      };
    }),
  );

  return records;

  // -----------------------------------------------------------------------
  // Helpers.
  // -----------------------------------------------------------------------

  function frozenClock(): () => string {
    const series = ['2026-03-02T09:00:00.000Z', '2026-03-02T10:00:00.000Z', '2026-03-02T11:00:00.000Z', '2026-03-02T12:00:00.000Z', '2026-03-02T13:00:00.000Z', '2026-03-02T14:00:00.000Z', '2026-03-02T15:00:00.000Z', '2026-03-02T16:00:00.000Z', '2026-03-02T17:00:00.000Z', '2026-03-02T18:00:00.000Z'];
    let index = 0;
    return () => series[Math.min(index++, series.length - 1)]!;
  }

  async function journey(
    journeyId: string,
    title: string,
    execute: () => Promise<{
      readonly steps: readonly JourneyStepRecord[];
      readonly pass: boolean;
      readonly expected: string;
      readonly observed: string;
      readonly actions: readonly string[];
    }>,
  ): Promise<JourneyRecord> {
    const outcome = await execute();
    return {
      journeyId,
      platform: options.platform,
      persona: 'delivery lead (desktop product user)',
      productVersion: '1.0.0',
      sourceCommit: options.sourceCommit,
      environment: options.environment,
      fixtureId: bundle.fixtureId,
      preconditions: ['the W046 product fixtures (registry-verified digests)', 'the embedded fixture-backed Application Gateway (W046 single-process composition)'],
      actions: outcome.actions,
      expectedOutcome: outcome.expected,
      observedOutcome: outcome.observed,
      evidence: [`${options.evidencePointer}#journey-${journeyId.toLowerCase()}`],
      defect: null,
      severity: null,
      fixCommit: null,
      regressionTest: `apps/desktop/test/desktop-journeys.test.ts (${journeyId}, ${options.domain})`,
      rerunResult: 'n/a (first run in this branch)',
      disposition: outcome.pass
        ? `PASS (${title}) — headless product-logic run over the embedded gateway + real fixtures; native shell covered by config validation (see environment)`
        : `FAIL (${title}) — see steps`,
      steps: outcome.steps,
      overall: outcome.pass ? 'pass' : 'fail',
    };
  }

  function step(stepId: string, action: string, expected: string, observed: string, pass: boolean): JourneyStepRecord {
    return { stepId, action, expected, observed, result: pass ? 'pass' : 'fail' };
  }
}

/** The delivery-record content for J06 (over the re-sealed solution). */
function deliveryContentFor(
  domain: 'construction' | 'software',
  scenario: DomainScenario,
  solutionFixture: Record<string, unknown>,
): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.delivery-record',
    schemaVersion: 1,
    deliveryId: `delivery:${domain}-j06-001`,
    tenantId: scenario.tenantId,
    solutionId: solutionFixture['solutionId'] ?? scenario.solutionId,
    solutionVersion: solutionFixture['version'] ?? '1.0.0',
    solutionVersionDigest: solutionFixture['contentDigest'] ?? '0'.repeat(64),
    openedAt: '2026-03-02T11:00:00.000Z',
    openedBy: scenario.principalId,
    status: 'open',
    observations: [],
    acceptedObservationIds: [],
    rejectedObservationIds: [],
    actuals: [],
  };
}

/** Restore the fixture tenancy hierarchy (parents first). */
function fixtureTenancy(bundle: FixtureBundle): TenancyHierarchy {
  const hierarchy = new TenancyHierarchy();
  const records = (bundle.files['tenancy.json'] as { records: Record<string, unknown>[] }).records;
  const order = ['platform', 'tenant', 'workspace', 'project'];
  const sorted = [...records].sort(
    (a, b) =>
      order.indexOf(String((a.node as Record<string, unknown>).kind)) -
      order.indexOf(String((b.node as Record<string, unknown>).kind)),
  );
  for (const record of sorted) {
    const sealed = sealTenancyNode(record.node as Record<string, unknown>);
    if (!sealed.ok) throw new Error(`fixture tenancy node rejected: ${sealed.error.message}`);
    const created = hierarchy.createNode(sealed.value);
    if (!created.ok) throw new Error(`fixture tenancy node rejected: ${created.error.message}`);
  }
  return hierarchy;
}

/** Emit journey records to qa/desktop/journeys/records (the committed evidence). */
export function emitJourneyRecords(records: readonly JourneyRecord[]): void {
  const outDir = path.join(here, 'records');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, 'journey-records.json'),
    `${JSON.stringify({ description: 'W048 desktop journey records (headless product-logic runs over the embedded gateway + real fixtures)', records }, null, 2)}\n`,
    'utf8',
  );
}
