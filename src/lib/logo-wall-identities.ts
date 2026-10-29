/** Generator-only entity aliases, NOT a catalogue merge or representative override.
 * 2026-10-28: all four current CDN PNGs manually inspected. Toss pair has the
 * same blue symbol/wordmark; Kakao pair differs by yellow background only.
 * Official identity reference: https://brand.toss.im/ and Kakao corporate CI.
 * Unrelated same-name candidates must still remain ambiguous.
 */
export const wallIdentityGroups = [
  { canonical: 'toss', members: ['toss','toss-logo'] },
  { canonical: 'kakao', members: ['kakao','kakaocorp'] },
] as const;
