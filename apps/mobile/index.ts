/**
 * @epoch/mobile — the Expo application entry (W049).
 *
 * Registers the native App (native/App.tsx) as the root component through
 * Expo's registerRootComponent. The app boots the field product
 * (native/bootstrap.ts: the REAL W046 gateway in-process + the platform
 * seams) and renders the W018 field surface.
 */
import { registerRootComponent } from 'expo';

import App from './native/App';

export default registerRootComponent(App);
