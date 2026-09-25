/**
 * Ambient test-global declarations for the W015 feature module tests.
 *
 * The app manifest is frozen during W015 (the shell/integration Work
 * Order owns app tooling decisions), so the app cannot declare vitest as
 * a dependency. The feature tests therefore run under the
 * `@epoch/ai-experience` package's Vitest runner in `globals` mode (see
 * `packages/ai-experience/vitest.config.mts`): the runner INJECTS these
 * globals at runtime, and these declarations type them for the app's
 * own `tsc --noEmit` pass. The declared surface is intentionally the
 * minimal matcher API the feature tests use — any drift from the real
 * Vitest API fails loudly at test time (never silently).
 */

declare function describe(name: string, fn: () => void): void;

interface ItFn {
  (name: string, fn: () => void | Promise<void>): void;
  each<T>(cases: readonly T[]): (name: string, fn: (arg: T) => void | Promise<void>) => void;
  skip(name: string, fn: () => void | Promise<void>): void;
  todo(name: string): void;
}

declare const it: ItFn;

declare function expect(actual: unknown): {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toStrictEqual(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toHaveLength(length: number): void;
  toContain(expected: unknown): void;
  toHaveProperty(path: string | readonly string[], value?: unknown): void;
  toMatch(pattern: RegExp | string): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  not: {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toHaveProperty(path: string | readonly string[], value?: unknown): void;
    toMatch(pattern: RegExp | string): void;
    toBeNull(): void;
    toBeUndefined(): void;
  };
};
