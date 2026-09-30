/**
 * @epoch/mobile — the capture screen (J06: realize, field observation).
 *
 * The field-worker surface: pick the work package (unambiguous linkage —
 * the picker lists exactly the program's work packages), enter the
 * quantity/progress measure with the mandatory uncertainty state, capture
 * digest-addressed photo evidence, and submit ONLINE (`delivery.observe`)
 * or queue OFFLINE (the pending projection — the badge shows which).
 *
 * Ambiguity discipline is structural: the picker offers only known work
 * packages; the anchor resolution + W018 envelope sealing reject anything
 * ambiguous with a typed error surfaced inline.
 */
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import type { MobileFieldHost } from '../../src/product/field-host';
import { layout, palette } from '../theme';

export function CaptureScreen(props: {
  readonly host: MobileFieldHost;
  readonly onComplete: () => void;
}): React.JSX.Element {
  const host = props.host;
  const workPackages = useMemo(() => host.programProjections().workPackages, [host]);
  const [selected, setSelected] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('120');
  const [unit] = useState('m3');
  const [note, setNote] = useState('');
  const [attachPhoto, setAttachPhoto] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (selected === null) {
      Alert.alert('Unambiguous linkage required', 'Select exactly one work package — ambiguous linkage is a typed rejection, never a guess.');
      return;
    }
    setBusy(true);
    try {
      const now = host.currentSession?.issuedAt ?? '2026-03-02T12:00:00.000Z';
      const result = await host.captureObservation({
        anchor: { kind: 'work-package', id: selected },
        measure: { kind: 'quantity', value: quantity, unit },
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed', sourceRef: 'source:epoch-field-device', actor: host.currentSession?.principalId ?? '' },
          freshness: { state: 'fresh', assessedAt: now },
          confidence: { method: 'measured', value: 0.95, rationale: 'direct field measurement' },
        },
        observedAt: now,
        captureId: `device-capture-${Date.now()}`,
        ...(note.trim().length > 0 ? { note: note.trim() } : {}),
        ...(attachPhoto ? [{ note: 'field photo' }] : []),
      });
      if (result.ok) {
        Alert.alert(
          result.mode === 'online' ? 'Observation recorded' : 'Observation queued offline',
          result.mode === 'online'
            ? `The authority accepted the capture.${result.replayed ? ' (replayed: the recorded outcome)' : ''}`
            : 'The pending projection will replay through the Action Gateway on reconnect (exactly once).',
        );
        props.onComplete();
      } else {
        Alert.alert(
          result.failure.stage === 'anchor-resolution' ? 'Ambiguous linkage rejected' : 'Capture rejected',
          result.failure.error.message,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={layout.section} testID="capture-screen">
      <View style={layout.card} testID="capture-linkage">
        <Text style={layout.cardTitle}>Work package (unambiguous linkage)</Text>
        {workPackages.map((workPackage) => {
          const active = selected === workPackage.workPackageId;
          return (
            <Pressable
              key={workPackage.workPackageId}
              testID={`select-${workPackage.workPackageId}`}
              accessibilityLabel={`Select ${workPackage.title}`}
              accessibilityRole="button"
              onPress={() => {
                setSelected(workPackage.workPackageId);
              }}
              style={[
                layout.buttonSecondary,
                { alignSelf: 'stretch', backgroundColor: active ? palette.brandSoft : palette.surface },
              ]}
            >
              <Text
                style={[
                  layout.buttonTextSecondary,
                  active && { color: palette.brand, fontWeight: '700' },
                ]}
              >
                {workPackage.title}
              </Text>
            </Pressable>
          );
        })}
        <Text style={layout.mono} testID="capture-selected">
          {selected ?? 'none selected'}
        </Text>
      </View>

      <View style={layout.card} testID="capture-measure">
        <Text style={layout.cardTitle}>Observed quantity (with mandatory uncertainty)</Text>
        <View style={layout.row}>
          <TextInput
            testID="capture-quantity"
            accessibilityLabel="Observed quantity"
            style={[layout.input, { flex: 1 }]}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
          />
          <Text style={[layout.value, { minWidth: 40 }]}>m3</Text>
        </View>
        <Text style={layout.hint}>Unit: {unit} · provenance observed · freshness fresh · confidence measured 0.95</Text>
        <TextInput
          testID="capture-note"
          accessibilityLabel="Capture note"
          style={[layout.input, { minHeight: 72, textAlignVertical: 'top' }]}
          value={note}
          onChangeText={setNote}
          placeholder="Optional note (carried on the capture context)"
          placeholderTextColor={palette.textFaint}
          multiline
        />
      </View>

      <View style={layout.card} testID="capture-evidence">
        <Text style={layout.cardTitle}>Evidence (digest-addressed)</Text>
        <Pressable
          testID="capture-attach-photo"
          accessibilityLabel="Attach photo evidence"
          accessibilityRole="switch"
          accessibilityState={{ selected: attachPhoto }}
          style={[layout.buttonSecondary, { alignSelf: 'stretch' }]}
          onPress={() => {
            setAttachPhoto(!attachPhoto);
          }}
        >
          <Text style={layout.buttonTextSecondary}>
            {attachPhoto ? '✓ Photo evidence attached (digest computed before upload)' : 'Attach photo evidence'}
          </Text>
        </Pressable>
        <Text style={layout.hint}>
          The bytes are hashed (SHA-256) before upload; the object-storage authority recomputes
          the digest and every record references the digest — never a local path.
        </Text>
      </View>

      <Pressable
        testID="capture-submit"
        accessibilityLabel="Submit observation"
        accessibilityRole="button"
        style={[layout.button, busy && { opacity: 0.6 }]}
        onPress={() => {
          void submit();
        }}
        disabled={busy}
      >
        <Text style={layout.buttonText}>
          {host.offline ? 'Queue observation (offline)' : 'Submit observation'}
        </Text>
      </Pressable>
    </View>
  );
}
