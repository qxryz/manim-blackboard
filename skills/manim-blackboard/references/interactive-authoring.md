# Author an interactive plot

Use an editable diagram when a viewer can test the lesson's claim by changing a quantity. In the [unit circle](https://github.com/qxryz/manim-blackboard/blob/main/examples/unit-circle/lesson.js), moving a point changes an angle. In [Fourier synthesis](https://github.com/qxryz/manim-blackboard/blob/main/examples/fourier/lesson.js), touching a spectral line adds or removes that frequency from the sum. In the [base-rate lesson](https://github.com/qxryz/manim-blackboard/blob/main/examples/bayes/lesson.js), filtering changes which pieces count toward the denominator.

## Scene interface

Export `title`, `language`, `stops` and `createScene`. A stop has a `primary` caption. For a bilingual lesson, export `secondaryLanguage` and give every stop a `secondary` caption. `createScene` receives the SVG plot, an HTML `readout`, an HTML `controls` region and `getState()`. Create the diagram and its controls once. Return `enter(step, options)` to put them in the state that begins that stop. Step numbering starts at zero.

The [square starter](../assets/starters/square.mjs) lets the audience compare a square’s side length with its area. The grid units stay fixed as the square grows. A range input and each stop feed the same drawing function.

From the skill directory, install the pinned dependencies with Node.js 20 or later and build the scene. For your own scene, substitute the path to your module. The same builder and checker accept a multi-scene deck. [Browser setup](../SKILL.md#build-and-rehearse)

```sh
npm ci
node scripts/build-interactive.mjs assets/starters/square.mjs -o build/square.html
uv run scripts/check-interactive.py build/square.html
```

## Inputs and playback

- Keep a single mathematical state. Update the picture, displayed values and accessible control values together. A stop can supply a useful initial state while its caption remains accurate throughout exploration. When a sentence names one particular answer, anchor it to the preset or update it as the input changes.
- Walk through the planned cases on ordinary board clicks. If the lesson uses first row A and then row B, schedule both in the scene. A learner who wants to explore can tap the labeled row itself. Give an interactive mark a generous hit area, a focus indicator, a name and the equivalent keyboard action. Its click belongs to the mark and leaves the current stop in place. Keep focus on the mark when its values update.
- Native buttons and inputs inside `controls` own their clicks and keyboard actions. For a draggable SVG handle, mark its hit area `data-interact`, map the pointer through the SVG's inverse screen transformation and handle cancellation. Give the same mathematical operation a keyboard or native form alternative. Reserve empty space for the presenter to advance.
- `enter(step, { animate, bilingual, reason })` also runs when a viewer goes back, replays, or opens a particular stop from a link. When `animate` is false, set the final state immediately. If the scene animates, return a promise from `enter` that resolves on completion or cancellation. Provide `settle()` to finish at the intended state. The player consumes a click during that transition to settle it. Cancel obsolete frames when a new gesture takes over. Use `languageChanged(bilingual)` to update local control labels without resetting the learner's inputs.
- Inherit `--bb-font` on live SVG text and HTML readouts. Wrap Chinese text in an element with `lang="zh-Hans"` and use `--bb-font-zh` when overriding font styles. Check changing fonts at the longest caption and largest readout. Keep equations as real text when the symbols can be read and laid out correctly.
