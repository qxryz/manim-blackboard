# /// script
# requires-python = ">=3.12"
# dependencies = ["manim==0.22.1"]
# ///
"""Bake the three value-vector operations. From the repository root, run uv run examples/neural-network/mixture-manim.py."""
import json
import subprocess
import sys
from tempfile import TemporaryDirectory
from pathlib import Path

import numpy as np
from manim import (AnimationGroup, Create, Dot, LaggedStart, Line, ORIGIN, RIGHT, Text,
                   Transform, UpdateFromAlphaFunc, Write, register_font, smooth, tempconfig)

directory = Path(__file__).resolve().parent
SKILL_DIR = directory.parents[1] / "skills" / "manim-blackboard"
sys.path.insert(0, str(SKILL_DIR / "scripts"))
from blackboard import svg_path

data = subprocess.check_output(
    ["node", "--input-type=module", "-e", """
import {attention} from './attention-math.mjs';
console.log(JSON.stringify([attention(2), attention(1)]));
"""], cwd=directory, text=True
)
query_c, query_b = json.loads(data)
values = np.c_[query_c["V"], np.zeros(3)]
weights = np.array(query_c["weights"])
parts = weights[:, None] * values
junctions = np.vstack([ORIGIN, np.cumsum(parts, axis=0)])


def capture(animation, count, measure):
    animation.begin()
    frames = []
    for tick in range(count + 1):
        animation.interpolate(tick / count)
        frames.append([round(float(n), 6) for n in measure()])
    animation.finish()
    return frames


def endpoints(lines):
    return [coord for obj in lines for p in (obj.get_start(), obj.get_end()) for coord in p[:2]]


# Transform the actual three mass labels in a common local basis, from 0 to
# 1 along each chord. The browser fits this authored motion between the old
# row and the new vector tips, including when the two SVGs differ in scale.
with TemporaryDirectory(prefix="manim-weights-") as cache, tempconfig({
    "renderer": "cairo", "dry_run": True, "disable_caching": True, "media_dir": cache,
}), register_font(SKILL_DIR / "assets/fonts/STIXTwoText-Italic.ttf"):
    labels = [Text(f"{weight:.3f}".rstrip("0").rstrip("."), font="STIX Two Text",
                   slant="ITALIC").move_to(ORIGIN) for weight in weights]
    carries = [Transform(label, label.copy().shift(RIGHT), path_arc=arc)
               for label, arc in zip(labels, [-.82, .68, -.48])]
    handoff = capture(LaggedStart(*carries, lag_ratio=.24), 60,
                      lambda: [n for label in labels for n in label.get_center()[:2]])
    # Export the multiplier written by Manim, including Write's outline and
    # outline-to-fill phases. Numerals keep the viewer's selected typeface.
    times = Text("×", font="STIX Two Text", slant="ITALIC")[0].move_to(ORIGIN)
    times.height = 1
    write = Write(times)
    write.begin()
    multiplier = []
    for i in range(22):
        write.interpolate(i / 21)
        multiplier.append([svg_path(times), round(float(times.get_fill_opacity()), 4),
                           round(float(times.get_stroke_opacity()), 4),
                           round(float(times.get_stroke_width()), 4)])
    write.finish()

# First write the original vectors. On the next click, these very strokes shrink,
# then their tails successively move to the previous arrowhead.
original = [Line(ORIGIN, value) for value in values]
draw = capture(LaggedStart(*(Create(obj) for obj in original), lag_ratio=0.31), 32, lambda: endpoints(original))
scaled = [Line(ORIGIN, value) for value in values]
shrink = capture(AnimationGroup(*(Transform(obj, Line(ORIGIN, part)) for obj, part in zip(scaled, parts))),
                 16, lambda: endpoints(scaled))
addition = list(shrink)
for i in (1, 2):
    transfer = Transform(scaled[i], Line(junctions[i], junctions[i + 1]))
    addition.extend(capture(transfer, 13, lambda: endpoints(scaled))[1:])

# Suppress exp(s_BC) continuously; re-normalize A, B and C for every frame.
# The independent variable of the browser interpolation is the probability of
# C, so the balance point and the mass discs stay consistent between samples.
initial = np.array(query_b["weights"])
marker = Dot(np.array([*query_b["output"], 0.0]))
probabilities = initial.copy()


def suppress(point, alpha):
    mass = initial * [1, 1, 1 - alpha]
    probabilities[:] = mass / np.sum(mass)
    point.move_to(probabilities @ values)


mask = capture(UpdateFromAlphaFunc(marker, suppress, rate_func=smooth), 32,
               lambda: [probabilities[2], *marker.get_center()[:2]])
(directory / "mixture-geometry.json").write_text(
    json.dumps({"carry": handoff, "multiply": multiplier, "draw": draw, "add": addition, "mask": mask}, separators=(",", ":")) + "\n"
)
