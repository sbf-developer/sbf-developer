"""Render a seamless, 50 fps butterfly study. Requires Pillow and NumPy.

Run from the repository root: python scripts/generate-butterflies.py
The generated GIF works in a GitHub README without scripts or external services.
"""

from math import cos, sin, pi
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

WIDTH, HEIGHT, SUPERSAMPLE = 760, 300, 2
FPS, SECONDS = 50, 12
BACKGROUND = (13, 17, 23)
OUTPUT = Path(__file__).resolve().parents[1] / "profile" / "butterflies.gif"


def bezier(p0, p1, p2, p3, count=22):
    return [tuple((1-t)**3*p0[j] + 3*(1-t)**2*t*p1[j]
                  + 3*(1-t)*t*t*p2[j] + t**3*p3[j] for j in (0, 1))
            for t in np.linspace(0, 1, count)]


def curve(*segments):
    return [point for segment in segments for point in bezier(*segment)]


WING = curve(
    ((1, -3), (8, -17), (27, -36), (36, -28)),
    ((36, -28), (49, -20), (42, -3), (24, 5)),
    ((24, 5), (39, 9), (31, 30), (20, 31)),
    ((20, 31), (16, 31), (16, 39), (12, 37)),
    ((12, 37), (9, 35), (9, 29), (6, 27)),
    ((6, 27), (1, 23), (0, 9), (1, -3)),
)

# Curves radiating from the thorax form the wing's fine venation.
VEINS = [
    ((1, 0), (9, -13), (22, -29), (34, -28)),
    ((1, 0), (13, -9), (31, -18), (41, -17)),
    ((1, 0), (14, -3), (28, -8), (37, -6)),
    ((2, 3), (10, 4), (18, 4), (24, 5)),
    ((1, 5), (12, 9), (24, 9), (30, 13)),
    ((1, 5), (8, 15), (19, 22), (23, 29)),
    ((1, 6), (4, 18), (9, 23), (12, 32)),
]
VEINS = [bezier(*segment) for segment in VEINS]
INNER = curve(
    ((7, -7), (16, -20), (29, -30), (34, -23)),
    ((34, -23), (41, -16), (30, -3), (20, 0)),
)
ANTENNA = bezier((0, -10), (1, -17), (4, -21), (7, -19), 16)

# Independent phase, orbit and scale keep the movement organic and repeatable.
FLOCK = [
    (113, 110, 63, 46, .84, .1, 1, 17),
    (292, 112, 80, 54, .66, 1.4, -1, 21),
    (472, 115, 66, 47, .92, 2.8, 1, 19),
    (646, 130, 57, 61, .73, 4.3, -1, 23),
    (182, 204, 62, 38, .54, 3.8, 1, 25),
    (365, 207, 74, 35, .61, 5.2, -1, 22),
    (565, 215, 70, 30, .49, .9, 1, 26),
]


def butterfly(draw, x, y, size, heading, flap, brightness):
    angle = heading + pi/2
    ca, sa = cos(angle), sin(angle)

    def transform(points, side=1, fold=1):
        out = []
        for px, py in points:
            px, py = px * side * fold * size, py * size
            out.append(((x + ca*px - sa*py)*SUPERSAMPLE,
                        (y + sa*px + ca*py)*SUPERSAMPLE))
        return out

    def color(level):
        return tuple(round(a+(230-a)*level*brightness) for a in BACKGROUND)

    # The slight asymmetry suggests banking rather than two rigid flat wings.
    for side in (-1, 1):
        fold = .20 + .80 * (.5 + .5*sin(flap + side*.14))**.8
        wing = transform(WING, side, fold)
        draw.polygon(wing, fill=color(.055))
        draw.line(wing+[wing[0]], fill=color(.78), width=SUPERSAMPLE,
                  joint="curve")
        for vein in VEINS:
            draw.line(transform(vein, side, fold), fill=color(.34), width=1,
                      joint="curve")
        draw.line(transform(INNER, side, fold), fill=color(.26), width=1)
        draw.line(transform(ANTENNA, side), fill=color(.65), width=1)
        # A few restrained markings along the wing edge.
        for px, py, radius in ((33, -18, 1.3), (29, -10, 1.1),
                               (25, -3, .9), (23, 15, 1.2), (18, 24, 1)):
            cx, cy = transform([(px, py)], side, fold)[0]
            r = radius*size*SUPERSAMPLE
            draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=color(.48))

    draw.line(transform([(0, -9), (0, 7), (0, 20)]),
              fill=color(.86), width=max(1, round(1.7*size*SUPERSAMPLE)))
    cx, cy = transform([(0, -10)])[0]
    r = 1.6*size*SUPERSAMPLE
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=color(.9))


def render(time):
    image = Image.new("RGB", (WIDTH*SUPERSAMPLE, HEIGHT*SUPERSAMPLE), BACKGROUND)
    draw = ImageDraw.Draw(image)
    a = time / SECONDS * 2*pi
    for cx, cy, rx, ry, scale, phase, direction, beats in FLOCK:
        theta = direction*a + phase
        x = cx + rx*sin(theta)
        y = cy + ry*sin(2*theta)*.70
        # A constant forward component avoids an abrupt half-turn at an orbit's tip.
        heading = -.35 + .45*sin(theta) + .12*sin(2*theta+phase)
        depth = .92 + .08*cos(theta)
        butterfly(draw, x, y, scale*depth, heading,
                  beats*a + phase, .74 + .20*depth)
    return image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    # A fixed palette prevents flickering. GIF timing is exactly 20 ms per frame.
    palette = Image.new("P", (1, 1))
    colors = []
    for i in range(64):
        colors.extend(round(a+(240-a)*i/63) for a in BACKGROUND)
    palette.putpalette(colors + [0]*(768-len(colors)))
    frames = [render(i/FPS).quantize(palette=palette,
              dither=Image.Dither.NONE) for i in range(FPS*SECONDS)]
    frames[0].save(OUTPUT, save_all=True, append_images=frames[1:],
                   duration=1000//FPS, loop=0, optimize=True, disposal=1)
    print(f"Rendered {len(frames)} frames: {OUTPUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
