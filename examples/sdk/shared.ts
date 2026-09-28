/**
 * examples/sdk — the shared vocabulary of the SDK examples (W035).
 *
 * The W031 example discipline: every example module is a PURE function of
 * these fixed constants — zero wall-clock (every instant is a `T[…]`
 * constant), zero randomness (every id explicit), zero network (the
 * reference adapters run on committed fixtures). Two runs of any example
 * in the same process produce byte-identical digest projections.
 */

/** The fixed instant series (producer-supplied, never clock-read). */
export const T = [
  '2026-02-10T09:00:00.000Z',
  '2026-02-10T09:00:01.000Z',
  '2026-02-10T09:00:02.000Z',
  '2026-02-10T09:00:03.000Z',
  '2026-02-10T09:00:04.000Z',
  '2026-02-10T09:00:05.000Z',
  '2026-02-10T09:00:06.000Z',
  '2026-02-10T09:00:07.000Z',
  '2026-02-10T09:00:08.000Z',
  '2026-02-10T09:00:09.000Z',
] as const;

/** The vendor (developer) tenant of every example. */
export const VENDOR_TENANT = 'tenant:acme-tools';

/** The buyer tenant of every example. */
export const BUYER_TENANT = 'tenant:globex';

/** The release engineer driving the release-readiness example. */
export const RELEASE_ACTOR = 'actor:release-engineer';

/** The typed actor reference of the release example (the W033 actor grammar). */
export const RELEASE_ACTOR_REF = { actorId: RELEASE_ACTOR, role: 'release-manager' } as const;

/** The principal that produces events (the W009 grammar). */
export const EVENT_PRINCIPAL = 'principal:release-bot';

/** A 64-hex zero digest placeholder (replaced by real digests per example). */
export const ZERO_DIGEST = '0'.repeat(64);

/** The fixed capability the examples register and serve. */
export const CAPABILITY_ID = 'engineering.stress-analysis';
