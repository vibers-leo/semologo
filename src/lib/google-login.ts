import { Capacitor, registerPlugin } from "@capacitor/core";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { getClientAuth, googleProvider } from "./firebase";

const nativeGoogle = registerPlugin<{ signIn(): Promise<{ idToken: string }> }>("SemoGoogleAuth");

export function hasNativeGoogleLogin() {
  return Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("SemoGoogleAuth");
}

export function authErrorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "";
}

export async function startGoogleLogin() {
  const auth = getClientAuth();
  if (hasNativeGoogleLogin()) {
    const { idToken } = await nativeGoogle.signIn();
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return;
  }
  try {
    // Call directly from the click, with no awaited preflight that loses Safari's
    // user activation. Redirect is safe only after the same-origin helper setup.
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(authErrorCode(error)) &&
        auth.config.authDomain === window.location.host) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw error;
  }
}
