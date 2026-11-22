# /// script
# requires-python = ">=3.11"
# dependencies = ["manim>=0.20.1,<0.23"]
# ///
"""Bake a Manim pen stroke and an operand's curved flight for matrix calculations.

Run from the repository root: uv run examples/neural-network/qkv-pen.py
The browser scales these unit paths to the locations of the live matrix entries.
"""
import json
from pathlib import Path
import sys

import numpy as np
from manim import Create, CubicBezier, Dot, MoveAlongPath, VMobject, smooth

SKILL_DIR = Path(__file__).resolve().parents[2] / "skills" / "manim-blackboard"
sys.path.insert(0, str(SKILL_DIR / 'scripts'))
from blackboard import svg_path


def sample():
    border = VMobject().set_points_as_corners([
        [0, 0, 0], [1, 0, 0], [1, -1, 0], [0, -1, 0], [0, 0, 0]
    ])
    route = CubicBezier(*[np.array(p) for p in (
        [0, 0, 0], [.19, 1, 0], [.74, 1, 0], [1, 0, 0]
    )])
    mark = Dot(route.get_start(), radius=.012)
    move = MoveAlongPath(mark, route, rate_func=smooth)
    write = Create(border, rate_func=smooth)
    move.begin()
    write.begin()
    arc, outline = [], []
    for tick in range(49):
        t = tick / 48
        move.interpolate(t)
        write.interpolate(t)
        arc.append([round(float(v), 5) for v in mark.get_center()[:2]])
        outline.append(svg_path(border))
    move.finish()
    write.finish()
    return {'arc': arc, 'outline': outline}


if __name__ == '__main__':
    Path(__file__).with_suffix('.json').write_text(json.dumps(sample(), separators=(',', ':')) + '\n')
