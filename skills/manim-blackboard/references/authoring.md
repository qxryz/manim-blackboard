# Author a lesson

A lesson is a Python module with a title, BCP 47 language tag(s) and a `build(board)` function. The builder loads the module with Manim's Cairo renderer active.

Build a one-click number line with the [distance starter](../assets/starters/distance.py). Its fixed dot marks zero. The next click draws two units to the right and updates both captions.

## The scene

- `board.add(*objects)` stages the opening objects. `board.freeze(primary=..., secondary=...)` captures the opening once. Supply at least one `board.beat(*animations, primary=..., secondary=..., duration=..., hold=...)` after it.
- A beat runs its animations together. Give `duration` in seconds. Use Manim's `Succession` or `AnimationGroup` for a sequence within a single click. A hold lasts until the presenter advances.
- If you pass `hold`, list **all** objects that should remain in the scene in paint order, back to front. It replaces the visible scene for that stop and the start of the next beat. Reuse the transformed object after `Transform`, or the target after `ReplacementTransform`. Omitting `hold` uses Manim's normal animation cleanup.
- Use a nonempty primary caption for every stop. Set `SECONDARY_LANGUAGE = None` or omit it for a single-language lesson and omit secondary captions. For bilingual lessons, supply a translation for every stop.
- Compose on a 16:9 plane approximately 14.22 units wide and 8 units tall, centered on the origin. Use flat vector objects such as lines, dots, groups, curves, outlined text and local SVG paths. The player reserves a separate band for captions. Raster images, 3D shading and camera motion require different rendering support.

## Type, formulas and assets

The builder registers the bundled STIX Two Text Italic and Lora Italic for use on the diagram. To match the secant lesson, use `Text("Slope", font="STIX Two Text", slant="ITALIC")`. An exported vector label keeps those shapes when the viewer changes the live caption font. Use Pango text and Manim lines for simple math, or `MathTex` with a working system LaTeX installation and `dvisvgm` for complex expressions. For Chinese inside the diagram, choose a CJK font available at build time and inspect its glyphs. [Live type and script coverage](resources.md)

For a local diagram, resolve the path relative to the lesson's own `__file__`. Import it with `SVGMobject` and verify the vector shapes survived the conversion. The lesson file is executable Python; build scenes you have authored or reviewed.

## Build and inspect

Run these commands from the skill directory with Python 3.10+ (`python3` on macOS/Linux if needed). The builder selects an interpreter with a working Manim installation or prepares a private environment. The distance starter uses no TeX. [Runtime setup](setup.md)

```sh
python scripts/build.py assets/starters/distance.py -o build/lesson.html
python scripts/check.py build/lesson.html
```

The exporter samples real Manim animations at 24 frames per second by default. Use `--fps 12` for draft builds of lengthy transitions. Static letters and shapes share stored paths across frames. To reduce a large file, simplify imported geometry and replace large groups of moving text with fixed labels before lowering the presentation frame rate.

For a Manim sequence inside an interactive deck, the number-line example samples one curve and its moving dot into local geometry. Its slide imports those samples and reuses the same mark on each click. In a checkout of the examples repository, regenerate those samples from its root with `python skills/manim-blackboard/scripts/python_runtime.py manim -- examples/neural-network/weighted-motion.py`. [Manim sampling source](https://github.com/qxryz/manim-blackboard/blob/main/examples/neural-network/weighted-motion.py) · [Slide using the samples](https://github.com/qxryz/manim-blackboard/blob/main/examples/neural-network/forward.js)

Open the resulting HTML locally. Advance during movement to settle at a hold, go back and replay it. For Chromium setup or an existing Chrome installation, see [Build and rehearse](../SKILL.md#build-and-rehearse).

## A native beat inside an interactive course

The [opening construction](https://github.com/qxryz/manim-blackboard/blob/main/examples/neural-network/opening-manim.py) lays out the target and prediction as Manim objects. On the next click the letters become the subtraction, the numerals land on a number line and an arrow measures the signed difference. The [course entry scene](https://github.com/qxryz/manim-blackboard/blob/main/examples/neural-network/bookends.js) plays the exported vector outlines at their authored timing, stops on the exact last frame and leaves the prediction mark available to the following scene. The input handles for later experiments live on the same black stage. Use this approach when a talk needs both a typeset derivation and a diagram that the audience can manipulate.
