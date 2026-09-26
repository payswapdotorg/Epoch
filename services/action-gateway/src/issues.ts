/**
 * Flattened-issue helpers for the gateway's total entry points — zod issues
 * become the kernel's typed issue values (the W009/W023 issue style), and
 * gateway-local validation errors reuse the kernel's `validation` shape so
 * the error surface stays one union.
 */
import type { ZodError } from 'zod';
import type { ActionPolicyError } from '@epoch/action-policy';

/** Flatten a zod failure into dotted-path issues. */
export function zodIssuesToGatewayIssues(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the kernel-shaped `validation` error for free-form issues. */
export function gatewayValidationError(issues: readonly { path: string; message: string }[]): ActionPolicyError {
  return {
    code: 'validation',
    message: `action-gateway input failed validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Re-path issues under a base path. */
export function rePathedIssues(
  error: ZodError,
  base: string,
): { path: string; message: string }[] {
  return zodIssuesToGatewayIssues(error).map((issue) => ({
    path: issue.path === '' ? base : `${base}.${issue.path}`,
    message: issue.message,
  }));
}
