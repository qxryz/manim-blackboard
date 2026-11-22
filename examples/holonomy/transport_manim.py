# /// script
# requires-python = ">=3.11"
# dependencies = ["manim>=0.20.1,<0.23"]
# ///
"""Bake the three great-circle rotations and the four flat translations.

Run with Manim Community Edition, then build lesson.js with Manim Blackboard.
Coordinates here use the mathematical convention: north is positive z.
"""
import json
from pathlib import Path

import numpy as np
from manim import Line, Rotate, Transform, linear

QUARTER = np.pi / 2
SUBDIVISIONS = 32
LENGTH = 0.43


def sample(animation, arrow):
    animation.begin()
    frames = []
    for index in range(SUBDIVISIONS + 1):
        animation.interpolate(index / SUBDIVISIONS)
        position = arrow.get_start()
        direction = (arrow.get_end() - position) / LENGTH
        frames.append([[round(float(v), 9) for v in a] for a in (position, direction)])
    animation.finish()
    return frames


def build():
    x, y, z = np.identity(3)
    arrow = Line(x, x + LENGTH * z)
    sphere = []
    for axis in [z, x, y]:
        # The transport is a rigid rotation around the great circle's normal.
        rotation = Rotate(arrow, angle=QUARTER, axis=axis, about_point=np.zeros(3), rate_func=linear)
        sphere.append(sample(rotation, arrow))

    corners = np.array([[-.62, -.62, 0], [.62, -.62, 0], [.62, .62, 0], [-.62, .62, 0]])
    direction = np.array([.45, .65, 0])
    direction /= np.linalg.norm(direction)
    arrow = Line(corners[0], corners[0] + LENGTH * direction)
    plane = []
    for index, point in enumerate(corners):
        offset = corners[(index + 1) % 4] - point
        slide = Transform(arrow, arrow.copy().shift(offset), rate_func=linear)
        plane.append(sample(slide, arrow))
    return {"sphere": sphere, "plane": plane}


if __name__ == "__main__":
    destination = Path(__file__).with_name("transport-samples.json")
    destination.write_text(json.dumps(build(), separators=(",", ":")) + "\n", encoding="utf-8")
