# Lesson sources · 课件源码

[Open the lesson gallery · 浏览课件](https://qxryz.github.io/manim-blackboard/examples/)

Each folder includes the playable `index.html`, its `preview.webp` and the source used to build the lesson. 下载仓库后，用浏览器打开本目录的 [index.html](index.html) 即可离线选课。

| Lesson · 课件 | Editable source · 源码 | Builder · 构建器 |
| --- | --- | --- |
| Box diagonal · 空间对角线 | [lesson.py](the-third-side/lesson.py) | [Manim scene builder](the-third-side/build.py) |
| Parallel transport · 球面平行移动 | [lesson.js](holonomy/lesson.js) | Three.js |
| Helicoid to catenoid · 螺旋面与悬链面 | [plate.mjs](associate-family/plate.mjs) | Three.js |
| Vortex rings · 涡环穿越 | [vortex.mjs](vortex-leapfrog/vortex.mjs) | Three.js |
| Slicing a 4D ball · 四维球切片 | [lesson.js](four-ball/lesson.js) | Three.js |
| Secant to tangent · 从割线到切线 | [lesson.py](derivative/lesson.py) | Manim |
| Unit circle and sine · 单位圆与正弦 | [lesson.js](unit-circle/lesson.js) | Interactive |
| Square wave · 方波合成 | [lesson.js](fourier/lesson.js) | Interactive |
| Bayes and the base rate · 贝叶斯与基准率 | [lesson.js](bayes/lesson.js) | Interactive |
| Neural networks · 神经网络 | [lesson.js](neural-network/lesson.js) | Interactive |

## Rebuild a lesson

Run these commands from the repository root. JavaScript lessons use Node.js 20 or later. 以下命令均从仓库根目录运行，JavaScript 课件需要 Node.js 20 或更新版本。

```sh
npm ci --prefix skills/manim-blackboard
node skills/manim-blackboard/scripts/build-three.mjs examples/holonomy/lesson.js -o build/holonomy.html
node skills/manim-blackboard/scripts/build-interactive.mjs examples/unit-circle/lesson.js -o build/unit-circle.html
```

To rebuild a different JavaScript lesson, use the source and builder in its row above, and choose an output filename. 构建其他 JavaScript 示例时，按表格选择构建器与源码，再指定输出文件。

Manim lessons use uv and Manim’s native dependencies. 安装 uv 和 Manim 的系统依赖后，可以构建下列两份课件。[Manim setup · 环境配置](../skills/manim-blackboard/references/authoring.md#build-and-inspect)

```sh
uv run --python 3.12 skills/manim-blackboard/scripts/build.py examples/derivative/lesson.py -o build/derivative.html
uv run --python 3.12 examples/the-third-side/build.py -o build/the-third-side.html
```

If you edit the spherical transport path, run `uv run --python 3.12 examples/holonomy/transport_manim.py` to regenerate its motion samples before rebuilding. 修改球面平行移动的路径后，先用这条命令重新采样，再构建课件。
