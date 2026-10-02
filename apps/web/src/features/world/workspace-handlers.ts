/**
 * Workspace HANDLERS (W057) — the pure command wiring between the
 * workspace components and the {@link WorldWorkspaceDriver}. Extracted as
 * a factory so the interaction logic is testable without a DOM: the
 * components attach these handlers to their input surfaces; the tests
 * (apps/web + qa/world-experience) drive them directly and assert the
 * typed commands the driver receives.
 *
 * Every handler either (a) forwards a RAW viewport input to the fabric
 * seam through the driver (pointer/wheel — semantic picking), (b) issues a
 * WORKSPACE COMMAND that composes an existing typed Epoch intent, or
 * (c) mutates presentation-only navigation state. Nothing here authors
 * new intent semantics, touches durable state, or throws.
 */
import type {
  NavigationGestureInput,
  NavigationKeyInput,
  WorldToolInput,
  WorldWorkspaceDriver,
} from './workspace-contracts';

/** Normalize one pixel position into the viewport's [0,1] pointer space. */
export function normalizePointer(
  bounds: { readonly width: number; readonly height: number },
  pixel: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return { x: 0.5, y: 0.5 };
  }
  const x = Math.min(1, Math.max(0, pixel.x / bounds.width));
  const y = Math.min(1, Math.max(0, pixel.y / bounds.height));
  return { x, y };
}

/** The drag gesture classifier: left-drag orbits, shift/meta-drag pans. */
export function classifyDrag(
  modifiers: { readonly shift: boolean; readonly meta: boolean; readonly alt: boolean },
  delta: { readonly dx: number; readonly dy: number },
): NavigationGestureInput {
  const kind = modifiers.shift || modifiers.meta || modifiers.alt ? 'pan' : 'orbit';
  return { kind, deltaX: delta.dx, deltaY: delta.dy };
}

/** One viewport drag in pixels → the presentation gesture (deterministic). */
export const DRAG_SENSITIVITY = 0.008;

/** Scale a pixel drag into a navigation gesture. */
export function dragToGesture(gesture: NavigationGestureInput): NavigationGestureInput {
  if (gesture.kind === 'orbit' || gesture.kind === 'free-look') {
    return {
      kind: gesture.kind,
      deltaX: gesture.deltaX * DRAG_SENSITIVITY,
      deltaY: gesture.deltaY * DRAG_SENSITIVITY,
    };
  }
  return gesture;
}

/** The keyboard tokens the workspace recognizes as navigation. */
const NAVIGATION_KEYS: readonly NavigationKeyInput[] = [
  'w',
  'a',
  's',
  'd',
  'q',
  'e',
  'r',
  'f',
  '+',
  '-',
];

/** Whether one raw key token is a navigation key (else it is not ours). */
export function isNavigationKey(key: string): key is NavigationKeyInput {
  return (NAVIGATION_KEYS as readonly string[]).includes(key);
}

/** The complete handler set of one workspace mount. */
export interface WorkspaceHandlers {
  /** A pointer-down at NORMALIZED [0,1] viewport coordinates (the fabric seam). */
  onViewportPointerDown(pointer: { readonly x: number; readonly y: number }): void;
  /** A wheel scroll at pixel coordinates (the fabric seam). */
  onViewportWheel(delta: { readonly x: number; readonly y: number }): void;
  /** A drag step (orbit or pan — presentation-only). */
  onViewportDrag(
    modifiers: { readonly shift: boolean; readonly meta: boolean; readonly alt: boolean },
    delta: { readonly dx: number; readonly dy: number },
  ): void;
  /** A navigation key press (presentation-only). */
  onNavigationKey(key: string): void;
  /** Reset the camera. */
  onResetNavigation(): void;
  /** Select a tool. */
  onToolSelect(tool: WorldToolInput): void;
  /** Toggle a layer. */
  onLayerToggle(layerId: string): void;
  /** Isolate a layer. */
  onLayerIsolate(layerId: string): void;
  /** Reveal every layer. */
  onLayersRevealAll(): void;
  /** Follow an agent. */
  onAgentFollow(agentId: string): void;
  /** Scrub the timeline to a virtual time. */
  onTimelineScrub(toMs: number): void;
  /** Pause the timeline. */
  onTimelinePause(): void;
  /** Resume the timeline. */
  onTimelineResume(): void;
  /** Submit the annotation composer. */
  onAnnotationSubmit(text: string): void;
  /** Invoke a scene control (branch/simulation entry). */
  onControlInvoke(
    controlId: string,
    payload?: { readonly annotationText?: string | undefined; readonly scenarioRef?: string | undefined; readonly branchAtMs?: number | undefined } | undefined,
  ): void;
  /** Switch the renderer. */
  onRendererSelect(rendererId: string): void;
}

/**
 * Build the handler set over one driver. Commands are fire-and-forget
 * (typed failures surface through the driver's own view model — the
 * components re-render from it); nothing throws. The optional `onSettled`
 * hook runs after every command (immediately for synchronous ones, on the
 * microtask for async ones) so the host can re-project the view model.
 */
export function createWorkspaceHandlers(
  driver: WorldWorkspaceDriver,
  onSettled?: (() => void) | undefined,
): WorkspaceHandlers {
  const settle = (): void => {
    onSettled?.();
    void Promise.resolve().then(() => {
      onSettled?.();
    });
  };
  const fire = (run: () => Promise<unknown>): void => {
    void run()
      .then(() => {
        settle();
      })
      .catch(() => {
        // Typed failures are the driver's results; an unexpected rejection
        // is swallowed here (the view model surfaces health honestly).
      });
  };
  return {
    onViewportPointerDown: (pointer) => {
      fire(() => driver.dispatchPointerDown(pointer));
    },
    onViewportWheel: (delta) => {
      fire(() => driver.dispatchWheel(delta));
    },
    onViewportDrag: (modifiers, delta) => {
      driver.applyGesture(dragToGesture(classifyDrag(modifiers, delta)));
      settle();
    },
    onNavigationKey: (key) => {
      if (isNavigationKey(key)) {
        driver.navigate(key);
        settle();
      }
    },
    onResetNavigation: () => {
      driver.resetNavigation();
      settle();
    },
    onToolSelect: (tool) => {
      driver.setTool(tool);
      settle();
    },
    onLayerToggle: (layerId) => {
      fire(() => driver.toggleLayer(layerId));
    },
    onLayerIsolate: (layerId) => {
      fire(() => driver.isolateLayer(layerId));
    },
    onLayersRevealAll: () => {
      fire(() => driver.revealAllLayers());
    },
    onAgentFollow: (agentId) => {
      fire(() => driver.followAgent(agentId));
    },
    onTimelineScrub: (toMs) => {
      fire(() => driver.scrubTimeline(toMs));
    },
    onTimelinePause: () => {
      fire(() => driver.pauseTimeline());
    },
    onTimelineResume: () => {
      fire(() => driver.resumeTimeline());
    },
    onAnnotationSubmit: (text) => {
      if (text.trim().length > 0) {
        fire(() => driver.composeAnnotation(text));
      }
    },
    onControlInvoke: (controlId, payload) => {
      fire(() => driver.invokeControl(controlId, payload));
    },
    onRendererSelect: (rendererId) => {
      fire(() => driver.selectRenderer(rendererId));
    },
  };
}
