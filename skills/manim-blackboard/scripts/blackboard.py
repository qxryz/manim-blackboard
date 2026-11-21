"""Sample a two-dimensional Manim scene into portable, click-sized SVG sequences."""

from __future__ import annotations

import hashlib
import math
from weakref import WeakKeyDictionary

import numpy as np
from manim import Scene, ValueTracker, VMobject


def number(value):
    if not math.isfinite(value):
        raise ValueError("Manim produced a non-finite coordinate or opacity.")
    rounded = f"{value:.3f}".rstrip("0").rstrip(".")
    return "0" if rounded == "-0" else rounded


def xy(point):
    return f"{number(point[0])} {number(-point[1])}"


def svg_path(mobject):
    """Use Cairo's cubic segments and keep each glyph's separate contours."""
    parts = []
    for subpath in mobject.get_subpaths():
        count = len(subpath) // 4 * 4
        if not count:
            continue
        curves = subpath[:count].reshape(-1, 4, 3)
        parts.append("M" + xy(curves[0, 0]))
        for _, first_handle, second_handle, end in curves:
            parts.append(f"C{xy(first_handle)} {xy(second_handle)} {xy(end)}")
        if mobject.consider_points_equals_2d(curves[0, 0], curves[-1, 3]):
            parts.append("Z")
    return "".join(parts)


def color(row):
    return "#" + "".join(f"{min(255, max(0, round(float(c) * 255))):02x}" for c in row[:3])


def paint(mobject, rows, attribute, definitions):
    if not len(rows) or np.max(rows[:, 3]) < 0.0001:
        return "none", ""
    if len(rows) == 1 or np.all(rows == rows[0]):
        alpha = rows[0, 3]
        opacity = f' {attribute}-opacity="{number(alpha)}"' if alpha < 0.9999 else ""
        return color(rows[0]), opacity

    start, end = mobject.get_gradient_start_and_end_points()
    stops = "".join(
        f'<stop offset="{number(index / (len(rows) - 1))}" stop-color="{color(row)}" '
        f'stop-opacity="{number(row[3])}"/>'
        for index, row in enumerate(rows)
    )
    gradient = (
        f'gradientUnits="userSpaceOnUse" x1="{number(start[0])}" y1="{number(-start[1])}" '
        f'x2="{number(end[0])}" y2="{number(-end[1])}">{stops}</linearGradient>'
    )
    key = "g" + hashlib.blake2s(gradient.encode(), digest_size=10).hexdigest()
    definitions[key] = f'<linearGradient id="{key}" {gradient}'
    return f"url(#{key})", ""


def index_in(pool, value):
    return pool.setdefault(value, len(pool))


