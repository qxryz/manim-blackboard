import mixtureGeometry from './mixture-geometry.json';
import { attention, inputs, projections, tokens } from './attention-math.mjs';
import { carryPoint, diagramChoices, penOutline } from './qkv-pen.js';
import { createMotion, ease } from './motion.js';

const teal = '#87ddcf',
  gold = '#f1bf89',
  white = '#f4f1e9',
  grey = '#b7bfbd',
  dim = '#525e5c';
const base = attention();
const ids = ['Q', 'K', 'V'];
const ab = (primary, secondary) => ({ primary, secondary });
const fmt = (n, digits = 3) =>
  (Math.abs(n) < 0.5 / 10 ** digits ? '0' : String(Number(n.toFixed(digits)))).replace('-', '−');
const vec = (values, digits = 3) => `(${values.map((x) => fmt(x, digits)).join(', ')})`;
const text = (x, y, value, size = 24, color = white, anchor = 'middle', attrs = '') =>
  `<text ${attrs} x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${value}</text>`;
const line = (x1, y1, x2, y2, color = dim, width = 2, extra = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const sub = (value) => `<tspan baseline-shift="sub" font-size="68%">${value}</tspan>`;
const rect = (x, y, w, h, fill, stroke = 'none') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"/>`;
const circle = (x, y, r, fill, stroke = 'none', attrs = '') =>
  `<circle ${attrs} cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const anchor = (key) => `data-bb-anchor="${key}"`;
const weightKey = (row, col) => `attn-weight-${tokens[row]}-${tokens[col]}`;
const scoreGradientKey = (col) => `attn-score-gradient-${tokens[col]}`;
const arrow = (x1, y1, x2, y2, color = dim) => {
  const theta = Math.atan2(y2 - y1, x2 - x1),
    h = 10;
  const tip = (sign) =>
    [x2 - h * Math.cos(theta + sign * 0.45), y2 - h * Math.sin(theta + sign * 0.45)].join(',');
  return (
    line(x1, y1, x2, y2, color, 2.5) + `<polygon points="${x2},${y2} ${tip(1)} ${tip(-1)}" fill="${color}"/>`
  );
};

// A matrix uses a shared rectangular grid so row highlights and entry indicators line up.
function matrix(values, x, y, cw, rh, { row = -1, color = white, highlight = teal, size = 24 } = {}) {
  const width = cw * values[0].length,
    height = rh * values.length;
  let out =
    row < 0 ? '' : rect(x, y + row * rh, width, rh, highlight, 'none').replace('/>', ' opacity=".13"/>');
  out += `<path d="M${x + 8},${y}h-8v${height}h8 M${x + width - 8},${y}h8v${height}h-8" fill="none" stroke="${color}" stroke-width="2.2"/>`;
  values.forEach((r, i) =>
    r.forEach((v, j) => {
      out += text(
        x + (j + 0.5) * cw,
        y + (i + 0.52) * rh + size * 0.31,
        fmt(v),
        size,
        i === row ? highlight : color,
      );
    }),
  );
  return out;
}
function formulas(ctx, lines) {
  ctx.readout.innerHTML = lines
    .map(
      ([math, accent = false]) =>
        `<div style="font-size:.91em;line-height:1.32;margin:.17em 0;color:${accent ? ctx.ink : white};overflow-wrap:normal">${math}</div>`,
    )
    .join('');
}
function init(ctx, ink = teal) {
  ctx.ink = ink;
  ctx.svg.setAttribute('viewBox', '0 0 600 335');
  ctx.svg.setAttribute('role', 'img');
}
function plot(ctx, description, body) {
  ctx.svg.setAttribute('aria-label', description);
  ctx.svg.innerHTML = body;
}
function slide(id, title, titleZh, steps, mount) {
  return { id, title, titleZh, chapter: 'Self-attention', steps, mount };
}

const project = slide(
  'qkv-projections',
  'One input, three roles',
  '一个输入，三个角色',
  [
    ab(
      'A query starts with one input row. Pair its two entries with a column of WQ, multiply, and add. The sum becomes one query coordinate.',
      '从一个输入行出发，把两个分量与查询矩阵的一列配对，相乘再相加。和就是查询向量的一个坐标。',
    ),
    ab(
      'Keep the input and change the map. In the second key column both entries are one, so this coordinate sums the two input features.',
      '保留同一个输入，换成键矩阵。第二列的两个数都是 1，因此这个键坐标等于两个输入特征的和。',
    ),
    ab(
      'Now use the value map. Its first column doubles the first input feature and drops the second. This is the content we will mix.',
      '现在使用值矩阵。第一列把第一个输入特征乘二，第二个特征的贡献为零。后面混合的就是这些内容。',
    ),
  ],
  (ctx) => {
    init(ctx);
    const motion = createMotion();
    let role = 'Q',
      row = 2,
      dual = false;
    const pitch = 48,
      rh = 44,
      xLeft = 66,
      wLeft = 245,
      pLeft = 425,
      top = 75;
    const targets = [
      [96, 289],
      [195, 289],
      [295, 289],
      [394, 289],
    ];
    const sumPos = [500, 289];
    function draw(animate) {
      const W = projections[role],
        P = base[role],
        col = role === 'V' ? 0 : 1;
      const tag = tokens[row],
        ry = top + row * rh,
        wTop = top + rh / 2;
      const wy = [wTop + rh / 2, wTop + 1.5 * rh];
      const wx = wLeft + (col + 0.5) * pitch,
        px = pLeft + (col + 0.5) * pitch;
      const source = [
        [xLeft + pitch / 2, ry + rh / 2],
        [wx, wy[0]],
        [xLeft + 1.5 * pitch, ry + rh / 2],
        [wx, wy[1]],
      ];
      const values = [inputs[row][0], W[0][col], inputs[row][1], W[1][col]];
      const frame = (x, y, w, h, color) =>
        `<path data-pen transform="translate(${x} ${y}) scale(${w} ${h})" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      let drawing =
        text(114, 47, 'X', 30) +
        text(293, 47, `W${sub(role)}`, 29) +
        text(473, 47, role, 30, teal) +
        matrix(inputs, xLeft, top, pitch, rh, { row }) +
        text(202, 150, '×', 30, grey) +
        matrix(W, wLeft, wTop, pitch, rh) +
        text(380, 150, '=', 30, grey) +
        `<g data-product>${matrix(P, pLeft, top, pitch, rh, { row })}</g>` +
        frame(xLeft, ry + 1, 2 * pitch, rh - 2, teal) +
        frame(wx - pitch / 2, wTop, pitch, 2 * rh, gold);
      tokens.forEach((token, i) => {
        drawing +=
          `<g data-choice="${token}">${rect(16, top + i * rh, xLeft + 2 * pitch - 16, rh, 'transparent')}` +
          text(
            38,
            top + (i + 0.5) * rh + 8,
            token,
            22,
            i === row ? teal : grey,
            'middle',
            i === 2 ? anchor('attention-token-c') : '',
          ) +
          '</g>';
      });
      drawing += line(74, 233, 530, 233, '#384342', 1);
      const termColors = [teal, gold, teal, gold];
      for (let i = 0; i < 4; i++)
        drawing += text(0, 9, fmt(values[i]), 31, termColors[i], 'middle', 'data-factor');
      drawing +=
        text(146, 298, '×', 26, grey, 'middle', 'data-symbol') +
        text(245, 298, '+', 26, grey, 'middle', 'data-symbol') +
        text(345, 298, '×', 26, grey, 'middle', 'data-symbol') +
        text(449, 298, '=', 26, grey, 'middle', 'data-symbol') +
        text(sumPos[0], sumPos[1] + 9, fmt(P[row][col]), 32, white, 'middle', 'data-total') +
        text(0, 9, fmt(P[row][col]), 29, teal, 'middle', 'data-copy');
      plot(
        ctx,
        `${role} projection. Input row ${tag} times column ${col + 1} gives ${P[row][col]}.`,
        drawing,
      );
      const choose = (id) => {
        motion.settle();
        row = tokens.indexOf(id);
        draw(false);
      };
      diagramChoices(ctx.svg, '[data-choice]', tag, choose, (id) =>
        dual ? `输入行 ${id}` : `Inspect input ${id}`,
      );
      formulas(ctx, [
        [`<i>${role}</i> = <i>XW</i><sub>${role}</sub>`],
        [
          `${role}<sub>${tag},${col + 1}</sub> = (${inputs[row].join(', ')}) · (${W.map((r) => r[col]).join(', ')})`,
        ],
        [`${role}<sub>${tag}</sub> = ${vec(P[row])}`, true],
      ]);
      const pens = ctx.svg.querySelectorAll('[data-pen]'),
        factors = ctx.svg.querySelectorAll('[data-factor]');
      const symbols = ctx.svg.querySelectorAll('[data-symbol]'),
        total = ctx.svg.querySelector('[data-total]'),
        copy = ctx.svg.querySelector('[data-copy]');
      const cell = ctx.svg.querySelectorAll('[data-product] text')[2 * row + col];
      const readResult = ctx.readout.lastElementChild;
      return motion.play({ animate, duration: 1960 }, (t) => {
        pens.forEach((el, i) => el.setAttribute('d', penOutline((t - 0.045 * i) / 0.24)));
        factors.forEach((el, i) => {
          const start = i < 2 ? 0.13 : 0.31,
            progress = (t - start) / 0.34;
          const p = carryPoint(progress, source[i], targets[i], i % 2 ? 38 : 23);
          el.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
          el.setAttribute('opacity', String(ease(progress * 5)));
        });
        symbols.forEach((el, i) =>
          el.setAttribute('opacity', String(ease((t - [0.37, 0.47, 0.54, 0.68][i]) / 0.1))),
        );
        total.setAttribute('opacity', String(ease((t - 0.7) / 0.1)));
        const flight = (t - 0.78) / 0.21,
          p = carryPoint(flight, sumPos, [px, ry + rh / 2], -24);
        copy.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
        copy.setAttribute('opacity', t >= 0.78 && t < 0.99 ? '1' : '0');
        cell.setAttribute('opacity', t >= 0.99 ? '1' : '0');
        readResult.style.opacity = String(ease((t - 0.88) / 0.12));
      });
    }
    return {
      enter(step, { bilingual, animate }) {
        motion.settle();
        role = ids[step];
        dual = bilingual;
        return draw(animate);
      },
      languageChanged(b) {
        motion.settle();
        dual = b;
        draw(false);
      },
      settle: motion.settle,
      dispose: motion.settle,
    };
  },
);

