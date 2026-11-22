# A rotatable Three.js blackboard

The player owns a black WebGL canvas, an orthographic camera, orbit controls, the caption band and the click timeline. The lesson owns the geometry and the math shown beside it. Start with [the 4-ball example](https://github.com/qxryz/manim-blackboard/blob/main/examples/four-ball/lesson.js).

## Scene contract

Export a title, a BCP 47 language tag, and an ordered list of stops. Every stop has a finite numeric `value` and a short `primary` caption. Set `secondaryLanguage` and provide `secondary` at every stop for a bilingual lesson. The camera angle, zoom and caption language stay independent of the selected stop.

The [quarter-turn starter](../assets/starters/quarter-turn.mjs) constructs a rectangular box. Its update function assigns the stop value to the box’s rotation and expresses the angle in degrees beside it. The audience can orbit the box before or after the turn.

`createScene({ THREE, scene, camera, controls, annotation, invalidate })` runs once. Return `update(value)`, and optionally `resize(width, height)` (CSS pixels in the plot area). Set up static meshes, line buffers and text once. Calculate each displayed frame from the absolute value passed to `update`: this also handles rewind, replay, deep links and reduced motion. The player redraws after every update and camera change. Use `invalidate()` if a custom interaction changes the scene outside that cycle. Keep lesson assets local and self-contained.

## A fourth coordinate on a three-dimensional stage

The closed unit 4-ball satisfies **x² + y² + z² + w² ≤ 1**. At **w = c**, its slice satisfies **x² + y² + z² ≤ 1 − c²**. For |c| < 1 the section is a solid ball of radius √(1 − c²). At |c| = 1 the only displayed xyz point is (0,0,0). Outside this interval the section is empty. A lesson that extends the sweep beyond an endpoint should distinguish an empty section from a point.

The example samples −1, −0.8, −0.6, 0, +0.6, +0.8 and +1. At ±0.8 the radius is 0.6; at ±0.6 it is 0.8. Use these pairs to check scale and symmetry. During a transition interpolate **w**, then recompute the radius. A fixed unit tick and a plane through the ball make changes in size and orientation visible. A tiny marker represents the zero-radius limit on screen.

## Build and inspect

Build the starter from the skill root with Node.js 20+. The builder checks esbuild and Three.js before installing any missing packages.

```sh
node scripts/build-three.mjs assets/starters/quarter-turn.mjs -o build/quarter-turn.html
python scripts/check-three.py build/quarter-turn.html
```

Open the HTML in a browser with WebGL 2. Orbit the box and advance the tilt while the camera stays turned. For a slicing lesson, check the first tip, midpoint, matching positive and negative slices, and last tip. [Browser setup](../SKILL.md#build-and-rehearse)
