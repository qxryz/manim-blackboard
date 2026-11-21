---
name: manim-blackboard
description: Create presenter-paced, offline HTML presentations that teach a relationship, mechanism or process through animated diagrams, worked examples and hands-on exploration. Use for single demonstrations and multi-scene talks.
---

# Manim Blackboard

Deliver one HTML that opens directly in a browser, in the requested language. Each click lands on a frame where the presenter can pause.

## Shape the explanation

Identify the audience's starting knowledge, speaking time and one question they should be able to answer afterward. Start at the first decision, observation or calculation they can make. Introduce a term when the picture gives the speaker something to point to.

For an algorithm talk, pick a small input the audience can follow from one operation to the next. When presenting a reproduction, tell the audience which part of the published method the project tested. Attribute any measured improvement to the experiment that produced it.

Treat the screen as one blackboard. The audience sees a drawing, the equation it explains, and a short caption. A click starts one authored movement and then the board holds. Keep the diagram and equation in a single composition. A chapter name belongs in the contents unless it helps the audience read the drawing. Use a new scene when the next question calls for a different representation. Choreograph the turn on the board itself. For instance, keep one job label visible as the queue clears, draw the time axis beneath it and seat the label on its interval. Leave the heading and caption still enough to read. The [teaching guide](references/teaching.md) works through a process and a numerical algorithm.

Reveal one interpretable change per click. Give the audience time to follow a specific mark through the operation. A number can travel to the multiplier that consumes it, or a secant can turn about a point until it reaches the tangent. Rehearse every chapter by advancing on the empty board. Keep identities, units and values consistent at the start, midpoint and end. Check worked values independently and verify claims against the supplied material. For a timed talk, read the captions aloud and allow time to point, predict and pause.

## Choose what the audience can do

| What the audience needs to see | Start here |
| --- | --- |
| Follow a construction or watch matching terms move in an equation | [Manim animation](references/authoring.md) |
| Change an input, reorder items, filter a group or compare cases | [Interactive SVG](references/interactive-authoring.md) |
| Inspect depth, a section or a spatial relationship from another angle | [Three.js scenes](references/three-authoring.md) |
| Move between diagrams, explanations and experiments in one talk | [Multi-scene decks](references/deck-authoring.md) |

When the brief specifies Manim, start with the [native click sequence](references/authoring.md). Build the settled picture with actual Manim objects and sample each beat into the HTML. Draw a line with Create, write a new term with Write, or use ReplacementTransform to carry the old term into the next equation. For a long interactive course, keep its mathematical beats on the same stage and attach hit targets to the live diagrams. Schedule the examples needed by the narration on the click sequence. Place optional exploration on the diagram. A learner can tap a labeled row, drag a point or rotate a surface. Omit separate option lists that repeat the scheduled cases. Give each control a question to answer. A filter shows which items still count. Compute the drawing, values and feedback from the same state. Provide a keyboard equivalent for a drag. Changing the camera or language should preserve the example.

## Compose the screen

Use the black stage, light lettering and a restrained accent palette by default. Let the diagram occupy the space its smallest detail needs. Label marks directly and pair color with shape, position or text. Keep controls near what they change and keep the chapter index available on demand. Reserve the projected frame for material the audience uses. Put production notes and sources in accompanying material when the brief calls for a clean stage.

Write one speakable caption per stop. Anchor the diagram, any visible heading, the first formula line and first line of each caption independently. Let additional lines grow down from each anchor. Reserve space for both languages at the actual display width and font. For bilingual lessons, align each translation with the same action, symbols and qualifiers. Check the longest pair, the smallest subscript and any new script in the available fonts. Keep labels as live text where the audience should be able to switch typefaces. Manim outlines retain their authored letterforms. [Typefaces and licensing](references/resources.md)

## Build and rehearse

Keep editable scene files in the requested project. Run the relevant builder from the directory containing this SKILL.md. It includes a runnable starter for each mode. Each guide gives the command. For a new talk, copy the starter into the user’s project and supply that source and the intended output path to the builder. Rebuild to the same HTML path for revisions. For a reader-facing README, explain what the skill produces, link a playable example, and give a quick start that takes someone from a usable prompt to their first click. Put build details in the authoring guides. Give each requested language a complete path through the quick start.

Open the delivered file offline. Check that both normal and reduced motion lead to the same conclusion and that the final frame makes sense if reached directly. On a deck, present across a page boundary, reverse it and jump to a later chapter. During ordinary playback, watch the start, middle and end of an operation in each chapter. Check that marks move and the text beside them stays still as formulas and translations gain lines. Test direct manipulation of an existing mark and its numerical or conceptual consequence. Inspect the densest frame on a projector-sized display and a phone with the companion text visible if supplied. Audio is optional for a topic where hearing a change helps. Keep visual explanations usable in silence.

Use the [rehearsal checks from the worked lessons](references/teaching.md#rehearsal-checks-from-the-worked-lessons) if the narration is doing most of the explaining, a transition changes the meaning of a quantity, or translation shifts the diagram. The [Manim](scripts/check.py), [interactive or multi-scene](scripts/check-interactive.py) and [Three.js](scripts/check-three.py) checkers open the finished file offline. To use an installed Google Chrome, add `--channel chrome` to the check command. For bundled Chromium, first run `uvx --from playwright==1.65.2 playwright install chromium`.