const scoreTop = 49,
  scoreLeft = 104,
  scoreWidth = 128,
  scoreHeight = 70;
const previousWeights = new WeakMap();

function scoreMatrix(rows, row, phase, interactive = true) {
  const top = scoreTop,
    x0 = scoreLeft,
    cw = scoreWidth,
    rh = scoreHeight;
  const field = ['raw', 'scores', 'weights'][phase],
    limit = phase === 2 ? 1 : 3;
  let out = '';
  tokens.forEach((token, j) => {
    out += text(x0 + (j + 0.5) * cw, 31, `k${sub(token)}`, 25, grey);
  });
  rows.forEach((r, i) => {
    const y = top + i * rh;
    out +=
      (interactive ? `<g data-choice="${tokens[i]}">` : '<g>') +
      rect(22, y, x0 + 3 * cw - 22, rh, 'transparent');
    out += text(
      x0 - 22,
      y + rh / 2 + 8,
      `q${sub(tokens[i])}`,
      26,
      i === row ? teal : grey,
      'end',
      interactive && i === 2 ? anchor('attention-token-c') : '',
    );
    r[field].forEach((v, j) => {
      const x = x0 + j * cw,
        k = Math.min(1, v / limit);
      const shade = `rgb(${Math.round(6 + 10 * k)},${Math.round(17 + 47 * k)},${Math.round(17 + 44 * k)})`;
      const width = (cw - 22) * k;
      out += rect(x + 2, y + 2, cw - 4, rh - 4, shade, i === row ? '#619189' : '#263633');
      out += text(
        x + cw / 2,
        y + rh / 2 + 8,
        fmt(v, phase === 1 ? 2 : 3),
        27,
        i === row ? white : '#bdc8c4',
        'middle',
        'data-score-number ' +
          (phase === 2 ? 'data-mass-number ' : '') +
          (interactive && i === row && phase === 2 ? anchor(weightKey(i, j)) : ''),
      );
      out += `<rect data-score-bar ${phase === 2 ? 'data-mass-bar' : ''} x="${x + 11}" y="${y + rh - 12}" width="${width}" height="3" fill="${i === row ? teal : '#536660'}"/>`;
    });
    out += '</g>';
  });
  return out;
}

