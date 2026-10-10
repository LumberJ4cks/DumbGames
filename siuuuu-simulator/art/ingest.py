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
RONALDO_POSES = ['siuuu', 'good', 'bad', 'jumpBack', 'jumpSide', 'jumpFront', 'run1', 'run2', 'run3', 'run4', 'crouch', 'fail1', 'fail2', 'idle']
# Poses fabriquées à partir d'une autre quand la source manque : (pose, source, transformation)
DERIVED = [('idle', 'siuuu', 'same'), ('crouch', 'run4', 'same'), ('run3', 'run1', 'same'), ('run4', 'run2', 'same'), ('bad', 'good', 'lean'), ('fail1', 'run2', 'lie'), ('fail2', 'jumpBack', 'lieBack')]
RONALDO_HEIGHT = 88   # hauteur de la pose SIUUU debout, en pixels du jeu (écran 640 × 360)
FAN_HEIGHT = 36       # hauteur d'un supporter (tête + buste), poses idle/up
OUTLINE = (19, 17, 28, 255)
MAX_COLOURS = 24


def key_out_background(im, tolerance=60):
    """Rend transparent le fond uni : la couleur des coins, mais seulement les zones reliées au
    bord de l'image, pour garder un blanc ou un vert à l'intérieur du personnage."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    if min(c[3] for c in corners) < 128:
        # déjà transparent : on durcit l'alpha (pas de demi-transparence en pixel art)
        alpha = im.getchannel('A').point(lambda v: 255 if v > 16 else 0)
        im.putalpha(alpha)
        return im
    bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    near = lambda p: abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) < tolerance
    seen = bytearray(w * h)
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x] or not near(px[x, y]):
            continue
        seen[y * w + x] = 1
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    out = im.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            if seen[y * w + x]:
                r, g, b, _ = px[x, y]
                op[x, y] = (r, g, b, 0)
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


def load_source(path):
    return crop_to_content(key_out_background(Image.open(path)))


def finish(im, target_h):
    """Réduction à la hauteur donnée, palette, contour."""
    return outline(quantize(shrink(im, max(1, round(target_h)))))


def derive(src, how):
    """Transformation d'une image source (pleine résolution) pour fabriquer une pose manquante."""
    if how == 'same':
        return src
    if how == 'lean':
        w, h = src.size
        k = 0.18
        out = src.transform((w + int(h * k), h), Image.AFFINE, (1, -k, 0, 0, 1, 0), Image.NEAREST)
        return crop_to_content(out)
    if how == 'lie':
        return crop_to_content(src.rotate(90, expand=True))
    if how == 'lieBack':
        return crop_to_content(src.rotate(-90, expand=True))
    return src


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
    # Ronaldo : ronaldo-<pose>.png, pieds en bas de l'image, ancre = milieu bas. Toutes les
    # poses partagent la même échelle (la plus haute pose debout fait RONALDO_HEIGHT px).
    sources = {}
    for pose in RONALDO_POSES:
        name = f'ronaldo-{pose.lower()}.png'
        if name in files:
            sources[pose] = load_source(os.path.join(SRC, files[name]))
    derived = []
    for pose, base, how in DERIVED:
        if pose not in sources and base in sources:
            sources[pose] = derive(sources[base], how)
            derived.append(pose)
    frames = []
    if sources:
        # l'échelle commune est calée sur une pose debout (siuuu, sinon good, sinon la première)
        ref = sources.get('siuuu') or sources.get('good') or sources[next(iter(sources))]
        scale = RONALDO_HEIGHT / ref.size[1]
        for pose in RONALDO_POSES:
            if pose not in sources:
                continue
            im = finish(sources[pose], sources[pose].size[1] * scale)
            frames.append((pose, im, im.size[0] // 2, im.size[1] - 1))
    if pack(frames, os.path.join(HERE, 'ronaldo.png'), os.path.join(HERE, 'ronaldo.json'), {'kind': 'ronaldo', 'height': RONALDO_HEIGHT}):
        if derived:
            print('  poses fabriquées à partir des autres :', ', '.join(derived))
        missing = [p for p in RONALDO_POSES if p not in sources]
        if missing:
            print('  poses manquantes (repli sur le dessin au code) :', ', '.join(missing))
    # Supporters : fan-<nn>-idle.png et fan-<nn>-up.png
    fans = []
    ids = sorted({f[4:6] for f in files if f.startswith('fan-') and len(f) > 6})
    for i in ids:
        for pose in ('idle', 'up'):
            name = f'fan-{i}-{pose}.png'
            if name in files:
                im = finish(load_source(os.path.join(SRC, files[name])), FAN_HEIGHT)
                fans.append((f'{i}-{pose}', im, im.size[0] // 2, im.size[1] - 1))
    pack(fans, os.path.join(HERE, 'fans.png'), os.path.join(HERE, 'fans.json'), {'kind': 'fans', 'height': FAN_HEIGHT, 'ids': ids})
    if not frames and not fans:
        print('Aucune image dans art/sources/. Voir art/SPEC.md.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
