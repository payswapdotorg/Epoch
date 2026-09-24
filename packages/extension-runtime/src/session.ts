/**
 * The sandboxed extension SESSION (W008): the typed context object an
 * admitted extension runs inside. `invoke` is the complete host-call
 * pipeline — every call is permission-checked against the FROZEN grant
 * allow-list before dispatch (lock rule 10), and every envelope is
 * validated against the typed envelope schema plus the per-function
 * request contract mirrors:
 *
 * 1. envelope parse (`validation`, precise paths);
 * 2. session identity (`sandbox-violation` / session-identity-mismatch);
 * 3. extension lifecycle (retired sessions stop serving —
 *    `lifecycle-conflict`);
 * 4. capability scope + grant allow-list + required resource scope
 *    (see src/enforcement.ts — typed `permission-denied` /
 *    `sandbox-violation`);
 * 5. payload validation against the per-function request mirror
 *    (`validation`);
 * 6. dispatch to the in-memory reference host state (deterministic);
 * 7. response validation against the per-function response mirror (a
 *    violating host implementation yields a typed handler-error
 *    outcome, never an untyped leak);
 * 8. audit record (permitted or denied) — deterministic sequence.
 *
 * The session exposes the deterministic sandbox surface description
 * (`describeSandboxSurface`) — the machine-checkable boundary the
 * extension actually runs against.
 */
import type { JsonValue } from '@epoch/agent-protocol';
import {
  CapabilityInvokeRequestMirrorSchema,
  CapabilityInvokeResponseMirrorSchema,
  ClockReadRequestMirrorSchema,
  ClockReadResponseMirrorSchema,
  EvidenceAppendRequestMirrorSchema,
  EvidenceAppendResponseMirrorSchema,
  HostInvocationEnvelopeSchema,
  LogWriteRequestMirrorSchema,
  LogWriteResponseMirrorSchema,
  StorageReadRequestMirrorSchema,
  StorageReadResponseMirrorSchema,
  StorageWriteRequestMirrorSchema,
  StorageWriteResponseMirrorSchema,
  WorldReadRequestMirrorSchema,
  WorldReadResponseMirrorSchema,
} from './schema';
import { flattenZodIssues, validationError } from './issues';
import { enforceInvocation } from './enforcement';
import type {
  AdmittedExtensionRecord,
  CapabilityInvoker,
  ExtensionRuntimeErrorCode,
  ExtensionRuntimeError,
  HostClock,
  HostExecutionOutcome,
  HostInvocationEnvelope,
  InvokeResult,
  InvocationAuditRecord,
  SandboxSurfaceDescription,
  WorldViewProvider,
} from './types';
import type {
  ExtensionStorageNamespace,
  InMemoryEvidenceBook,
  SessionLogRing,
} from './state';
import type { CapabilityLifecycleState } from '@epoch/capability-registry';

/** Request payload mirror table (per host function). */
const REQUEST_MIRRORS = {
  'clock.read': ClockReadRequestMirrorSchema,
  'log.write': LogWriteRequestMirrorSchema,
  'world.read': WorldReadRequestMirrorSchema,
  'evidence.append': EvidenceAppendRequestMirrorSchema,
  'capability.invoke': CapabilityInvokeRequestMirrorSchema,
  'storage.read': StorageReadRequestMirrorSchema,
  'storage.write': StorageWriteRequestMirrorSchema,
} as const;

/** Response payload mirror table (per host function). */
const RESPONSE_MIRRORS = {
  'clock.read': ClockReadResponseMirrorSchema,
  'log.write': LogWriteResponseMirrorSchema,
  'world.read': WorldReadResponseMirrorSchema,
  'evidence.append': EvidenceAppendResponseMirrorSchema,
  'capability.invoke': CapabilityInvokeResponseMirrorSchema,
  'storage.read': StorageReadResponseMirrorSchema,
  'storage.write': StorageWriteResponseMirrorSchema,
} as const;

interface SessionDeps {
  readonly record: AdmittedExtensionRecord;
  readonly clock: HostClock;
  readonly worldView: WorldViewProvider;
  readonly capabilityInvoker: CapabilityInvoker;
  readonly storage: ExtensionStorageNamespace;
  readonly logRing: SessionLogRing;
  readonly evidenceBook: InMemoryEvidenceBook;
}

/** A live, capability-scoped, sandboxed extension session. */
export class ExtensionSession {
  private mutableRecord: AdmittedExtensionRecord;

  private readonly deps: SessionDeps;

