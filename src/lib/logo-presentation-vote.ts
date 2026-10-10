import type { LogoPresentation } from './logo-presentation';
export function presentationVoteId(file: string, bg: LogoPresentation['bg']) {
  return `${file}::${bg}`;
}
// Encoded keys contain no dots, so Firestore map updates cannot interpret file names as field paths.
export function presentationVoteKey(file: string, bg: LogoPresentation['bg']) {
  return encodeURIComponent(presentationVoteId(file, bg)).replace(/\./g, '%2E');
}
export function legacyFileVoteKey(file: string) {
  return file.replace(/\//g, '__').replace(/\./g, '_');
}
export function presentationVoteCount(votes: Record<string, number>, file: string, bg: LogoPresentation['bg']) {
  return (votes[presentationVoteKey(file, bg)] || 0) + (bg === 'light' ? votes[legacyFileVoteKey(file)] || 0 : 0);
}
