/**
 * @epoch/mobile — the queue screen (J07: offline work, queue, reconnect,
 * idempotent sync).
 *
 * Renders the pending offline projections (queue ids, idempotency keys,
 * attempts, last error codes) and the reconnect + sync action. The sync
 * report surfaces the exactly-once proof: every drained intent replays
 * through the Action Gateway with its idempotency key, the re-submission
 * returns the RECORDED outcome (replayed: true, same digest), and
 * duplicateSideEffects must be 0.
 */
import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { MobileFieldHost } from '../../src/product/field-host';
import type { IdempotentSyncReport } from '../../src/product/offline';
import { layout } from '../theme';

export function QueueScreen(props: {
  readonly host: MobileFieldHost;
  readonly onSynced: () => void;
}): React.JSX.Element {
  const host = props.host;
  const [report, setReport] = useState<IdempotentSyncReport | null>(null);
  const [busy, setBusy] = useState(false);
  const queue = host.queueSnapshot();

  const sync = async (): Promise<void> => {
    setBusy(true);
    try {
      const at = host.currentSession?.issuedAt ?? '2026-03-02T14:00:00.000Z';
      const result = await host.syncNow(at);
      setReport(result);
      const drained = result.drain.drained.length;
      const duplicates = result.duplicateSideEffects;
      Alert.alert(
        'Reconnect + sync complete',
        `${drained} intent(s) replayed through the Action Gateway · duplicate side effects: ${duplicates}`,
      );
      props.onSynced();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={layout.section} testID="queue-screen">
      <View style={layout.card} testID="queue-state">
        <Text style={layout.cardTitle}>Offline queue (pending projections)</Text>
        {queue.length === 0 ? (
          <View style={layout.empty}>
            <Text style={layout.emptyText}>No pending intents — the queue is empty.</Text>
          </View>
        ) : (
          queue.map((intent) => (
            <View key={intent.queueId} style={{ gap: 2 }} testID={`queue-intent-${intent.queueId}`}>
              <Text style={layout.mono} numberOfLines={1}>
                {intent.queueId} · {intent.operation}
              </Text>
              <Text style={layout.hint} numberOfLines={1}>
                key {intent.idempotencyKey} · attempts {intent.attempts}
                {intent.lastErrorCode !== undefined ? ` · last ${intent.lastErrorCode}` : ''}
              </Text>
            </View>
          ))
        )}
      </View>

      {report !== null && (
        <View style={layout.card} testID="queue-sync-report">
          <Text style={layout.cardTitle}>Last sync (the idempotence proof)</Text>
          <Text style={layout.value} testID="queue-sync-counts">
            drained {report.drain.drained.length} · pending {report.drain.stillPending.length} ·
            rejected {report.drain.rejected.length}
          </Text>
          <Text style={layout.value} testID="queue-sync-duplicates">
            duplicate side effects: {report.duplicateSideEffects}
          </Text>
          {report.replayProofs.map((proof) => (
            <View key={proof.queueId} style={{ gap: 2 }} testID={`replay-proof-${proof.queueId}`}>
              <Text style={layout.mono} numberOfLines={1}>
                {proof.idempotencyKey}
              </Text>
              <Text style={layout.hint}>
                replayed {String(proof.replayed)} · digest-stable {String(proof.digestStable)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        testID="queue-go-offline"
        accessibilityLabel="Simulate offline interval"
        accessibilityRole="button"
        style={[layout.buttonSecondary, { alignSelf: 'stretch' }]}
        onPress={() => {
          host.goOffline();
          props.onSynced();
        }}
      >
        <Text style={layout.buttonTextSecondary}>Enter offline interval</Text>
      </Pressable>

      <Pressable
        testID="queue-sync-now"
        accessibilityLabel="Reconnect and sync now"
        accessibilityRole="button"
        style={[layout.button, busy && { opacity: 0.6 }]}
        onPress={() => {
          void sync();
        }}
        disabled={busy}
      >
        <Text style={layout.buttonText}>Reconnect + sync (exactly once)</Text>
      </Pressable>

      <View style={layout.card}>
        <Text style={layout.hint}>
          The queue holds PENDING PROJECTIONS of user intent only — never semantic state. Every
          replay goes through the Action Gateway with idempotency keys; a replayed key returns
          the recorded outcome, never a double-apply.
        </Text>
      </View>
    </View>
  );
}
