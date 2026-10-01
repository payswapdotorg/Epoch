'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { FixtureDomain } from '../../src/native/web';
import { ProductWorkspace } from './product-workspace';

/**
 * The desktop product app (the client entry).
 *
 * Holds the fixture-domain selection and remounts the workspace with a
 * fresh key per domain: switching construction ↔ software rebuilds the
 * ENTIRE product root — a fresh fixture bundle, a fresh embedded
 * Application Gateway, a fresh product — exactly like the journey
 * runner's per-journey isolation.
 */
export function ProductApp(): ReactNode {
  const [domain, setDomain] = useState<FixtureDomain>('construction');
  return <ProductWorkspace key={domain} domain={domain} onDomainChange={setDomain} />;
}