  private readonly audit: InvocationAuditRecord[] = [];

  private nextSequence = 1;

  private nextLogSequence = 1;

  constructor(deps: SessionDeps) {
    this.deps = deps;
    this.mutableRecord = deps.record;
  }

  /** The admitted record (frozen manifest copy + lifecycle + digest + pins). */
  get record(): AdmittedExtensionRecord {
    return this.mutableRecord;
  }

  /** Apply a lifecycle transition (host-driven; the session's own record view). */
  applyLifecycle(state: CapabilityLifecycleState): void {
    this.mutableRecord = { ...this.mutableRecord, lifecycle: state };
  }

  /**
   * Invoke one host function on behalf of the extension. Total, never
   * throws: a permitted call returns an execution outcome; a boundary
   * rejection returns a typed error. See the module docs for the
   * pipeline.
   */
  invoke(envelope: unknown): InvokeResult {
    const parsed = HostInvocationEnvelopeSchema.safeParse(envelope);
    if (!parsed.success) {
      return { ok: false, error: validationError(parsed.error) };
    }
    const typedEnvelope: HostInvocationEnvelope = parsed.data;
    const deny = (error: ExtensionRuntimeError): InvokeResult => {
      this.audit.push({
        sequence: this.nextSequence,
        envelopeId: typedEnvelope.envelopeId,
        capabilityId: typedEnvelope.capabilityId,
        hostFunction: typedEnvelope.hostFunction,
        decision: 'denied',
        denialCode: error.code,
      });
      this.nextSequence += 1;
      return { ok: false, error };
    };

    if (typedEnvelope.extensionId !== this.mutableRecord.manifest.extensionId) {
      return deny({
        code: 'sandbox-violation',
        message: `invocation envelope claims extension "${typedEnvelope.extensionId}" inside the session of "${this.mutableRecord.manifest.extensionId}" — a session serves exactly one extension identity`,
        path: ['extensionId'],
        extensionId: this.mutableRecord.manifest.extensionId,
        detail: 'session-identity-mismatch',
      });
    }
    if (this.mutableRecord.lifecycle === 'retired') {
      return deny({
        code: 'lifecycle-conflict',
        message: `extension "${this.mutableRecord.manifest.extensionId}" is retired — retired sessions do not serve invocations`,
        path: ['hostFunction'],
        from: 'retired',
        to: 'registered',
      });
    }
    const enforcement = enforceInvocation(this.mutableRecord, typedEnvelope);
    if (!enforcement.permitted) {
      return deny(enforcement.error);
    }
    const payloadParse = REQUEST_MIRRORS[typedEnvelope.hostFunction].safeParse(
      typedEnvelope.payload,
    );
    if (!payloadParse.success) {
      const error = validationError(payloadParse.error);
      const prefixed: ExtensionRuntimeError = {
        code: 'validation',
        message: `host function "${typedEnvelope.hostFunction}" payload failed the request contract (${error.message})`,
        issues: error.issues.map((issue) => ({
          path: issue.path === '' ? 'payload' : `payload.${issue.path}`,
          message: issue.message,
        })),
      };
      return deny(prefixed);
    }

    const outcome = this.dispatch(typedEnvelope);
    this.audit.push({
      sequence: this.nextSequence,
      envelopeId: typedEnvelope.envelopeId,
      capabilityId: typedEnvelope.capabilityId,
      hostFunction: typedEnvelope.hostFunction,
      decision: 'permitted',
    });
    this.nextSequence += 1;
    return { ok: true, envelopeId: typedEnvelope.envelopeId, outcome };
  }

  /**
   * The deterministic sandbox surface description: content address,
   * resolved binding pins, and the frozen grants — sorted everywhere,
   * identical for equivalent admissions regardless of order.
   */
  describeSandboxSurface(): SandboxSurfaceDescription {
    const description: SandboxSurfaceDescription = {
      schemaVersion: 1,
      extensionId: this.mutableRecord.manifest.extensionId,
      extensionVersion: this.mutableRecord.manifest.version,
      extensionManifestDigest: this.mutableRecord.manifestDigest,
      flavor: this.mutableRecord.manifest.flavor,
      trustClass: this.mutableRecord.manifest.trustClass,
      bindings: [...this.mutableRecord.bindings].sort((a, b) =>
        a.capabilityId < b.capabilityId ? -1 : a.capabilityId > b.capabilityId ? 1 : 0,
      ),
      grants: this.mutableRecord.manifest.grants.map((grant) => ({
        capabilityId: grant.capabilityId,
        hostFunctions: [...grant.hostFunctions],
        resourceScopes: grant.resourceScopes.map((scope) => ({ ...scope })),
      })),
    };
    return description;
  }

