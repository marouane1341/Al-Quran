#!/usr/bin/env python3
"""Dessine les icônes (bleu nuit et or : arche, médaillon en losange, étoile à huit branches), comme l'icône Android."""
from PIL import Image, ImageDraw

NAVY, GOLD, DEEP = (11, 27, 58), (217, 177, 90), (19, 41, 79)

def draw(size, pad):
    k = 4  # sur-échantillonnage pour des bords lisses
    S = size * k
    im = Image.new("RGB", (S, S), NAVY)
    d = ImageDraw.Draw(im)
    # Repère sur 108 unités, zone utile centrée (comme l'icône adaptative Android).
    scale = S / 108.0 * (1 - 2 * pad)
    off = S * pad
    def P(x, y): return (off + x * scale, off + y * scale)
    def line(pts, w, close=True):
        pts = [P(*p) for p in pts]
        if close: pts.append(pts[0])
        d.line(pts, fill=GOLD, width=max(1, int(w * scale)), joint="curve")
    def poly(pts, fill, outline=None, w=1):
        d.polygon([P(*p) for p in pts], fill=fill)
        if outline: line(pts, w)
    def bez(p0, p1, p2, p3, n=24):
        out = []
        for i in range(n + 1):
            t = i / n; u = 1 - t
            out.append((u**3*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t**3*p3[0], u**3*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t**3*p3[1]))
        return out
    def arch(x0, x1, ybot, ytop_side, ytip, tipx, w):
        left = [(x0, ybot), (x0, ytop_side)]
        a = bez((x0, ytop_side), (x0, ytop_side - 10), (x0 + 14, ytip + 15), (tipx, ytip))
        b = bez((tipx, ytip), (x1 - 14, ytip + 15), (x1, ytop_side - 10), (x1, ytop_side))
        line(left[:1] + a + b + [(x1, ybot)], w)
    line([(22, 18), (86, 18), (86, 90), (22, 90)], 1.4)
    line([(25.5, 21.5), (82.5, 21.5), (82.5, 86.5), (25.5, 86.5)], 0.6)
    arch(31, 77, 82, 56, 27, 54, 1.0)
    arch(34, 74, 80, 56.5, 32, 54, 0.5)
    poly([(54, 22), (57, 26.5), (54, 31), (51, 26.5)], GOLD)
    poly([(54, 78), (57.5, 83), (54, 88), (50.5, 83)], GOLD)
    poly([(54, 38), (69, 57), (54, 76), (39, 57)], DEEP, True, 1.2)
    cx, cy, r = P(54, 57)[0], P(54, 57)[1], 10 * scale
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=GOLD, width=max(1, int(0.8 * scale)))
    poly([(49, 52), (59, 52), (59, 62), (49, 62)], GOLD)
    poly([(54, 49.2), (61.8, 57), (54, 64.8), (46.2, 57)], GOLD)
    r2 = 3 * scale
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=DEEP)
    return im.resize((size, size), Image.LANCZOS)

import os
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(here, exist_ok=True)
draw(180, 0.0).save(os.path.join(here, "apple-touch-icon.png"))
draw(192, 0.0).save(os.path.join(here, "icon-192.png"))
draw(512, 0.0).save(os.path.join(here, "icon-512.png"))
print("ok")
