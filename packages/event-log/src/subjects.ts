/**
 * Kernel event payload contracts: the typed data contracts for the
 * reserved `world` and `action` event-kind namespaces (W010 Tech Lead
 * pin: "the event payloads reference world entities — EntityId/RelationId
 * vocabulary"; "action-derived event kinds reuse the typed action
 * reference vocabulary").
 *
 * These are FACT records about world subjects and action lifecycles —
 * they REFERENCE the W002 world vocabulary and the W003 action vocabulary
 * opaquely (via the runtime validators imported from those packages) and
 * never re-declare or interpret them:
 * - `world:subjects` — the event concerns one or more world-graph
 *   subjects (entities/relations);
 * - `action:lifecycle` — the event records one lifecycle phase of an
 *   action proposal at an exact revision.
 *
 * Admission enforces these contracts for discriminators inside the
 * reserved namespaces; unknown kinds in a reserved namespace are
 * rejected (a typed `validation` error), mirroring the world-model's
 * reserved `core` namespace discipline.
 */
import { z } from 'zod';
import { namespaceOf, RESERVED_EVENT_NAMESPACES } from './version';
import { ActionLifecycleEventDataSchema, WorldSubjectsEventDataSchema } from './schema';
import { flattenZodIssues } from './issues';
import type {
  ActionLifecycleEventData,
  EventLogError,
  EventPayload,
  WorldSubjectsEventData,
} from './types';

/** The reserved `world:subjects` event-kind discriminator. */
export const WORLD_SUBJECTS_EVENT_KIND = 'world:subjects' as const;

/** The reserved `action:lifecycle` event-kind discriminator. */
export const ACTION_LIFECYCLE_EVENT_KIND = 'action:lifecycle' as const;

/** The reserved kernel event-kind payload contract dispatch. */
const KERNEL_PAYLOAD_CONTRACTS: Readonly<
  Record<string, z.ZodType<Record<string, unknown>>>
> = {
  [WORLD_SUBJECTS_EVENT_KIND]: WorldSubjectsEventDataSchema as unknown as z.ZodType<
    Record<string, unknown>
  >,
  [ACTION_LIFECYCLE_EVENT_KIND]: ActionLifecycleEventDataSchema as unknown as z.ZodType<
    Record<string, unknown>
  >,
};

/**
 * Validate the payload data of an event against the kernel payload
 * contract for its discriminator, when (and only when) the discriminator
 * lives in a reserved kernel namespace. Returns `null` when the payload
 * is an open (extension) payload — nothing to check.
 */
export function kernelPayloadViolation(payload: EventPayload): EventLogError | null {
  const namespace = namespaceOf(payload.discriminator);
  if (!(RESERVED_EVENT_NAMESPACES as readonly string[]).includes(namespace)) {
    return null;
  }
  const contract = KERNEL_PAYLOAD_CONTRACTS[payload.discriminator];
  if (contract === undefined) {
    return {
      code: 'validation',
      message: `event-kind discriminator "${payload.discriminator}" uses the reserved "${namespace}" namespace but is not a published kernel payload kind`,
      issues: [
        {
          path: 'payload.discriminator',
          message: `reserved namespace "${namespace}" admits only: ${
            namespace === 'world' ? WORLD_SUBJECTS_EVENT_KIND : ACTION_LIFECYCLE_EVENT_KIND
          }`,
        },
      ],
    };
  }
  const parsed = contract.safeParse(payload.data);
  if (!parsed.success) {
    const issues = flattenZodIssues(parsed.error).map((issue) => ({
      path: issue.path === '' ? 'payload.data' : `payload.data.${issue.path}`,
      message: issue.message,
    }));
    return {
      code: 'validation',
      message: `event payload data does not satisfy the kernel "${payload.discriminator}" contract (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
      issues,
    };
  }
  return null;
}

/**
 * Parse and admit the data of a `world:subjects` payload (typed accessor
 * for consumers). Total; failures are typed `validation` errors.
 */
export function parseWorldSubjectsEventData(
  payload: EventPayload,
): { ok: true; value: WorldSubjectsEventData } | { ok: false; error: EventLogError } {
  if (payload.discriminator !== WORLD_SUBJECTS_EVENT_KIND) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `expected the "${WORLD_SUBJECTS_EVENT_KIND}" event kind, encountered "${payload.discriminator}"`,
        issues: [
          {
            path: 'payload.discriminator',
            message: `must be "${WORLD_SUBJECTS_EVENT_KIND}"`,
          },
        ],
      },
    };
  }
  const parsed = WorldSubjectsEventDataSchema.safeParse(payload.data);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'world-subjects payload data failed schema validation',
        issues: flattenZodIssues(parsed.error),
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse and admit the data of an `action:lifecycle` payload (typed
 * accessor for consumers). Total; failures are typed `validation` errors.
 */
export function parseActionLifecycleEventData(
  payload: EventPayload,
): { ok: true; value: ActionLifecycleEventData } | { ok: false; error: EventLogError } {
  if (payload.discriminator !== ACTION_LIFECYCLE_EVENT_KIND) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `expected the "${ACTION_LIFECYCLE_EVENT_KIND}" event kind, encountered "${payload.discriminator}"`,
        issues: [
          {
            path: 'payload.discriminator',
            message: `must be "${ACTION_LIFECYCLE_EVENT_KIND}"`,
          },
        ],
      },
    };
  }
  const parsed = ActionLifecycleEventDataSchema.safeParse(payload.data);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'action-lifecycle payload data failed schema validation',
        issues: flattenZodIssues(parsed.error),
      },
    };
  }
  return { ok: true, value: parsed.data };
}
