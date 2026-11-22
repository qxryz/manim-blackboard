# /// script
# requires-python = ">=3.11"
# dependencies = ["manim>=0.20.1,<0.23"]
# ///
"""Regenerate the two native Manim cues in the neural-network opening."""
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

from manim import (
    AnimationGroup, Arrow, Create, Dot, FadeIn, FadeOut, GrowArrow,
    LaggedStart, Line, ReplacementTransform, RIGHT, Text, VGroup, Write, register_font, tempconfig,
)

SKILL_DIR = Path(__file__).resolve().parents[2] / "skills" / "manim-blackboard"
sys.path.insert(0, str(SKILL_DIR / "scripts"))
from blackboard import Board, svg_path

TITLE = "A neural network, by hand"
LANGUAGE = "en"
SECONDARY_LANGUAGE = "zh-Hans"
PAPER = "#F7F5EF"
TEAL = "#84DECA"
GOLD = "#F2B078"
MUTED = "#9DA5A4"
DIM = "#66716D"

OPEN = ("The target is 1. The network predicts 2. How far apart are they?",
        "目标是 1，网络预测是 2。它们相差多少？")
GAP = ("Subtract the target from the prediction. One step to the right gives a signed error of +1.",
       "从预测值减去目标值。从 1 向右走到 2，带符号误差是 +1。")


def glyph(word, size, color=PAPER):
    return Text(word, font="STIX Two Text", slant="ITALIC", font_size=size, color=color)


def at(x, y):
    return [x, y, 0.0]


def given(symbol, n, x, color, what):
    expr = VGroup(glyph(symbol, 86, color), glyph("=", 72), glyph(n, 86, color))
    expr.arrange(RIGHT, buff=.22).move_to(at(x, -.45))
    name = glyph(what, 43, MUTED).move_to(at(x, .85))
    return expr, name


def build(board):
    target, t_label = given("y", "1", -2.4, PAPER, "Target")
    prediction, p_label = given("ŷ", "2", 2.4, TEAL, "Prediction")
    board.freeze(primary=OPEN[0], secondary=OPEN[1])
    board.beat(
        LaggedStart(
            AnimationGroup(Write(t_label), Write(target)),
            AnimationGroup(Write(p_label), Write(prediction)),
            lag_ratio=.22,
        ),
        duration=1.45, primary=OPEN[0], secondary=OPEN[1],
        hold=[t_label, target, p_label, prediction],
    )

    opening_prediction_path = svg_path(prediction[2][0])
    # The two variables become the subtraction. Their numerical values take
    # their actual positions beneath the ticks on the same number line.
    eq = VGroup(glyph("ŷ", 85, TEAL), glyph("−", 70), glyph("y", 85),
                glyph("=", 70), glyph("+1", 83, GOLD))
    eq.arrange(RIGHT, buff=.26).move_to(at(0, 1.05))
    axis_y = -1.24
    tick_x = [-3.90, -1.30, 1.30, 3.90]
    axis = Line(at(-4.65, axis_y), at(4.65, axis_y), color=DIM, stroke_width=3)
    ticks = VGroup(*(Line(at(x, axis_y-.095), at(x, axis_y+.095), color=MUTED, stroke_width=2.3)
                     for x in tick_x))
    digits = [glyph(str(i), 50, color).move_to(at(x, -1.80))
              for i, (x, color) in enumerate(zip(tick_x, [MUTED, PAPER, TEAL, MUTED]))]
    dots = [Dot(at(tick_x[i], axis_y), radius=.073, color=color)
            for i, color in ((1, PAPER), (2, TEAL))]
    guides = VGroup(*(Line(at(x, axis_y+.11), at(x, -.65), color=DIM, stroke_width=2.4)
                      for x in tick_x[1:3]))
    distance = Arrow(at(tick_x[1], -.56), at(tick_x[2], -.56), buff=0,
                     color=GOLD, stroke_width=4, tip_length=.18)
    board.beat(
        LaggedStart(
            AnimationGroup(
                FadeOut(t_label), FadeOut(p_label), FadeOut(target[1]), FadeOut(prediction[1]),
                ReplacementTransform(prediction[0], eq[0], path_arc=.55),
                ReplacementTransform(target[0], eq[2], path_arc=-.55),
                ReplacementTransform(prediction[2], digits[2]), ReplacementTransform(target[2], digits[1]),
                Write(eq[1]),
            ),
            AnimationGroup(Create(axis), Create(ticks), FadeIn(digits[0]), FadeIn(digits[3]),
                           FadeIn(dots[0]), FadeIn(dots[1])),
            LaggedStart(Create(guides), GrowArrow(distance), lag_ratio=.35),
            LaggedStart(Write(eq[3]), Write(eq[4]), lag_ratio=.30),
            lag_ratio=.68,
        ),
        duration=2.35, primary=GAP[0], secondary=GAP[1],
        hold=[axis, ticks, *digits, *dots, guides, distance, eq],
    )
    # Keep the prediction mark's actual vector path as the cross-scene anchor.
    return [opening_prediction_path, svg_path(dots[1])]


if __name__ == "__main__":
    with TemporaryDirectory(prefix="manim-opening-") as cache, tempconfig({
        "renderer": "cairo", "dry_run": True, "disable_caching": True,
        "media_dir": cache, "frame_rate": 24, "frame_width": 128/9, "frame_height": 8,
    }), register_font(SKILL_DIR / "assets/fonts/STIXTwoText-Italic.ttf"):
        recording = Board(fps=24)
        prediction_paths = build(recording)
        data = recording.export()
    beats = data["boards"][0]["beats"]
    anchors = []
    for cue, path in zip(beats, prediction_paths):
        geometry = data["geometry"].index(path)
        anchors.append(next(item for item in cue["frames"][-1] if data["items"][item][0] == geometry))
    out = {"viewBox": [-5.6, -2.7, 11.2, 5.0], "geometry": data["geometry"],
           "paint": data["paint"], "items": data["items"], "beats": beats,
           "captions": data["captions"][1:], "anchors": anchors}
    Path(__file__).with_name("opening-vectors.json").write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":"))+"\n", encoding="utf-8")
