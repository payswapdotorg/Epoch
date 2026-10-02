/**
 * Deterministic, caller-scoped id derivation (W057). Zero randomness: the
 * runtime derives every id it mints from a monotonic counter + the
 * workspace's fixed slug, so identical interaction scripts produce
 * identical envelopes and receipts (idempotent replays — the W016
 * discipline). Every id honors the grammar of the surface it addresses:
 * fabric sessions "fx-", switches "sw-", inputs "rin-", and W016
 * invocation ids (the shared message-id grammar, 1..128 chars).
 */

import { MESSAGE_ID_PATTERN } from '@epoch/agent-protocol';

/** The bounds of one minted id (kept in sync with the shared grammar). */
const MAX_ID_LENGTH = 128;

/** Assert one minted id honors the shared message-id grammar. */
function assertValidInvocationId(id: string, kind: string): string {
  if (!MESSAGE_ID_PATTERN.test(id)) {
    throw new Error(`the derived ${kind} id "${id}" violates the shared message-id grammar`);
  }
  return id;
}

/** A deterministic id sequencer scoped to one workspace runtime. */
export class IdSequence {
  private counter = 0;
  private readonly slug: string;

  constructor(slug: string) {
    this.slug = slug;
  }

  private next(label: string): string {
    this.counter += 1;
    const id = `${this.slug}-${label}-${this.counter}`;
    if (id.length > MAX_ID_LENGTH) {
      throw new Error(`the derived id "${id}" exceeds the shared message-id length bound`);
    }
    return id;
  }

  /** One fabric session id ("fx-" grammar, opaque to the fabric). */
  fabricSessionId(): string {
    this.counter += 1;
    return `fx-${this.slug}-fs${this.counter}`;
  }

  /** One switch id ("sw-" grammar). */
  switchId(): string {
    this.counter += 1;
    return `sw-${this.slug}-${this.counter}`;
  }

  /** One raw input id ("rin-" grammar of contracts/renderers v1.1.0). */
  inputId(): string {
    this.counter += 1;
    return `rin-${this.slug}-${this.counter}`;
  }

  /** One W016 invocation id (shared message-id grammar). */
  invocationId(): string {
    return assertValidInvocationId(this.next('inv'), 'invocation');
  }

  /** The current counter (evidence/billing parity with receipts). */
  get count(): number {
    return this.counter;
  }
}
