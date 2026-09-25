// Host negative battery: admission failures pass through the kernel
// taxonomy unchanged (unsupported-format, digest-mismatch,
// malformed-document with precise paths), tenant isolation (R12) is
// enforced on every read/advance/escalation, and the trust floor denies
// every escalation op.
import { describe, expect, it } from 'vitest';
import {
  deriveDocumentDescriptor,
  type DocumentContent,
} from '@epoch/document-adapter';
import {
  TENANT_A,
  TENANT_B,
  driveToProvisional,
  ingestInput,
  jsonDocument,
  mustAdvance,
  mustIngest,
  newHost,
  runContext,
  textDocument,
} from './fixtures';
import { expectHostFailure } from './host-helpers';

describe('admission failures pass through the kernel taxonomy (negative)', () => {
  it('rejects an unsupported document format at ingestion', () => {
    const host = newHost();
    const content = { format: 'pdf', text: 'not a typed form' };
    const descriptor = deriveDocumentDescriptor(
      { format: 'structured-text', text: 'x' } as DocumentContent,
      { tenantId: TENANT_A },
    );
    const rejected = host.ingestDocument(
      ingestInput({ content, descriptor: { ...descriptor, format: 'pdf' as never } }),
    );
    const error = expectHostFailure(rejected, 'unsupported-format');
    expect(error.format).toBe('pdf');
    expect(error.supportedFormats).toEqual(['structured-text', 'structured-json']);
  });

  it('rejects a tampered descriptor (digest mismatch) at ingestion', () => {
    const host = newHost();
    const document = jsonDocument();
    const tampered = { ...document.descriptor, digest: 'f'.repeat(64) };
    const rejected = host.ingestDocument(ingestInput({ ...document, descriptor: tampered }));
    const error = expectHostFailure(rejected, 'digest-mismatch');
    expect(error.expected).toBe(document.descriptor.digest);
    expect(error.encountered).toBe('f'.repeat(64));
  });

  it('rejects content changed after the descriptor was derived (tamper)', () => {
    const host = newHost();
    const document = textDocument();
    const tamperedContent = {
      format: 'structured-text',
      text: `${(document.content as { text: string }).text}\nfields.extra -> demo:thing`,
    };
    const rejected = host.ingestDocument(
      ingestInput({ content: tamperedContent, descriptor: document.descriptor }),
    );
    expectHostFailure(rejected, 'digest-mismatch');
  });

  it('rejects a malformed text document with the precise line path', () => {
    const host = newHost();
    const content = { format: 'structured-text', text: 'fields.ok -> construction:wall\ngarbage line' };
    const descriptor = deriveDocumentDescriptor(content as DocumentContent, { tenantId: TENANT_A });
    const rejected = host.ingestDocument(ingestInput({ content, descriptor }));
    const error = expectHostFailure(rejected, 'malformed-document');
    expect(error.issues[0]!.path).toBe('lines[2]');
  });

  it('rejects a malformed JSON mapping with the precise JSON path', () => {
    const host = newHost();
    const content = {
      format: 'structured-json',
      json: {
        documentKind: 'mapping-table',
        mappings: [{ sourcePath: 'fields.walls', semanticTarget: 'NOT-A-KEY' }],
      },
    };
    const descriptor = deriveDocumentDescriptor(content as DocumentContent, { tenantId: TENANT_A });
    const rejected = host.ingestDocument(ingestInput({ content, descriptor }));
    const error = expectHostFailure(rejected, 'malformed-document');
    expect(error.issues[0]!.path).toContain('semanticTarget');
  });

  it('rejects a vendor field on the document content (blocklist shape)', () => {
    const host = newHost();
    const content = {
      format: 'structured-text',
      text: 'fields.walls -> construction:wall',
      provider: 'vendor-document-service',
    };
    const descriptor = deriveDocumentDescriptor(
      { format: 'structured-text', text: 'fields.walls -> construction:wall' },
      { tenantId: TENANT_A },
    );
    const rejected = host.ingestDocument(ingestInput({ content, descriptor }));
    const error = expectHostFailure(rejected, 'malformed-document');
    expect(JSON.stringify(error.issues)).toContain('provider');
  });

  it('rejects a vendor field on the descriptor (strict object)', () => {
    const host = newHost();
    const document = jsonDocument();
    const poisoned = { ...document.descriptor, apiKey: 'sk-123' };
    const rejected = host.ingestDocument(ingestInput({ ...document, descriptor: poisoned }));
    expectHostFailure(rejected, 'malformed-document');
  });
});

