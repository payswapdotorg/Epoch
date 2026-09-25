// RUNTIME PARITY with the frozen W003 action-protocol principal
// reference: every W009 PrincipalId is a valid W003
// PrincipalReference.id (the opaque id field, 1..128 chars), and the
// shared corruptions are rejected by both validators. DevDependency
// only — @epoch/identity has NO runtime coupling with W003.
//
// Vocabulary note (documented, not tested): W003 REQUESTING roles
// (action-gateway / agent-runtime / human) describe who may REQUEST a
// decision; W009 PRINCIPAL kinds (human/agent/solver/robot/service)
// describe the principal's class. Different vocabularies, deliberately
// unconflated — reconciliation of the two role surfaces is parked for
// the W022 gateway wiring (an architecture note in the W009 PR).
import { describe, expect, it } from 'vitest';
import { PrincipalReferenceSchema } from '@epoch/action-protocol';
import { PrincipalIdSchema } from '../src/index';
import { PRINCIPAL_ID } from './helpers';

const VALID_PRINCIPAL_IDS: string[] = [
  PRINCIPAL_ID,
  'principal:a',
  'principal:stress-agent-01',
  `principal:${'y'.repeat(63)}`,
  'principal:0123456789',
];

const SHARED_CORRUPTIONS: string[] = ['', 'user:ada', `principal:${'x'.repeat(64)}`];

describe('W003 principal-reference alignment', () => {
  it('every valid W009 PrincipalId is a valid W003 PrincipalReference.id', () => {
    for (const [index, principalId] of VALID_PRINCIPAL_IDS.entries()) {
      expect(PrincipalIdSchema.safeParse(principalId).success, `w009 ${index}`).toBe(true);
      expect(
        PrincipalReferenceSchema.safeParse({ id: principalId, role: 'human' }).success,
        `w003 ${index}`,
      ).toBe(true);
    }
  });

  it('both validators reject the shared corruptions (boundary discipline)', () => {
    for (const [index, corruption] of SHARED_CORRUPTIONS.entries()) {
      expect(PrincipalIdSchema.safeParse(corruption).success, `w009 ${index}`).toBe(false);
      // W003's id field is opaque (1..128 chars): it rejects the empty
      // and oversize corruptions that W009 rejects as well.
      if (corruption === '' || corruption.length > 128) {
        expect(
          PrincipalReferenceSchema.safeParse({ id: corruption, role: 'human' }).success,
          `w003 ${index}`,
        ).toBe(false);
      }
    }
  });

  it('a full W003 PrincipalReference embeds a W009 PrincipalId without friction', () => {
    const reference = { id: PRINCIPAL_ID, role: 'action-gateway' as const };
    expect(PrincipalReferenceSchema.safeParse(reference).success).toBe(true);
    expect(PrincipalIdSchema.safeParse(reference.id).success).toBe(true);
  });
});
