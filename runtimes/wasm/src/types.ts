/**
 * runtimes/wasm — typed HOST-side view of the Wasm Component Model
 * surface. These types are the host's own declarations (zero imports —
 * self-contained machinery; see src/version.ts). They are
 * shape-compatible with the author-side `WasmComponentDescriptor`
 * published by @epoch/extension-sdk (W008): compatibility is pinned by
 * the SHARED COMMITTED FIXTURE under test/fixtures/
 * component-descriptor.fixture.json, which BOTH validators must accept
 * (defense in depth — the host re-validates independently and never
 * trusts author-side tooling).
 */
import type { WasmSectionKind, WasmValueType } from './version';
import type { Sha256Hex } from './digest';

/** Wasm component parameter declaration (WIT primitive type). */
export interface WasmParamDeclaration {
  readonly name: string;
  readonly type: WasmValueType;
}

/** One function of a Wasm component interface declaration. */
export interface ComponentFunctionDeclaration {
  readonly functionName: string;
  readonly params: readonly WasmParamDeclaration[];
  /** Result type; absent when the function returns nothing. */
  readonly result?: WasmValueType | undefined;
}

/** One import or export interface of a Wasm component world. */
export interface ComponentInterfaceDeclaration {
  readonly interfaceName: string;
  readonly functions: readonly ComponentFunctionDeclaration[];
}

/**
 * One canonical layout section of a component package: sorted by
 * `name` ascending, unique; `contentDigest` is the SHA-256 of the
 * section's bytes (verifySectionContent checks provided bytes against
 * it).
 */
export interface LayoutSection {
  readonly name: string;
  readonly kind: WasmSectionKind;
  readonly byteSize: number;
  readonly contentDigest: Sha256Hex;
}

/**
 * The canonical component layout descriptor — the HOST-side document.
 * Canonical ordering: imports/exports sorted by interfaceName (unique),
 * functions sorted by functionName (unique) within an interface, params
 * sorted by name (unique), sections sorted by name (unique). At least
 * one export and one section.
 */
export interface ComponentLayoutDescriptor {
  readonly schemaVersion: 1;
  readonly componentId: string;
  readonly componentVersion: string;
  readonly worldName: string;
  readonly imports: readonly ComponentInterfaceDeclaration[];
  readonly exports: readonly ComponentInterfaceDeclaration[];
  readonly sections: readonly LayoutSection[];
}

/** A sealed layout envelope: the descriptor plus its claimed digest. */
export interface SealedLayoutDescriptor {
  readonly descriptor: ComponentLayoutDescriptor;
  readonly digest: Sha256Hex;
}

/**
 * Section content bundle for verification: one byte array per section
 * name (exactly the declared sections — extras are rejected).
 */
export type SectionContentBundle = Readonly<Record<string, Uint8Array>>;
