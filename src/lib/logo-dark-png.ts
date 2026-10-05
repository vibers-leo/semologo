export async function generateInverted(src: string): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 800;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imageData.data;

          // ⚠️ 예전엔 모든 픽셀을 255-값 으로 뒤집었다. 그래서 색이 있는 로고가
          //    보색이 됐다 — 한국투자증권의 파란 심볼이 주황색이 됐다.
          //    build-variants.py 의 make_white_version 과 같은 규칙을 쓴다:
          //      · 무채색(흑백) 로고 → 통째로 흰색으로
          //      · 색이 있는 로고   → 색은 그대로 두고 **어두운 부분만** 흰색으로
          //        (검은 배경에서 까맣게 묻히는 글자만 살리는 것)
          let colored = 0, opaque = 0;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] <= 10) continue;
            opaque++;
            if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) colored++;
          }
          const isMono = opaque === 0 || colored / opaque <= 0.02;

          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] <= 10) continue;
            if (isMono) { d[i] = d[i + 1] = d[i + 2] = 255; continue; }
            const chroma = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
            const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
            if (chroma <= 40 && lum < 128) { d[i] = d[i + 1] = d[i + 2] = 255; }
          }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
