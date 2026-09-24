/**
 * Simulator contract declarations: the typed surfaces every simulator must
 * declare to be registrable (architecture.md, "Simulation / Evaluation"):
 * fidelity, validity domain, assumptions, and reproducibility.
 *
 * A simulator that cannot declare its validity domain and assumptions is
 * NOT registrable — the registration schema makes both mandatory and
 * non-empty. Simulators remain external capabilities (architecture lock
 * rule 5): this protocol declares the contract surfaces, never an engine.
 * Nothing solver-specific (vendor, product, or engine vocabulary) may
 * appear in these types.
 */
import { z } from 'zod';

/** Registered simulator identifier: `simulator:` + lowercase kebab slug. */
export const SIMULATOR_ID_PATTERN = /^simulator:[a-z0-9][a-z0-9-]{0,62}$/;

export const SimulatorIdSchema = z.string().regex(SIMULATOR_ID_PATTERN).meta({
  id: 'SimulatorId',
  title: 'SimulatorId',
  description: 'Registered simulator identifier: "simulator:" followed by a lowercase slug.',
});

export type SimulatorId = z.infer<typeof SimulatorIdSchema>;

/**
 * Fidelity declaration: what the simulator's predictions are worth, in
 * prose a consumer can reason over. `summary` states the fidelity level
 * (e.g. the governing approximation order, in the simulator's own neutral
 * terms); `knownDeviations` lists the known systematic deviations from
 * ground truth — an empty list is the explicit claim "none known".
 */
export const FidelityProfileSchema = z
  .strictObject({
    summary: z.string().min(1).max(2000),
    knownDeviations: z.array(z.string().min(1).max(2000)),
  })
  .meta({
    id: 'FidelityProfile',
    title: 'FidelityProfile',
    description:
      'Declared fidelity: a summary of the fidelity level plus the list of known systematic deviations (possibly empty).',
  });

export type FidelityProfile = z.infer<typeof FidelityProfileSchema>;

/**
 * Validity domain declaration: where the simulator's predictions may be
 * used. `includes` must name at least one applicable scope — an empty
 * validity domain is an unregistrable non-declaration. `excludes` lists
 * explicitly out-of-scope regimes.
 */
export const ValidityDomainSchema = z
  .strictObject({
    summary: z.string().min(1).max(2000),
    includes: z.array(z.string().min(1).max(2000)).min(1),
    excludes: z.array(z.string().min(1).max(2000)),
  })
  .meta({
    id: 'ValidityDomain',
    title: 'ValidityDomain',
    description:
      'Declared validity domain: summary, at least one included scope, and explicitly excluded regimes.',
  });

export type ValidityDomain = z.infer<typeof ValidityDomainSchema>;

/** Seed-handling policies a simulator may declare (neutral vocabulary). */
export const SEED_POLICIES = ['not-applicable', 'external-seed', 'internal-seed'] as const;

/** Seed-policy value type. */
export type SeedPolicy = (typeof SEED_POLICIES)[number];

export const SeedPolicySchema = z.enum(SEED_POLICIES).meta({
  id: 'SeedPolicy',
  title: 'SeedPolicy',
  description:
    'How the simulator handles seeds: not-applicable (no seeding), external-seed (callers supply a seed), or internal-seed (the simulator derives a fixed seed itself).',
});

/**
 * Reproducibility declaration. `deterministic` is the digest-stability
 * claim: when true, the simulator asserts that the same invocation
 * request (same exact revision, including any external seed) always
 * produces the same canonical result digest. Runtime refinement:
 * `deterministic: false` combined with `internal-seed` is contradictory
 * (internal seeding is itself a determinism mechanism) and is rejected.
 */
export const ReproducibilityProfileSchema = z
  .strictObject({
    deterministic: z.boolean(),
    seedPolicy: SeedPolicySchema,
  })
  .refine(
    (profile) => profile.deterministic || profile.seedPolicy !== 'internal-seed',
    'a non-deterministic simulator cannot declare internal-seed (internal seeding is a determinism mechanism)',
  )
  .meta({
    id: 'ReproducibilityProfile',
    title: 'ReproducibilityProfile',
    description:
      'Reproducibility declaration: the determinism (digest-stability) claim plus the seed policy.',
  });

export type ReproducibilityProfile = z.infer<typeof ReproducibilityProfileSchema>;
