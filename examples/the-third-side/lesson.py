"""Two applications of Pythagoras on the same rectangular prism."""
import numpy as np
from manim import (
    AnimationGroup, Create, DEGREES, Dot, FadeIn, FadeOut, Indicate, Line,
    MoveAlongPath, ReplacementTransform, RIGHT, Succession, Text, ThreeDCamera,
    UpdateFromAlphaFunc, VGroup, VMobject, Wait, Write, linear, smooth,
)

TITLE = "The Third Side"
LANGUAGE = "en"
SECONDARY_LANGUAGE = "zh-Hans"

TEAL = "#42DDD0"
GOLD = "#FFD17A"
LILAC = "#B9A5FF"
IVORY = "#F7F4E9"
WIRE = "#68788D"

# Raw coordinates and camera poses are shared by the two triangles and the walk.
POINTS = {k: np.array(pos, dtype=float) for k, pos in {
    "A": (0, 0, 0), "B": (3, 0, 0), "C": (3, 4, 0), "E": (0, 4, 0),
    "F": (0, 0, 6), "G": (3, 0, 6), "D": (3, 4, 6), "H": (0, 4, 6),
}.items()}
FLOOR_EDGES = ("AB", "BC", "CE", "EA")
BOX_EDGES = ("AF", "BG", "EH", "FG", "GD", "DH", "HF")
FLOOR_POSE = np.array([26., -65., 1.65, -1.56])
UPRIGHT_POSE = np.array([54., -54., 1., 0.])
INTERIOR_POSE = np.array([61., -42., 1., 0.])
FINAL_POSE = np.array([58., -48., 1., 0.])

def point2(x, y):
    return np.array([x, y, 0.])

def part(t, start, stop):
    return float(np.clip((t - start) / (stop - start), 0., 1.))

def segment(a, b, t):
    return a + (b - a) * t

def ink(text, color, size):
    return Text(text, font="STIX Two Text", slant="ITALIC", font_size=size,
                color=color, disable_ligatures=True)

def radical(digits, color):
    # Extend the vinculum to cover the entire radicand.
    root = ink("√", color, 45)
    body = ink(digits, color, 43)
    root.stretch_to_fit_height(body.height * 1.25)
    body.next_to(root, RIGHT, buff=-0.052)
    body.shift(point2(0, root.get_bottom()[1] - body.get_bottom()[1] + 0.018))
    tip = root.get_corner(np.array([1., 1., 0.]))
    bar = Line(tip + point2(-.018, -.015), point2(body.get_right()[0] + .035, tip[1] - .015),
               color=color, stroke_width=3)
    return VGroup(root, body, bar)

def equation(*tokens):
    symbols = []
    for value, color in tokens:
        token = radical(value[1:], color) if value.startswith("√") else ink(value, color, 43)
        symbols.append(token)
    row = VGroup(*symbols).arrange(RIGHT, buff=.14)
    # Align symbols to the same baseline. Lowercase d and uppercase L have ascenders.
    for token, (value, _) in zip(row, tokens):
        if value in ("=", "≈", "+", "<"):
            token.shift(point2(0, -.012))
        elif value.endswith("²") or value.startswith("√"):
            token.shift(point2(0, .05))
    return row.move_to(point2(0, -3.45)).set_z_index(12)

def line(color, width, layer, opacity=1):
    return VMobject(stroke_color=color, stroke_width=width, stroke_opacity=opacity,
                    fill_opacity=0).set_z_index(layer)

def face(color, layer):
    return VMobject(fill_color=color, stroke_width=0, fill_opacity=.14).set_z_index(layer)

