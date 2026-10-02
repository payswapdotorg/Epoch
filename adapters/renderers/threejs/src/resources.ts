/**
 * GPU resource ledger (W058) — safe disposal made provable.
 *
 * Every geometry, material, texture, and renderer instance this adapter
 * creates is REGISTERED here the moment it is created, and DISPOSED
 * exactly once at session dispose. The ledger records the actual Three.js
 * `dispose` event of each resource (where the resource emits one), so
 * tests prove the GPU teardown really happened — not merely that a flag
 * flipped.
 *
 * The ledger is presentation-only bookkeeping — never semantic state.
 */

/** Anything Three.js-disposable (geometries, materials, textures, renderers). */
interface DisposableLike {
  dispose: () => void;
}

/** One tracked GPU resource. */
interface TrackedResource {
  readonly kind: 'geometry' | 'material' | 'texture' | 'renderer';
  readonly resource: DisposableLike;
  /** Flipped by the real Three.js `dispose` event of the resource. */
  disposedEvent: boolean;
}

/** The disposal summary of one ledger (typed evidence). */
export interface DisposalReport {
  readonly geometries: number;
  readonly materials: number;
  readonly textures: number;
  readonly renderers: number;
  /** How many of the tracked resources actually emitted `dispose`. */
  readonly disposedEvents: number;
  readonly totalTracked: number;
}

/** A ledger of every GPU resource one adapter session created. */
export class GpuResourceLedger {
  private readonly tracked: TrackedResource[] = [];

  /** Track one geometry (its real dispose event flips its flag). */
  registerGeometry<T extends DisposableLike>(geometry: T): T {
    return this.register('geometry', geometry);
  }

  /** Track one material (its real dispose event flips its flag). */
  registerMaterial<T extends DisposableLike>(material: T): T {
    return this.register('material', material);
  }

  /** Track one texture (its real dispose event flips its flag). */
  registerTexture<T extends DisposableLike>(texture: T): T {
    return this.register('texture', texture);
  }

  /** Track one renderer (its real dispose event flips its flag). */
  registerRenderer<T extends DisposableLike>(renderer: T): T {
    return this.register('renderer', renderer);
  }

  /** The number of tracked resources of one kind. */
  countOf(kind: TrackedResource['kind']): number {
    return this.tracked.filter((entry) => entry.kind === kind).length;
  }

  /**
   * Dispose EVERY tracked resource (full GPU teardown). Idempotent per
   * resource: Three.js dispose is safe to call repeatedly. Returns the
   * typed disposal report.
   */
  disposeAll(): DisposalReport {
    let disposedEvents = 0;
    for (const entry of this.tracked) {
      try {
        entry.resource.dispose();
      } catch {
        // A provider-native dispose failure never blocks the rest of the
        // teardown (the remaining resources still release).
      }
      if (entry.disposedEvent) {
        disposedEvents += 1;
      }
    }
    return this.reportOf(disposedEvents);
  }

  /** The current disposal state (evidence helper). */
  reportOf(disposedEvents?: number): DisposalReport {
    return {
      geometries: this.countOf('geometry'),
      materials: this.countOf('material'),
      textures: this.countOf('texture'),
      renderers: this.countOf('renderer'),
      disposedEvents:
        disposedEvents ?? this.tracked.filter((entry) => entry.disposedEvent).length,
      totalTracked: this.tracked.length,
    };
  }

  private register<T extends DisposableLike>(kind: TrackedResource['kind'], resource: T): T {
    const entry: TrackedResource = { kind, resource, disposedEvent: false };
    // Observe the real dispose event where the resource dispatches one
    // (geometries, materials, textures, and renderers all do; the typed
    // event maps differ per class, hence the single narrow cast).
    const dispatcher = resource as unknown as {
      addEventListener?: (type: 'dispose', listener: () => void) => void;
    };
    if (typeof dispatcher.addEventListener === 'function') {
      dispatcher.addEventListener('dispose', () => {
        entry.disposedEvent = true;
      });
    }
    this.tracked.push(entry);
    return resource;
  }
}
