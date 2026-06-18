#!/usr/bin/env python3
"""
Strip the outer near-white background from a PNG by flood-filling from the
four corners. Pixels reachable from the edges that are within `tolerance` of
pure white become transparent; interior whites (eyes, highlights, etc.) are
left intact.

Usage: strip-icon-bg.py <input.png> <output.png> [tolerance]
       tolerance defaults to 12 (0-255). Higher = more aggressive.
"""

import sys
from collections import deque
from PIL import Image


def is_near_white(px, tol):
    return px[0] >= 255 - tol and px[1] >= 255 - tol and px[2] >= 255 - tol


def strip_bg(src_path, dst_path, tolerance=12):
    img = Image.open(src_path).convert("RGBA")
    w, h = img.size
    pixels = img.load()

    visited = bytearray(w * h)
    queue = deque()

    def seed(x, y):
        idx = y * w + x
        if not visited[idx] and is_near_white(pixels[x, y], tolerance):
            visited[idx] = 1
            queue.append((x, y))

    for x in range(w):
        seed(x, 0); seed(x, h - 1)
    for y in range(h):
        seed(0, y); seed(w - 1, y)

    while queue:
        x, y = queue.popleft()
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if not visited[nidx] and is_near_white(pixels[nx, ny], tolerance):
                    visited[nidx] = 1
                    queue.append((nx, ny))

    img.save(dst_path, "PNG", optimize=True)
    total = w * h
    transparent = sum(1 for v in visited if v)
    print(f"wrote {dst_path} ({w}x{h}, RGBA, {transparent:,}/{total:,} px transparent = {100*transparent/total:.1f}%)")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    src = sys.argv[1]
    dst = sys.argv[2]
    tol = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    strip_bg(src, dst, tol)
