# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright==1.65.2"]
# ///
"""Check a generated interactive SVG lesson from its standalone HTML file."""

import argparse
import sys
from pathlib import Path
from urllib.parse import urldefrag

from playwright.sync_api import Error, sync_playwright


def require(condition, message):
    if not condition:
        raise ValueError(message)


def current_step(page):
    return int(page.locator("body").get_attribute("data-step"))


def layout(page):
    problem = page.evaluate("""() => {
        const fits = (r, b) => r.left >= b.left - 2 && r.right <= b.right + 2 &&
            r.top >= b.top - 2 && r.bottom <= b.bottom + 2;
        const screen = {left: 0, top: 0, right: innerWidth, bottom: innerHeight};
        for (const el of document.querySelectorAll(
            '#lesson-title, #plot, #readout, #scene-controls, #scene-controls :is(button,input,select)')) {
            if (!el.getClientRects().length ||
                (el.id === 'lesson-title' && document.body.dataset.layout === 'blackboard')) continue;
            const rect = el.getBoundingClientRect();
            if (!fits(rect, screen)) return (el.id || el.tagName) + ' outside viewport';
            if (el.clientWidth && el.scrollWidth > el.clientWidth + 2)
                return (el.id || el.tagName) + ' text or controls overflow horizontally';
        }
        if (document.body.dataset.layout === 'blackboard') {
            const frame = document.querySelector('.bb-plot-frame').getBoundingClientRect();
            const working = document.querySelector('#readout').getBoundingClientRect();
            const drawing = document.querySelector('#plot');
            if (Math.abs((frame.left + frame.right) / 2 - (working.left + working.right) / 2) > 2)
                return 'the diagram and formula bands have different centers';
            if (drawing.getClientRects().length) {
                for (const mark of drawing.querySelectorAll('text,path,line,circle,rect,polygon,polyline')) {
                    if (mark.closest('defs,clipPath,mask,[hidden]') || !mark.checkVisibility({visibilityProperty:true, opacityProperty:true})) continue;
                    const ink = mark.getBoundingClientRect();
                    if (ink.width && ink.height && ink.bottom > working.top + 2)
                        return 'diagram ink overlaps working: ' + (mark.textContent.trim() || mark.tagName);
                }
            }
        }
        const sceneBottom = document.querySelector('#scene').getBoundingClientRect().bottom;
        for (const el of document.querySelectorAll('#subtitles p:not([hidden])')) {
            const range = new Range(); range.selectNodeContents(el);
            const rect = range.getBoundingClientRect();
            if (rect.left < -2 || rect.right > innerWidth + 2 || rect.top < sceneBottom - 2)
                return 'caption overlaps the scene or overflows horizontally';
            // A longer translation can extend down the document on narrow screens.
            if (rect.bottom > innerHeight + 2) {
                const previousY = scrollY;
                scrollTo({top: previousY + rect.bottom - innerHeight, behavior:'instant'});
                const reachable = range.getBoundingClientRect().bottom <= innerHeight + 2;
                scrollTo({top: previousY, behavior:'instant'});
                if (!reachable) return 'the last caption line is unreachable';
            }
        }
        const plot = document.querySelector('#plot');
        if (plot.getClientRects().length) {
            const box = plot.getBBox();
            if (box.width <= 0 || box.height <= 0) return 'empty SVG drawing';
        } else {
            const frame = plot.parentElement;
            const alternate = [...frame.children].some(el => el !== plot && el.getBoundingClientRect().height > 0);
            if (!alternate) return 'no visible drawing';
        }
        // Keep the authored drawing and controls untouched. Shortening only the
        // current captions exposes shifts from re-centering a wrapped paragraph.
        const content = [...document.querySelectorAll('#scene, #plot, #lesson-title, #scene-controls')]
            .filter(el => el.getClientRects().length);
        const tops = content.map(el => el.getBoundingClientRect().top);
        const captions = [...document.querySelectorAll('#subtitles p:not([hidden])')];
        const words = captions.map(el => el.textContent);
        try {
            captions.forEach(el => { el.textContent = '1'; });
            for (const [i, el] of content.entries()) {
                const offset = el.getBoundingClientRect().top - tops[i];
                if (Math.abs(offset) > 1) return el.id + ' moved ' + offset.toFixed(1) + 'px when only the caption changed';
            }
        } finally {
            captions.forEach((el, i) => { el.textContent = words[i]; });
        }
        return '';
    }""")
    require(not problem, f"stop {current_step(page) + 1}: {problem}")


def background_point(page):
    return page.evaluate("() => ({x: 3, y: Math.round(innerHeight / 2)})")


def long_press(context, page):
    finger = background_point(page)
    session = context.new_cdp_session(page)
    try:
        session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [finger]})
        page.wait_for_function("document.body.dataset.bilingual === 'true'", timeout=2000)
    finally:
        session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        session.detach()


