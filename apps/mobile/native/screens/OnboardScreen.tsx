/**
 * @epoch/mobile — the onboarding screen (J01: onboard/project entry).
 *
 * Signs the field principal in through the gateway (`session.issue` over
 * the fixture VERIFIED authentication result), persists the session in
 * the platform secure store, and surfaces the boot mode honestly (which
 * platform seams are bound: secure store / camera / transport).
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import type { MobileFieldHost } from '../../src/product/field-host';
import type { BootMode } from '../bootstrap';
import { layout, palette } from '../theme';

export function OnboardScreen(props: {
  readonly host: MobileFieldHost;
  readonly mode: BootMode;
  readonly onSignedIn: () => void;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);

  const signIn = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await props.host.signIn();
      if (result.ok) {
        props.onSignedIn();
      } else {
        Alert.alert('Sign-in failed', result.failure.error.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[layout.screen, { padding: 16, gap: 16 }]} testID="onboard-screen">
      <View style={[layout.card, { gap: 10 }]} testID="onboard-product">
        <Text style={layout.headerTitle}>Epoch Field</Text>
        <Text style={layout.hint}>
          The field product: capture observations with digest-addressed evidence, approve through the
          Action Gateway, and sync offline work exactly once.
        </Text>
        <View style={layout.rowSpace}>
          <Text style={layout.cardTitle}>Transport</Text>
          <Text style={layout.value} testID="onboard-transport">
            {props.mode.transport}
          </Text>
        </View>
        <View style={layout.rowSpace}>
          <Text style={layout.cardTitle}>Secure store</Text>
          <Text style={layout.value} testID="onboard-secure-store">
            {props.mode.secureStore}
          </Text>
        </View>
        <View style={layout.rowSpace}>
          <Text style={layout.cardTitle}>Camera</Text>
          <Text style={layout.value} testID="onboard-camera">
            {props.mode.camera}
          </Text>
        </View>
      </View>

      <View style={layout.card} testID="onboard-principal">
        <Text style={layout.cardTitle}>Field principal</Text>
        <Text style={layout.value} testID="onboard-principal-id">
          principal:delivery-lead
        </Text>
        <Text style={layout.hint}>
          Session tokens persist only through the platform secure store — never plain storage.
        </Text>
      </View>

      <Pressable
        testID="onboard-sign-in"
        accessibilityLabel="Sign in"
        accessibilityRole="button"
        style={[layout.button, busy && { opacity: 0.6 }]}
        onPress={() => {
          void signIn();
        }}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={palette.brandText} />
        ) : (
          <Text style={layout.buttonText}>Sign in to the field session</Text>
        )}
      </Pressable>
    </View>
  );
}
