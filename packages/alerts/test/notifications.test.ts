// TYPED NOTIFICATIONS through the NotificationPort seam: the closed
// neutral channel vocabulary (provider-vocabulary-rejected), replay-
// safe dispatch, and tamper detection.
import { describe, expect, it } from 'vitest';
import {
  InMemoryNotificationAdapter,
  buildNotification,
  verifySealedNotification,
} from '../src/index';
import {
  PRINCIPAL,
  T4,
  T5,
  alertChain,
  expectError,
  findingSummary,
  unwrap,
} from './fixtures';

/** One notification over the standard chain head. */
function notification(overrides: Record<string, unknown> = {}) {
  const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
  return unwrap(
    buildNotification({
      notificationId: 'notification:excavate-blocked-1',
      alert: chain[chain.length - 1]!,
      channelKind: 'in-app',
      targets: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
      title: 'Blocked activity requires attention',
      body: 'activity:excavate is blocked and past its plan window',
      dispatchedAt: T5,
      dispatchedBy: PRINCIPAL,
      ...overrides,
    } as never),
  );
}

describe('the provider-vocabulary seam (the kernel never names a provider)', () => {
  it('a channel kind outside the closed neutral set is PROVIDER-VOCABULARY-REJECTED', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const error = expectError(
      buildNotification({
        notificationId: 'notification:excavate-blocked-1',
        alert: chain[chain.length - 1]!,
        channelKind: 'slack' as never,
        targets: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
        title: 'x',
        body: 'x',
        dispatchedAt: T5,
        dispatchedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('provider-vocabulary-rejected');
  });

  it('a target kind outside the closed neutral set is PROVIDER-VOCABULARY-REJECTED', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const error = expectError(
      buildNotification({
        notificationId: 'notification:excavate-blocked-1',
        alert: chain[chain.length - 1]!,
        channelKind: 'in-app',
        targets: [{ targetKind: 'webhook-url' as never, targetRef: 'https://vendor.invalid/hook' }],
        title: 'x',
        body: 'x',
        dispatchedAt: T5,
        dispatchedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('provider-vocabulary-rejected');
  });

  it('a vendor field on a notification is VENDOR-FIELDS-REJECTED (strict records)', () => {
    const built = notification();
    const error = expectError(
      verifySealedNotification({ ...built, vendorChannelConfig: { token: 'x' } }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });
});

describe('the NotificationPort reference adapter (replay-safe dispatch)', () => {
  it('dispatches a sealed notification and returns a typed receipt', () => {
    const adapter = new InMemoryNotificationAdapter();
    const built = notification();
    const receipt = unwrap(
      adapter.dispatch({ notification: built, dispatchedAt: T5, dispatchedBy: PRINCIPAL }),
    );
    expect(receipt.notificationId).toBe(built.notificationId);
    expect(receipt.notificationDigest).toBe(built.contentDigest);
    expect(receipt.channelKind).toBe('in-app');
    expect(receipt.duplicate).toBe(false);
    expect(adapter.size).toBe(1);
  });

  it('re-dispatching the SAME notification returns the SAME receipt (duplicate: true)', () => {
    const adapter = new InMemoryNotificationAdapter();
    const built = notification();
    const first = unwrap(adapter.dispatch({ notification: built, dispatchedAt: T5, dispatchedBy: PRINCIPAL }));
    const replay = unwrap(adapter.dispatch({ notification: built, dispatchedAt: T5, dispatchedBy: PRINCIPAL }));
    expect(replay).toEqual(first);
    expect(adapter.size).toBe(1);
  });

  it('a TAMPERED notification is rejected by the port (digest-mismatch)', () => {
    const adapter = new InMemoryNotificationAdapter();
    const built = notification();
    const error = expectError(
      adapter.dispatch({
        notification: { ...built, contentDigest: '0'.repeat(64) },
        dispatchedAt: T5,
        dispatchedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('a notification for a NEW alert revision dispatches separately', () => {
    const adapter = new InMemoryNotificationAdapter();
    const first = notification();
    const chain = alertChain([
      findingSummary({ findingStatus: 'due' }),
      findingSummary({ findingStatus: 'blocked', findingDigest: 'c'.repeat(64) }),
    ]);
    const second = unwrap(
      buildNotification({
        notificationId: 'notification:excavate-blocked-2',
        alert: chain[chain.length - 1]!,
        channelKind: 'in-app',
        targets: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
        title: 'Blocked activity requires attention',
        body: 'activity:excavate is blocked and past its plan window',
        dispatchedAt: T5,
        dispatchedBy: PRINCIPAL,
      }),
    );
    unwrap(adapter.dispatch({ notification: first, dispatchedAt: T4, dispatchedBy: PRINCIPAL }));
    unwrap(adapter.dispatch({ notification: second, dispatchedAt: T5, dispatchedBy: PRINCIPAL }));
    expect(adapter.size).toBe(2);
    expect(adapter.recordedReceipts().map((receipt) => receipt.notificationId)).toEqual([
      'notification:excavate-blocked-1',
      'notification:excavate-blocked-2',
    ]);
  });
});

describe('notification records (typed, content-addressed)', () => {
  it('the notification round-trips and carries the alert revision binding', () => {
    const built = notification();
    const verified = unwrap(verifySealedNotification(JSON.parse(JSON.stringify(built))));
    expect(verified.contentDigest).toBe(built.contentDigest);
    expect(verified.alertRevision).toBe(1);
    expect(verified.severity).toBe('critical');
    expect(verified.targets).toEqual([{ targetKind: 'role', targetRef: 'role:program-manager' }]);
  });

  it('an empty target list is rejected (notifications address someone)', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const error = expectError(
      buildNotification({
        notificationId: 'notification:excavate-blocked-empty',
        alert: chain[chain.length - 1]!,
        channelKind: 'in-app',
        targets: [],
        title: 'x',
        body: 'x',
        dispatchedAt: T5,
        dispatchedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('validation');
  });
});
