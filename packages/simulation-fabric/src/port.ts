/**
 * The execution-port adapter seam (architecture lock rule 13: provider
 * semantics are adapterized) and the ONE in-memory reference adapter.
 *
 * ALL concrete compute — solver engines, numerical frameworks, HPC grids,
 * cloud batch services, co-simulation bridges — lives behind
 * {@link SimulationExecutionPort}. The fabric core never names a vendor,
 * never transports anything, and never executes simulations itself: it
 * plans, supervises, and ingests. The port receives the admitted W005
 * chain (request + registration + the run's capability bindings) and
 * returns either a W005 `simulation.result` document (raw JSON — the
 * fabric re-admits it through the REAL W005 pipeline and checks
 * conformance before sealing) or a typed execution failure in the W005
 * failure vocabulary.
 *
 * The {@link ReferenceSimulationExecutionPort} is the single reference
 * adapter shipped inside this package: it executes through the W005
 * reference simulator (`runReferenceSimulation` — the auditable
 * first-order affine mapping) and proves the seam end-to-end. External
 * backends are adapters, NEVER core types.
 */
import { runReferenceSimulation } from '@epoch/simulation-protocol';
import type { PortExecution, SimulationExecutionPort } from './types';
import type { AdmittedInvocation } from './types';

export type { AdmittedInvocation, PortExecution, SimulationExecutionPort };

/**
 * The in-memory REFERENCE execution adapter (the one adapter shipped in
 * this package). Executes invocation requests through the W005 reference
 * simulator: requests targeting `simulator:reference-affine-scalar` at its
 * exact registration revision run through the REAL reference pipeline
 * (`runReferenceSimulation`); anything else is the typed
 * `input-out-of-domain` port failure (external backends are separate
 * adapters behind the same seam).
 *
 * `executionCount` is the replay-evidence hook: it counts admitted
 * `execute` calls, so tests prove that an idempotent replay returns the
 * sealed prior result WITHOUT re-executing (the count stays unchanged).
 * The count never influences results — the adapter stays deterministic.
 */
export class ReferenceSimulationExecutionPort implements SimulationExecutionPort {
  private count = 0;

  /** Number of `execute` calls admitted so far (replay evidence). */
  get executionCount(): number {
    return this.count;
  }

  execute(invocation: AdmittedInvocation): PortExecution {
    this.count += 1;
    const outcome = runReferenceSimulation(invocation.request);
    if (outcome.ok) {
      return { ok: true, result: outcome.run.result };
    }
    if (outcome.failure.kind === 'nonconforming-request') {
      return {
        ok: false,
        failure: {
          code: 'input-out-of-domain',
          message:
            `the reference execution adapter executes the W005 reference simulator only ` +
            `(the request targets "${invocation.request.simulator.simulatorId}"); ` +
            `external backends are adapters behind the SimulationExecutionPort seam`,
        },
      };
    }
    return {
      ok: false,
      failure: {
        code: 'internal-error',
        message: `the reference execution adapter could not admit the request: ${outcome.failure.error.message}`,
      },
    };
  }
}