class Geometry:
    """Manim vector paths viewed through one native Manim 3D camera."""
    def __init__(self):
        self.camera = ThreeDCamera(focal_distance=30)
        self.floor = [line(WIRE, 3, -4, .72) for _ in FLOOR_EDGES]
        self.wire = [line(WIRE, 3, -4, .73) for _ in BOX_EDGES]
        self.ab = line(TEAL, 6.0, 2)
        self.bc = line(TEAL, 6.0, 2)
        self.ac = line(GOLD, 6.3, 3)
        self.cd = line(LILAC, 6.0, 3)
        self.ad = line(GOLD, 7.6, 4)
        self.floor_face = face(TEAL, -8)
        self.upright_face = face(LILAC, -7)
        self.mark_b = line(IVORY, 3.8, 5)
        self.mark_c = line(IVORY, 3.8, 5)
        self.start = Dot(radius=.055, color=IVORY).set_z_index(7)
        self.finish = Dot(radius=.061, color=IVORY).set_z_index(7)
        self.labels = {key: ink(s, color, 40).set_z_index(9) for key, s, color in
                       [("ab", "3", TEAL), ("bc", "4", TEAL), ("ac", "d", GOLD),
                        ("cd", "6", LILAC), ("ad", "L", GOLD)]}
        self.five = ink("5", GOLD, 40).set_z_index(9)
        self.place(FLOOR_POSE, height=1, interior=1)

    def place(self, pose, height=1, interior=1):
        phi, theta, zoom, center_z = pose
        cam = self.camera
        cam.set_phi(phi * DEGREES)
        cam.set_theta(theta * DEGREES)
        cam.set_zoom(zoom)
        cam.frame_center = [0, 0, center_z]
        cam.reset_rotation_matrix()

        def project(raw):
            xy = cam.project_points((np.array(raw, dtype=float) - [1.5, 2, 3]) * .52)
            xy[:, 2] = 0
            return xy * 1.45 + point2(0, .60)

        vertices = {key: pos.copy() for key, pos in POINTS.items()}
        for key in "FGDH":
            vertices[key][2] *= height
        projected = project(list(vertices.values()))
        self.p = dict(zip(vertices, projected))

        def draw(stroke, *coordinates):
            stroke.set_points_as_corners(coordinates)
        def edge(stroke, name):
            draw(stroke, *(self.p[k] for k in name))

        for stroke, pair in zip(self.floor + self.wire, FLOOR_EDGES + BOX_EDGES):
            edge(stroke, pair)
        for stroke, pair in ((self.ab, "AB"), (self.bc, "BC"), (self.ac, "AC"), (self.cd, "CD")):
            edge(stroke, pair)
        p = self.p
        diagonal_tip = project([segment(vertices["A"], vertices["D"], interior)])[0]
        draw(self.ad, p["A"], diagonal_tip)
        edge(self.floor_face, "ABCA")
        edge(self.upright_face, "ACDA")
        # Both squares have a physical side length of 0.34 in the object.
        side = .34
        towards_a = (POINTS["A"] - POINTS["C"]) / 5
        up = np.array([0., 0., side])
        draw(self.mark_b, *project([[3-side, 0, 0], [3-side, side, 0], [3, side, 0]]))
        draw(self.mark_c, *project([POINTS["C"] + side*towards_a,
                                    POINTS["C"] + side*towards_a + up, POINTS["C"] + up]))
        self.start.move_to(p["A"])
        self.finish.move_to(p["D"])

        def outside(a, b, opposite, distance, fraction=.5):
            midpoint = segment(p[a], p[b], fraction)
            delta = p[b] - p[a]
            normal = point2(-delta[1], delta[0])
            normal /= max(np.linalg.norm(normal), 1.e-8)
            if np.dot(normal, p[opposite] - midpoint) > 0:
                normal *= -1
            return midpoint + distance * normal

        self.labels["ab"].move_to(outside("A", "B", "C", .41))
        self.labels["bc"].move_to(outside("B", "C", "A", .41))
        diagonal_fraction = .5 + .18 * part(phi, FLOOR_POSE[0], UPRIGHT_POSE[0])
        self.labels["ac"].move_to(outside("A", "C", "B", .35, diagonal_fraction))
        self.five.move_to(self.labels["ac"])
        self.labels["cd"].move_to((p["C"] + p["D"]) / 2 + point2(.40, 0))
        self.labels["ad"].move_to(outside("A", "D", "C", .38, .68))

    def floor_triangle(self):
        return [self.floor_face, *self.floor, self.ab, self.bc, self.ac, self.mark_b,
                self.start, self.labels["ab"], self.labels["bc"], self.five]

    def standing(self):
        return [*self.floor_triangle(), *self.wire, self.cd, self.mark_c, self.finish, self.labels["cd"]]

    def full_box(self):
        return [*self.standing(), self.upright_face, self.ad, self.labels["ad"]]

    def first_turn(self, _, alpha):
        t = smooth(alpha)
        height = smooth(part(alpha, .10, 1))
        self.place(segment(FLOOR_POSE, UPRIGHT_POSE, t), height=height)
        for wire in self.wire:
            wire.set_stroke(opacity=.73 * smooth(part(alpha, .34, .80)))
        self.mark_c.set_stroke(opacity=smooth(part(alpha, .78, .98)))
        self.finish.set_opacity(smooth(part(alpha, .64, .86)))
        self.labels["cd"].set_opacity(smooth(part(alpha, .56, .80)))
        self.cd.set_stroke(opacity=smooth(part(alpha, 0, .10)))

    def through_box(self, _, alpha):
        self.place(segment(UPRIGHT_POSE, INTERIOR_POSE, smooth(alpha)),
                   interior=smooth(part(alpha, .12, .80)))
        self.ad.set_stroke(opacity=smooth(part(alpha, .10, .22)))
        self.ac.set_stroke(width=6.3 - 1.4 * smooth(alpha))
        self.upright_face.set_fill(opacity=.15 * smooth(part(alpha, .68, 1)))
        self.labels["ad"].set_opacity(smooth(part(alpha, .68, .96)))