describe('tenant isolation through the host (negative — R12)', () => {
  it('rejects ingestion when the descriptor belongs to another tenant', () => {
    const host = newHost();
    const document = textDocument();
    const rejected = host.ingestDocument({
      ...ingestInput(document),
      asTenant: TENANT_B,
    });
    const error = expectHostFailure(rejected, 'cross-tenant-denied');
    expect(error.expectedTenantId).toBe(TENANT_B);
    expect(error.encounteredTenantId).toBe(TENANT_A);
  });

  it('rejects cross-tenant session reads', () => {
    const host = newHost();
    const receipt = mustIngest(host, jsonDocument());
    const rejected = host.getSession({ sessionId: receipt.sessionId, asTenant: TENANT_B });
    expectHostFailure(rejected, 'cross-tenant-denied');
  });

  it('rejects cross-tenant candidate reads', () => {
    const host = newHost();
    const receipt = mustIngest(host, jsonDocument());
    mustAdvance(host, receipt.sessionId, 'parsed');
    mustAdvance(host, receipt.sessionId, 'candidates-extracted');
    const rejected = host.getSessionCandidates({ sessionId: receipt.sessionId, asTenant: TENANT_B });
    expectHostFailure(rejected, 'cross-tenant-denied');
  });

  it('rejects cross-tenant advances', () => {
    const host = newHost();
    const receipt = mustIngest(host, jsonDocument());
    const rejected = host.advanceSession({
      sessionId: receipt.sessionId,
      to: 'parsed',
      asTenant: TENANT_B,
      run: runContext(),
    });
    expectHostFailure(rejected, 'cross-tenant-denied');
  });

  it('rejects cross-tenant trust-escalation requests (tenant gate before the floor)', () => {
    const host = newHost();
    const sessionId = driveToProvisional(host, jsonDocument());
    const rejected = host.requestTrustEscalation({
      sessionId,
      op: 'certify',
      asTenant: TENANT_B,
    });
    expectHostFailure(rejected, 'cross-tenant-denied');
  });

  it('never lists another tenant\u2019s sessions', () => {
    const host = newHost();
    mustIngest(host, jsonDocument());
    expect(host.listSessions({ asTenant: TENANT_B })).toEqual([]);
    expect(host.listSessions({ asTenant: TENANT_A })).toHaveLength(1);
  });
});

describe('trust escalation is ALWAYS denied (negative — the floor, not the gate)', () => {
  it('denies certify/execute/grant-capability for a tenant-owning caller too', () => {
    const host = newHost();
    const sessionId = driveToProvisional(host, jsonDocument());
    for (const op of ['certify', 'execute', 'grant-capability'] as const) {
      const denied = host.requestTrustEscalation({ sessionId, op, asTenant: TENANT_A });
      const error = expectHostFailure(denied, 'trust-escalation-denied');
      expect(error.op).toBe(op);
      expect(error.currentTrustClass).toBe('t1');
      expect(error.ceiling).toBe('t1');
    }
  });

  it('the denial is total even for sessions still mid-pipeline', () => {
    const host = newHost();
    const receipt = mustIngest(host, jsonDocument());
    const denied = host.requestTrustEscalation({
      sessionId: receipt.sessionId,
      op: 'execute',
      asTenant: TENANT_A,
    });
    expectHostFailure(denied, 'trust-escalation-denied');
  });
});

describe('session state integrity (negative)', () => {
  it('a failed advance never mutates the session (state stays at the prior stage)', () => {
    const host = newHost();
    const receipt = mustIngest(host, jsonDocument());
    const skip = host.advanceSession({
      sessionId: receipt.sessionId,
      to: 'review-pending',
      asTenant: TENANT_A,
      run: runContext(),
    });
    expect(skip.ok).toBe(false);
    const snapshot = host.getSession({ sessionId: receipt.sessionId, asTenant: TENANT_A });
    if (!snapshot.ok) throw new Error(snapshot.error.message);
    expect(snapshot.value.stage).toBe('uploaded');
    expect(host.health().evidenceCount).toBe(1);
  });
});
