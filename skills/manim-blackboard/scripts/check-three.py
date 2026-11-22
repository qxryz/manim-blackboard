"""Exercise a standalone Three.js blackboard offline in Chromium."""

import argparse
import base64
import sys
from pathlib import Path
from urllib.parse import urldefrag

def require(condition, message):
    if not condition:
        raise ValueError(message)


def settled(page, step):
    page.wait_for_function(
        """step => document.body.dataset.step === String(step)
            && document.body.dataset.animating === 'false'""",
        arg=step, timeout=6000,
    )
    return float(page.locator("body").get_attribute("data-value"))


def image_signature(page, canvas):
    # Capture the composited WebGL image. Reading an on-demand framebuffer
    # after the browser has discarded it could report black for a valid scene.
    png = base64.b64encode(canvas.screenshot()).decode("ascii")
    return page.evaluate("""async png => {
        const image = await createImageBitmap(new Blob(
            [Uint8Array.from(atob(png), c => c.charCodeAt(0))], {type: 'image/png'}));
        const probe = document.createElement('canvas');
        probe.width = 192;
        probe.height = Math.max(1, Math.round(192 * image.height / image.width));
        const ctx = probe.getContext('2d');
        ctx.drawImage(image, 0, 0, probe.width, probe.height);
        image.close();
        const values = ctx.getImageData(0, 0, probe.width, probe.height).data;
        let lit = 0, hash = 2166136261;
        for (let i = 0; i < values.length; i += 4) {
            const rgb = (values[i] << 16) | (values[i+1] << 8) | values[i+2];
            if (Math.max(values[i], values[i+1], values[i+2]) > 16) lit++;
            hash = Math.imul(hash ^ rgb, 16777619);
        }
        return [lit, hash >>> 0];
    }""", png)


def check_layout(page):
    issue = page.evaluate("""() => {
        for (const selector of ['#visual canvas', '#annotation', '#primary', '#secondary']) {
            const el = document.querySelector(selector);
            if (!el?.getClientRects().length) continue;
            const rect = el.getBoundingClientRect();
            if (rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1
                || rect.bottom > innerHeight + 1) return selector + ' outside screen';
            if (el.scrollWidth > el.clientWidth + 2) return selector + ' horizontal overflow';
        }
        return null;
    }""")
    require(not issue, issue)


def inspect(page, touch):
    canvas = page.locator("#visual canvas")
    canvas.wait_for(timeout=6000)
    require(canvas.evaluate("c => Boolean(c.getContext('webgl2'))"), "missing WebGL2 context")
    settled(page, 0)
    page.keyboard.press("End")
    last = int(page.locator("body").get_attribute("data-step"))
    page.keyboard.press("Home")
    settled(page, 0)
    box = canvas.bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2

    if not touch and last:
        page.mouse.click(x, y)
        require(page.locator("body").get_attribute("data-animating") == "true",
                "click did not start the first transition")
        page.keyboard.press("Space")
        settled(page, 1)
        page.keyboard.press("r")
        settled(page, 1)
        page.keyboard.press("ArrowLeft")
        settled(page, 0)

    page.emulate_media(reduced_motion="reduce")
    for step in range(last + 1):
        if step:
            if touch:
                page.touchscreen.tap(x, y)
            else:
                page.keyboard.press("ArrowRight")
        value = settled(page, step)
        caption = page.locator("#primary").inner_text()
        require(caption.strip(), f"empty caption at stop {step + 1}")
        check_layout(page)
        page.keyboard.press("l")
        if page.locator("body").get_attribute("data-bilingual") == "true":
            require(page.locator("#secondary").is_visible()
                    and page.locator("#secondary").inner_text().strip(),
                    f"missing translation at stop {step + 1}")
            check_layout(page)
            page.keyboard.press("l")
        require(settled(page, step) == value, "caption toggle changed the lesson parameter")

    page.keyboard.press("Home")
    middle = min(last, max(1, last // 2))
    for _ in range(middle):
        page.keyboard.press("ArrowRight")
    value = settled(page, middle)
    lit, drawing = image_signature(page, canvas)
    require(lit > 2, "the WebGL canvas is blank")
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + box["width"] * 0.23, y + box["height"] * 0.13, steps=10)
    page.mouse.up()
    require(settled(page, middle) == value, "drag changed the parameter")
    lit, rotated = image_signature(page, canvas)
    require(lit > 2 and rotated != drawing, "drag produced no visible rotation")
    page.mouse.wheel(0, 60)
    require(settled(page, middle) == value, "wheel changed the parameter")
    page.keyboard.press("l")
    page.reload()
    require(settled(page, middle) == value, "reload lost the selected stop")
    return last + 1


def run(path, channel):
    from playwright.sync_api import Error
    from python_runtime import chromium_browser

    url = path.resolve().as_uri()
    with chromium_browser(channel, args=[
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    ]) as browser:
        for name, size, touch in (("projector", (1280, 720), False),
                                  ("portrait", (390, 844), True),
                                  ("landscape", (550, 330), True)):
            context = browser.new_context(viewport={"width": size[0], "height": size[1]},
                                          has_touch=touch, offline=True,
                                          reduced_motion="reduce" if touch else "no-preference")
            errors, outside = [], []
            def audit(request):
                target = urldefrag(request.url).url
                if target != url and not target.startswith(("data:", "blob:")):
                    outside.append(target)
            context.on("request", audit)
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("websocket", lambda ws: outside.append(ws.url))
            try:
                page.goto(url)
                count = inspect(page, touch)
                require(not errors, f"browser error: {errors[:1]}")
                require(not outside, f"external resource: {outside[:1]}")
                print(f"PASS {name} · {count} stops · WebGL2 offline")
            except (Error, ValueError) as error:
                raise ValueError(f"{name}: {error}") from error
            finally:
                context.close()
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path)
    parser.add_argument("--channel", choices=["chrome", "msedge"], help="use an installed browser")
    options = parser.parse_args()
    if not options.html.is_file():
        parser.error("HTML file does not exist")
    sys.dont_write_bytecode = True
    from python_runtime import RuntimeSetupError, ensure_profile

    try:
        ensure_profile("playwright", __file__)
    except (OSError, RuntimeSetupError) as error:
        sys.exit(f"FAIL {error}")
    from playwright.sync_api import Error

    try:
        run(options.html, options.channel)
    except (Error, ValueError, RuntimeSetupError) as error:
        sys.exit(f"FAIL {error}")
