#!/usr/bin/env python3
"""
Transforme des images de personnages (générées ou dessinées) en planches de sprites prêtes
pour le jeu. Lis art/SPEC.md pour les noms de fichiers attendus.

    python3 art/ingest.py            # lit art/sources/, écrit art/ronaldo.png|json et art/fans.png|json

Pour chaque image source : détection du fond uni (couleur des coins) et découpe par
chroma key, recadrage au contenu, réduction à la hauteur cible avec un rééchantillonnage
« boîte » puis quantification de la palette (le résultat reste du pixel art net), contour
sombre de 1 px, puis empilement dans une planche avec un fichier JSON d'ancrage.
"""
import json
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'sources')
RONALDO_POSES = ['siuuu', 'good', 'bad', 'jumpBack', 'jumpSide', 'jumpFront', 'run1', 'run2', 'crouch', 'fail1', 'fail2', 'idle']
RONALDO_HEIGHT = 96   # hauteur du personnage debout, en pixels du jeu (écran 640 × 360)
FAN_HEIGHT = 36       # hauteur d'un supporter (tête + buste), poses idle/up
OUTLINE = (19, 17, 28, 255)
MAX_COLOURS = 24


def key_out_background(im, tolerance=40):
    """Rend transparent le fond uni (couleur médiane des quatre coins)."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    if min(c[3] for c in corners) < 128:
        return im  # déjà transparent
    out = Image.new('RGBA', im.size)
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            op[x, y] = (r, g, b, 0) if d < tolerance else (r, g, b, a)
    return out


def crop_to_content(im):
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def shrink(im, target_h):
    """Réduction nette : rééchantillonnage boîte, puis seuil de l'alpha."""
    w, h = im.size
    scale = target_h / h
    tw = max(1, round(w * scale))
    small = im.resize((tw, target_h), Image.BOX)
    px = small.load()
    for y in range(target_h):
        for x in range(tw):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a >= 128 else 0)
    return small


def quantize(im, colours=MAX_COLOURS):
    rgb = im.convert('RGB').quantize(colors=colours, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGBA')
    rgb.putalpha(im.getchannel('A'))
    return rgb


def outline(im):
    w, h = im.size
    out = Image.new('RGBA', (w + 2, h + 2))
    out.paste(im, (1, 1), im)
    src = out.load()
    res = out.copy()
    dst = res.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w + 2 and 0 <= ny < h + 2 and src[nx, ny][3]:
                    dst[x, y] = OUTLINE
                    break
    return res


def prepare(path, target_h):
    im = Image.open(path)
    im = key_out_background(im)
    im = crop_to_content(im)
    im = shrink(im, target_h)
    im = quantize(im)
    im = outline(im)
    return im


def pack(frames, out_png, out_json, meta):
    """frames : liste de (nom, image, ancre_x, ancre_y). Planche sur une ligne, cellules collées."""
    if not frames:
        return False
    cell_h = max(f[1].size[1] for f in frames)
    total_w = sum(f[1].size[0] for f in frames)
    sheet = Image.new('RGBA', (total_w, cell_h))
    index = {}
    x = 0
    for name, im, ax, ay in frames:
        sheet.paste(im, (x, cell_h - im.size[1]))
        index[name] = {'x': x, 'y': cell_h - im.size[1], 'w': im.size[0], 'h': im.size[1], 'ax': ax, 'ay': ay}
        x += im.size[0]
    sheet.save(out_png, optimize=True)
    with open(out_json, 'w') as f:
        json.dump({**meta, 'frames': index}, f, indent=1)
    print(f'{out_png} : {len(frames)} images, {sheet.size[0]}×{sheet.size[1]}')
    return True


def main():
    os.makedirs(SRC, exist_ok=True)
    files = {f.lower(): f for f in os.listdir(SRC)}
    # Ronaldo : ronaldo-<pose>.png, pieds en bas de l'image, ancre = milieu bas
    frames = []
    for pose in RONALDO_POSES:
        name = f'ronaldo-{pose.lower()}.png'
        if name not in files:
            continue
        lying = pose.startswith('fail')
        im = prepare(os.path.join(SRC, files[name]), RONALDO_HEIGHT // 2 if lying else RONALDO_HEIGHT)
        frames.append((pose, im, im.size[0] // 2, im.size[1] - 1))
    if pack(frames, os.path.join(HERE, 'ronaldo.png'), os.path.join(HERE, 'ronaldo.json'), {'kind': 'ronaldo', 'height': RONALDO_HEIGHT}):
        missing = [p for p in RONALDO_POSES if f'ronaldo-{p.lower()}.png' not in files]
        if missing:
            print('  poses manquantes (repli sur le dessin au code) :', ', '.join(missing))
    # Supporters : fan-<nn>-idle.png et fan-<nn>-up.png
    fans = []
    ids = sorted({f[4:6] for f in files if f.startswith('fan-') and len(f) > 6})
    for i in ids:
        for pose in ('idle', 'up'):
            name = f'fan-{i}-{pose}.png'
            if name in files:
                im = prepare(os.path.join(SRC, files[name]), FAN_HEIGHT)
                fans.append((f'{i}-{pose}', im, im.size[0] // 2, im.size[1] - 1))
    pack(fans, os.path.join(HERE, 'fans.png'), os.path.join(HERE, 'fans.json'), {'kind': 'fans', 'height': FAN_HEIGHT, 'ids': ids})
    if not frames and not fans:
        print('Aucune image dans art/sources/. Voir art/SPEC.md.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
