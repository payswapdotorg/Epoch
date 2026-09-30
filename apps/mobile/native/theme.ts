/**
 * @epoch/mobile — the native product theme (W049).
 *
 * Provider-neutral palette (no vendor/brand vocabulary): neutral stone
 * surfaces with a teal-green brand accent (the Epoch field identity);
 * warm semantic colors for state (fresh/accepted, pending, rejected,
 * offline). Minimum touch target 48px; dark text on light surfaces.
 */
import { StyleSheet } from 'react-native';

/** The palette (hex literals — RN StyleSheet values). */
export const palette = {
  background: '#f7f7f5',
  surface: '#ffffff',
  surfaceMuted: '#efefec',
  border: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#57534e',
  textFaint: '#a8a29e',
  brand: '#0f766e',
  brandText: '#ffffff',
  brandSoft: '#ccfbf1',
  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  offline: '#78716c',
  offlineSoft: '#e7e5e4',
} as const;

/** The shared style fragments every screen composes. */
export const layout = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: palette.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowSpace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  value: {
    fontSize: 15,
    color: palette.text,
    lineHeight: 21,
  },
  mono: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: palette.textMuted,
    lineHeight: 16,
  },
  hint: {
    fontSize: 12,
    color: palette.textMuted,
    lineHeight: 17,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.brand,
  },
  buttonSecondary: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  buttonDanger: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.danger,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.brandText,
  },
  buttonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    fontSize: 15,
    color: palette.text,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  tabItem: {
    flex: 1,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textMuted,
  },
  tabLabelActive: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.brand,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    gap: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: palette.textMuted,
  },
  section: {
    gap: 8,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    color: palette.textMuted,
    textAlign: 'center',
  },
});

/** The badge style pairs (background + text) per state. */
export const badges = StyleSheet.create({
  fresh: { backgroundColor: palette.successSoft },
  freshText: { color: palette.success },
  pending: { backgroundColor: palette.warningSoft },
  pendingText: { color: palette.warning },
  rejected: { backgroundColor: palette.dangerSoft },
  rejectedText: { color: palette.danger },
  offline: { backgroundColor: palette.offlineSoft },
  offlineText: { color: palette.offline },
  brand: { backgroundColor: palette.brandSoft },
  brandText: { color: palette.brand },
});

/** One tab of the field product navigation. */
export type FieldTab = 'project' | 'capture' | 'approvals' | 'queue' | 'status';