def check_inputs(page, selectors='input,button,select'):
    # Each focused input should consume its own activation or arrow key.
    step = current_step(page)
    for control in page.locator(f'#scene-controls :is({selectors})').all():
        if not control.is_visible() or not control.is_enabled():
            continue
        key = control.evaluate("""el => el.type === 'range' || el.tagName === 'SELECT'
            ? 'ArrowRight' : (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'BUTTON'
            ? 'Space' : null)""")
        if key:
            control.focus()
            control.press(key)
            require(current_step(page) == step, f"{key} on a scene control advanced the lesson")
    page.evaluate('document.activeElement?.blur()')


def check_slide_navigation(page, slide_starts):
    expected = list(slide_starts)
    page.keyboard.press('g')
    outline = page.locator('#bb-contents')
    require(outline.is_visible(), 'the slide outline did not open')
    buttons = outline.locator('[data-target-slide]')
    ids = buttons.evaluate_all("els => els.map(el => el.dataset.targetSlide)")
    require(ids == expected, 'outline order differs from the slides reached during playback')
    page.keyboard.press('Escape')
    require(not outline.is_visible(), 'slide outline did not close')
    for index in reversed(range(len(ids))):
        page.keyboard.press('g')
        buttons.nth(index).click()
        slide = ids[index]
        require(current_step(page) == slide_starts[slide], f'outline opened the wrong stop for {slide}')
        require(page.locator('body').get_attribute('data-slide') == slide, f'could not remount {slide}')
        require(not outline.is_visible(), 'outline stayed open after navigation')
    if len(ids) > 1:
        page.emulate_media(reduced_motion='no-preference')
        page.keyboard.press('PageDown')
        require(current_step(page) == slide_starts[ids[1]], 'PageDown did not go to the next slide')
        settled = page.evaluate("""() => {
            const state = document.body.dataset;
            if (state.animating !== 'true') return true;
            const step = state.step;
            document.querySelector('#stage').dispatchEvent(new KeyboardEvent('keydown', {key:' ', bubbles:true}));
            return state.step === step && state.animating === 'false';
        }""")
        require(settled, 'finishing the drawing skipped a stop or left it moving')
        # Reverse before the new diagram finishes drawing. An interrupted turn
        # must leave one live scene and must not consume the navigation key.
        page.keyboard.press('PageUp')
        require(current_step(page) == slide_starts[ids[0]], 'PageUp did not go to the previous slide')
        page.keyboard.press('PageDown')
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_function("""() => matchMedia('(prefers-reduced-motion: reduce)').matches &&
            !document.getAnimations().some(a => a.id.startsWith('bb-') && a.playState === 'running')""")
        page.keyboard.press('PageUp')
        require(page.locator('#plot').count() == 1 and page.locator('#scene-controls').count() == 1,
                'interrupted navigation left duplicate plots or controls')
        require(page.locator('#lesson-title').inner_text().strip() and current_step(page) == slide_starts[ids[0]],
                'changing motion preference lost the current slide')


def inspect(context, page, touch):
    page.wait_for_selector('#stage #plot', state='attached')
    page.wait_for_selector('body[data-step="0"]', state='attached')
    page.evaluate('document.fonts.ready')
    page.keyboard.press('End')
    last = current_step(page)
    page.keyboard.press('Home')
    require(current_step(page) == 0, 'Home did not return to the opening')
    page.keyboard.press('l')
    dual = page.locator('body').get_attribute('data-bilingual') == 'true'
    if dual:
        page.keyboard.press('l')
    figure = page.locator('.bb-plot-frame, #plot').first
    if dual and touch:
        long_press(context, page)
        require(current_step(page) == 0, 'long press changed the stop')
        page.keyboard.press('l')

    is_deck = page.locator('body').get_attribute('data-slide') is not None
    slide_starts = {}
    for step in range(last + 1):
        if step:
            finger = background_point(page)
            if touch:
                page.touchscreen.tap(finger['x'], finger['y'])
            else:
                page.mouse.click(finger['x'], finger['y'])
        require(current_step(page) == step, f'could not advance to stop {step + 1}')
        require(page.locator('#primary').inner_text().strip(), 'empty spoken caption')
        if is_deck:
            slide = page.locator('body').get_attribute('data-slide')
            first = slide_starts.setdefault(slide, step)
            require(page.locator('body').get_attribute('data-local-step') == str(step - first),
                    f'{slide} has inconsistent local stop numbering')
        layout(page)
        if dual:
            original = figure.bounding_box()
            page.keyboard.press('l')
            translation = page.locator('#secondary')
            require(translation.is_visible() and translation.inner_text().strip(), 'missing translation')
            translated = figure.bounding_box()
            if original and translated and abs(original['height'] - translated['height']) <= 1:
                require(abs(original['y'] - translated['y']) <= 1,
                        f'stop {step + 1}: the drawing moved when the translation was shown')
            layout(page)
            page.keyboard.press('l')
        # A deck button can intentionally navigate to a different chapter.
        check_inputs(page, 'input,select' if is_deck else 'input,button,select')
    page.keyboard.press('r')
    require(current_step(page) == last, 'replay changed the stop')
    if dual:
        page.keyboard.press('l')
    page.reload()
    page.wait_for_selector(f'body[data-step="{last}"]', state='attached')
    require(page.locator('#secondary').is_visible() == dual, 'reload lost the caption mode')
    if last:
        page.keyboard.press('ArrowLeft')
        require(current_step(page) == last - 1, 'previous-stop shortcut failed')
    page.keyboard.press('t')
    require(page.locator('#bb-type-dialog').is_visible(), 'typeface shortcut did not open the picker')
    previous = current_step(page)
    page.keyboard.press('Escape')
    if previous < last:
        page.keyboard.press('ArrowRight')
        require(current_step(page) == previous + 1, 'the picker consumed the next navigation key')
    require(not page.locator('#bb-type-dialog').is_visible(), 'typeface picker stayed open')
    if is_deck:
        check_slide_navigation(page, slide_starts)
    return last + 1, len(slide_starts)



