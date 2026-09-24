/**
 * Typed errors for the evidence kernel. Only thrown by low-level helpers on
 * programming errors (e.g. digesting a record that failed validation); all
 * public entry points are total and return typed issues instead.
 */
export class EvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvidenceError';
  }
}
