#!/usr/bin/env python3
"""
Throwaway: turn the owner's raw mascot PNGs (in /Mascot at the repo root) into
web-ready, transparent, trimmed, small PNGs in public/mascot/.

Per image:
  1. load as RGBA, downscale to a working size,
  2. flood-fill the BACKGROUND to transparent from the image edges (connected
     region only, so interior whites like eyes/teeth/highlights are preserved),
  3. auto-crop to the character's bounding box,
  4. resize so the longest side is ~600px,
  5. save an optimized PNG.

Run from repo root:  python3 scripts/process-mascot.py
"""
import colorsys
import os
from collections import deque

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = "Mascot"
OUT = "public/mascot"
WORK = 1200          # working resolution for the flood-fill pass
FINAL = 600          # longest side of the output
THRESH_DEFAULT = 48  # colour distance counted as "same as background"

# Recolour the character's violet body/outline to this colour (shading kept).
# Set RECOLOR = None to skip and use the original purple art.
RECOLOR = "#B388FF"

# Drop opaque islands smaller than this fraction of the frame (stray specks /
# watermark bits) before cropping, so the crop hugs the real character + props.
MIN_ISLAND_FRAC = 0.004


def _hex(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def recolor(im: Image.Image, target_hex: str) -> Image.Image:
    """Shift only the violet pixels (body, limbs, outline) to `target_hex`,
    keeping each pixel's brightness so shading survives. Reds/greens/yellows
    (hearts, leaf, star, cheeks) and near-greys (eyes) are left alone."""
    im = im.convert("RGBA")
    alpha = im.getchannel("A")
    hsv = np.asarray(im.convert("RGB").convert("HSV")).astype(np.int16)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]  # each 0–255

    tr, tg, tb = _hex(target_hex)
    th, ts, _tv = colorsys.rgb_to_hsv(tr / 255, tg / 255, tb / 255)
    th255, ts255 = int(th * 255), int(ts * 255)

    # violet hue band (~215°–290°) and saturated enough to be "the character"
    mask = (H >= 150) & (H <= 205) & (S >= 64)
    H[mask] = th255
    S[mask] = ts255  # keep V (brightness) → shading preserved

    out = np.stack([H, S, V], axis=-1).astype("uint8")
    rgb = Image.fromarray(out, "HSV").convert("RGB").convert("RGBA")
    rgb.putalpha(alpha)
    return rgb

# source filename -> (output name, threshold override)
JOBS = {
    "Welcome.png": ("welcome.png", THRESH_DEFAULT),
    "happy.png":   ("happy.png",   THRESH_DEFAULT),
    "Sad.png":     ("sad.png",     THRESH_DEFAULT),
    "angry.png":   ("angry.png",   THRESH_DEFAULT),
    "annoyed.png": ("annoyed.png", 70),  # solid maroon bg, needs a wider tolerance
}


def dist2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def remove_bg(im: Image.Image, thresh: int) -> Image.Image:
    """Flood-fill from every border pixel, clearing alpha on the connected
    background region within `thresh` colour distance of its neighbours."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    t2 = thresh * thresh

    visited = bytearray(w * h)
    q = deque()

    # seed from the whole border
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if visited[i]:
            continue
        visited[i] = 1
        r, g, b, a = px[x, y]
        if a == 0:
            # already transparent — keep spreading through it
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
            continue
        # compare against the nearest already-cleared neighbour's ORIGINAL colour
        # by using a fixed reference: the corner background colour.
        if dist2((r, g, b), BG) <= t2:
            px[x, y] = (r, g, b, 0)
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def remove_small_islands(im: Image.Image, min_frac: float) -> Image.Image:
    """Clear the alpha of small disconnected opaque blobs (stray specks /
    leftover watermark bits), keeping the character and large props (hearts,
    star, moon, clouds)."""
    arr = np.array(im)  # RGBA
    alpha = arr[..., 3]
    mask = alpha > 16
    lbl, n = ndimage.label(mask)
    if n <= 1:
        return im
    counts = np.bincount(lbl.ravel())
    counts[0] = 0  # label 0 is the transparent background
    thr = max(700, int(min_frac * mask.size))
    keep = counts >= thr
    arr[..., 3] = np.where(keep[lbl], alpha, 0)
    return Image.fromarray(arr, "RGBA")


def process(src_name, out_name, thresh):
    global BG
    path = os.path.join(SRC, src_name)
    im = Image.open(path).convert("RGBA")

    if RECOLOR:
        im = recolor(im, RECOLOR)

    # working downscale
    im.thumbnail((WORK, WORK), Image.LANCZOS)

    # background reference = average of the four corners
    w, h = im.size
    px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    BG = tuple(sum(c[k] for c in corners) // 4 for k in range(3))

    im = remove_bg(im, thresh)
    im = remove_small_islands(im, MIN_ISLAND_FRAC)

    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    im.thumbnail((FINAL, FINAL), Image.LANCZOS)

    os.makedirs(OUT, exist_ok=True)
    out_path = os.path.join(OUT, out_name)
    im.save(out_path, "PNG", optimize=True)
    kb = os.path.getsize(out_path) // 1024
    print(f"{src_name:14s} -> {out_path:28s} {im.size}  bg={BG}  {kb}KB")


if __name__ == "__main__":
    for src, (out, th) in JOBS.items():
        process(src, out, th)
