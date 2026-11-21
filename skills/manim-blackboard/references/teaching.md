# Teaching a relationship through motion

Choose the drawing by asking what the audience will be able to infer from its final state. Rehearse a sentence that names the part of the diagram they should look at and what changed there. If the caption already gives the whole answer while the drawing stays the same, make the missing operation visible.

## A process across several pages

Suppose three jobs reach one printer at time zero, queued A, B, C. They take 4, 1 and 1 minutes respectively. The audience's question is “How much waiting does the job order create?” Choose the order before printing begins and run each job to completion.

| Page | Visible step | Question for the audience |
| --- | --- | --- |
| Queue | Put the three labeled jobs in a line. Print A, then B, then C. Each card still shows its own duration. | Which job is last to start? |
| Timeline | Carry the same labels into intervals on one time axis. Mark the start times 0, 4 and 5. Show the gaps from arrival to each start. | Can you read each wait directly from the picture? |
| Comparison | Move B and C ahead of A. Let the learner switch orders and recompute both timelines on a fixed scale. The new waits are 0, 1 and 2 minutes. | Why did the average wait fall from 3 minutes to 1 even though the printer stays busy for 6 minutes in both orders? |

The queue page establishes identity. The timeline changes how time is represented. Across that turn, the label B can move to the start of B's interval. Keep any text that changes value out of the shared label. Different orders produce different start times. If a learner has selected their own order, carry it forward or visibly restore the named preset before making a claim about that order.

In a qualitative talk the same pattern works with an observation and an interpretation. For example, a sentence can keep the same highlighted pronoun across two readings. Moving its connection to a different noun can show why the two readings have different meanings.

## A numerical algorithm on one board

Suppose the audience knows exponents and probabilities. Ask “How can we compute softmax when a score is very large?” Keep the scores in fixed rows so that each output can be traced to its input.

| Click | What changes on screen | What the speaker can point out |
| --- | --- | --- |
| Begin with raw scores | The exponentiation column for 1000, 999 and 998 overflows in float64. | All three scores are close to one another. |
| Subtract the maximum | Subtract 1000 in every row. Their new values are 0, −1 and −2. | The largest exponential is now 1. |
| Explain the shift | In a symbolic softmax fraction, show the common factor from the shift in numerator and denominator, then cancel it. | Scaling all three weights by the same positive number preserves each share of the total. |
| Normalize | Turn weights 1, exp(−1) and exp(−2) into aligned bars of approximately 0.665, 0.245 and 0.090. | The bars sum to 1 to the displayed precision. |

Compute the shifted logits directly. The symbolic cancellation explains the identity in exact arithmetic. Very small weights can still round to zero in floating point.

## Compose one continuous board

Suppose a measured return already occupies the center of the board. On the next click the time window stays put, the return moves into a longer equation and the starting value is written after a minus sign. The presenter can point to precisely what was subtracted. In Manim the shared terms can be a VGroup passed to ReplacementTransform, with Write introducing the new suffix. Keep the accented term the same color throughout its move and leave the finished equation in place for the speaker.

Keep sectional titles in the chapter index. Use the space above the subtitles for the objects the explanation needs. A matrix may occupy the full board, while a loss calculation needs only two points and their separation. A phone can put the equation just below its drawing without changing the click sequence.

## Choose the transition

Move a shared label or mark between adjacent views when it represents the same thing in both. A dot estimated at noon can meet the noon point on a time-series chart. A common accent alone is insufficient evidence that two marks correspond. For a new topic, clear the old marks and draw the first object in place. Let that action settle before the speaker needs to read. Apply movement to the object the audience is following and keep the page frame stationary.

Inspect one frame halfway through the busiest page turn. The outgoing relationship should still be recognizable and the destination should become clear. Recheck the destination with motion reduced and with the longest caption. A viewer who skipped directly there should see the same evidence.

## Rehearsal checks from the worked lessons

**Can the speaker point to the operation?** In the backward pass, a gradient of 1 travels to the local multiplier 2. The value leaving that node is 2. Stop at the multiplier and ask the audience what number should arrive at the next node. If a caption about the chain rule is the only way to answer, expose the incoming gradient and the local multiplication in the drawing. [Play the calculation](https://qxryz.github.io/manim-blackboard/examples/neural-network/#step-21)

**Does the path tell the truth between stops?** Move the ReLU input from +1 to −1. Interpolating straight between the two plotted endpoints makes the dot cut across the corner. Animate the input and compute its height as `max(0, z)` on every frame. Inspect the crossing at zero, finish the motion with a click and compare its endpoint with a direct link to the same step. [ReLU construction](https://github.com/qxryz/manim-blackboard/blob/main/examples/neural-network/forward.js)

**What exactly carries over?** In attention, three bars for query C become three weights on the value diagram. Each weight still belongs to a particular query–key pair. Let the audience click the empty board to advance from the unmasked middle token B to the masked calculation. Touching a labeled value in the diagram can reveal its contribution at either stop. C is now excluded, the remaining two weights are ½ each, and the output is (1, ½). Use a caption whose numbers refer to the visible row and mask state. [Attention scenes](https://github.com/qxryz/manim-blackboard/blob/main/examples/neural-network/attention.js)

**What stays fixed in an experiment?** In the worked network, a learning rate of 0.025 reduces the loss from 0.5 to about 0.064 when all five parameters update. The 3D plot varies only two weights and holds the others fixed. The same learning rate there gives 0.125. State the fixed quantities when introducing the surface and connect the scenes at their common starting loss. Ask the learner to change the rate once and verify the new value in the readout. [Full update](https://github.com/qxryz/manim-blackboard/blob/main/examples/neural-network/backward.js) · [Two-weight surface](https://github.com/qxryz/manim-blackboard/blob/main/examples/neural-network/landscape.js)

**Can you see it happen on an ordinary click?** Start with the [secant lesson](https://github.com/qxryz/manim-blackboard/blob/main/examples/derivative/lesson.py). Point to the fixed dot as the other dot slides and the line pivots. Try the same rehearsal in each chapter of a longer talk. Watch a contribution leave its source, reach a multiplier, then appear in the sum. Give the intermediate state enough time to read. A curtain fade between two finished diagrams can conceal that whole calculation.

**Where did your eye have to move?** Watch the first word of the heading, the first line of the calculation and the first word of *each* subtitle as a short stop gives way to a long one. A drawing can stay put while an extra line of algebra shifts the heading, or an English line wrap pushes the Chinese translation down. Reserve independent start positions for those regions across adjacent stops. Measure at the start, middle and end of a real click in both languages, at a projector width and on a phone. Repeat with the widest font, and check that the last line of a long passage can be reached. [Playback checks](../scripts/check-interactive.py)

## Further reading

The question-first storyboard and hold-frame checks draw on [Manim Composer](https://github.com/adithya-s-k/manim_skill/blob/main/skills/manim-composer/SKILL.md). For equation layout, see [ManimCE Best Practices](https://github.com/adithya-s-k/manim_skill/blob/main/skills/manimce-best-practices/SKILL.md). For fitting a composition into different browser viewports, see [Frontend Slides](https://github.com/zarazhangrui/frontend-slides/blob/main/SKILL.md).
