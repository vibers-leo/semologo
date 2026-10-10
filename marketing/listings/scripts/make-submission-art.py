"""Build store branding and frame real screenshots; never synthesize app UI."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
SIZES = {'iphone': (1290, 2796), 'ipad': (2064, 2752), 'android': (1080, 1920)}
SHOTS = [
    ('01-search', '필요한 로고를, 빠르게', '브랜드 이름으로 편하게 찾아보세요'),
    ('02-detail', '로고 하나부터 자세히', '선명한 이미지와 저장 기능을 한곳에'),
    ('03-saved', '자주 쓰는 로고는 가까이', '내 기기에 모아두고 다시 꺼내보세요'),
    ('04-share', 'PNG로 저장하고 공유해요', '필요한 순간, 다른 앱으로 간편하게'),
]


def font(size):
    return ImageFont.truetype(FONT, size=size)


def save(im, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, optimize=True)
    return {'file': str(path.relative_to(ROOT)), 'size': list(im.size), 'mode': im.mode,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def text_fit(draw, text, xy, max_width, size, color):
    while draw.textlength(text, font=font(size)) > max_width:
        size -= 1
    draw.text(xy, text, font=font(size), fill=color)


def branding():
    icon = Image.open(ROOT / 'app-store/assets/app-icon-1024.png').convert('RGB')
    out = ROOT / 'play-store/20261011'
    records = [save(icon.resize((512, 512), Image.Resampling.LANCZOS).convert('RGBA'), out / 'app-icon-512.png')]
    im = Image.new('RGB', (1024, 500), '#f5f3ff')
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((680, 90, 942, 352), radius=50, fill='white')
    im.paste(icon.resize((238, 238), Image.Resampling.LANCZOS), (692, 102))
    d.text((70, 90), '세모로고', font=font(34), fill='#675afa')
    d.text((70, 158), '필요한 로고를', font=font(59), fill='#171717')
    d.text((70, 229), '가까이', font=font(59), fill='#171717')
    d.text((73, 341), '브랜드 검색 · 기기 저장 · PNG 공유', font=font(25), fill='#55535f')
    records.append(save(im, out / 'feature-1024x500.png'))
    (out / 'branding-manifest.json').write_text(json.dumps({'status': 'branding-generated-not-uploaded', 'files': records}, ensure_ascii=False, indent=2) + '\n')


def screenshots(captures, device):
    w, h = SIZES[device]
    store = 'play-store' if device == 'android' else 'app-store'
    out = ROOT / store / '20261011' / device
    # Validate the complete input set before producing any outputs.
    sources = []
    for slug, title, subtitle in SHOTS:
        source = captures / (slug + '.png')
        with Image.open(source) as im:
            sw, sh = im.size
            if sw < 700 or sh < 1000 or abs(sw / sh - w / h) > .045:
                raise ValueError(f'Wrong device ratio or insufficient resolution: {source.name} {sw}x{sh}')
        sources.append((source, slug, title, subtitle))
    records = []
    for source, slug, title, subtitle in sources:
        im = Image.new('RGB', (w, h), '#f5f3ff')
        d = ImageDraw.Draw(im)
        margin = int(w * .07)
        d.text((margin, int(h * .035)), '세모로고', font=font(int(w * .034)), fill='#675afa')
        text_fit(d, title, (margin, int(h * .083)), w - 2 * margin, int(w * .061), '#171717')
        text_fit(d, subtitle, (margin, int(h * .132)), w - 2 * margin, int(w * .028), '#65616e')
        with Image.open(source) as capture:
            capture = ImageOps.contain(capture.convert('RGB'), (w - margin * 2, int(h * .77)), Image.Resampling.LANCZOS)
        x, y = (w - capture.width) // 2, int(h * .195)
        d.rounded_rectangle((x - 8, y - 8, x + capture.width + 8, y + capture.height + 8), radius=30, fill='#242329')
        im.paste(capture, (x, y))
        row = save(im, out / (slug + '.png'))
        row.update(source=source.name, source_sha256=hashlib.sha256(source.read_bytes()).hexdigest())
        records.append(row)
    (out / 'render-manifest.json').write_text(json.dumps({'status': 'requires-human-visual-and-device-verification', 'device': device, 'files': records}, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--captures', type=Path)
    parser.add_argument('--device', choices=SIZES)
    args = parser.parse_args()
    if bool(args.captures) != bool(args.device):
        parser.error('--captures and --device must be supplied together')
    if args.captures:
        screenshots(args.captures.resolve(), args.device)
    else:
        branding()
    print('PASS: submission artwork generated; no app screenshots fabricated or uploaded')