def build(board):
    box = Geometry()
    first = [*box.floor, box.start]
    board.add(*first)
    board.freeze(primary="How far is it across the floor of this box?",
                 secondary="这个长方体的底面对角线有多长？")

    with_ab = [*first, box.ab, box.labels["ab"]]
    board.beat(Create(box.ab), FadeIn(box.labels["ab"]), duration=.95, hold=with_ab,
               primary="Start at the white point and follow the three-unit edge.",
               secondary="从白点出发，沿第一条棱走 3 个单位。")
    with_bc = [*with_ab, box.bc, box.labels["bc"], box.mark_b]
    board.beat(Create(box.bc), FadeIn(box.labels["bc"]),
               Succession(Wait(.55), Create(box.mark_b, run_time=.35)), duration=1.15, hold=with_bc,
               primary="Turn a right angle and follow the four-unit edge.",
               secondary="转过一个直角，沿第二条棱再走 4 个单位。")

    with_d = [*with_bc, box.floor_face, box.ac, box.labels["ac"]]
    board.beat(Create(box.ac), FadeIn(box.floor_face), FadeIn(box.labels["ac"]),
               duration=1.15, hold=with_d,
               primary="Join the two ends. The gold segment is the floor diagonal, d.",
               secondary="连接起点和终点。金色线段就是底面对角线 d。")

    ground_sq = equation(("d²", GOLD), ("=", IVORY), ("3²", TEAL), ("+", IVORY),
                         ("4²", TEAL), ("=", IVORY), ("25", IVORY))
    board.beat(Write(ground_sq), Indicate(box.mark_b, scale_factor=1.25, color=IVORY),
               duration=1.3, hold=[*with_d, ground_sq],
               primary="The two floor edges meet at a right angle, so their squares add to 25.",
               secondary="底面两条棱互相垂直，它们的长度平方相加得 25。")

    ground_length = equation(("d", GOLD), ("=", IVORY), ("√25", GOLD), ("=", IVORY), ("5", GOLD))
    board.beat(ReplacementTransform(ground_sq, ground_length),
               ReplacementTransform(box.labels["ac"], box.five), duration=1.15,
               hold=[*box.floor_triangle(), ground_length],
               primary="Take the positive square root. The floor diagonal is five units long.",
               secondary="取正平方根，得到底面对角线长 5 个单位。")

    standing = VGroup(*box.standing())
    box.first_turn(None, 0)
    board.beat(UpdateFromAlphaFunc(standing, box.first_turn, rate_func=linear),
               FadeOut(ground_length), duration=2.8, hold=box.standing(),
               primary="Keep the five-unit diagonal. The six-unit height stands perpendicular to it.",
               secondary="保留这条长为 5 的对角线。长为 6 的高与它垂直。")

    solid = VGroup(*box.full_box())
    box.through_box(None, 0)
    board.beat(UpdateFromAlphaFunc(solid, box.through_box, rate_func=linear), duration=2.25,
               hold=box.full_box(),
               primary="Join the white endpoints. The new diagonal, L, passes through the box.",
               secondary="连接两个白色端点。新的对角线 L 穿过长方体内部。")

    inner_sq = equation(("L²", GOLD), ("=", IVORY), ("5²", GOLD), ("+", IVORY),
                        ("6²", LILAC), ("=", IVORY), ("61", IVORY))
    board.beat(Write(inner_sq), Indicate(box.mark_c, scale_factor=1.30, color=IVORY),
               duration=1.25, hold=[*box.full_box(), inner_sq],
               primary="Five and six are the legs of the upright right triangle.",
               secondary="竖直剖面上，5 和 6 是这个直角三角形的两条直角边。")

    inner_length = equation(("L", GOLD), ("=", IVORY), ("√61", GOLD),
                            ("≈", IVORY), ("7.81", GOLD))
    board.beat(ReplacementTransform(inner_sq, inner_length), duration=1.12,
               hold=[*box.full_box(), inner_length],
               primary="The exact length is the square root of 61, about 7.81 units.",
               secondary="空间对角线的精确长度是根号 61，约为 7.81 个单位。")

    walk_sum = equation(("3", TEAL), ("+", IVORY), ("4", TEAL), ("+", IVORY),
                        ("6", LILAC), ("=", IVORY), ("13", IVORY))
    walker = Dot(box.p["A"], radius=.11, color=IVORY).set_z_index(11)
    path = []
    for pair, length in zip(("AB", "BC", "CD"), (3, 4, 6)):
        a, b = (box.p[k] for k in pair)
        # A constant 3D speed has a slightly nonuniform speed in perspective.
        ends = (np.array([POINTS[k] for k in pair]) - [1.5, 2, 3]) * .52
        depths = box.camera.project_points(ends)[:, 2]
        w0, w1 = box.camera.get_focal_distance() - depths
        def perspective_rate(t, start=w0, finish=w1):
            return t * finish / ((1-t) * start + t * finish)
        path.append(MoveAlongPath(walker, Line(a, b), run_time=3*length/13,
                                  rate_func=perspective_rate))
    walk = Succession(*path, rate_func=linear)
    # Explicit durations keep the walk proportional to real edge lengths.
    emphasis = AnimationGroup(box.ad.animate.set_stroke(opacity=.31),
                              box.labels["ad"].animate.set_opacity(.39),
                              box.ab.animate.set_stroke(width=8.3), box.bc.animate.set_stroke(width=8.3),
                              box.cd.animate.set_stroke(width=8.3), FadeOut(inner_length), run_time=.36)
    board.beat(AnimationGroup(walk, emphasis,
                              Succession(Wait(3), Write(walk_sum, run_time=.55)), lag_ratio=0),
               duration=3.55, hold=[*box.full_box(), walk_sum],
               primary="Follow the white dot along three edges. It travels 13 units.",
               secondary="看白点沿三条棱依次前进，这条路线全长 13 个单位。")

    comparison = equation(("√61", GOLD), ("≈", IVORY), ("7.81", GOLD), ("<", IVORY), ("13", IVORY))
    def return_camera(_, alpha):
        t = smooth(alpha)
        box.place(segment(INTERIOR_POSE, FINAL_POSE, t))
        box.ad.set_stroke(opacity=.31+.69*t)
        box.labels["ad"].set_opacity(.39+.61*t)
        for stroke in (box.ab, box.bc, box.cd):
            stroke.set_stroke(width=8.3-2.3*t)
    board.beat(UpdateFromAlphaFunc(VGroup(*box.full_box()), return_camera, rate_func=linear),
               ReplacementTransform(walk_sum, comparison), duration=1.8,
               hold=[*box.full_box(), comparison],
               primary="The straight path is shortest. It reaches the same corner in about 7.81 units.",
               secondary="起点和终点相同，直线段最短，长约 7.81 个单位。")