  /** The session-local invocation audit trail (deterministic sequence). */
  auditTrail(): readonly InvocationAuditRecord[] {
    return [...this.audit];
  }

  /** The session-local log records written through `log.write`. */
  sessionLog(): readonly { sequence: number; level: string; message: string; instant: string }[] {
    return this.deps.logRing.snapshot().map((entry: { level: string; message: string; instant: string }, index: number) => ({
      sequence: index + 1,
      level: entry.level,
      message: entry.message,
      instant: entry.instant,
    }));
  }

  /** The session-local storage snapshot (extension-scoped namespace, sorted keys). */
  storageSnapshot(): Readonly<Record<string, unknown>> {
    const entries: Record<string, unknown> = {};
    for (const [key, value] of this.deps.storage.entries()) {
      entries[key] = value;
    }
    return entries;
  }

  private dispatch(envelope: HostInvocationEnvelope): HostExecutionOutcome {
    switch (envelope.hostFunction) {
      case 'clock.read':
        return this.validateResponse(envelope.hostFunction, { instant: this.deps.clock.now() });
      case 'log.write': {
        const payload = envelope.payload as unknown as { level: string; message: string };
        this.deps.logRing.append(payload.level, payload.message, this.deps.clock.now());
        return this.validateResponse(envelope.hostFunction, { logged: true });
      }
      case 'world.read': {
        const payload = envelope.payload as unknown as { entityRefs: readonly string[] };
        const snapshots = this.deps.worldView.readProjection(payload.entityRefs);
        return this.validateResponse(envelope.hostFunction, { snapshots: [...snapshots] });
      }
      case 'evidence.append': {
        const payload = envelope.payload as unknown as { statement: string; subjectDigest?: string };
        const evidenceId = this.deps.evidenceBook.append(
          payload.statement,
          this.mutableRecord.manifest.extensionId,
          payload.subjectDigest,
        );
        return this.validateResponse(envelope.hostFunction, { evidenceId });
      }
      case 'capability.invoke': {
        const payload = envelope.payload as {
          capabilityId: string;
          inputs: Readonly<Record<string, JsonValue>>;
        };
        if (
          !this.mutableRecord.bindings.some(
            (binding) => binding.capabilityId === payload.capabilityId,
          ) &&
          payload.capabilityId !== envelope.capabilityId
        ) {
          return {
            status: 'failed',
            code: 'handler-error',
            message: `capability.invoke payload names capability "${payload.capabilityId}" outside the invoked scope "${envelope.capabilityId}"`,
          };
        }
        const invocation = this.deps.capabilityInvoker.invoke({
          capabilityId: payload.capabilityId,
          inputs: payload.inputs,
        });
        if (invocation.status === 'failed') {
          return invocation;
        }
        return this.validateResponse(envelope.hostFunction, invocation.response);
      }
      case 'storage.read': {
        const payload = envelope.payload as unknown as { key: string };
        return this.validateResponse(envelope.hostFunction, { value: this.deps.storage.read(payload.key) });
      }
      case 'storage.write': {
        const payload = envelope.payload as unknown as { key: string; value: JsonValue };
        this.deps.storage.write(payload.key, payload.value);
        return this.validateResponse(envelope.hostFunction, { written: true });
      }
    }
  }

  /** Validate a host implementation's response against the response mirror. */
  private validateResponse(
    hostFunction: keyof typeof RESPONSE_MIRRORS,
    response: unknown,
  ): HostExecutionOutcome {
    const failed = (message: string): HostExecutionOutcome => ({
      status: 'failed',
      code: 'handler-error',
      message,
    });
    const parsed = RESPONSE_MIRRORS[hostFunction].safeParse(response);
    if (!parsed.success) {
      const first = flattenZodIssues(parsed.error)[0];
      return failed(
        `host implementation response for "${hostFunction}" violated the response contract (${first ? `${first.path}: ${first.message}` : 'invalid'})`,
      );
    }
    return { status: 'completed', response: parsed.data as unknown as JsonValue };
  }

  /** Audit summary (typed for tests). */
  auditCodes(): readonly ExtensionRuntimeErrorCode[] {
    return this.audit
      .filter((record) => record.decision === 'denied')
      .map((record) => record.denialCode!)
      .filter((code): code is ExtensionRuntimeErrorCode => code !== undefined);
  }

}
