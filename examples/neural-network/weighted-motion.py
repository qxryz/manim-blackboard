# /// script
# requires-python = ">=3.12"
# dependencies = ["manim==0.22.1"]
# ///
"""Regenerate the number-line strokes, network signals, and matrix operand transfers with Manim Community Edition.

From the repository root: uv run examples/neural-network/weighted-motion.py
"""
import json
from pathlib import Path
import sys

import numpy as np
from manim import Create, Dot, MoveAlongPath, VMobject, smooth

SKILL_DIR = Path(__file__).resolve().parents[2] / "skills" / "manim-blackboard"
sys.path.insert(0, str(SKILL_DIR / "scripts"))
from blackboard import svg_path


def sweep(start, end, height):
    """Draw a single Bézier arc and move the marker along it in sync."""
    def point(x, y):
        return np.array([x, y, 0.0])

    route = VMobject()
    route.start_new_path(point(start, 0))
    route.add_cubic_bezier_curve_to(point(start, height), point(end, height), point(end, 0))
    mark = Dot(point(start, 0))
    drawing = Create(route.copy(), rate_func=smooth)
    moving = MoveAlongPath(mark, route, rate_func=smooth)
    drawing.begin()
    moving.begin()
    frames = []
    for tick in range(25):
        drawing.interpolate(tick / 24)
        moving.interpolate(tick / 24)
        x, y, _ = mark.get_center()
        frames.append([svg_path(drawing.mobject), round(float(x), 4), round(float(-y), 4)])
    drawing.finish()
    moving.finish()
    return frames


def travel(bend):
    """Sample the pen tip of a directed edge or a curved operand transfer in SVG coordinates."""
    start, end = np.array([0, 0, 0.]), np.array([1, 0, 0.])
    route = VMobject()
    route.start_new_path(start)
    route.add_cubic_bezier_curve_to([.24, bend, 0], [.76, bend, 0], end)
    mark = Dot(start)
    moving = MoveAlongPath(mark, route, rate_func=smooth)
    moving.begin()
    frames = []
    for tick in range(41):
        moving.interpolate(tick / 40)
        x, y, _ = mark.get_center()
        frames.append([round(float(x), 5), round(float(-y), 5)])
    moving.finish()
    return frames


if __name__ == "__main__":
    samples = {
        "sweeps": [sweep(0, 2, .86), sweep(2, 4, .86), sweep(4, 2, -.86)],
        "edge": travel(0),
        "copy": travel(.24),
    }
    output = Path(__file__).with_name("forward-motion.json")
    output.write_text(json.dumps(samples, separators=(",", ":")) + "\n", encoding="utf-8")
