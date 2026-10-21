# iPad Google login repair (2026-10-21)

## Verified configuration and scope

- Web Firebase Auth uses the cross-origin ai-recipe-lab.firebaseapp.com helper. Safari can lose redirect persistence under third-party storage restrictions; the same-origin helper is the selected mitigation from Firebase's redirect best practices. The specific original device error has not yet been reproduced.
- Existing SemoLogo native WebViews deliberately disable the web Google button. Embedded Google OAuth is unsuitable; a native system authentication session is required.
- Existing Google provider and semologo.com authorized domain are enabled. Existing users remain in the same Firebase project.

## Changes

- iOS GoogleSignIn 10.0.0, app-specific OAuth client and reverse-client-ID URL scheme; build number 3.
- Local Capacitor plugin returns a Google identity token only over the bridge to the trusted semologo.com HTTPS page; Firebase signInWithCredential keeps existing account identity. Tokens are never placed in URLs or logs.
- WKWebView Auth uses local persistence without the web popup resolver.
- Korean and English login restore existing sessions, prevent repeated submits and distinguish popup cancellation, blocked popup and network errors.
- A blocked popup uses redirect only when authDomain matches the current host. The previous cross-origin redirect fallback must not silently lose Safari authentication state.
- Exact /__/auth/* reverse proxy uses a fixed Firebase upstream, no-store responses and preserves ordinary trailing-slash behavior elsewhere.

## Configuration verified

The existing Google web OAuth client now allows `https://semologo.com` as a JavaScript origin and the exact callback `https://semologo.com/__/auth/handler`. Both saved values were reopened and verified in Google Cloud on 2026-10-21. Existing localhost origins and Firebase callback were preserved. No secret rotation or IAM changes were made.

Build with NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=semologo.com. Runtime-only changes do not alter the compiled client. A production-base isolated build passed full TypeScript checks, login tests, 410 local-logo source checks and the Next production build.

A localhost-only NCP preview returned 200 for Korean/English login, home, brand detail and all three Firebase helper requests. Helper responses use private/no-store. Normal page/file redirects preserve the path and query without loops.

## Validation and release

- `node scripts/check-login-browser.cjs`
- `node scripts/check-google-login.cjs`
- Full TypeScript check and Next production build after dependency installation completes.
- iOS Xcode build with dependencies resolved on 1F HDD; then real device login/cancel/reopen verification.
- Check login, safe next path, existing account UID, token-free URL, restored session after reload, home/search/download independently.
- Before deployment isolate this patch from unrelated local changes; retain current production image as rollback.
- After NCP deployment: `ssh vibers "bash /root/check-deploy.sh semologo https://semologo.com"`.
- Native SDK requires a new app build; updating the website alone does not add the native plugin to old installations. Old apps keep external-browser guidance.

Native scheme compilation currently reports a missing iOS 26.5 platform/runtime; a target-only SDK build is being checked. No successful real-account iPad end-to-end authentication has been claimed. Module candidate: native Google ID-token-to-Firebase credential bridge and same-origin redirect guard.

Official references:
- https://firebase.google.com/docs/auth/web/redirect-best-practices
- https://developers.google.com/identity/sign-in/ios/start-integrating
