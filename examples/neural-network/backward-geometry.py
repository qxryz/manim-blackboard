# /// script
# requires-python = ">=3.12"
# dependencies = ["manim==0.22.1"]
# ///
"""Bake the loss curve, shrinking secant and carried gradient with Manim CE."""
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

import numpy as np
from manim import (
    Create, CubicBezier, Dot, Line, MoveAlongPath, Text, Transform,
    UpdateFromAlphaFunc, VGroup, register_font, smooth, tempconfig,
)

SKILL_DIR = Path(__file__).resolve().parents[2] / "skills" / "manim-blackboard"
sys.path.insert(0, str(SKILL_DIR / 'scripts'))
from blackboard import svg_path


def at(x, y):
    return np.array([x, -y, 0.0])


def chart(x, loss):
    return at(61 + (x + .5) * 154, 286 - loss * 155)


def timeline(animation, capture, ticks=48):
    animation.begin()
    frames = []
    for i in range(ticks + 1):
        animation.interpolate(i / ticks)
        frames.append(capture())
    animation.finish()
    return frames


def coordinates(point):
    return [round(float(point[0]), 3), round(float(-point[1]), 3)]


def bake():
    lo, hi = -.45, 2.59
    loss = lambda x: (x - 1) ** 2 / 2
    delta = (hi - lo) / 3
    curve = CubicBezier(
        chart(lo, loss(lo)), chart(lo + delta, loss(lo) + delta * (lo - 1)),
        chart(hi - delta, loss(hi) - delta * (hi - 1)), chart(hi, loss(hi)))
    drawing = timeline(Create(curve, rate_func=smooth), lambda: svg_path(curve))
    neighbour = Dot(chart(2.54, loss(2.54)))
    secant = Line(chart(1.57, .07), chart(2.55, 1.05))

    def approach(group, progress):
        gap = .54 * (1 - smooth(progress))
        slope = 1 + gap / 2
        group[0].move_to(chart(2 + gap, loss(2 + gap)))
        group[1].put_start_and_end_on(chart(1.57, .5 - .43 * slope),
                                      chart(2.55, .5 + .55 * slope))

    closing = timeline(UpdateFromAlphaFunc(VGroup(neighbour, secant), approach), lambda: [
        *coordinates(neighbour.get_center()), *coordinates(secant.get_start()), *coordinates(secant.get_end())])
    arc = CubicBezier(at(0, 0), at(.26, -.38), at(.7, -.38), at(1, 0))
    digit = Dot(arc.get_start())
    route = timeline(MoveAlongPath(digit, arc, rate_func=smooth), lambda: coordinates(digit.get_center()))
    with TemporaryDirectory() as media, tempconfig({'media_dir': media}), register_font(SKILL_DIR / 'assets/fonts/STIXTwoText-Italic.ttf'):
        def outline(value):
            glyph = Text(value, font='STIX Two Text', slant='ITALIC')[0]
            glyph.height = 1
            return glyph.move_to([0, 0, 0])
        one, two = outline('1'), outline('2')
        morph = timeline(Transform(one, two, rate_func=smooth), lambda: svg_path(one), ticks=20)
        plus, times = outline('+'), outline('×')
        operator = timeline(Transform(plus, times, rate_func=smooth), lambda: svg_path(plus), ticks=24)
    return {'curve': drawing, 'secant': closing, 'route': route, 'digit': morph, 'operator': operator}


if __name__ == '__main__':
    Path(__file__).with_suffix('.json').write_text(json.dumps(bake(), separators=(',', ':')) + '\n')