def check_text_tracks(page, count, bilingual):
    # Use the rendered first character to catch wrapping, altered line-height
    # and vertical alignment. A fixed parent rectangle can hide all three.
    measure = """() => {
        const select = q => document.querySelector(q);
        function firstInk(q) {
            const el = select(q);
            if (el.hidden || el.getBoundingClientRect().width <= 1) return null;
            const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let text; text = walk.nextNode();) {
                const start = text.data.search(/\\S/);
                if (start < 0 || text.parentElement.closest('[aria-hidden="true"],style,script')) continue;
                const range = new Range();
                range.setStart(text, start); range.setEnd(text, start + 1);
                const rect = range.getClientRects()[0];
                if (rect) return rect.top + scrollY;
            }
            return null;
        }
        const top = q => select(q).getBoundingClientRect().top + scrollY;
        return {scene:document.body.dataset.slide, layout:document.body.dataset.layout,
            frame:top('.bb-plot-frame'), working:top('#readout'), title:firstInk('#lesson-title'),
            formula:firstInk('#readout'), english:firstInk('#primary'), translation:firstInk('#secondary')};
    }"""
    page.keyboard.press('Home')
    if bilingual and page.locator('body').get_attribute('data-bilingual') != 'true':
        page.keyboard.press('l')
    page.emulate_media(reduced_motion='no-preference')
    page.clock.install()
    base = None
    for step in range(count):
        if step:
            page.keyboard.press('ArrowRight')
        require(current_step(page) == step, 'motion check failed to reach the requested stop')
        first = page.evaluate(measure)
        frames = [first]
        for elapsed in (200, 350):
            page.clock.run_for(elapsed)
            frames.append(page.evaluate(measure))
        if page.locator('body').get_attribute('data-animating') == 'true':
            page.keyboard.press('ArrowRight')
        require(current_step(page) == step, 'settling an animation changed its stop')
        frames.append(page.evaluate(measure))
        for frame in frames:
            if base is not None:
                same_scene = frame['scene'] == base['scene']
                same_board = frame['layout'] == base['layout'] == 'blackboard'
                keys = ['title', 'formula'] if same_scene else []
                if same_scene or same_board:
                    keys += ['frame', 'working', 'english', 'translation']
                for key in keys:
                    a, b = frame[key], base[key]
                    if a is not None and b is not None:
                        require(abs(a - b) <= 2, f'stop {step + 1}: {key} moved {a - b:+.1f}px')
            base = frame

def run(path, channel):
    url = path.resolve().as_uri()
    with sync_playwright() as engine:
        browser = engine.chromium.launch(channel=channel, args=[
            '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'
        ])
        for label, size, touch in [('projector', (1280, 720), False), ('desktop', (1850, 929), False),
                                   ('portrait', (390, 844), True), ('landscape', (568, 320), True)]:
            context = browser.new_context(offline=True, has_touch=touch, reduced_motion='reduce',
                                          viewport={'width': size[0], 'height': size[1]})
            problems = []

            def audit(request):
                target = urldefrag(request.url).url
                if target != url and not target.startswith(('data:', 'blob:')):
                    problems.append('external resource: ' + target)

            context.on('request', audit)
            page = context.new_page()
            page.on('pageerror', lambda error: problems.append(str(error)))
            page.on('websocket', lambda socket: problems.append('websocket: ' + socket.url))
            try:
                page.goto(url)
                count, slides = inspect(context, page, touch)
                if slides and label in ('desktop', 'portrait'):
                    check_text_tracks(page, count, not page.locator('#language-help').evaluate('el => el.hidden'))
                require(not problems, ', '.join(problems))
                chapters = f'{slides} slides · ' if slides else ''
                print(f'PASS {label} · {chapters}{count} stops · offline')
            except (ValueError, Error) as error:
                raise ValueError(f'{label}: {error}') from error
            finally:
                context.close()
        browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('html', type=Path)
    parser.add_argument('--channel', choices=['chrome', 'msedge'], help='use an installed browser')
    options = parser.parse_args()
    if not options.html.is_file():
        parser.error('HTML file does not exist')
    try:
        run(options.html, options.channel)
    except (ValueError, Error) as error:
        sys.exit(f'FAIL {error}')
