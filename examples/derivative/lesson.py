"""Follow one secant of a parabola as its two points come together."""

import numpy as np
from manim import (
    DOWN, RIGHT, UP, Create, Dot, FadeIn, FadeOut, Line, Succession, Text,
    UpdateFromAlphaFunc, VGroup, VMobject, Write,
)

TITLE = "The slope at one point"
LANGUAGE = "en"
SECONDARY_LANGUAGE = "zh"

PAPER = "#F5F2E9"
MUTED = "#BBC1C6"
AXIS = "#768189"
SLOPE = "#78D9E8"


def typeset(string, size, color=PAPER):
    return Text(string, font="STIX Two Text", slant="ITALIC", color=color, font_size=size)


def label(string, height, color=PAPER):
    return typeset(string, 48, color).scale_to_fit_height(height)


def fraction(top, bottom):
    width = max(top.width, bottom.width) + 0.16
    bar = Line([0, 0, 0], [width, 0, 0], stroke_width=3.2, color=PAPER)
    return VGroup(top, bar, bottom).arrange(DOWN, buff=0.10)


def point(x, y):
    """Map mathematical coordinates into the left half of the blackboard."""
    return np.array([-3.4 + 1.72 * x, -1.35 + 0.81 * y, 0.0])


def graph():
    first, last = -1.48, 2.16
    x_axis = Line(point(-1.64, 0), point(2.27, 0), color=AXIS, stroke_width=2.1)
    y_axis = Line(point(0, -0.50), point(0, 4.79), color=AXIS, stroke_width=2.1)
    x_label = label("x", 0.23, MUTED).next_to(x_axis, RIGHT, buff=0.10)
    y_label = label("y", 0.24, MUTED).next_to(y_axis, UP, buff=0.10)
    ticks = VGroup()
    for x in (1, 2):
        tick = Line(point(x, -0.075), point(x, 0.075), color=AXIS, stroke_width=2)
        value = label(str(x), 0.23, MUTED).next_to(tick, DOWN, buff=0.12)
        ticks.add(tick, value)
    curve = VMobject(stroke_width=4.2, stroke_color=PAPER)
    curve.start_new_path(point(first, first**2))
    # One quadratic Bézier represents the parabola exactly between the endpoints.
    curve.add_quadratic_bezier_curve_to(point((first + last) / 2, first * last),
                                        point(last, last**2))
    return VGroup(x_axis, y_axis, x_label, y_label, ticks, curve)


def place_secant(group, h):
    """Keep the cyan line through P and Q at every frame, including its limit."""
    secant, run, rise, interval, moving_point = group
    fixed = point(1, 1)
    foot = point(1 + h, 1)
    moving = point(1 + h, (1 + h)**2)
    slope = 2 + h
    left, right = 0.46, 2.14
    secant.set_points_as_corners([point(x, 1 + slope * (x - 1)) for x in (left, right)])
    run.set_points_as_corners([fixed, foot])
    rise.set_points_as_corners([foot, moving])
    interval.move_to((fixed + foot) / 2 + 0.23 * DOWN)
    interval.set_opacity(min(1, h / 0.25))
    moving_point.move_to(moving)


def build(board):
    heading = label(TITLE, 0.60).move_to([0, 3.31, 0])
    axes = graph()
    anchor = Dot(point(1, 1), radius=0.085, color=PAPER)
    name = label("P", 0.26).move_to(point(1, 1) + [-0.24, 0.22, 0])
    function = label("f(x) = x²", 0.62).move_to([3.45, 1.64, 0])
    coordinate = label("P = (1, 1)", 0.42, MUTED).move_to([3.45, 0.17, 0])
    base = [heading, axes, function]
    board.add(*base, anchor, name, coordinate)
    board.freeze(
        primary="At P, the curve has a slope. How can we measure it with just one point?",
        secondary="曲线在 P 点有一个斜率。只有一个点，怎么量出这个斜率？",
    )

    secant = Line(color=SLOPE, stroke_width=4.1)
    run = Line(color=MUTED, stroke_width=2.4)
    rise = run.copy()
    interval = label("h", 0.23, MUTED)
    moving_point = Dot(radius=0.075, color=SLOPE)
    moving = VGroup(secant, run, rise, interval, moving_point)
    place_secant(moving, 1.0)
    ratio = VGroup(typeset("m =", 40, SLOPE),
                   fraction(typeset("rise", 36), typeset("run", 36)))
    ratio.arrange(RIGHT, buff=0.19).move_to([3.45, 0.25, 0])

    def reading(string):
        return label(string, 0.36, MUTED).move_to([3.45, -1.19, 0])

    first = reading("h = 1,    m = 3")
    board.beat(
        FadeOut(coordinate), Create(secant), FadeIn(VGroup(run, rise, interval, moving_point)),
        Write(ratio), FadeIn(first), duration=1.45,
        hold=[*base, moving, anchor, name, ratio, first],
        primary="Add a second point one unit to the right. The secant rises three units, so its slope is three.",
        secondary="在右边一个单位处加一个点。割线向上升了三个单位，所以斜率是 3。",
    )

    half = reading("h = 0.5,    m = 2.5")
    board.beat(
        UpdateFromAlphaFunc(moving, lambda group, t: place_secant(group, 1 - 0.5 * t)),
        Succession(FadeOut(first), FadeIn(half)), duration=1.55,
        hold=[*base, moving, anchor, name, ratio, half],
        primary="Halve the gap. The second point stays on the curve, and the secant turns around P.",
        secondary="把间隔缩短一半。第二个点沿曲线移动，割线随之绕 P 转动。",
    )

    exact = VGroup(typeset("m =", 40, SLOPE),
                   fraction(typeset("(1 + h)² − 1", 35), typeset("h", 35)),
                   typeset("= 2 + h", 40, SLOPE))
    exact.arrange(RIGHT, buff=0.16).move_to(ratio)
    nonzero = reading("h ≠ 0")
    board.beat(
        Succession(FadeOut(ratio), Write(exact)), Succession(FadeOut(half), FadeIn(nonzero)),
        duration=1.65,
        hold=[*base, moving, anchor, name, exact, nonzero],
        primary="For any nonzero gap h, the rise is (1 + h)² − 1. Dividing by h gives 2 + h.",
        secondary="对任意非零间隔 h，高度差都是 (1 + h)² − 1。除以 h，得到 2 + h。",
    )

    limit = label("as h → 0", 0.38, MUTED).move_to([3.45, 0.49, 0])
    derivative = label("f′(1) = 2", 0.62, SLOPE).move_to([3.45, -0.57, 0])
    board.beat(
        UpdateFromAlphaFunc(moving, lambda group, t: place_secant(group, 0.5 * (1 - t))),
        Succession(FadeOut(exact), FadeIn(limit)), Succession(FadeOut(nonzero), Write(derivative)),
        duration=1.65,
        hold=[*base, secant, anchor, name, limit, derivative],
        primary="As h tends to zero, the secant tends to the tangent. Its limiting slope, two, is the derivative at P.",
        secondary="当 h 趋近于零，割线趋向切线。斜率的极限是 2，这就是函数在 P 点的导数。",
    )
