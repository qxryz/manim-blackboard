# A multi-scene blackboard talk

Organize a long explanation into scenes the presenter can revisit. Within each scene, a click draws or changes something on the same blackboard. Open a new scene when the explanation needs a different representation. The entire sequence compiles to one offline HTML. The [two-scene starter](../assets/starters/scale-deck.mjs) carries a six-unit length from multiplication into division.

## Sequence the scenes

Import `defineDeck` from `blackboard-deck`. The builder resolves that module from the installed skill, including when your scene lives in a different directory. A complete course exports `title`, `language`, optional `secondaryLanguage`, `stops` and `createScene`. For example, the entry point for a two-chapter course can be as short as this:

```js
import { defineDeck } from 'blackboard-deck';
import { neuronSlides } from './neuron.js';
import { gradientSlides } from './gradient.js';

export const title = 'How a neuron learns';
export const language = 'en';
export const secondaryLanguage = 'zh-Hans';
export const { stops, createScene } = defineDeck([...neuronSlides, ...gradientSlides]);
```

A slide declares a unique `id` (a lowercase slug beginning with a letter), a `chapter`, a `title`, an array of `steps` and a `mount` function. Each step carries the same `primary` and optional `secondary` caption as a single plot. Adjacent slides with the same chapter name share a group in the contents. Optional `titleZh` and `chapterZh` strings translate the contents for a Chinese companion edition.

```js
export const neuronSlides = [{
  id: 'weighted-input', chapter: 'Forward pass', chapterZh: '前向传播',
  title: 'Weight one input', titleZh: '给输入加权',
  steps: [
    { primary: 'The input has value two.', secondary: '输入的值为二。' },
    { primary: 'A weight of three triples the input.', secondary: '权重为三，输入就放大三倍。' }
  ],
  mount({ svg }) {
    svg.setAttribute('viewBox', '0 0 600 240');
    svg.innerHTML = '<path d="M60 150H540" stroke="#707a80"/><line x1="60" x2="200" y1="150" y2="150" stroke="#83d8c9" stroke-width="5"/><circle cx="200" cy="150" r="7" fill="#83d8c9"/><g fill="#f7f5ef" text-anchor="middle" font-size="24"><text x="60" y="190">0</text><text x="200" y="190">2</text><text x="480" y="190">6</text></g>';
    const segment = svg.querySelector('line'), tip = svg.querySelector('circle');
    let motion;
    function paint(x) {
      segment.setAttribute('x2', x);
      tip.setAttribute('cx', x);
    }
    return {
      enter(step, {animate}) {
        paint(step ? 480 : 200);
        if (!step || !animate) return;
        // The browser scales the measured segment about its origin. Its tip
        // follows the identical 280-unit change on the number line.
        const timing = {duration: 1350, easing: 'ease-in-out'};
        segment.style.transformOrigin = '60px 150px';
        motion = [
          segment.animate([{scale: '0.333333 1'}, {scale: '1 1'}], timing),
          tip.animate([{translate: '-280px 0'}, {translate: '0 0'}], timing),
        ];
        return Promise.all(motion.map(part => part.finished.catch(() => {})));
      },
      settle() { motion?.forEach(part => part.cancel()); }
    };
  }
}];
```

`mount` receives fresh `svg`, `plotHost`, `readout` and `controls` nodes on each visit, plus `getState()`, `invalidate()` and `navigate(slideId, localStep = 0)`. Use `plotHost` for a live canvas beside the SVG. Hide the SVG with `svg.setAttribute('hidden', '')` on a canvas-only slide. Give the canvas a logical size at portrait and landscape widths. Return `enter(localStep, {animate, bilingual, reason})` and any relevant `settle()`, `languageChanged(bilingual)`, `render(now)` and `dispose()` methods. The [single-plot interface](interactive-authoring.md) explains numerical state, pointer input and animation promises.

Each revisit remounts the slide at its requested local step. If an experiment should carry between slides, use a shared model and derive every number and caption from it. Release resources in the returned `dispose()` method when the slide leaves view, including orbit controls, renderer, observers, event handlers attached outside the slide and animation frames. DOM events attached only to the replaced slide elements go away with them.

## Carry an object into the next view

Suppose the speaker draws a moving point on a distance–time graph, then calculates its speed. Keep the two axis labels in place while the point travels. At the next scene, the same interval of two seconds can move from its bracket on the graph to the denominator of the fraction. The audience can follow where that number came from.

Give the visible interval label the same `data-bb-anchor` in the two adjacent scenes. Use each key once in a scene. Both of these labels refer to the duration of the same observation.

```html
<!-- On the graph -->
<text x="210" y="260" data-bb-anchor="elapsed-time">2 s</text>
<!-- In the next scene, below the fraction bar -->
<text x="450" y="195" data-bb-anchor="elapsed-time">2 s</text>
```

Mark a specific label or geometric object the viewer can track. If a control changes that interval, carry the current value through or match only the symbol. A repeated numeral alone is insufficient to establish identity. For a mathematical operation with its own intermediate states, implement the motion in the scene so that geometry and numbers agree throughout. Make the final diagram intelligible when reached directly or with reduced motion.

## Frame the picture

Use one black stage for the whole sequence. Center the active drawing, place its live working just below it and anchor the narration separately. A scene title doubles as its entry in the contents. Draw a heading in the composition only when it identifies something the speaker needs to name. When one representation turns into the next, leave a shared quantity visible or draw the new construction where the old one settled.

## Navigation and checks

- Click the background, use Space or the arrows, or swipe horizontally on a blank area to move by one step. `R` replays the current step. `Page Up` and `Page Down` jump to adjacent slides. `Home` and `End` select the first and last stops of the entire talk.
- The unobtrusive upper-left Contents button and `G` open a chapter index. The list keeps the current slide marked. Selecting an entry opens its first step. `Esc` returns to the stage. The upper-right `Aa` button and `T` select the typeface.
- `#dual` opens both caption languages. A link ending in `#step-12-dual` selects the twelfth global stop. Internal calls use zero-based local indices. For browser checks, `body.dataset.slide` is the active slide ID and `body.dataset.localStep` is the active step within it.
- Rehearse the deck in order, then jump to the last reveal of a later slide and go backwards. Confirm that revisiting a slide creates one copy of its controls, recovers the intended values, and releases any prior WebGL context or observer. Check touch swipes starting on a slider or rotatable object preserve the current step.

```sh
node scripts/build-interactive.mjs assets/starters/scale-deck.mjs -o build/course.html
python scripts/check-interactive.py build/course.html
```
