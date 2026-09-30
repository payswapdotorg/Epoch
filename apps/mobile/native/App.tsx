/**
 * @epoch/mobile — the Expo application root (W049).
 *
 * The native field product shell: boots the field product (the REAL W046
 * gateway in-process + the platform seams — native/bootstrap.ts), signs
 * in through the onboarding surface (J01), then renders the five field
 * tabs: Project (J02), Capture (J06), Approvals (J04), Queue (J07),
 * Status (J08/J09/J11/J12).
 *
 * Every interactive element carries a detox testID (the qa/mobile e2e
 * specs address them); the screens stay renderings of the product
 * engine's typed state — NO semantic logic lives in the UI (lock rule 8:
 * the UI is a projection).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MobileFieldHost } from '../src/product/field-host';
import type { BootMode } from './bootstrap';
import { bootFieldProduct } from './bootstrap';
import { layout, palette, type FieldTab } from './theme';
import { OnboardScreen } from './screens/OnboardScreen';
import { ProjectScreen } from './screens/ProjectScreen';
import { CaptureScreen } from './screens/CaptureScreen';
import { ApprovalsScreen } from './screens/ApprovalsScreen';
import { QueueScreen } from './screens/QueueScreen';
import { StatusScreen } from './screens/StatusScreen';

/** One booted product + the render-version counter (the projection refresh). */
interface ProductState {
  readonly host: MobileFieldHost;
  readonly mode: BootMode;
  readonly version: number;
}

const TABS: readonly { readonly id: FieldTab; readonly label: string; readonly testID: string }[] = [
  { id: 'project', label: 'Project', testID: 'tab-project' },
  { id: 'capture', label: 'Capture', testID: 'tab-capture' },
  { id: 'approvals', label: 'Approvals', testID: 'tab-approvals' },
  { id: 'queue', label: 'Queue', testID: 'tab-queue' },
  { id: 'status', label: 'Status', testID: 'tab-status' },
];

export default function App(): React.JSX.Element {
  const [product, setProduct] = useState<ProductState | null>(null);
  const [tab, setTab] = useState<FieldTab>('project');
  const [busy, setBusy] = useState(false);

  // Boot once (the product host lives for the process lifetime).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const booted = await bootFieldProduct({
        principalId: 'principal:delivery-lead',
        sessionNonce: 'nonce:epoch-field-device',
      });
      if (!cancelled) {
        setProduct({ host: booted.host, mode: booted.mode, version: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => {
    setProduct((current) => (current === null ? current : { ...current, version: current.version + 1 }));
  }, []);

  const signedIn = product?.host.hasSession ?? false;

  if (product === null) {
    return (
      <View style={[layout.screen, { justifyContent: 'center', alignItems: 'center', gap: 8 }]}>
        <Text style={layout.headerTitle} testID="boot-title">
          Epoch Field
        </Text>
        <Text style={layout.hint} testID="boot-status">
          Starting the field product…
        </Text>
      </View>
    );
  }

  if (!signedIn) {
    return (
      <OnboardScreen
        host={product.host}
        mode={product.mode}
        onSignedIn={refresh}
      />
    );
  }

  const screen = (() => {
    switch (tab) {
      case 'project':
        return <ProjectScreen host={product.host} />;
      case 'capture':
        return <CaptureScreen host={product.host} onComplete={refresh} />;
      case 'approvals':
        return <ApprovalsScreen host={product.host} onComplete={refresh} />;
      case 'queue':
        return <QueueScreen host={product.host} onSynced={refresh} />;
      case 'status':
        return <StatusScreen host={product.host} mode={product.mode} version={product.version} />;
    }
  })();

  return (
    <View style={layout.screen} testID="app-root">
      <View style={layout.header}>
        <View style={layout.rowSpace}>
          <Text style={layout.headerTitle} testID="app-title">
            Epoch Field
          </Text>
          <OfflineBadge host={product.host} />
        </View>
        <Text style={layout.headerSubtitle} testID="app-session" numberOfLines={1}>
          {product.host.currentSession?.principalId ?? ''} · {product.host.tenantId}
        </Text>
      </View>
      <ScrollView style={layout.scroll} contentContainerStyle={layout.scrollContent}>
        {screen}
      </ScrollView>
      <View style={layout.tabBar}>
        {TABS.map((entry) => {
          const active = entry.id === tab;
          return (
            <Pressable
              key={entry.id}
              testID={entry.testID}
              accessibilityLabel={entry.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={layout.tabItem}
              onPress={() => {
                setBusy(true);
                setTab(entry.id);
                setBusy(false);
              }}
              disabled={busy}
            >
              <Text style={active ? layout.tabLabelActive : layout.tabLabel}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The offline/online badge (the network state projection). */
function OfflineBadge({ host }: { readonly host: MobileFieldHost }): React.JSX.Element {
  const offline = host.offline;
  return (
    <View
      style={[
        layout.badge,
        { backgroundColor: offline ? palette.offlineSoft : palette.successSoft },
      ]}
      testID="network-badge"
    >
      <Text
        style={[layout.badgeText, { color: offline ? palette.offline : palette.success }]}
      >
        {offline ? 'OFFLINE' : 'ONLINE'}
      </Text>
    </View>
  );
}
