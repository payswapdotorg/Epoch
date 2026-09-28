// Shared scenario helpers (the tests/integration shared.ts pattern).
import { conformingSubject } from './security-scenario';

/**
 * A violating sandbox subject FOR ONE EXTENSION (t4 / remote /
 * external-transfer — three violations under the baseline profile).
 */
export function badSubjectFor(extensionId: string): Record<string, unknown> {
  return conformingSubject({
    extensionId,
    trustClass: 't4',
    flavor: 'remote',
    dataHandling: 'external-transfer',
  });
}