class Board:
    """Capture a sequence of visible holds and the real Manim motion between them."""

    def __init__(self, fps=24):
        if not math.isfinite(fps) or fps <= 0:
            raise ValueError("fps must be positive and finite.")
        self.fps = fps
        self.scene = Scene()
        self._geometry = {}
        self._paint = {}
        self._items = {}
        self._path_cache = WeakKeyDictionary()
        self._initial = None
        self._beats = []
        self._captions = []

    def add(self, *mobjects):
        self.scene.add(*mobjects)

    def _geometry_index(self, mobject):
        signature = mobject.points.tobytes()
        cached = self._path_cache.get(mobject)
        if cached is None or cached[0] != signature:
            if np.any(np.abs(mobject.points[:, 2]) > 1e-6):
                raise TypeError("Use flat XY geometry on this two-dimensional blackboard.")
            path = svg_path(mobject)
            cached = (signature, index_in(self._geometry, path) if path else None)
            self._path_cache[mobject] = cached
        return cached[1]

    def _stroke(self, mobject, background, definitions):
        width = mobject.get_stroke_width(background) * self.scene.camera.cairo_line_width_multiple
        if width <= 0:
            return ""
        ink, opacity = paint(mobject, mobject.get_stroke_rgbas(background), "stroke", definitions)
        if ink == "none":
            return ""
        attributes = f' stroke="{ink}" stroke-width="{number(width)}"{opacity}'
        cap = mobject.cap_style.name.lower()
        join = mobject.joint_type.name.lower()
        if cap in ("round", "square"):
            attributes += f' stroke-linecap="{cap}"'
        if join in ("round", "bevel"):
            attributes += f' stroke-linejoin="{join}"'
        return attributes

    def _frame(self):
        shapes = []
        definitions = {}
        for mobject in self.scene.camera.get_mobjects_to_display(self.scene.mobjects):
            if isinstance(mobject, ValueTracker):
                continue
            if not isinstance(mobject, VMobject):
                raise TypeError(f"Use vector paths in place of {type(mobject).__name__}.")
            if mobject.get_background_image() is not None or mobject.shade_in_3d:
                raise TypeError("Use a two-dimensional solid color or vector gradient.")
            geometry = self._geometry_index(mobject)
            if geometry is None:
                continue

            fill, opacity = paint(mobject, mobject.get_fill_rgbas(), "fill", definitions)
            behind = self._stroke(mobject, True, definitions)
            stroke = self._stroke(mobject, False, definitions)
            styles = []
            if behind:
                styles.append('fill="none"' + behind)
            if fill != "none" or stroke:
                styles.append(f'fill="{fill}"{opacity}{stroke}')
            for style in styles:
                pair = (geometry, index_in(self._paint, style))
                shapes.append(index_in(self._items, pair))
        if definitions:
            defs = "<defs>" + "".join(definitions.values()) + "</defs>"
            shapes.insert(0, index_in(self._items, defs))
        return shapes

    @staticmethod
    def _caption(primary, secondary):
        if not isinstance(primary, str) or not primary.strip():
            raise ValueError("Give each hold a nonempty primary caption.")
        if secondary is not None and (not isinstance(secondary, str) or not secondary.strip()):
            raise ValueError("Provide a nonempty secondary caption, or omit it.")
        return [primary.strip(), secondary.strip() if secondary is not None else None]

    def freeze(self, *, primary, secondary=None):
        """Record the opening scene. Call this once after adding the opening objects."""
        if self._initial is not None:
            raise ValueError("freeze() records the opening once. Use beat() for later holds.")
        caption = self._caption(primary, secondary)
        self._initial = self._frame()
        self._captions.append(caption)

    def beat(self, *animations, primary, secondary=None, duration=1.2, hold=None):
        """Run simultaneous Manim animations, then pin the optional exact visible cast."""
        if self._initial is None:
            raise ValueError("Add the opening objects and call freeze() before the first beat().")
        if not math.isfinite(duration) or duration <= 0:
            raise ValueError("Beat duration must be positive and finite.")
        if not animations:
            raise ValueError("Give beat() at least one Manim animation.")
        caption = self._caption(primary, secondary)
        scene = self.scene
        # Capture the actual pre-animation scene before Manim adds introducer objects.
        frames = [self._frame()]
        scene.compile_animation_data(*animations)
        original_duration = scene.get_run_time(scene.animations)
        for animation in scene.animations:
            animation.run_time *= duration / original_duration
        scene.duration = duration
        scene.begin_animations()
        count = max(1, round(self.fps * duration))
        for tick in range(1, count + 1):
            scene.update_to_time(tick * duration / count)
            if tick < count:
                frames.append(self._frame())
        for animation in scene.animations:
            animation.finish()
            animation.clean_up_from_scene(scene)
        scene.update_mobjects(0)
        if hold is not None:
            scene.clear()
            scene.add(*hold)
        frames.append(self._frame())
        self._beats.append({"duration": duration, "frames": frames})
        self._captions.append(caption)

    def export(self):
        if self._initial is None or not self._beats:
            raise ValueError("A lesson needs an opening freeze() and at least one animated beat().")
        camera = self.scene.camera
        width, height = camera.frame_width, camera.frame_height
        return {
            "geometry": list(self._geometry),
            "paint": list(self._paint),
            "items": list(self._items),
            "boards": [{
                "viewBox": [-width / 2, -height / 2, width, height],
                "initial": self._initial,
                "beats": self._beats,
            }],
            "captions": self._captions,
        }
