"""Package existing brand artwork; never redraw or upscale its details."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'
art = Image.open(source).convert('RGB')
assert art.size == (1024, 1024)
res = root / 'android/app/src/main/res'

def save(image, path):
    temporary = path.with_suffix('.png.tmp')
    image.save(temporary, format='PNG')
    temporary.replace(path)

save(art, source)  # App Store icons must have no alpha channel.

for density, size in {'mdpi':48, 'hdpi':72, 'xhdpi':96, 'xxhdpi':144, 'xxxhdpi':192}.items():
    folder = res / f'mipmap-{density}'
    save(art.resize((size, size), Image.Resampling.LANCZOS), folder / 'ic_launcher.png')
    for filename, canvas_size, artwork_size in [
        ('ic_launcher_round.png', size, round(size * .75)),
        # Adaptive icons have a 108dp canvas and a 66dp safe zone.
        ('ic_launcher_foreground.png', round(size * 2.25), round(size * 66 / 48)),
    ]:
        canvas = Image.new('RGB', (canvas_size, canvas_size), 'white')
        mark = art.resize((artwork_size, artwork_size), Image.Resampling.LANCZOS)
        offset = (canvas_size - artwork_size) // 2
        canvas.paste(mark, (offset, offset))
        save(canvas, folder / filename)
print('Android brand icons packaged with adaptive safe-zone padding.')
