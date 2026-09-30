/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W046
 * application-gateway contract guarantee; the JSON-Schema half is
 * test/contract-drift.test.ts, and the declaration-level half is
 * contracts/application-gateway/parity.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators
 * infer exactly the published contract types.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type { GatewayError } from './errors';
import type { RequestCorrelation } from './correlation';
import type { ClientSession, SessionRef } from './session';
import type { GatewayErrorSchema } from './errors';
import type { RequestCorrelationSchema } from './correlation';
import type { ClientSessionSchema, SessionRefSchema } from './session';
import type { IdempotencyRecordSchema, IdempotentReplaySchema } from './idempotency';
import type { OfflineQueueScopeSchema, QueuedIntentSchema } from './offline';
import type { JsonValue } from '@epoch/agent-protocol';

export type ClientRuntimeSchemaSync = [
  Expect<Equals<z.infer<typeof GatewayErrorSchema>, GatewayError>>,
  Expect<Equals<z.infer<typeof RequestCorrelationSchema>, RequestCorrelation>>,
  Expect<Equals<z.infer<typeof ClientSessionSchema>, ClientSession>>,
  Expect<Equals<z.infer<typeof SessionRefSchema>, SessionRef>>,
  Expect<Equals<z.infer<typeof IdempotencyRecordSchema>['outcome'], JsonValue | null>>,
  Expect<Equals<z.infer<typeof IdempotentReplaySchema>['status'], 'applied' | 'replayed'>>,
  Expect<Equals<z.infer<typeof OfflineQueueScopeSchema>['tenantId'], string>>,
  Expect<Equals<z.infer<typeof QueuedIntentSchema>['state'], 'pending' | 'draining' | 'drained' | 'rejected'>>,
];

/** String-literal unions are additionally pinned member-for-member. */
export type ClientRuntimeLiteralSync = [
  Expect<
    Equals<
      GatewayError['class'],
      'transient' | 'auth-session-expired' | 'conflict' | 'validation' | 'authority-rejected' | 'unrecoverable'
    >
  >,
  Expect<Equals<ClientSession['state'], 'active' | 'expired' | 'revoked'>>,
];
