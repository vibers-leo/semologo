type Logo = { name?: string; id: string; file: string; light?: boolean };
type Settings = { background?: string; columns?: number; motion?: string; speed?: string };
const escape = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

/** Self-contained presentation; every logo URL points to an included PNG. */
export function logoWallHtml(title: string, settings: Settings, logos: Logo[]): string {
  const columns = [2, 3, 4, 6].includes(settings.columns ?? 0) ? settings.columns! : 4;
  const dark = settings.background === 'dark';
  const motion = ['marquee', 'alternating'].includes(settings.motion ?? '') ? settings.motion : 'static';
  const speed = settings.speed === 'slow' ? 48 : settings.speed === 'fast' ? 14 : 28;
  const tile = (logo: Logo, decorative = false) => {
    // Export filenames must be local, never supplied external URLs or traversal paths.
    if (!/^logos\/[\w가-힣-]+\.png$/.test(logo.file)) throw new Error('unsafe logo file');
    const name = escape(String(logo.name || logo.id));
    const background = dark || (settings.background !== 'light' && logo.light) ? '#18181b' : '#fff';
    return `<div class="tile" style="background:${background}"><img src="${escape(logo.file)}" alt="${decorative ? '' : name}" draggable="false">${decorative ? '' : `<span>${name}</span>`}</div>`;
  };
  let content: string;
  if (motion === 'static') content = `<div class="grid">${logos.map(l => tile(l)).join('')}</div>`;
  else {
    const rows = motion === 'alternating' ? Math.min(3, logos.length, Math.max(2, Math.ceil(logos.length / columns))) : 1;
    content = Array.from({ length: rows }, (_, row) => {
      const group = logos.filter((_, i) => i % rows === row);
      const repeated = Array.from({ length: Math.max(1, Math.ceil(8 / group.length)) }, () => group).flat();
      const cells = repeated.map(l => tile(l, true)).join('');
      return `<div class="row"><div class="track" style="animation-direction:${row % 2 ? 'reverse' : 'normal'}"><div class="group">${cells}</div><div class="group" aria-hidden="true">${cells}</div></div></div>`;
    }).join('') + `<ul class="names">${logos.map(l => `<li>${escape(String(l.name || l.id))}</li>`).join('')}</ul>`;
  }
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:${dark ? '#101012' : '#fafafa'};color:${dark ? '#fafafa' : '#18181b'};font-family:system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:32px 20px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}h1{font-size:24px;overflow-wrap:anywhere}button{padding:10px 16px;border:1px solid #a1a1aa;border-radius:8px;font:inherit;cursor:pointer}button:focus-visible{outline:3px solid #6366f1;outline-offset:3px}.grid{display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:16px}.tile{border:1px solid #d4d4d8;border-radius:10px;min-width:0;padding:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}.tile img{display:block;max-width:100%;width:160px;height:90px;object-fit:contain}.tile span{font-size:12px;color:#71717a;overflow-wrap:anywhere}.row{overflow:hidden;margin:16px 0}.track{display:flex;width:max-content;animation:marquee ${speed}s linear infinite}.group{display:flex;gap:16px;padding-right:16px;flex-shrink:0}.group .tile{width:180px;height:120px}.paused .track{animation-play-state:paused}.names{display:flex;flex-wrap:wrap;gap:16px;padding:20px;line-height:1.6;font-size:13px}footer{margin-top:24px;font-size:12px;color:#71717a;line-height:1.8}@keyframes marquee{to{transform:translateX(-50%)}}@media(max-width:600px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(prefers-reduced-motion:reduce){.track{animation:none}}
</style></head><body><main><header><h1>${escape(title)}</h1>${motion !== 'static' ? '<button id="pause" type="button" aria-pressed="false">일시정지</button>' : ''}</header>${content}<footer>이미지는 이 ZIP에 포함된 PNG를 사용해요. 세모로고 접속 없이도 볼 수 있어요.<br>움직임 줄이기 설정을 따라요. 각 브랜드의 상표와 사용 조건은 해당 권리자에게 있어요.</footer></main>
<script>const button=document.getElementById('pause');if(button)button.addEventListener('click',()=>{const paused=document.body.classList.toggle('paused');button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'재생하기':'일시정지'});</script></body></html>`;
}
