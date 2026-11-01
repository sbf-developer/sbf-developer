"""Render transparent, seamless 50 fps butterfly animations for the profile.

Requires Pillow and NumPy. Run: python scripts/generate-butterflies.py
WebP preserves smooth alpha edges; README's picture element selects the ink
color for GitHub's light or dark theme. No browser scripts are required.
"""

from math import atan2, cos, sin, pi
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

WIDTH, HEIGHT, SUPERSAMPLE = 760, 280, 3
FPS, SECONDS = 50, 16
OUTPUT = Path(__file__).resolve().parents[1] / "profile"


def bezier(p0, p1, p2, p3, count=20):
    return [tuple((1-t)**3*p0[j] + 3*(1-t)**2*t*p1[j]
                  + 3*(1-t)*t*t*p2[j] + t**3*p3[j] for j in (0, 1))
            for t in np.linspace(0, 1, count)]


def curve(*segments):
    return [point for segment in segments for point in bezier(*segment)]


# Pointed forewings and scalloped hindwings, with a fine swallowtail.
WING = curve(
    ((1, -5), (10, -23), (31, -47), (42, -45)),
    ((42, -45), (47, -28), (43, -12), (28, 0)),
    ((28, 0), (31, 3), (34, 5), (32, 10)),
    ((32, 10), (30, 13), (33, 17), (28, 20)),
    ((28, 20), (25, 20), (28, 25), (23, 26)),
    ((23, 26), (19, 26), (18, 35), (16, 41)),
    ((16, 41), (13, 37), (14, 30), (11, 28)),
    ((11, 28), (5, 29), (2, 20), (1, 13)),
    ((1, 13), (0, 6), (0, 0), (1, -5)),
)
VEINS = [bezier(*s) for s in [
    ((1, -3), (10, -17), (27, -35), (40, -42)),
    ((1, -3), (14, -12), (31, -25), (43, -29)),
    ((1, -2), (15, -8), (27, -15), (39, -16)),
    ((1, -1), (10, -3), (22, -6), (30, -2)),
    ((1, 3), (10, 3), (24, 3), (31, 8)),
    ((1, 4), (10, 8), (22, 13), (28, 19)),
    ((1, 6), (9, 14), (15, 19), (20, 27)),
    ((1, 7), (4, 18), (10, 24), (13, 28)),
]]
MARGIN = curve(
    ((9, -13), (20, -29), (33, -40), (38, -39)),
    ((38, -39), (42, -24), (35, -13), (27, -7)),
)
ANTENNA = bezier((0, -12), (1, -20), (5, -24), (8, -22), 16)

# Position derivatives determine orientation: each butterfly faces its flight.
FLOCK = [
    (122, 116, 74, 49, .87, .20, 1, 33),
    (290, 102, 95, 47, .69, 1.70, -1, 37),
    (466, 113, 94, 53, .98, 3.20, 1, 31),
    (637, 124, 67, 49, .76, 4.50, -1, 39),
    (180, 205, 83, 26, .55, 3.70, 1, 43),
    (372, 205, 87, 25, .64, 5.30, -1, 35),
    (574, 208, 83, 26, .57, .90, 1, 41),
]


def butterfly(draw, x, y, size, heading, flap, bank):
    ca, sa = cos(heading+pi/2), sin(heading+pi/2)

    def transform(points, side=1, fold=1, lag=0):
        result = []
        for px, py in points:
            bend = lag*max(py, 0)/40
            px, py = px*side*fold*size, (py+bend)*size
            result.append(((x+ca*px-sa*py)*SUPERSAMPLE,
                           (y+sa*px+ca*py)*SUPERSAMPLE))
        return result

    def line(points, opacity, weight=1):
        draw.line(points, fill=round(255*opacity),
                  width=max(1, round(weight*SUPERSAMPLE*size)), joint="curve")

    # Far wing first; turns foreshorten one wing, and hindwings flex with a lag.
    for side in sorted((-1, 1), key=lambda s: s*bank):
        phase = flap + side*bank*.45
        opening = .17 + .83*(.5+.5*cos(phase))**.63
        fold = opening*(1-side*bank*.17)
        lag = 3.2*sin(phase-.5)
        wing = transform(WING, side, fold, lag)
        draw.polygon(wing, fill=13)
        line(wing+[wing[0]], .82, .86)
        for vein in VEINS:
            line(transform(vein, side, fold, lag), .37, .46)
        line(transform(MARGIN, side, fold, lag), .32, .43)
        line(transform(ANTENNA, side), .74, .60)
        for px, py, r in ((37, -30, 1.1), (35, -22, 1), (31, -15, .9),
                          (26, -8, .8), (26, 10, 1.3), (23, 18, 1.1)):
            cx, cy = transform([(px, py)], side, fold, lag)[0]
            r *= size*SUPERSAMPLE
            draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=137)

    line(transform([(0, -12), (0, -4), (0, 9), (0, 23)]), .91, 1.7)
    line(transform([(-1, -3), (-2, 5), (0, 10), (2, 5), (1, -3)]), .7, .8)
    cx, cy = transform([(0, -12)])[0]
    r = 1.7*size*SUPERSAMPLE
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=235)


def render_alpha(time):
    mask = Image.new("L", (WIDTH*SUPERSAMPLE, HEIGHT*SUPERSAMPLE), 0)
    draw = ImageDraw.Draw(mask)
    a = time/SECONDS*2*pi
    for cx, cy, rx, ry, scale, phase, direction, beats in FLOCK:
        base = direction*a+phase
        theta = base+.18*sin(2*base)
        velocity = direction*(1+.36*cos(2*base))
        x = cx+rx*cos(theta)+5*sin(2*theta+phase)
        y = cy+ry*sin(theta)+3*sin(3*theta+phase)
        dx = (-rx*sin(theta)+10*cos(2*theta+phase))*velocity
        dy = (ry*cos(theta)+9*cos(3*theta+phase))*velocity
        heading = atan2(dy, dx)
        flap = beats*a+phase+.16*sin(2*base)
        depth = .94+.06*sin(theta+phase)
        y += .85*sin(flap)
        bank = .58*sin(theta)+.16*sin(2*theta+phase)
        butterfly(draw, x, y, scale*depth, heading, flap, bank)
    mask = mask.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    # 32 alpha levels retain smooth edges while keeping the animation compact.
    return mask.point([round(round(v/255*31)/31*255) for v in range(256)])


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    masks = [render_alpha(i/FPS) for i in range(FPS*SECONDS)]
    for theme, ink in (("light", (38, 47, 57)), ("dark", (220, 225, 231))):
        frames = []
        for mask in masks:
            frame = Image.new("RGBA", (WIDTH, HEIGHT), (*ink, 0))
            frame.putalpha(mask)
            frames.append(frame)
        target = OUTPUT/f"butterflies-{theme}.webp"
        frames[0].save(target, save_all=True, append_images=frames[1:],
                       duration=1000//FPS, loop=0, lossless=True, method=4,
                       background=(0, 0, 0, 0), minimize_size=True, exact=True)
        print(f"{target.name}: {len(frames)} frames, {target.stat().st_size:,} bytes",
              flush=True)


if __name__ == "__main__":
    main()
