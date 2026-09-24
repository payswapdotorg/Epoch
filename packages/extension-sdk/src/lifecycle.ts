/**
 * Extension lifecycle (W008): the `registered -> deprecated -> retired`
 * semantics ALIGNED with the W007 capability registry. The states and
 * transition table are imported from @epoch/capability-registry (genuine
 * runtime composition — the only permitted @epoch runtime dependencies
 * are agent-protocol and capability-registry), so extension lifecycle
 * vocabulary and registry lifecycle vocabulary can never drift.
 *
 * This module re-exports the vocabulary and ships one total helper:
 * {@link checkExtensionLifecycleTransition} — an illegal transition is a
 * typed `lifecycle-conflict` error, never a thrown exception. Applying
 * transitions to admitted extensions is HOST state (extension-runtime /
 * later marketplace Work Orders), never manifest content.
 */
import { CAPABILITY_LIFECYCLE_TRANSITIONS } from '@epoch/capability-registry';
import type { CapabilityLifecycleState } from '@epoch/capability-registry';
import type { ExtensionSdkResult } from './types';

// Vocabulary re-export (zero-drift alignment with the W007 registry).
export {
  CAPABILITY_LIFECYCLE_STATES as EXTENSION_LIFECYCLE_STATES,
  CAPABILITY_LIFECYCLE_TRANSITIONS as EXTENSION_LIFECYCLE_TRANSITIONS,
} from '@epoch/capability-registry';

/** The transition currently applied (input of {@link checkExtensionLifecycleTransition}). */
export interface ExtensionLifecycleTransition {
  readonly from: CapabilityLifecycleState;
  readonly to: CapabilityLifecycleState;
}

function describeTransitions(state: CapabilityLifecycleState): string {
  const next = CAPABILITY_LIFECYCLE_TRANSITIONS[state];
  return next.length === 0
    ? 'none (terminal state)'
    : next.map((target) => `${state} -> ${target}`).join(', ');
}

/**
 * Check one lifecycle transition against the legal table (total, never
 * throws). Legal: `registered -> deprecated`, `registered -> retired`,
 * `deprecated -> retired`; there is no revival and `retired` is
 * terminal — an extension that must return ships as a NEW version.
 */
export function checkExtensionLifecycleTransition(
  transition: ExtensionLifecycleTransition,
): ExtensionSdkResult<ExtensionLifecycleTransition> {
  const legal = CAPABILITY_LIFECYCLE_TRANSITIONS[transition.from];
  if (legal === undefined || !legal.includes(transition.to)) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `illegal extension lifecycle transition ${transition.from} -> ${transition.to} (legal transitions: ${describeTransitions(transition.from)})`,
        path: ['to'],
        from: transition.from,
        to: transition.to,
      },
    };
  }
  return { ok: true, value: transition };
}
