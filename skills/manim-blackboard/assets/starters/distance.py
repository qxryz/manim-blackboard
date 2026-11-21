from manim import RIGHT, Dot, Line, Create

TITLE = "Distance from zero"
LANGUAGE = "en"
SECONDARY_LANGUAGE = "zh-Hans"

def build(board):
    zero = Dot(radius=0.10, color="#F5F2E9")
    board.add(zero)
    board.freeze(primary="Where is two relative to zero?", secondary="2 在 0 的什么位置？")

    two = 2 * RIGHT
    segment = Line(zero.get_center(), two, color="#78D9E8")
    board.beat(Create(segment), duration=1.1, hold=[segment, zero],
               primary="Move two units to the right of zero.", secondary="从 0 出发，向右移动两个单位。")
