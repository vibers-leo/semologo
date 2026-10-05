// Ask Firebase to validate the existing login token; never trust a client-supplied UID.
export async function logoOwner(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !key) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }), cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const result = await response.json();
  const user = result.users?.[0];
  return user && !user.disabled && typeof user.localId === 'string' ? user.localId : null;
}

