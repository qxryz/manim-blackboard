# Type, motion and diagrams

## Typeface choices

The default **Classic** setting follows the secant lesson. Its diagrams, equations and titles use the embedded STIX Two Text Italic. English captions use the device’s Georgia, Times New Roman or default serif. Chinese captions prefer the device’s Kai or Song face and have an embedded Kai fallback. Press **T** or open **Aa** to change the live typeface. Browsers that allow local storage remember an explicit choice. [STIX font license](../assets/fonts/stix-two-text-OFL.txt)

Three optional Fontshare families include regular and italic WOFF2s and their copyright notices in each offline HTML. [Fontshare open-source license](https://www.fontshare.com/licenses/sil-ofl)

| Face | Chinese pairing | Source |
| --- | --- | --- |
| Lora 3.004 | Blackboard Song | [Fontshare family](https://www.fontshare.com/fonts/lora) · [License](../assets/fonts/lora-OFL.txt) |
| Public Sans 2.001 | Blackboard Hei | [Fontshare family](https://www.fontshare.com/fonts/public-sans) · [License](../assets/fonts/public-sans-OFL.txt) |
| JetBrains Mono 2.251 | Blackboard Kai | [Fontshare family](https://www.fontshare.com/fonts/jet-brains-mono) · [License](../assets/fonts/jetbrains-mono-OFL.txt) |

The Manim build registers the original STIX Two Text Italic TTF and the Lora Italic OTF from Fontshare. Use `Text("A tangent", font="STIX Two Text", slant="ITALIC")` to reproduce the default drawing style. Manim exports letterforms as paths that retain their shape when a viewer changes live text. Use mathematical typesetting for stacked fractions, matrices and multiline derivations.

The Chinese faces cover the bundled presentations’ Chinese text. Blackboard Song comes from Noto Serif CJK SC 2.003, Blackboard Hei from Noto Sans CJK SC 2.004, and Blackboard Kai from LXGW WenKai Mono 1.530. The renamed subsets ship with their original OFL notices. Characters outside a subset fall back to installed fonts. [Noto Serif CJK](https://github.com/notofonts/noto-cjk/tree/main/Serif) · [Noto Sans CJK](https://github.com/notofonts/noto-cjk/tree/main/Sans) · [LXGW WenKai](https://github.com/lxgw/LxgwWenKai/releases/tag/v1.530)

## When a lesson needs another resource

These three resources are listed in César Eduardo’s directory. Use them during authoring. The exported lesson can then play offline. [Design Engineer Resources](https://resources.cesaroeduardo.com/)

| Authoring decision | How to use the reference |
| --- | --- |
| Would a different typeface read better? | Preview a real heading, a minus sign, a superscript, and your smallest label on black. Check the family’s license before bundling its files. Fontshare distinguishes OFL families from those under the ITF Free Font License. Keep the original notice for any font you redistribute and check coverage for each presentation language. [Fontshare](https://www.fontshare.com/) · [License terms](https://fontshare.com/licenses/sil-ofl) |
| Can the eye follow a moving object? | Watch a transition once, then sketch its first and last positions. Try the same movement with a point or a line in Manim. At the midpoint the viewer should still be able to identify the object they were following. [60fps](https://60fps.design/) |
| Is an imported vector diagram too heavy? | Run a copy of an original or licensed SVG through SVGOMG before giving it to `SVGMobject`. Compare the original and optimized outlines at the final presentation size. Keep the viewBox, meaningful groups and holes inside letters. A lower point count is worthwhile only if the intermediate morph also looks right. [SVGOMG](https://jakearchibald.github.io/svgomg/) |
