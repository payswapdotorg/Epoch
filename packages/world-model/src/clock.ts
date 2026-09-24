import type { Instant } from '@epoch/world-contracts';

/**
 * Clock abstraction. The world model is deterministic relative to its
 * clock: tests inject fixed/stepping clocks, production uses the system
 * clock. Instants are RFC 3339 UTC strings (`...Z`).
 */
export type Clock = () => Instant;

export const systemClock: Clock = () => new Date().toISOString();
