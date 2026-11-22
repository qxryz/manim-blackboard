"""Build an authored Manim lesson into one offline HTML file."""

from __future__ import annotations

import argparse
import base64
from html import escape
import json
import os
from pathlib import Path
import re
import runpy
import sys
import tempfile


ASSETS = Path(__file__).resolve().parent.parent / "assets"


def render(source, fps):
    from manim import register_font, tempconfig

    from blackboard import Board

    # A scene may import sibling modules and resolve assets against its own __file__.
    sys.path.insert(0, str(source.parent))
    with tempfile.TemporaryDirectory(prefix="manim-blackboard-") as cache:
        settings = {
            "renderer": "cairo",
            "dry_run": True,
            "disable_caching": True,
            "media_dir": cache,
            "input_file": str(source),
            "frame_rate": fps,
            "pixel_width": 1280,
            "pixel_height": 720,
            "frame_width": 128 / 9,
            "frame_height": 8,
        }
        try:
            with (
                tempconfig(settings),
                register_font(ASSETS / "fonts/STIXTwoText-Italic.ttf"),
                register_font(ASSETS / "fonts/Lora-Italic.otf"),
            ):
                lesson = runpy.run_path(str(source), run_name="blackboard_lesson")
                title = lesson.get("TITLE")
                language = lesson.get("LANGUAGE")
                secondary_language = lesson.get("SECONDARY_LANGUAGE")
                for label, value in (("TITLE", title), ("LANGUAGE", language)):
                    if not isinstance(value, str) or not value.strip():
                        raise ValueError(f"Define a nonempty {label} in the lesson.")
                if secondary_language is not None:
                    if not isinstance(secondary_language, str) or not secondary_language.strip():
                        raise ValueError("Set SECONDARY_LANGUAGE to a language tag or None.")
                    if secondary_language.casefold() == language.casefold():
                        raise ValueError("Choose distinct primary and secondary languages.")
                if not callable(lesson.get("build")):
                    raise ValueError("Define build(board) in the lesson.")
                board = Board(fps)
                lesson["build"](board)
                data = board.export()
        finally:
            sys.path.remove(str(source.parent))
    for step, (_, secondary) in enumerate(data["captions"], start=1):
        if (secondary_language is None) != (secondary is None):
            raise ValueError(f"Secondary caption at hold {step} must match SECONDARY_LANGUAGE.")
    data.update(title=title, language=language, secondaryLanguage=secondary_language)
    return data


def typography_panel():
    panel = (ASSETS / "type-controls.html").read_text(encoding="utf-8")

    def embed(match):
        source = ASSETS / "fonts" / match[1]
        if match[2] == "woff2":
            return base64.b64encode(source.read_bytes()).decode("ascii")
        return source.read_text(encoding="utf-8")

    return re.sub(r"\{\{([\w.-]+\.(woff2|txt))\}\}", embed, panel)


def player_page(data):
    # No user text is placed directly into HTML or JS. Escaping '<' protects the
    # JSON script element even when a lesson quotes a literal closing script tag.
    encoded = json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    license_text = (ASSETS.parent / "LICENSE").read_text(encoding="utf-8")
    slots = {
        "<!--BLACKBOARD_PLAYER_LICENSE-->": (
            '<template data-software-license="Manim Blackboard built-in player">'
            f"<pre>{escape(license_text, quote=False)}</pre></template>"
        ),
        "<!--BLACKBOARD_TYPE-->": typography_panel(),
        "<!--BLACKBOARD_CAPTION_TRACK-->": (ASSETS / "caption-track.html").read_text(encoding="utf-8"),
        "<!--BLACKBOARD_DATA-->": encoded.replace("<", r"\u003c"),
        "<!--BLACKBOARD_PLAYER-->": (ASSETS / "player.js").read_text(encoding="utf-8"),
    }
    template = (ASSETS / "player.html").read_text(encoding="utf-8")
    if any(template.count(marker) != 1 for marker in slots):
        raise ValueError("The player template must contain exactly one instance of each player slot.")
    return re.sub("|".join(map(re.escape, slots)), lambda m: slots[m.group()], template)


def write_page(page, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=output.parent, suffix=".tmp")
    staged = Path(name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            file.write(page)
        os.replace(staged, output)
    finally:
        staged.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lesson", type=Path, help="Python file defining build(board)")
    parser.add_argument("-o", "--output", type=Path, required=True, help="destination .html file")
    parser.add_argument("--fps", type=int, default=24, help="vector samples per second (default 24)")
    args = parser.parse_args()
    if args.fps < 1:
        parser.error("--fps must be a positive integer")
    source = args.lesson.resolve()
    if not source.is_file() or source.suffix.lower() != ".py":
        parser.error("the lesson must be an existing .py file")
    if args.output.suffix.lower() != ".html" or args.output.resolve() == source:
        parser.error("choose a separate output file with an .html extension")

    # Keep source checkouts clean when building with a directly invoked Python.
    sys.dont_write_bytecode = True
    from python_runtime import RuntimeSetupError, ensure_profile

    try:
        ensure_profile("manim", __file__)
        data = render(source, args.fps)
        write_page(player_page(data), args.output)
    except (ValueError, OSError, TypeError, ImportError, RuntimeSetupError) as error:
        parser.exit(1, f"Build failed: {error}\n")
    print(f"{args.output} · {len(data['captions'])} holds · {args.output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