const scores = slide(
  'attention-scores',
  'Compare a query with every key',
  '用查询逐一匹配键',
  [
    ab(
      'One query meets three keys. Multiply matching coordinates and add. Each dot product fills one cell in the same row.',
      '一个查询依次与三个键相遇。对应坐标相乘再相加，每个点积填入这一行的一个格子。',
    ),
    ab(
      'Each key has two coordinates. Divide the dot products by √2. Their order stays the same as the scores shrink.',
      '每个键有两个坐标。把点积除以根号 2，分数缩小，大小顺序不变。',
    ),
    ab(
      'Turn each score into a positive mass. Divide by the row’s total mass and the three shares add up to one.',
      '用指数把分数变成正数。每个数除以本行的总和，三个权重相加就等于 1。',
    ),
  ],
  (ctx) => {
    init(ctx);
    const motion = createMotion(),
      rows = tokens.map((_, i) => attention(i));
    const numerators = rows.map((r) => r.scores.map((s) => Math.exp(s - Math.max(...r.scores))));
    const sums = numerators.map((values) => values.reduce((sum, value) => sum + value, 0));
    const top = scoreTop,
      x0 = scoreLeft,
      cw = scoreWidth,
      rh = scoreHeight;
    let globalStop = -1,
      phase = 0,
      row = 2,
      dual = false;
    function draw(animate) {
      const current = rows[row],
        name = tokens[row],
        query = current.Q[row];
      const field = ['raw', 'scores', 'weights'][phase];
      let out = scoreMatrix(rows, row, phase);
      out += `<path data-trace fill="none" stroke="${gold}" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      if (phase === 0) {
        out +=
          text(134, 309, '', 27, white, 'middle', 'data-dot-first') +
          text(213, 309, '+', 24, grey, 'middle', 'data-dot-plus') +
          text(292, 309, '', 27, white, 'middle', 'data-dot-second') +
          text(368, 309, '=', 24, grey, 'middle', 'data-dot-equals') +
          text(416, 309, '', 28, gold, 'middle', 'data-dot-answer');
      } else {
        out += text(293, 309, '', 27, teal, 'middle', 'data-operation');
      }
      out += text(0, 8, '', 28, gold, 'middle', 'data-deposit pointer-events="none"');
      plot(ctx, `Query-key ${field} matrix. Select a query row. Current row ${name}.`, out);
      diagramChoices(
        ctx.svg,
        '[data-choice]',
        name,
        (id) => {
          motion.settle();
          row = tokens.indexOf(id);
          draw(false);
        },
        (id) => (dual ? `查询行 ${id}` : `Inspect query ${id}`),
      );
      const bars = ctx.svg.querySelectorAll('[data-score-bar]'),
        numbers = ctx.svg.querySelectorAll('[data-score-number]');
      const operation = ctx.svg.querySelector('[data-operation]'),
        flying = ctx.svg.querySelector('[data-deposit]');
      const trace = ctx.svg.querySelector('[data-trace]');
      function updateCell(i, j, value, width, digits) {
        const n = i * 3 + j;
        numbers[n].textContent = value === null ? '' : fmt(value, digits);
        bars[n].setAttribute('width', String((cw - 22) * width));
      }
      const vecLine = (symbol) => `${symbol}<sub>${name}</sub>`;
      if (phase === 0) {
        formulas(ctx, [[`${vecLine('q')} = ${vec(query)}`], [''], ['', true]]);
        const kLine = ctx.readout.children[1],
          result = ctx.readout.children[2];
        const rowY = top + rh * (row + 0.5);
        const first = ctx.svg.querySelector('[data-dot-first]'),
          second = ctx.svg.querySelector('[data-dot-second]');
        const plus = ctx.svg.querySelector('[data-dot-plus]'),
          equals = ctx.svg.querySelector('[data-dot-equals]');
        const answerInk = ctx.svg.querySelector('[data-dot-answer]');
        let lastColumn = -1,
          lastStage = -1;
        return motion.play({ animate, duration: 2100 }, (t) => {
          const clock = Math.max(0, t) * 3,
            col = Math.min(2, Math.floor(clock)),
            u = clock - col;
          const key = current.K[col],
            answer = current.raw[col];
          const term1 = query[0] * key[0],
            term2 = query[1] * key[1];
          const stage = u < 0.19 ? 0 : u < 0.44 ? 1 : 2;
          if (lastColumn !== col || lastStage !== stage) {
            kLine.innerHTML = `k<sub>${tokens[col]}</sub> = ${vec(key)}`;
            first.textContent = `${query[0]} × ${key[0]}`;
            second.textContent = `${query[1]} × ${key[1]}`;
            answerInk.textContent = fmt(answer);
            for (const mark of [second, plus]) mark.setAttribute('opacity', stage >= 1 ? '1' : '0');
            for (const mark of [equals, answerInk]) mark.setAttribute('opacity', stage === 2 ? '1' : '0');
            const entries = current.raw.map((n, j) => (j < col || (j === col && stage === 2) ? fmt(n) : '·'));
            result.innerHTML = `${vecLine('q')} Kᵀ = (${entries.join(', ')})`;
            lastColumn = col;
            lastStage = stage;
          }
          current.raw.forEach((v, j) => {
            const done = j < col || (j === col && u >= 0.96);
            updateCell(row, j, done ? v : null, done ? v / 3 : 0, 0);
          });
          const x = x0 + col * cw,
            y = top + row * rh;
          trace.setAttribute('transform', `translate(${x + 2} ${y + 2}) scale(${cw - 4} ${rh - 4})`);
          trace.setAttribute('d', penOutline(u / 0.46));
          const p = carryPoint((u - 0.51) / 0.45, [416, 301], [x + cw / 2, rowY], -18);
          flying.textContent = fmt(term1 + term2);
          flying.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
          flying.setAttribute('opacity', u >= 0.51 && u < 0.96 ? '1' : '0');
        });
      }
      if (phase === 1) {
        formulas(ctx, [[`${vecLine('s')} = ${vec(current.raw)} / √2`], ['', true]]);
        const result = ctx.readout.lastElementChild;
        return motion.play({ animate, duration: 1550 }, (t) => {
          const d = 1 + (Math.SQRT2 - 1) * ease((t - 0.08) / 0.84);
          rows.forEach((r, i) => r.raw.forEach((v, j) => updateCell(i, j, v / d, v / d / 3, 2)));
          result.textContent = `≈ ${vec(
            current.raw.map((v) => v / d),
            2,
          )}`;
          operation.textContent = t === 1 ? 'S = QKᵀ / √2' : `d = ${fmt(d, 3)}     ·     S = QKᵀ / d`;
        });
      }
      const maximum = Math.max(...current.scores),
        sum = sums[row];
      formulas(ctx, [['uⱼ = exp(sⱼ − m)'], [`m = max(s) ≈ ${fmt(maximum, 2)}`], ['', true]]);
      const result = ctx.readout.lastElementChild;
      return motion.play({ animate, duration: 1800 }, (t) => {
        const beta = ease(t / 0.33),
          progress = ease((t - 0.37) / 0.57);
        rows.forEach((r, i) => {
          const d = 1 + progress * (sums[i] - 1);
          numerators[i].forEach((v, j) => {
            const mass = Math.pow(v, beta) / d;
            updateCell(i, j, mass, mass, 3);
          });
        });
        operation.textContent =
          t === 1 ? 'A = softmax(S)' : progress ? 'aⱼ = uⱼ / d' : 'uⱼ = exp(β · (sⱼ − m))';
        if (t === 1) {
          result.innerHTML = `${vecLine('a')} ≈ ${vec(current.weights)}`;
          ctx.readout.children[1].innerHTML = `∑ u ≈ ${fmt(sum)}`;
        } else {
          result.textContent =
            beta < 1 ? `β = ${fmt(beta, 2)} → 1` : `d = ${fmt(1 + progress * (sum - 1))} → ∑u ≈ ${fmt(sum)}`;
        }
      });
    }
    return {
      enter(step, { bilingual, animate }) {
        motion.settle();
        globalStop = ctx.getState().step;
        phase = step;
        dual = bilingual;
        return draw(animate);
      },
      languageChanged(b) {
        motion.settle();
        dual = b;
        draw(false);
      },
      settle: motion.settle,
      dispose() {
        motion.settle();
        if (phase === 2 && ctx.getState().step === globalStop + 1) {
          previousWeights.set(ctx.plotHost.parentElement, { row, matrix: ctx.svg.getScreenCTM() });
        }
      },
    };
  },
);

// The source grid and the moving numbers occupy the same SVG as the value
// vectors. The digit at each destination is the original softmax weight.
function mountWeightBridge(ctx, source, layout, useScreenMatrix) {
  const overlay = ctx.svg.querySelector('[data-weight-grid]'),
    labels = [...ctx.svg.querySelectorAll('[data-weight-term]')];
  const termInk = labels.map((node) => node.querySelector('[data-weight-number]'));
  const signs = labels.map((node) => node.querySelector('path')),
    symbols = labels.map((node) => node.querySelector('[data-role-symbol]'));
  const previous = useScreenMatrix && source?.matrix;
  const map = previous ? ctx.svg.getScreenCTM().inverse().multiply(previous) : new DOMMatrix();
  // The source screen matrix is relevant only to the crossing which captured it.
  const starts = tokens.map((_, j) => {
    const p = new DOMPoint(
      scoreLeft + (j + 0.5) * scoreWidth,
      scoreTop + 2.5 * scoreHeight + 8,
    ).matrixTransform(map);
    return [p.x, p.y];
  });
  if (overlay) {
    overlay.setAttribute('transform', map.toString());
    overlay.querySelectorAll('[data-score-number]').forEach((node, i) => {
      if (i >= 6) node.remove();
    });
  }
  const arc = mixtureGeometry.carry,
    writing = mixtureGeometry.multiply;
  const toRGB = (hex) => [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16));
  const originalColor = toRGB(source && source.row !== 2 ? '#bdc8c4' : white);
  const roleColors = [white, teal, gold].map(toRGB);
  const operation = ctx.readout.firstElementChild;
  const scenery = ctx.svg.querySelector('[data-value-plane]');
  const paintSign = (node, progress) => {
    const i = Math.round(Math.max(0, Math.min(1, progress)) * (writing.length - 1));
    const [path, fill, stroke, width] = writing[i];
    node.setAttribute('d', path);
    node.setAttribute('fill-opacity', fill);
    node.setAttribute('stroke-opacity', progress <= 0 ? 0 : stroke);
    node.setAttribute('stroke-width', width * 0.033);
  };
  return (t) => {
    const frame = sampleMix(arc, (t - 0.045) / 0.65);
    const sourceOpacity = 1 - ease((t - 0.03) / 0.38),
      sceneryOpacity = ease((t - 0.16) / 0.38);
    if (overlay) {
      if (t === 1) overlay.remove();
      else overlay.setAttribute('opacity', sourceOpacity);
    }
    scenery.setAttribute('opacity', sceneryOpacity);
    operation.style.opacity = String(ease((t - 0.64) / 0.28));
    labels.forEach((node, i) => {
      const [u, v] = frame.slice(2 * i, 2 * i + 2),
        [sx, sy] = starts[i],
        [tx, ty] = layout[i];
      const dx = tx - sx,
        dy = ty - sy;
      const x = sx + dx * u - dy * v,
        y = sy + dy * u + dx * v;
      node.setAttribute('transform', `translate(${x} ${y})`);
      const color = roleColors[i].map((end, j) =>
        Math.round(originalColor[j] + (end - originalColor[j]) * u),
      );
      termInk[i].setAttribute('fill', 'rgb(' + color.join(',') + ')');
      termInk[i].setAttribute('font-size', 27 * Math.hypot(map.a, map.b) * (1 - u) + 23 * u);
      const write = (t - (0.49 + 0.09 * i)) / 0.25;
      paintSign(signs[i], write);
      symbols[i].setAttribute('opacity', ease((write - 0.3) / 0.68));
      if (t === 1) termInk[i].setAttribute('data-bb-anchor', weightKey(2, i));
    });
  };
}

function sampleMix(frames, progress) {
  const position = Math.max(0, Math.min(1, progress)) * (frames.length - 1);
  const i = Math.floor(position),
    next = frames[Math.min(i + 1, frames.length - 1)];
  return frames[i].map((v, k) => v + (next[k] - v) * (position - i));
}

const mixture = slide(
  'attention-mixture',
  'Mix the value vectors',
  '混合值向量',
  [
    ab(
      'Follow the three numbers in row C. Each travels to its own value vector and becomes its multiplier. The area of the circle shows the same weight.',
      '沿着查询 C 的这一行看。三个数分别移到各自的值向量旁边，成为它的乘数。圆的面积也表示这个权重。',
    ),
    ab(
      'Shorten each arrow by its weight, then join them head to tail. The last tip is the output for C. Touch a vertex to see its term.',
      '先把每支箭头缩短到对应权重的比例，再把箭头首尾相接。最后的箭头指向查询 C 的输出。点顶点可看单项贡献。',
    ),
    ab(
      'For query B, lower C’s score toward −∞ before softmax. Follow the output as C loses weight and A and B draw it toward their midpoint.',
      '现在看查询 B。在 softmax 前，把未来键 C 的分数降到 −∞。观察 C 的权重如何逐渐消失，A 和 B 如何把输出拉到两点的中间。',
    ),
  ],
  (ctx) => {
    init(ctx);
    const motion = createMotion();
    const host = ctx.plotHost.parentElement,
      source = previousWeights.get(host);
    previousWeights.delete(host);
    const labelPositions = [
      [393, 318],
      [120, 35],
      [411, 35],
    ];
    const b = attention(1),
      masked = attention(1, true);
    const ox = 98,
      oy = 259,
      unit = 166;
    const xy = (v) => [ox + unit * v[0], oy - unit * v[1]];
    const vertices = base.V.map(xy),
      colors = [white, teal, gold];
    let phase = 0,
      dual = false,
      inspected = -1;

    // Shrink the tip as an arrow starts or disappears, keeping it on its stroke.
    function stroke([x1, y1, x2, y2]) {
      const [sx, sy] = xy([x1, y1]),
        [ex, ey] = xy([x2, y2]);
      const dx = ex - sx,
        dy = ey - sy,
        length = Math.hypot(dx, dy);
      if (length < 0.2) return '';
      const along = Math.min(10, length * 0.42) / length,
        across = along * 0.41;
      return (
        'M' +
        sx +
        ' ' +
        sy +
        'L' +
        ex +
        ' ' +
        ey +
        'M' +
        (ex - dx * along + dy * across) +
        ' ' +
        (ey - dy * along - dx * across) +
        'L' +
        ex +
        ' ' +
        ey +
        'L' +
        (ex - dx * along - dy * across) +
        ' ' +
        (ey - dy * along + dx * across)
      );
    }

    function draw(animate, useScreenMatrix = false) {
      const row = phase === 2 ? 1 : 2,
        tag = tokens[row];
      const symbol = 'o<sub>' + tag + '</sub>';
      let art =
        '<g data-value-plane>' +
        arrow(63, oy, 506, oy) +
        arrow(ox, 281, ox, 39) +
        text(525, oy + 8, 'v₁', 23, grey) +
        text(63, 59, 'v₂', 23, grey) +
        '<polygon data-hull points="' +
        vertices.map((v) => v.join(',')).join(' ') +
        '" fill="#11201f" stroke="#53756f" stroke-width="1.4"/>' +
        '<path data-edge fill="none" stroke="' +
        teal +
        '" stroke-linecap="round" stroke-width="2.8"/>' +
        '<path data-trail fill="none" stroke="' +
        gold +
        '" stroke-width="1.4" stroke-dasharray="3 5"/>';
      if (phase === 2) {
        const [ux, uy] = xy(b.output);
        art += circle(ux, uy, 5.2, '#000', '#946e47', 'data-before');
      }
      art += colors
        .map(
          (c) =>
            '<path data-vector fill="none" stroke="' +
            c +
            '" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.2"/>',
        )
        .join('');
      art +=
        '<g data-mixture-output>' +
        circle(0, 0, 5.5, gold) +
        line(5, 6, 15, 19, gold, 1.1) +
        text(18, 34, 'o' + sub(tag), 23, gold, 'start') +
        '</g>';
      vertices.forEach(([x, y], i) => {
        const lx = i === 1 ? x - 1 : x + 7,
          ly = i === 0 ? y + 34 : y - 25;
        art +=
          '<g data-choice="' +
          tokens[i] +
          '">' +
          circle(x, y, 24, 'transparent') +
          circle(x, y, 3, '#000', colors[i], phase < 2 ? '' : anchor(weightKey(row, i))) +
          circle(x, y, 15, '#000', colors[i], 'data-mass') +
          '<circle data-ring cx="' +
          x +
          '" cy="' +
          y +
          '" r="19" fill="none" stroke="' +
          colors[i] +
          '" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>' +
          text(
            lx,
            ly,
            tokens[i] + ' ' + vec(base.V[i]),
            23,
            colors[i],
            i === 1 ? 'middle' : 'start',
            'data-corner',
          ) +
          '</g>';
      });
      art += '</g>';
      if (phase < 2) {
        if (phase === 0 && animate) {
          const sourceRows = tokens.map((_, i) => attention(i));
          art +=
            '<g data-weight-grid aria-hidden="true" pointer-events="none">' +
            scoreMatrix(sourceRows, source?.row ?? 2, 2, false) +
            text(293, 309, 'A = softmax(S)', 27, teal) +
            '</g>';
        }
        base.weights.forEach((weight, i) => {
          art +=
            '<g data-weight-term="' +
            tokens[i] +
            '" pointer-events="none">' +
            text(0, 0, fmt(weight), 23, colors[i], 'middle', 'data-weight-number') +
            '<g transform="translate(40 -7) scale(11)"><path fill="' +
            colors[i] +
            '" stroke="' +
            colors[i] +
            '"/></g>' +
            text(53, 0, 'v' + sub(tokens[i]), 23, colors[i], 'start', 'data-role-symbol') +
            '</g>';
        });
      }
      plot(
        ctx,
        dual
          ? '三个值向量和加权和。选择顶点可查看该项。'
          : 'Value vectors and their weighted sum. Select a vertex to inspect its term.',
        art,
      );
      const disks = [...ctx.svg.querySelectorAll('[data-mass]')],
        corners = [...ctx.svg.querySelectorAll('[data-corner]')];
      const rings = [...ctx.svg.querySelectorAll('[data-ring]')],
        paths = [...ctx.svg.querySelectorAll('[data-vector]')];
      const head = ctx.svg.querySelector('[data-mixture-output]'),
        hull = ctx.svg.querySelector('[data-hull]');
      const trail = ctx.svg.querySelector('[data-trail]'),
        edge = ctx.svg.querySelector('[data-edge]');
      const choices = [...ctx.svg.querySelectorAll('[data-choice]')];
      const [A, B] = vertices;
      if (phase === 0) {
        formulas(ctx, [['a<sub>CA</sub> + a<sub>CB</sub> + a<sub>CC</sub> = 1'], ['']]);
      } else if (phase === 1) {
        formulas(ctx, [
          [symbol + ' = Σ<sub>j</sub> a<sub>Cj</sub>v<sub>j</sub>'],
          [symbol + ' ≈ ' + vec(base.output), true],
          [''],
        ]);
      } else {
        formulas(ctx, [
          ['s<sub>BC</sub> <span></span>'],
          ['a<sub>B</sub> <span></span>'],
          [symbol + ' <span></span>', true],
          [''],
        ]);
      }
      const rows = [...ctx.readout.children],
        inspection = rows.at(-1);
      const numbers = [...ctx.readout.querySelectorAll('span')];
      inspection.style.cssText += ';min-height:1.4em;font-size:.77em';
      inspection.setAttribute('aria-live', 'polite');
      let currentWeights = phase === 2 ? b.weights : base.weights;
      function showInspection() {
        const i = inspected;
        choices.forEach((node, j) => {
          node.setAttribute('aria-pressed', String(j === i));
          rings[j].setAttribute('opacity', j === i ? '1' : '0');
          paths[j].style.strokeWidth = j === i ? '5' : '3.2';
        });
        if (i < 0) {
          inspection.textContent = '';
          return;
        }
        const weight = currentWeights[i],
          term = base.V[i].map((n) => n * weight);
        inspection.style.color = colors[i];
        const exact = weight === 0 || weight === 0.5;
        inspection.textContent =
          tokens[i] + '　' + fmt(weight) + ' × ' + vec(base.V[i]) + (exact ? ' = ' : ' ≈ ') + vec(term);
      }
      diagramChoices(
        ctx.svg,
        '[data-choice]',
        '',
        (id) => {
          motion.settle();
          const i = tokens.indexOf(id);
          inspected = inspected === i ? -1 : i;
          showInspection();
        },
        (id) => (dual ? '查看值向量 ' + id + ' 的贡献' : 'Inspect the contribution of value ' + id),
      );
      showInspection();

      const handoff =
        phase < 2 ? mountWeightBridge(ctx, source, labelPositions, phase === 0 && useScreenMatrix) : null;
      if (phase === 1) handoff(1);
      return motion.play({ animate, duration: [2300, 2460, 2150][phase] }, (t) => {
        if (phase === 0) handoff(t);
        let weights = base.weights,
          output = base.output;
        if (phase < 2) {
          const frame = sampleMix(
            phase === 0 ? mixtureGeometry.draw : mixtureGeometry.add,
            phase === 0 ? (t - 0.24) / 0.68 : t,
          );
          for (let i = 0; i < 3; i++) paths[i].setAttribute('d', stroke(frame.slice(4 * i, 4 * i + 4)));
          hull.setAttribute('opacity', phase === 0 ? ease((t - 0.5) / 0.47) : '1');
          const opacity = phase === 0 ? 0 : ease((t - 0.81) / 0.19);
          head.setAttribute('opacity', opacity);
          if (phase === 1) rows[1].style.opacity = opacity;
        } else {
          const [cMass, px, py] = sampleMix(mixtureGeometry.mask, (t - 0.13) / 0.72);
          // Both unmasked logits are equal. Express all quantities in terms of
          // the same residual mass, including points between Manim samples.
          weights = [(1 - cMass) / 2, (1 - cMass) / 2, cMass];
          output = [px, py];
          const cutoff = cMass === 0;
          if (cutoff) {
            weights = masked.weights;
            output = masked.output;
          }
          const scoreC = cutoff ? '−∞' : fmt(b.scores[0] + Math.log(cMass / weights[0]), 2);
          [scoreC, vec(weights), vec(output)].forEach((value, i) => {
            const label = (cutoff ? '= ' : '≈ ') + value;
            if (numbers[i].textContent !== label) numbers[i].textContent = label;
          });
          const progress = 1 - cMass / b.weights[2];
          hull.setAttribute('opacity', 1 - 0.75 * progress);
          edge.setAttribute('d', 'M' + A.join(',') + 'L' + B.join(','));
          edge.setAttribute('opacity', progress);
          const before = xy(b.output),
            after = xy(output);
          trail.setAttribute('d', 'M' + before.join(',') + 'L' + after.join(','));
          head.setAttribute('opacity', '1');
          corners[2].setAttribute('fill', cutoff ? grey : gold);
        }
        for (let i = 0; i < 3; i++) {
          const emerging = phase === 0 ? ease((t - 0.22 * i - 0.09) / 0.38) : 1;
          disks[i].setAttribute('r', 17 * Math.sqrt(weights[i]) * emerging);
          corners[i].setAttribute('opacity', phase === 0 ? 0.35 + 0.65 * emerging : 1);
        }
        head.setAttribute('transform', 'translate(' + xy(output).join(',') + ')');
        currentWeights = weights;
        if (t === 1 && inspected >= 0) showInspection();
      });
    }
    return {
      enter(step, { bilingual, animate, reason }) {
        motion.settle();
        phase = step;
        dual = bilingual;
        inspected = -1;
        return draw(animate, reason === 'navigate' || reason === 'page');
      },
      languageChanged(bilingual) {
        motion.settle();
        dual = bilingual;
        draw(false);
      },
      settle: motion.settle,
      dispose: motion.settle,
    };
  },
);

const adjoint = slide(
  'attention-adjoint',
  'Differentiate the mixture',
  '对混合结果求导',
  [
    ab(
      'Use query C with all keys visible. Its first output coordinate should be one. Trace the error forward to the loss, then follow its slope back to the output.',
      '查询 C 可以看到全部键，训练目标是让输出的第一个坐标等于 1。先沿误差算出损失，再把损失的斜率传回输出。',
    ),
    ab(
      'The same output gradient flows to all three values. Each branch carries its own share: the attention weight times the incoming gradient.',
      '同一个输出梯度分到三个值向量。每条支路按自己的注意力权重分得一份梯度。',
    ),
    ab(
      'Now vary the mixing weights. Each value is a direction in which the output can move. Its dot product with the incoming gradient gives the slope for that weight.',
      '现在改变混合权重。每个值向量代表输出可以移动的一个方向。这个向量与传回梯度的点积，就是对应权重的斜率。',
    ),
    ab(
      'Softmax compares each slope with the weighted mean. Shift the mean to zero, then scale each signed difference by its attention weight. The three resulting score gradients cancel.',
      'softmax 比较各个斜率与加权平均值。先把平均值平移到零，再把各个有正负号的差乘以相应权重。所得的三个分数梯度相加为零。',
    ),
  ],
  (ctx) =>
    gradientScene(ctx, (phase, { track, transfer, reveal, portion }) => {
      const { output, g, loss, weights, V, dV, da, mean, ds } = base;
      let body = '',
        readout;
      if (phase === 0) {
        const xs = [101, 300, 503];
        body += text(xs[0], 86, `o${sub('C,1')}`, 27, grey) + text(xs[0], 140, fmt(output[0]), 36, teal);
        body += text(xs[1], 86, 'o − 1', 26, grey) + text(xs[2], 86, '½ (o − 1)²', 26, grey);
        body +=
          transfer([156, 127], [247, 127], 0, 0.27, 16, teal) +
          reveal(text(xs[1], 140, fmt(g[0]), 36), 0.21, 0.34);
        body +=
          transfer([351, 127], [454, 127], 0.25, 0.5, 16, teal) +
          reveal(text(xs[2], 140, fmt(loss), 36), 0.44, 0.55);
        body +=
          transfer([503, 158], [112, 219], 0.5, 0.9, -74) +
          reveal(text(300, 265, `∂L / ∂o${sub('C,1')} = o${sub('C,1')} − 1 ≈ ${fmt(g[0])}`, 25, gold), 0.77, 1);
        readout = [['L = ½ (o<sub>C,1</sub> − 1)²'], [`L ≈ ${fmt(loss)}`], [`g ≈ ${vec(g)}`, true]];
      } else if (phase === 1) {
        body += text(300, 54, `g ≈ ${vec(g)}`, 32, gold);
        [105, 300, 495].forEach((x, j) => {
          const start = j * 0.08;
          body += transfer([300, 72], [x, 137], start, start + 0.46, j === 1 ? 0 : 14);
          body += reveal(text(x, 170, `× ${fmt(weights[j])}`, 26, teal), start + 0.26, start + 0.48);
          body += transfer([x, 184], [x, 215], start + 0.42, start + 0.59, 0);
          body += reveal(text(x, 245, vec(dV[j]), 25, gold), start + 0.56, start + 0.73);
          body += text(x, 291, `∂L / ∂v${sub(tokens[j])}`, 22, grey);
        });
        readout = [
          ['o<sub>C</sub> = ∑ a<sub>j</sub> v<sub>j</sub>'],
          ['∂o<sub>C</sub> / ∂v<sub>j</sub> = a<sub>j</sub> I'],
          ['∂L / ∂v<sub>j</sub> = a<sub>j</sub> g', true],
        ];
      } else if (phase === 2) {
        body +=
          text(128, 48, `v${sub('j')}`, 27, teal) +
          text(311, 48, `g · v${sub('j')}`, 27) +
          text(508, 48, '∂L / ∂aⱼ', 25, gold);
        V.forEach((v, j) => {
          const y = 104 + j * 82,
            start = j * 0.08;
          body += text(33, y, tokens[j], 24, grey) + text(128, y, vec(v), 29, teal);
          body += transfer([178, y - 9], [212, y - 9], start, start + 0.22, 7, teal);
          body += reveal(text(311, y, `${fmt(g[0])}·${v[0]} + 0·${v[1]}`, 23), start + 0.15, start + 0.36);
          body += transfer([405, y - 9], [463, y - 9], start + 0.35, start + 0.61, 8);
          body += reveal(text(508, y, fmt(da[j]), 29, gold), start + 0.55, start + 0.74);
        });
        readout = [
          [`g ≈ ${vec(g)}`],
          ['∂o<sub>C</sub> / ∂a<sub>j</sub> = v<sub>j</sub>'],
          ['∂L / ∂a<sub>j</sub> = g · v<sub>j</sub>', true],
        ];
      } else {
        const zero = 263,
          scale = 135,
          meanX = zero + scale * mean,
          ticks = [105, 178, 251];
        body += text(29, 48, 'j', 23, grey);
        body += track(text(540, 48, '', 23, gold), (node, t) => {
          node.firstElementChild.textContent = t < 0.16 ? 'dⱼ' : t < 0.52 ? 'dⱼ − μ' : '∂L / ∂sⱼ';
        });
        body += line(zero, 74, zero, 278, dim, 2) + text(zero, 309, '0', 21, grey);
        // Magnify around zero after multiplying; ticks and marks use the same
        // scale so the small signed gradients are legible.
        for (const tick of [-0.2, 0.2]) {
          body += track(line(0, 274, 0, 282, dim, 1.5) + text(0, 309, fmt(tick), 18, grey), (node, t) => {
            const zoom = 1 + 4.5 * ease(portion(t, 0.78, 1));
            node.setAttribute('transform', `translate(${zero + scale * zoom * tick} 0)`);
            node.setAttribute('opacity', ease(portion(t, 0.78, 1)));
          });
        }
        body += track(
          line(0, 74, 0, 278, teal, 1.4, 'stroke-dasharray="4 5"') + text(0, 48, 'μ', 27, teal),
          (node, t) => {
            const shift = ease(portion(t, 0.16, 0.52));
            node.setAttribute('transform', `translate(${meanX + (zero - meanX) * shift} 0)`);
            node.setAttribute('opacity', 1 - ease(portion(t, 0.48, 0.62)));
          },
        );
        ticks.forEach((y, j) => {
          body += text(29, y + 8, tokens[j], 24, grey) + line(64, y, 478, y, dim, 1);
          body += track(line(0, y, 0, y, gold, 4) + circle(0, y, 6, gold), (node, t) => {
            const shift = ease(portion(t, 0.16, 0.52)),
              shrink = ease(portion(t, 0.52, 0.87));
            const start = zero + scale * mean * (1 - shift),
              diff = da[j] - mean;
            const zoom = 1 + 4.5 * ease(portion(t, 0.78, 1));
            const x = start + scale * zoom * diff * (1 + (weights[j] - 1) * shrink);
            const segment = node.firstElementChild;
            segment.setAttribute('x1', start);
            segment.setAttribute('x2', x);
            node.lastElementChild.setAttribute('cx', x);
          });
          body += track(text(540, y + 8, '', 24, gold, 'middle', anchor(scoreGradientKey(j))), (node, t) => {
            const centered = da[j] - mean * ease(portion(t, 0.16, 0.52));
            const value = centered * (1 + (weights[j] - 1) * ease(portion(t, 0.52, 0.87)));
            node.firstElementChild.textContent = fmt(value);
          });
        });
        readout = [
          ['d<sub>j</sub> = g · v<sub>j</sub>'],
          [`μ = ∑ a<sub>j</sub> d<sub>j</sub> ≈ ${fmt(mean)}`],
          ['∂L / ∂s<sub>j</sub> = a<sub>j</sub> (d<sub>j</sub> − μ)', true],
        ];
      }
      return {
        body,
        readout,
        description: [
          `Output ${fmt(output[0])}, error ${fmt(g[0])}, loss ${fmt(loss)}. The gradient back to the output is ${vec(g)}.`,
          `Split the gradient ${vec(g)} by attention weights ${vec(weights)}, giving value gradients ${dV.map((v) => vec(v)).join(', ')}.`,
          `Dot output gradient ${vec(g)} with the values to get attention weight gradients ${vec(da)}.`,
          `Center gradients ${vec(da)} at ${fmt(mean)} and multiply by weights. Score gradients ${vec(ds)} sum to zero.`,
        ][phase],
      };
    }),
);

const returnPath = slide(
  'attention-projections-back',
  'Return to the learned maps',
  '把梯度传回投影矩阵',
  [
    ab(
      'A dot product has two inputs. Each key gets its own scaled copy of the query. On the query side, the contributions from all three keys add together.',
      '点积有两个输入。每个键分别接到查询向量乘以自身系数的结果。查询向量则汇集三个键传回的贡献。',
    ),
    ab(
      'For the key map, each token contributes one small matrix: its input column times its key-gradient row. Add the three matrices to recover the gradient of the shared weights.',
      '在键投影中，每个词元都贡献一个小矩阵：把它的输入列向量乘以键梯度行向量。三个小矩阵相加，就是共享权重的梯度。',
    ),
    ab(
      'Each input reaches the loss three ways. Carry each gradient back through its own map and add the three vectors. Select another input to compare its sum.',
      '每个输入都通过三条路径影响损失。让梯度穿过各自的投影，再将三个向量相加。选择其他输入词元，可以比较它们各自的梯度总和。',
    ),
  ],
  (ctx) =>
    gradientScene(ctx, (phase, { track, reveal, transfer, row }) => {
      const { K, ds, dQ, dK, dW, inputPaths, dX } = base;
      let body = '',
        readout,
        description;
      if (phase === 0) {
        const parts = K.map((k, i) => k.map((v) => (ds[i] * v) / Math.SQRT2));
        body +=
          text(100, 45, '∂L / ∂kⱼ', 25, teal) + text(291, 45, 'uⱼ', 26, gold) + text(470, 45, 'uⱼ kⱼ / √2', 25);
        ds.forEach((u, j) => {
          const y = 95 + 65 * j,
            start = j * 0.055;
          body +=
            text(15, y + 7, tokens[j], 19, grey) +
            text(291, y + 7, fmt(u), 23, gold, 'middle', anchor(scoreGradientKey(j)));
          body +=
            transfer([248, y], [181, y], start, start + 0.37, 11, teal) +
            transfer([335, y], [390, y], start, start + 0.37, -11);
          body +=
            reveal(text(109, y + 7, vec(dK[j]), 20, teal), start + 0.31, start + 0.48) +
            reveal(text(470, y + 7, vec(parts[j]), 21), start + 0.31, start + 0.48);
          body += transfer([553, y], [536, 275], start + 0.49, start + 0.78, -12);
        });
        body += reveal(circle(537, 275, 10, '#211a12', gold) + text(537, 281, '+', 17, gold), 0.8, 0.92);
        body += reveal(text(367, 303, `∂L / ∂q${sub('C')} ≈ ${vec(dQ[2])}`, 26, gold), 0.82, 1);
        readout = [
          ['u<sub>j</sub> = ∂L / ∂s<sub>j</sub>'],
          ['∂L / ∂k<sub>j</sub> = u<sub>j</sub> q<sub>C</sub> / √2'],
          ['∂L / ∂q<sub>C</sub> = ∑ u<sub>j</sub> k<sub>j</sub> / √2', true],
        ];
        description = `Each score gradient splits. The three key gradients are ${dK.map((v) => vec(v)).join(', ')}. The query gradient sums to ${vec(dQ[2])}.`;
      } else if (phase === 1) {
        const sums = [
            [0, 0],
            [0, 0],
          ],
          arrivals = [0.54, 0.72, 0.9],
          partial = [];
        inputs.forEach((x, j) => {
          const cx = [100, 300, 500][j],
            dj = dK[j],
            start = j * 0.12;
          const outer = x.map((xi) => dj.map((v) => xi * v));
          outer.forEach((r, i) =>
            r.forEach((v, k) => {
              sums[i][k] += v;
            }),
          );
          partial.push(sums.map((r) => [...r]));
          body +=
            text(cx, 34, `x${sub(tokens[j])} = ${vec(x)}`, 24, teal) +
            text(cx, 68, `dk${sub(tokens[j])} ≈ ${vec(dj)}`, 19, grey);
          body += reveal(matrix(outer, cx - 80, 86, 80, 32, { color: white, size: 19 }), start, start + 0.21);
          body += transfer([cx, 155], [300, 219], start + 0.23, arrivals[j], 18);
        });
        body += text(109, 272, `∂L / ∂W${sub('K')} ≈`, 25, gold);
        body += track(
          matrix(
            [
              [0, 0],
              [0, 0],
            ],
            194,
            225,
            96,
            38,
            { color: gold, size: 24 },
          ),
          (node, t) => {
            const index = arrivals.filter((v) => t >= v).length - 1;
            if (node.dataset.sum === String(index)) return;
            node.dataset.sum = String(index);
            [...node.querySelectorAll('text')].forEach((cell, i) => {
              cell.textContent = index < 0 ? '·' : fmt(partial[index][Math.floor(i / 2)][i % 2]);
            });
          },
        );
        readout = [
          ['P = X W<sub>P</sub>'],
          ['∂L / ∂W<sub>K</sub> = ∑ x<sub>j</sub>ᵀ (∂L / ∂k<sub>j</sub>)'],
          ['= Xᵀ (∂L / ∂K)', true],
        ];
        description = `Three token outer products accumulate into the key weight gradient with rows ${dW.K.map((r) => vec(r)).join(' and ')}.`;
      } else {
        const ys = [72, 158, 244],
          paths = ids.map((id) => inputPaths[id][row]);
        const sums = [...paths[0]],
          partial = [sums.slice()];
        for (const path of paths.slice(1)) {
          sums[0] += path[0];
          sums[1] += path[1];
          partial.push(sums.slice());
        }
        const arrivals = [0.34, 0.52, 0.7];
        ids.forEach((id, i) => {
          body += text(54, ys[i] - 4, `d${id} W${sub(id)}ᵀ`, 24, grey, 'start');
          body += text(54, ys[i] + 26, vec(paths[i]), 23, i === 0 ? teal : white, 'start');
          body += transfer([228, ys[i] + 4], [305, 158], i * 0.16, arrivals[i], i === 1 ? 0 : 12);
        });
        body += circle(320, 158, 16, '#211a12', gold) + text(320, 166, '+', 25, gold);
        body += track(text(320, 248, '', 24, gold), (node, t) => {
          const index = arrivals.filter((v) => t >= v).length - 1;
          node.setAttribute('opacity', 1 - ease((t - 0.78) / 0.16));
          if (node.dataset.sum === String(index)) return;
          node.dataset.sum = String(index);
          node.firstElementChild.textContent = index >= 0 ? vec(partial[index]) : '';
        });
        body += transfer([338, 158], [452, ys[row]], 0.7, 0.94, row === 1 ? 0 : 15);
        tokens.forEach((token, i) => {
          const active = i === row,
            y = ys[i];
          const label = text(499, y + 7, `x${sub(token)}`, 25, active ? gold : grey);
          body += `<g data-choice="${token}"><title>Input ${token}</title>${rect(454, y - 25, 90, 54, 'transparent')}${circle(499, y, 23, active ? '#211a12' : '#080a09', active ? gold : dim)}${label}</g>`;
          if (active) body += reveal(text(497, y + 48, vec(dX[i]), 21, gold), 0.86, 1);
        });
        readout = [
          ['P ∈ {Q, K, V}'],
          ['∂L / ∂X = ∑ (∂L / ∂P) W<sub>P</sub>ᵀ'],
          [`∂L / ∂x<sub>${tokens[row]}</sub> ≈ ${vec(dX[row])}`, true],
        ];
        description = `Input ${tokens[row]} receives gradient contributions ${paths.map((v) => vec(v)).join(', ')}. Their sum is ${vec(dX[row])}.`;
      }
      return { body, readout, description, choose: phase === 2 };
    }),
);

// A transfer follows the sampled Manim path used by the forward projections. The live
// gradient values stay as SVG text, including when a presenter changes the selected token.
function gradientScene(ctx, compose) {
  init(ctx, gold);
  const motion = createMotion();
  let step = 0,
    dual = false,
    row = 2;

  function run(animate) {
    motion.settle();
    const effects = [];
    const track = (markup, paint) => {
      const id = effects.length;
      effects.push(paint);
      return `<g data-gradient-track="${id}">${markup}</g>`;
    };
    const portion = (t, start, end) => Math.max(0, Math.min(1, (t - start) / (end - start)));
    const reveal = (markup, start, end = start + 0.12) =>
      track(markup, (node, t) => node.setAttribute('opacity', ease(portion(t, start, end))));
    const transfer = (a, b, start, end, lift = 16, color = gold) => {
      const count = 24;
      const points = Array.from({ length: count + 1 }, (_, i) => carryPoint(i / count, a, b, lift).join(','));
      const trail = `<polyline fill="none" stroke="${color}" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/>`;
      return track(trail + circle(0, 0, 5.5, color), (node, t) => {
        const progress = portion(t, start, end);
        const [x, y] = carryPoint(progress, a, b, lift);
        const trail = node.firstElementChild,
          tip = node.lastElementChild;
        trail.setAttribute(
          'points',
          points
            .slice(0, Math.floor(progress * count) + 1)
            .concat(`${x},${y}`)
            .join(' '),
        );
        trail.setAttribute('opacity', progress === 0 ? 0 : 0.65);
        tip.setAttribute('transform', `translate(${x} ${y})`);
        tip.setAttribute('r', progress === 1 ? 2.5 : 5.5);
        tip.setAttribute('opacity', progress > 0 ? 1 : 0);
      });
    };
    const { body, description, readout, choose } = compose(step, {
      track,
      reveal,
      transfer,
      portion,
      dual,
      row,
    });
    plot(ctx, description, body);
    formulas(ctx, readout);
    if (choose)
      diagramChoices(
        ctx.svg,
        '[data-choice]',
        tokens[row],
        (token) => {
          const next = tokens.indexOf(token);
          if (next >= 0 && row !== next) {
            row = next;
            run(false);
          }
        },
        (id) => (dual ? `查看词元 ${id} 的输入梯度` : `Trace the input gradient for token ${id}`),
      );
    const nodes = [...ctx.svg.querySelectorAll('[data-gradient-track]')];
    const notes = [...ctx.readout.children];
    return motion.play({ animate, duration: 1830 }, (t) => {
      nodes.forEach((node) => effects[Number(node.dataset.gradientTrack)](node, t));
      notes.forEach((node, i) => {
        node.style.opacity =
          i === 0
            ? '1'
            : String(ease(portion(t, i === notes.length - 1 ? 0.8 : 0.4, i === notes.length - 1 ? 1 : 0.57)));
      });
    });
  }
  return {
    enter(phase, { animate, bilingual }) {
      step = phase;
      dual = bilingual;
      return run(animate);
    },
    languageChanged(bilingual) {
      dual = bilingual;
      run(false);
    },
    settle: motion.settle,
    dispose: motion.settle,
  };
}

export const attentionSlides = [project, scores, mixture, adjoint, returnPath];
