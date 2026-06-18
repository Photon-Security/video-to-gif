#!/usr/bin/env python3
"""
Strip the outer white background from assets/Icon.png by flood-filling from
the four corners. Pixels reachable from the edges that are within `tolerance`
of pure white become transparent; interior whites (eyes, highlights, etc.)
are left intact.

Writes a 1254x1254 RGBA PNG to assets/icons/icon-source.png.
"""

import sys
from collections import deque
from PIL import Image

SRC = "assets/Icon.png"
DST = "assets/icons/icon-source.png"
TOLERANCE = 12  # 0-255, how close to white a pixel must be to count as background


def is_near_white(px, tol=TOLERANCE):
    r, g, b = px[0], px[1], px[2]
    return r >= 255 - tol and g >= 255 - tol and b >= 255 - tol


def main():
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    pixels = img.load()

    visited = bytearray(w * h)
    queue = deque()

    # Seed the queue with every edge pixel that is near-white.
    def seed(x, y):
        idx = y * w + x
        if visited[idx]:
            return
        if is_near_white(pixels[x, y]):
            visited[idx] = 1
            queue.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    # Flood fill 4-connected.
    while queue:
        x, y = queue.popleft()
        # Mark this pixel transparent.
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if not visited[nidx] and is_near_white(pixels[nx, ny]):
                    visited[nidx] = 1
                    queue.append((nx, ny))

    img.save(DST, "PNG", optimize=True)
    print(f"wrote {DST} ({w}x{h}, RGBA)")


if __name__ == "__main__":
    sys.exit(main())
