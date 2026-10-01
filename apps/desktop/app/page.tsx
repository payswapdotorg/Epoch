import { ProductApp } from './components/product-app';

/**
 * The desktop product route (W048): a thin server component that renders
 * the client product shell. The static export pre-renders this page; the
 * product root (embedded gateway + product runtime) composes exclusively
 * client-side on mount — the same code path the journey harness drives.
 */
export default function Page() {
  return <ProductApp />;
}
