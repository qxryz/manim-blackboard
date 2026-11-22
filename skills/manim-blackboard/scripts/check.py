"""Exercise a generated blackboard in an offline Chromium browser."""

import argparse
import sys
from pathlib import Path
from urllib.parse import urldefrag

class CheckFailure(Exception):
    pass


def require(condition, message):
    if not condition:
        raise CheckFailure(message)


def position(page, step, playing=False):
    actual = page.locator("body").evaluate("(el) => [el.dataset.step, el.dataset.animating]")
    expected = [str(step), str(playing).lower()]
    require(actual == expected, f"step {step + 1}: expected {expected}, got {actual}")


def check_stop(page, step, pair, dual):
    position(page, step)
    label = f"step {step + 1} ({'bilingual' if dual else 'primary'})"
    require(page.locator("#primary").text_content() == pair[0], f"{label}: primary caption mismatch")
    require(page.locator("#description").text_content() == pair[0], f"{label}: SVG description mismatch")
    second = page.locator("#secondary")
    require(second.is_visible() == bool(dual and pair[1]), f"{label}: translation visibility mismatch")
    if dual and pair[1]:
        require(second.text_content() == pair[1], f"{label}: translation mismatch")
    problem = page.evaluate("""() => {
        const rect = id => document.getElementById(id).getBoundingClientRect();
        const fits = (inner, outer) => inner.left >= outer.left - 2 && inner.right <= outer.right + 2 &&
            inner.top >= outer.top - 2 && inner.bottom <= outer.bottom + 2;
        const stage = rect('stage'), picture = rect('picture'), art = rect('art');
        if (!fits(picture, stage)) return 'picture extends beyond stage';
        if (!art.width && !art.height) return 'empty drawing';
        if (!fits(art, picture)) return 'drawing extends beyond picture';
        for (const node of document.querySelectorAll('#subtitles p:not([hidden])')) {
            const pixels = parseFloat(getComputedStyle(node).fontSize);
            if (pixels < 15) return 'caption size ' + pixels.toFixed(1) + 'px falls below 15px';
            const range = new Range();
            range.selectNodeContents(node);
            const text = range.getBoundingClientRect();
            if (!fits(text, stage)) return 'caption extends beyond stage';
            if (text.top < art.bottom - 2 && text.bottom > art.top + 2 &&
                text.left < art.right && text.right > art.left) return 'caption overlaps drawing';
        }
        return '';
    }""")
    require(not problem, f"{label}: {problem}")


def inspect(page, touch):
    page.wait_for_selector("body[data-step]", state="attached", timeout=5000)
    model = page.locator("#lesson").evaluate("""el => {
        const data = JSON.parse(el.textContent);
        return {pairs: data.captions, dual: Boolean(data.secondaryLanguage),
                durations: data.boards[0].beats.map(beat => beat.duration)};
    }""")
    pairs, dual, durations = model["pairs"], model["dual"], model["durations"]
    require(len(pairs) == len(durations) + 1 and durations, "expected an opening and at least one animation")
    stage = page.locator("#stage")

    # Test actual playback and an interruption using a controlled browser clock.
    if not touch:
        page.clock.install()
        page.clock.pause_at(page.evaluate("new Date(Date.now() + 200)"))
        stage.click()
        position(page, 1, playing=True)
        page.keyboard.press("Space")
        position(page, 1)
        settled = page.locator("#art").inner_html()
        page.keyboard.press("r")
        position(page, 1, playing=True)
        page.clock.run_for(round(1000 * durations[0]) + 80)
        position(page, 1)
        require(page.locator("#art").inner_html() == settled, "replay ended on a different frame")
        page.keyboard.press("ArrowLeft")
        position(page, 0)

    page.emulate_media(reduced_motion="reduce")
    for step, pair in enumerate(pairs):
        if step:
            if touch:
                page.touchscreen.tap(40, 40)
            else:
                page.keyboard.press("ArrowRight")
        check_stop(page, step, pair, False)
        drawing = page.locator("#art").inner_html()
        page.keyboard.press("l")
        check_stop(page, step, pair, dual)
        require(page.locator("#art").inner_html() == drawing, f"step {step + 1}: language switch changed drawing")
        if dual:
            page.keyboard.press("l")
    page.keyboard.press("ArrowRight")
    position(page, len(durations))
    if dual:
        page.keyboard.press("l")
    page.reload()
    check_stop(page, len(durations), pairs[-1], dual)
    page.keyboard.press("Home")
    position(page, 0)
    page.keyboard.press("End")
    position(page, len(durations))
    return len(pairs)


def run(path, channel):
    from playwright.sync_api import Error
    from python_runtime import chromium_browser

    url = path.resolve().as_uri()
    with chromium_browser(channel) as browser:
        devices = [
            ("projector", (1280, 720), False),
            ("phone portrait", (390, 844), True),
            ("phone landscape", (550, 330), True),
        ]
        for label, size, touch in devices:
            external = []
            errors = []
            context = browser.new_context(offline=True, viewport={"width": size[0], "height": size[1]},
                                          has_touch=touch, reduced_motion="reduce" if touch else "no-preference")
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))

            def record_request(request):
                target = urldefrag(request.url).url
                if target != url and not target.startswith(("data:", "blob:")):
                    external.append(target)

            context.on("request", record_request)
            page.on("websocket", lambda socket: external.append(socket.url))
            try:
                page.goto(url)
                stops = inspect(page, touch)
                require(not errors, f"browser error: {errors[:1]}")
                require(not external, f"external dependency: {external[:1]}")
            except (Error, CheckFailure) as error:
                raise CheckFailure(f"{label}: {error}") from error
            finally:
                context.close()
            print(f"PASS {label} · {stops} stops · offline")
        browser.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path)
    parser.add_argument("--channel", choices=["chrome", "msedge"], help="use an installed browser")
    args = parser.parse_args()
    if not args.html.is_file():
        parser.error("HTML file does not exist")
    sys.dont_write_bytecode = True
    from python_runtime import RuntimeSetupError, ensure_profile

    try:
        ensure_profile("playwright", __file__)
    except (OSError, RuntimeSetupError) as error:
        sys.exit(f"FAIL {error}")
    from playwright.sync_api import Error

    try:
        run(args.html, args.channel)
    except (Error, CheckFailure, RuntimeSetupError) as error:
        message = str(error).strip().splitlines()[0]
        print(f"FAIL {message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
