/**
 * @epoch/mobile — the status screen (J08 cross-device state, J09
 * supervision, J11 recovery, J12 relaunch).
 *
 * Surfaces: the cross-device state (the world digest + program digest +
 * session scope — what web/desktop resolve from the same fixtures), the
 * supervision check result, the session state (expiry/re-auth path), and
 * the sign-out/relaunch actions.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { MobileFieldHost } from '../../src/product/field-host';
import type { BootMode } from '../bootstrap';
import { REGISTRY_WORLD_DIGEST } from '../bootstrap';
import { layout } from '../theme';

interface StatusState {
  readonly worldDigest: string;
  readonly crossDevice: boolean;
  readonly supervision: 'pass' | 'fail' | 'unavailable';
}

export function StatusScreen(props: {
  readonly host: MobileFieldHost;
  readonly mode: BootMode;
  readonly version: number;
}): React.JSX.Element {
  const host = props.host;
  const [state, setState] = useState<StatusState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const world = await host.worldSnapshot();
      const supervision = await host.supervisionCheck({
        passId: 'pass:field-status-check',
        evaluatedAt: host.currentSession?.issuedAt ?? '2026-03-02T15:00:00.000Z',
        thresholds: {
          quantityOverrunRatio: '1.1',
          costOverrunRatio: '1.1',
          quantityUnderrunRatio: '0.9',
          costUnderrunRatio: '0.9',
        },
      });
      if (cancelled) return;
      const digest = world.ok ? world.value.digest : '';
      setState({
        worldDigest: digest,
        crossDevice: digest === REGISTRY_WORLD_DIGEST,
        supervision: supervision.ok ? 'pass' : 'unavailable',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [host, props.version]);

  const session = host.currentSession;

  return (
    <View style={layout.section} testID="status-screen">
      <View style={layout.card} testID="status-cross-device">
        <Text style={layout.cardTitle}>Cross-device state (J08)</Text>
        <Text style={layout.mono} numberOfLines={1} selectable testID="status-world-digest">
          {state?.worldDigest ?? '…'}
        </Text>
        <Text style={layout.hint} testID="status-cross-device-match">
          {state === null
            ? '…'
            : state.crossDevice
              ? '✓ matches the authoritative fixture world digest (what web/desktop resolve)'
              : '✗ digest divergence from the registry anchor'}
        </Text>
        <Text style={layout.hint} testID="status-scope">
          {host.tenantId} · {host.deliveryId}
        </Text>
      </View>

      <View style={layout.card} testID="status-session">
        <Text style={layout.cardTitle}>Session (J11 recovery / J12 relaunch)</Text>
        <Text style={layout.mono} numberOfLines={1} testID="status-session-id">
          {session?.sessionId ?? '—'}
        </Text>
        <Text style={layout.hint} testID="status-session-window">
          {session ? `${session.issuedAt} → ${session.expiresAt} · ${session.state}` : '—'}
        </Text>
        <Text style={layout.hint}>
          Persisted in the {props.mode.secureStore === 'platform' ? 'platform secure store' : 'in-memory secure store (fallback)'}.
          Expiry surfaces the typed re-authenticate recovery action.
        </Text>
      </View>

      <View style={layout.card} testID="status-supervision">
        <Text style={layout.cardTitle}>Supervision (J09)</Text>
        <Text style={layout.value} testID="status-supervision-state">
          {state?.supervision ?? '…'}
        </Text>
        <Text style={layout.hint}>
          The supervision pass runs over the sealed program + delivery (the W043 authority) —
          pending actions are readable on the Approvals tab.
        </Text>
      </View>

      <Pressable
        testID="status-sign-out"
        accessibilityLabel="Sign out (revoke the session)"
        accessibilityRole="button"
        style={[layout.buttonDanger, { alignSelf: 'stretch' }]}
        onPress={() => {
          void (async () => {
            await host.signOut();
            Alert.alert('Signed out', 'The session is revoked through the gateway; the secure store record is cleared.');
          })();
        }}
      >
        <Text style={layout.buttonText}>Sign out (revoke session)</Text>
      </Pressable>
    </View>
  );
}
