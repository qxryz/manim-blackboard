# /// script
# requires-python = ">=3.12"
# dependencies = ["manim==0.22.1"]
# ///
"""Build with Manim Blackboard, then frame the narrow diagram for portrait phones.

Run from the repository root with uv run examples/the-third-side/build.py -o build/the-third-side.html.
"""
import argparse
from pathlib import Path
import subprocess
import sys

ORIGINAL = "https://github.com/HarleyCoops/Math-To-Manim/blob/963353c269e9e8023309c3ba25c2167c7dba6fcf/examples/sol/the_third_side.py"

PORTRAIT_FRAME = """
<style>
@media (orientation: portrait) {
  #stage { padding-block-start: max(16px, (100dvh - 88.8889vw - 8rem) / 2); }
  #picture { aspect-ratio: 9 / 8; }
}
</style>
<script>
document.addEventListener('DOMContentLoaded', () => {
  const picture = document.querySelector('#picture');
  const wide = picture.getAttribute('viewBox');
  const portrait = matchMedia('(orientation: portrait)');
  function frame() {
    picture.setAttribute('viewBox', portrait.matches ? '-4.5 -4 9 8' : wide);
  }
  portrait.addEventListener('change', frame);
  frame();
});
</script>
"""

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-o", "--output", type=Path, required=True)
    args = parser.parse_args()
    scene_dir = Path(__file__).resolve().parent
    skill = scene_dir.parents[1] / "skills" / "manim-blackboard"
    builder = skill / "scripts" / "build.py"
    license_text = (skill / "licenses" / "math-to-manim-MIT.txt").read_text(encoding="utf-8")
    notice = f"<!-- Adapted from The Third Side in Math-To-Manim.\n{ORIGINAL}\n\n{license_text.rstrip()}\n-->\n"
    lesson = scene_dir / "lesson.py"
    subprocess.run([sys.executable, str(builder), str(lesson), "-o", str(args.output)], check=True)
    html = args.output.read_text(encoding="utf-8")
    if html.count("</head>") != 1:
        raise ValueError("Expected a single document head")
    args.output.write_text(html.replace("</head>", notice + PORTRAIT_FRAME + "</head>"), encoding="utf-8")

if __name__ == "__main__":
    main()
