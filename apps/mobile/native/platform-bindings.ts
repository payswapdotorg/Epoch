/**
 * @epoch/mobile — the platform module bindings (W049, the adapter layer).
 *
 * THE PLATFORM ADAPTER SURFACE: this is the one place the product names
 * its platform binding targets (lock rule 13: provider-specific behavior
 * is adapterized — the vendor vocabulary lives HERE, never in the typed
 * field contracts or the product runtime under src/).
 *
 * The bindings are STRUCTURAL (the W046 bindPgPool precedent): the repo
 * references no unpinned npm module — the catalog pins only expo /
 * react-native / detox for this package. The deployment (a native entry
 * shim, an Expo dev client with the platform modules installed, or infra)
 * provides the module objects and they are duck-typed against the typed
 * seams declared in src/product/secure-store.ts and src/product/camera.ts.
 */
import type { SecureStorePort } from '../src/product/secure-store';
import type { FieldCameraPort } from '../src/product/camera';

/** The structural shape of the real platform secure-store module (duck-typed). */
export interface ExpoSecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** The module specifier of the platform secure store (never statically imported). */
export const EXPO_SECURE_STORE_MODULE = 'expo-secure-store' as const;

/**
 * Bind the REAL platform secure-store module (structural). The native
 * bootstrap injects the resolved module object here; the product runtime
 * then holds ONLY the typed port.
 */
export function bindExpoSecureStore(module: ExpoSecureStoreLike): SecureStorePort {
  return {
    async getItem(key: string): Promise<string | undefined> {
      const value = await module.getItemAsync(key);
      return value === null ? undefined : value;
    },
    async setItem(key: string, value: string): Promise<void> {
      await module.setItemAsync(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      await module.deleteItemAsync(key);
    },
    async hasItem(key: string): Promise<boolean> {
      return (await module.getItemAsync(key)) !== null;
    },
  };
}

/** The structural shape of the platform camera adapter (duck-typed). */
export interface ExpoCameraLike {
  takePhoto(options: {
    readonly quality?: number | undefined;
  }): Promise<{ readonly base64: string; readonly width?: number | undefined; readonly height?: number | undefined }>;
}

/** The module specifier of the platform camera (never statically imported). */
export const EXPO_CAMERA_MODULE = 'expo-camera' as const;

/** Bind a platform camera adapter (structural). */
export function bindExpoCamera(
  module: ExpoCameraLike,
  decode: (base64: string) => Uint8Array,
): FieldCameraPort {
  return {
    async capturePhoto(options: Parameters<FieldCameraPort['capturePhoto']>[0]): Promise<
      Awaited<ReturnType<FieldCameraPort['capturePhoto']>>
    > {
      const photo = await module.takePhoto({ quality: 1 });
      return {
        bytes: decode(photo.base64),
        kind: 'photo',
        capturedAt: options.capturedAt,
        capturedBy: options.capturedBy,
        ...(photo.width !== undefined ? { width: photo.width } : {}),
        ...(photo.height !== undefined ? { height: photo.height } : {}),
        ...(options.note !== undefined ? { note: options.note } : {}),
      };
    },
  };
}
