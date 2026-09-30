'use client';

import type { ReactNode } from 'react';
import { DESKTOP_PRODUCT_VERSION } from '../../src/native/web';
import type { HostAppMeta } from '../../src/native/web';
import { FONTS, SPACE, TYPE } from './ui-tokens';
import { COLORS } from './ui-tokens';

/**
 * The status strip (the desktop product footer): the host seam kind, the
 * product version, the fixture id of the loaded bundle and the platform
 * label reported by the host handshake.
 */
export interface StatusStripProps {
  readonly hostKind: 'memory' | 'browser' | 'tauri' | null;
  readonly fixtureId: string | null;
  readonly appMeta: HostAppMeta | null;
}

export function StatusStrip({ hostKind, fixtureId, appMeta }: StatusStripProps): ReactNode {
  const platform = appMeta?.platform ?? 'unknown';
  const cells = [
    `host: ${hostKind ?? '—'}`,
    `product: v${DESKTOP_PRODUCT_VERSION}`,
    fixtureId !== null ? `fixture: ${fixtureId}` : 'fixture: —',
    `platform: ${platform}`,
  ];
  return (
    <footer
      role="contentinfo"
      style={{
        background: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`,
        color: COLORS.textMuted,
        padding: `${SPACE.sm}px ${SPACE.xl}px`,
        display: 'flex',
        gap: SPACE.lg,
        flexWrap: 'wrap',
        fontFamily: FONTS.mono,
        fontSize: TYPE.sizeXs,
        letterSpacing: '0.02em',
      }}
    >
      {cells.map((cell) => (
        <span key={cell}>{cell}</span>
      ))}
    </footer>
  );
}
