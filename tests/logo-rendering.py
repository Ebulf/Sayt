"""Compare actual logo pixels with and without browser auto-darkening."""
from pathlib import Path
import json
from PIL import Image, ImageChops
root=Path(__file__).resolve().parent.parent/'reports'
rows=json.loads((root/'after.json').read_text())
normal=Image.open(root/'after-normal-logos.png').convert('RGB')
dark=Image.open(root/'after-forced-dark-logos.png').convert('RGB')
checks=[]
for logo in rows[0]['logos']:
    r=logo['rect'];box=(round(r['x']),round(r['y']),round(r['x']+r['width']),round(r['y']+r['height']))
    a,b=normal.crop(box),dark.crop(box)
    assert ImageChops.difference(a,b).getbbox() is None,logo['name']+' changed colors in forced dark mode'
    pixels=a.tobytes()
    assert sum(min(pixels[i:i+3])<150 for i in range(0,len(pixels),3))>12,logo['name']+' has no visible mark'
    checks.append(logo['name'])
assert all(x['loaded'] for row in rows for x in row['logos'])
assert all('only' in row['colorScheme'] for row in rows)
print(json.dumps({'status':'PASS','sameVisibleLogoPixels':checks},ensure_ascii=False))
