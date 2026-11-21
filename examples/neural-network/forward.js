import tracks from './forward-motion.json';
import { createMotion, ease } from './motion.js';

const {sweeps} = tracks;

const teal = '#84deca';
const amber = '#f3b378';
const paper = '#f4f0e7';
const soft = '#a7b1af';
const line = '#566360';
const chapter = 'Forward pass';
const step = (primary, secondary) => ({primary, secondary});

function plot(svg, name, diagram) {
  svg.setAttribute('viewBox', '0 0 620 350');
  svg.setAttribute('aria-label', name);
  svg.innerHTML = `<style>
    .fw-graph text {fill:${paper};font-family:var(--bb-font,serif);font-size:25px}
    .fw-graph .soft {fill:${soft}} .fw-graph .teal {fill:${teal}} .fw-graph .amber {fill:${amber}}
    .fw-graph .large {font-size:37px} .fw-graph .small {font-size:21px}
    .fw-graph .stem {fill:none;stroke:${line};stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
    .fw-graph .wire {fill:none;stroke:${teal};stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
    #readout .fw-formula {margin:.16em 0;line-height:1.25;font-variant-numeric:tabular-nums}
    #readout .fw-formula strong {color:${teal};font-weight:500}
    #readout .fw-formula[data-loss] strong {color:${amber}}
    #readout .fw-minor {color:${soft};font-size:.78em}
    .fw-graph [data-layer] {cursor:pointer}
    .fw-graph [data-layer]:focus-visible {outline:none;stroke:${paper};stroke-width:2;stroke-dasharray:5 6}
    .fw-graph .copy {paint-order:stroke;stroke:#000;stroke-width:5;stroke-linejoin:round}
    .fw-graph [data-relu] {cursor:ew-resize;touch-action:none;outline:none}
    .fw-graph [data-focus-ring] {visibility:hidden;pointer-events:none}
    .fw-graph [data-relu]:focus-visible ~ [data-focus-ring] {visibility:visible}
  </style><g class="fw-graph">${diagram}</g>`;
  return svg.querySelector('.fw-graph');
}
function formula(main, detail = '', loss = false) {
  return `<p class="fw-formula"${loss ? ' data-loss' : ''}>${main}</p>${detail ? `<p class="fw-formula fw-minor">${detail}</p>` : ''}`;
}
function label(x, y, text, cls = '', align = 'middle', key = '') {
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${align}"${key ? ` data-bb-anchor="${key}"` : ''}>${text}</text>`;
}
function display(group, visible) { group.style.visibility = visible ? 'visible' : 'hidden'; }
function phase(t, start, end) {
  return Math.max(0, Math.min(1, (t-start)/(end-start)));
}

// Rotate and scale the sampled Manim path to join two points on this board.
function along(track, progress, from, to, bend = 1) {
  const at = progress * (track.length-1), index = Math.floor(at);
  const a = track[index], b = track[Math.min(index+1, track.length-1)];
  const along = a[0] + (b[0]-a[0]) * (at-index);
  const side = (a[1] + (b[1]-a[1]) * (at-index)) * bend;
  const dx = to[0]-from[0], dy = to[1]-from[1];
  return [from[0]+along*dx-side*dy, from[1]+along*dy+side*dx];
}
function number(value) { return String(Number(value.toFixed(3))).replace('-', '−'); }
function localized(dual, en, zh) { return dual ? `${en} · ${zh}` : en; }
function bracket(x, y, height, side) {
  const tip = side === 'left' ? 10 : -10;
  return `<path class="stem" d="M${x+tip} ${y}h${-tip}v${height}h${tip}"/>`;
}

const network = {
  id: 'network', chapter, title: 'Two inputs, one prediction', titleZh: '两个输入，一个预测',
  steps: [
    step('Follow the two inputs into the hidden neuron. Each contributes 1. Their sum is 2, and the bias brings it back to 1.', '沿着两条线看，两个输入各贡献 1。相加得到 2，偏置再减去 1，隐藏神经元的值就是 1。'),
    step('The output weight doubles the hidden value. The prediction is 2, one unit above the target of 1.', '输出权重把隐藏值放大两倍。预测是 2，比目标值 1 高一格。'),
  ],
  mount({svg, readout}) {
    const routes = [[[116,105],[271,164]], [[116,236],[271,179]], [[340,171],[483,171]]];
    const g = plot(svg, 'Two weighted inputs merge into a hidden value, then travel to the prediction', `
      <path class="stem" d="M116 105L273 164M116 236L273 179M335 171H484"/>
      ${routes.map(()=>`<g data-signal><path class="wire"/><circle r="5.5" fill="${paper}"/>${label(0,0,'1','small teal copy')}</g>`).join('')}
      <path fill="${teal}" d="M274 165l-13-11-4 8zM274 178l-16 0 4 8zM484 171l-14-6v12z"/>
      <g fill="#112620" stroke="${teal}" stroke-width="2.5"><circle cx="78" cy="92" r="39"/><circle cx="78" cy="249" r="39"/><circle cx="304" cy="171" r="36"/></g>
      <circle cx="528" cy="171" r="41" fill="#000" stroke="${paper}" stroke-width="2.4" data-bb-anchor="network-prediction"/>
      ${label(78,102,'1','large')}${label(78,260,'2','large')}<g data-hidden>${label(304,182,'h','large teal')}</g><g data-output>${label(528,183,'ŷ','large')}</g>
      ${label(78,33,'x₁','soft')}${label(78,324,'x₂','soft')}
      ${label(181,102,'× 1','soft','middle','input-weight-1')}${label(180,256,'× ½','soft','middle','input-weight-2')}${label(413,139,'× 2','soft')}
      <g data-bias>${label(304,241,'b = −1','amber')}</g>
      <g data-target><path class="stem" stroke-dasharray="4 7" d="M528 219v33"/><path d="M528 254l12 12-12 12-12-12z" fill="none" stroke="${amber}" stroke-width="2.5"/>${label(528,317,'y = 1','amber')}</g>`);
    const signals = [...g.querySelectorAll('[data-signal]')].map(group=>({
      path:group.querySelector('path'), dot:group.querySelector('circle'), value:group.querySelector('text')
    }));
    const h = g.querySelector('[data-hidden] text'), output = g.querySelector('[data-output] text');
    const bias = g.querySelector('[data-bias]'), target = g.querySelector('[data-target]');
    const motion = createMotion();
    return {enter(i,{animate}) {
      motion.settle();
      readout.innerHTML=i ? formula('ŷ = 2 × 1 = <strong>2</strong>','y = 1') :
        formula('z = 1 + 1 − 1 = <strong>1</strong>','h = max(0, z) = 1');
      const final = readout.querySelector('strong'), detail = readout.querySelector('.fw-minor');
      return motion.play({animate,duration:i?1450:1750}, t=>{
        const arrivals=i ? [1,1,phase(t,.04,.72)] :
          [phase(t,.04,.5),phase(t,.23,.7),0];
        signals.forEach(({path,dot,value},j)=>{
          const p=arrivals[j], [from,to]=routes[j];
          const [x,y]=along(tracks.edge,p,from,to);
          path.setAttribute('d',p>0 ? `M${from[0]} ${from[1]}L${x} ${y}` : '');
          dot.setAttribute('cx',x);dot.setAttribute('cy',y);display(dot,p>0 && p<1);
          value.setAttribute('x',x);value.setAttribute('y',y+(j===1?23:-12));
          value.textContent=j===2 ? (p<.5?'1':'2') : j===1 && p<.5?'2':'1';
          display(value,p>.025 && p<.98);
        });
        h.textContent=i || t>=.82 ? '1' : t>=.7?'2':'h';
        output.textContent=i && t>=.72 ? '2':'ŷ';
        display(bias,Boolean(i) || t>=.7);display(target,Boolean(i) && t>=.82);
        display(final,t >= (i ? .72 : .82));display(detail,t>=.82);
      });
    },settle:motion.settle,dispose:motion.settle};
  },
};

const weighted = {
  id: 'weighted-sum', chapter, title: 'Add the weighted inputs', titleZh: '把加权输入加起来',
  steps: [
    step('Begin at zero. A weight scales each input before the contributions are added.', '从零开始。每个输入先乘自己的权重，再把贡献相加。'),
    step('The first input is 1 and its weight is 1. Travel one unit to the right.', '第一个输入是 1，权重也是 1。在数轴上向右走一格。'),
    step('The second input is 2, but its weight is one half. Its contribution is also 1.', '第二个输入是 2，权重是二分之一。它的贡献也是 1。'),
    step('The bias is −1. Shift the total left by one. The preactivation z is 1.', '偏置是 −1，把总和向左移一格。激活前的数值 z 等于 1。'),
  ],
  mount({svg,readout}) {
    const g = plot(svg, 'Accumulating weighted inputs on a number line', `
      <path class="stem" pathLength="1" data-axis d="M46 177H582m-9-5 10 5-10 5"/>
      ${[0,1,2].map(i => `<path class="stem" d="M${98+205*i} 169v16"/>${label(98+205*i,218,String(i),'soft')}`).join('')}
      ${label(581,216,'z','soft')}
      <g transform="translate(98 177) scale(102.5)" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path stroke="${teal}" stroke-width=".038"/><path stroke="${teal}" stroke-width=".038"/><path stroke="${paper}" stroke-width=".038"/>
        <circle r=".066" fill="${paper}" stroke="#000" stroke-width=".017"/>
      </g>
      <g data-term>${label(201,85,'1 × 1','teal')}</g>
      <g data-term>${label(405,85,'½ × 2','teal')}</g>
      <g data-term>${label(405,291,'b = −1')}</g>`);
    const [paths, dot] = [g.querySelectorAll('g[transform] path'),g.querySelector('circle')];
    const terms = [...g.querySelectorAll('[data-term]')], axis = g.querySelector('[data-axis]');
    const equations = [formula('z = <span data-bb-anchor="input-weight-1">w₁</span>x₁ + <span data-bb-anchor="input-weight-2">w₂</span>x₂ + b','w = (1, ½),  b = −1'),formula('w₁x₁ = 1 × 1 = <strong>1</strong>'),formula('w₂x₂ = ½ × 2 = <strong>1</strong>', '1 + 1 = 2'),formula('z = 1 + 1 − 1 = <strong>1</strong>')];
    const motion = createMotion();
    let stop=0;
    function draw(at) {
      const active = stop - 1;
      paths.forEach((path,j) => {
        const seq=sweeps[j];
        path.setAttribute('d', j<active ? seq.at(-1)[0] : j===active ? seq[at][0] : '');
        display(terms[j],j<=active);
      });
      const pos=stop ? sweeps[active][at] : [null,0,0];
      dot.setAttribute('cx',pos[1]); dot.setAttribute('cy',pos[2]);
    }
    return { enter(i,{animate}) {
      motion.settle(); stop=i; readout.innerHTML=equations[i];
      if (i === 3) dot.dataset.bbAnchor = 'preactivation-one';
      else delete dot.dataset.bbAnchor;
      const last = i ? sweeps[i-1].length-1 : 0;
      const answer=readout.querySelector('strong');
      axis.style.strokeDasharray='1';
      return motion.play({animate, duration:i?1360:1150}, t=>{
        axis.style.strokeDashoffset=i?'0':String(1-ease(phase(t,0,.78)));
        draw(Math.round(t*last));
        display(dot,Boolean(i) || t>.17);
        if (answer) display(answer,t>=.83);
      });
    },settle:motion.settle,dispose:motion.settle};
  },
};

const activation = {
  id:'relu',chapter,title:'A gate at zero',titleZh:'零点处的门',
  steps: [
    step('At z = 1 the gate is open. Positive values pass through unchanged. Drag the point to test another value.', '当 z = 1 时门是开的。正数原样通过。拖动图上的点可以换一个数试试。'),
    step('On the negative side the output stays at zero. A small change there has no effect on the output.', '在负数一侧，输出始终是零。在这条水平线上小幅改变输入，输出不会变。'),
    step('At zero the two slopes disagree. The derivative does not exist there. For the backward pass we choose a gate of zero at the corner.', '零点两侧的斜率不同，因此这里没有导数。反向计算遇到这个拐点时，我们约定门值取零。'),
  ],
  mount({svg,readout}) {
    const g=plot(svg,'ReLU with a draggable point',`
      <path class="stem" d="M52 258H568m-9-5 10 5-10 5M306 287V37m-5 10 5-10 5 10"/>
      ${label(564,293,'z','soft')}${label(278,52,'h','soft')}
      <path class="wire" d="M76 258H306L490 74" data-bb-anchor="relu-function"/>
      ${[-2,-1,0,1,2].map(x=>`<path class="stem" d="M${306+x*92} 261v5"/>${label(306+x*92,295,number(x),'small soft')}`).join('')}
      <path class="stem" stroke-dasharray="4 6" data-guide/>
      <circle r="8" fill="${paper}" stroke="${teal}" stroke-width="3" data-dot/>
      <rect x="52" y="43" width="505" height="245" fill="transparent" data-relu data-interact data-drag
        role="slider" tabindex="0" aria-label="ReLU input" aria-orientation="horizontal" aria-valuemin="-2" aria-valuemax="2"/>
      <circle r="16" fill="none" stroke="${paper}" stroke-dasharray="3 4" stroke-width="2" data-focus-ring/>`);
    const guide=g.querySelector('[data-guide]'),dot=g.querySelector('[data-dot]'),drag=g.querySelector('[data-drag]');
    svg.setAttribute('role','group');
    const ring=g.querySelector('[data-focus-ring]');
    const stopsZ = [1, -1, 0];
    const motion = createMotion();
    readout.innerHTML = formula('h = max(0, z) = <strong></strong>', ' ');
    const activationOutput = readout.querySelector('strong'), detail = readout.querySelector('.fw-minor');
    let dual=false, local=0, z=1;
    function paint() {
      const h=Math.max(0,z), x=306+92*z,y=258-92*h;
      dot.setAttribute('cx',x);dot.setAttribute('cy',y);
      ring.setAttribute('cx',x);ring.setAttribute('cy',y);
      drag.setAttribute('aria-label',localized(dual,'ReLU input','ReLU 输入'));
      drag.setAttribute('aria-valuenow',String(Number(z.toFixed(2))));
      drag.setAttribute('aria-valuetext',`z = ${number(z)}, h = ${number(h)}`);
      if (z === 1) dot.dataset.bbAnchor = 'preactivation-one';
      else delete dot.dataset.bbAnchor;
      guide.setAttribute('d',`M${x},258V${y}H306`);
      const slope = !z ? localized(dual,'at 0, use gate 0','零点取门值 0') : `dh/dz = ${z>0?1:0}`;
      activationOutput.textContent = number(Number(h.toFixed(2)));
      detail.textContent = local ? `z = ${number(z)} · ${slope}` : `z = ${number(z)}`;
    }
    drag.addEventListener('keydown',e=>{
      const keys={ArrowLeft:-.25,ArrowDown:-.25,ArrowRight:.25,ArrowUp:.25};
      if (!(e.key in keys) && e.key!=='Home' && e.key!=='End') return;
      e.preventDefault();e.stopPropagation();motion.settle();
      z=e.key==='Home'?-2:e.key==='End'?2:Math.max(-2,Math.min(2,z+keys[e.key]));
      paint();
    });
    function position(e) {
      const matrix=svg.getScreenCTM(); if(!matrix) return;
      const xy=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
      z=Math.max(-2,Math.min(2,Math.round((xy.x-306)/92*4)/4));paint();
    }
    let pointer=null;
    drag.addEventListener('pointerdown',e=>{if(e.button!==0 || !e.isPrimary) return;motion.settle();drag.focus({preventScroll:true});pointer=e.pointerId;drag.setPointerCapture(pointer);position(e);});
    drag.addEventListener('pointermove',e=>{if(e.pointerId===pointer)position(e);});
    drag.addEventListener('lostpointercapture',()=>{pointer=null;});
    return {
      enter(i,opts) {
        motion.settle();
        const from = opts.reason === 'replay' && i ? stopsZ[i-1] : z;
        const to = stopsZ[i];
        local=i;dual=opts.bilingual;
        if (!i) {
          z=to;paint();
          return motion.play({animate:opts.animate,duration:1400}, t=>{
            const rise=along(tracks.edge,phase(t,0,.62),[398,258],[398,166]);
            const across=along(tracks.edge,phase(t,.6,.92),[398,166],[306,166]);
            dot.setAttribute('cy',rise[1]);ring.setAttribute('cy',rise[1]);
            guide.setAttribute('d',t<.6 ? `M398 258V${rise[1]}` : `M398 258V166H${across[0]}`);
            display(activationOutput,t>=.65);
          });
        }
        return motion.play({animate:opts.animate && from!==to, duration:1350}, t=>{
          z = t === 1 ? to : from + (to-from)*ease(t);
          paint();
        });
      },
      languageChanged(b){dual=b;paint();},settle:motion.settle,dispose:motion.settle
    };
  },
};

const layer = {
  id:'layer-rows',chapter,title:'One row per neuron',titleZh:'一行权重，一个神经元',
  steps:[
    step('To build a layer, give each hidden neuron its own row of weights and its own bias. The first row is our original neuron.', '要组成一层，就给每个隐藏神经元各分配一行权重和一个偏置。第一行就是刚才的神经元。'),
    step('Both rows use the same inputs. The first gives 1. The second gives −1, which ReLU maps to 0. Select a row to trace its calculation.', '两行用同样的输入。第一行算得 1，第二行算得 −1，经过 ReLU 后变成 0。点选任意一行可对照计算。'),
  ],
  mount({svg,readout}) {
    const selected = [
      {coeff:['1','½'], bias:'−1', z:'1', h:'1', products:['1','1']},
      {coeff:['1','−1'], bias:'0', z:'−1', h:'0', products:['1','−2']},
    ];
    const g=plot(svg,'Follow a weight row and the input column into their dot product',`
      ${label(163,53,'W','soft')}${label(318,53,'x','soft')}${label(431,53,'b','soft')}${label(548,53,'z','soft')}
      <rect x="67" y="89" width="205" height="61" rx="5" fill="#122f28" data-row-highlight/>
      ${bracket(58,84,140,'left')}${bracket(280,84,140,'right')}
      ${bracket(289,84,140,'left')}${bracket(347,84,140,'right')}
      ${bracket(393,84,140,'left')}${bracket(469,84,140,'right')}
      ${bracket(508,84,140,'left')}${bracket(587,84,140,'right')}
      ${label(367,166,'+','soft')}${label(487,166,'=','soft')}
      ${selected.map((r,i)=>{
        const y=133+72*i;
        return `<g data-row>${label(119,y,r.coeff[0],'large')}${label(220,y,r.coeff[1],'large')}${label(430,y,r.bias,'large')}<g data-result>${label(549,y,r.z,'large')}</g></g>
          <rect role="button" tabindex="0" data-interact data-layer="${i}" x="67" y="${y-44}" width="205" height="61" rx="5" fill="transparent"/>`;
      }).join('')}
      ${label(318,133,'1','large')}${label(318,205,'2','large')}
      <g data-copy-line aria-hidden="true" pointer-events="none">
        <g data-op>${label(107,304,'×','soft')}</g><g data-op>${label(193,304,'+','soft')}</g>
        <g data-op>${label(273,304,'×','soft')}</g><g data-op>${label(359,304,'+','soft')}</g>
        <g data-op>${label(475,304,'=','soft')}</g>
        ${[0,1,2,3,4].map(()=>label(0,0,'','teal copy')).join('')}
        <g data-total>${label(549,304,'','large teal')}</g>
      </g>`);
    svg.setAttribute('role','group');
    const hit=[...g.querySelectorAll('[data-layer]')], rows=[...g.querySelectorAll('[data-row]')];
    const results=[...g.querySelectorAll('[data-result]')], highlight=g.querySelector('[data-row-highlight]');
    const terms=[...g.querySelectorAll('[data-copy-line] > text')];
    const signs=[...g.querySelectorAll('[data-op]')], total=g.querySelector('[data-total] text');
    const motion=createMotion();
    let row=0,dual=false;
    function accessibleNames() {
      hit.forEach((item,j)=>item.setAttribute('aria-label',localized(dual,`Calculate row ${j+1}`,`计算第${j+1}行`)));
    }
    function playRow(which,animate) {
      motion.settle();
      const previous=row;row=which;
      const r=selected[row], y=133+72*row, sub=row?'₂':'₁';
      const entry=[r.coeff[0],'1',row?'(−1)':r.coeff[1],'2',row?'0':'(−1)'];
      const from=[[119,y],[318,133],[220,y],[318,205],[430,y]];
      const ends=[74,141,232,309,413];
      const starts=[.02,.07,.19,.24,.42];
      rows.forEach((item,j)=>item.style.opacity=j===row?'1':'.56');
      hit.forEach((item,j)=>item.setAttribute('aria-pressed',String(j===row)));
      total.textContent=r.z;
      terms.forEach((item,j)=>item.textContent=entry[j]);
      readout.innerHTML=formula(`z${sub} = ${r.products[0]} ${row?'− 2 + 0':'+ 1 − 1'} = <strong>${r.z}</strong>`,
        `h${sub} = <span data-bb-anchor="relu-function">max(0, ${r.z})</span> = ${r.h}`);
      const numerical=readout.querySelector('strong'), relu=readout.querySelector('.fw-minor');
      return motion.play({animate,duration:1850}, t=>{
        highlight.setAttribute('y',89+72*(previous+(row-previous)*ease(phase(t,0,.23))));
        terms.forEach((item,j)=>{
          const u=phase(t,starts[j],starts[j]+.37);
          const [x,y]=along(tracks.copy,u,from[j],[ends[j],304],j%2 ? -1:1);
          item.setAttribute('x',x);item.setAttribute('y',y);display(item,t>starts[j]);
        });
        signs.forEach((item,j)=>display(item,t>=[.36,.52,.54,.7,.78][j]));
        display(total,t>=.81);display(numerical,t>=.81);display(relu,t>=.89);
        results.forEach((item,j)=>display(item,j===row?t>=.81:j<row));
      });
    }
    hit.forEach((item,j)=>{
      item.addEventListener('click',()=>playRow(j,true));
      item.addEventListener('keydown',event=>{
        if (event.key==='Enter' || event.key===' ') {
          event.preventDefault();event.stopPropagation();playRow(j,true);
        }
      });
    });
    return {
      enter(i,opts){dual=opts.bilingual;accessibleNames();return playRow(i,opts.animate);},
      languageChanged(b){dual=b;accessibleNames();},
      settle:motion.settle,dispose:motion.settle,
    };
  },
};

const loss = {
  id:'prediction-loss',chapter,title:'How wrong is the prediction?',titleZh:'预测偏了多少？',
  steps:[
    step('Return to the single-neuron model with h = 1. The output weight doubles h, and the output bias is zero. Our prediction is 2.', '回到单隐藏神经元模型，此时 h = 1。输出权重把它放大两倍，输出偏置为零，所以预测是 2。'),
    step('The target is 1. Prediction minus target gives a signed error of +1. The prediction is one unit high.', '目标是 1。预测减去目标得到带符号误差 +1，说明预测偏高。'),
    step('Square the error and take half. The shaded triangle is the loss: one half. Now trace that loss back to the weights.', '把误差平方，再取一半。阴影三角形的面积就是损失 0.5。现在可以从这个损失往回追到各个权重。'),
  ],
  mount({svg,readout}) {
    const g=plot(svg,'Signed prediction error on a fixed scale and half of the error square',`
      <path class="stem" d="M47 250H381m-9-5 10 5-10 5"/>
      ${[0,1,2].map((n)=>`<path class="stem" d="M${69+n*126} 242v16"/>${label(69+n*126,289,String(n),'soft')}`).join('')}
      <path data-measure fill="none" stroke="${teal}" stroke-width="3.5"/>
      <g data-prediction><path fill="none" stroke="${teal}" stroke-width="3.5" d="M321 118v119"/><circle cx="321" cy="247" r="6" fill="${teal}" data-bb-anchor="network-prediction"/>
      ${label(321,96,'ŷ = 2','teal')}</g>
      <g data-gap><path fill="none" stroke="${amber}" stroke-width="3" pathLength="1" d="M195 239v-67h126m-10-5 10 5-10 5"/><circle cx="195" cy="246" r="5" fill="${amber}"/>
      ${label(195,150,'y = 1','amber')}${label(258,205,'e = +1','small')}</g>
      <g data-area><path fill="#17120e" stroke="${amber}" stroke-width="2.5"/>
      <path fill="#704526" stroke="${amber}" stroke-width="1.5"/>
      <g data-area-labels>${label(505,232,'½','large')}${label(486,112,'|e| = 1','small soft')}${label(487,290,'L = ½e²','amber')}</g></g>
      <path data-base-copy fill="none" stroke="${amber}" stroke-width="3"/>`);
    const E = [formula('ŷ = vh + c = <strong>2</strong>','v = 2,  c = 0'),formula('e = ŷ − y = <strong>+1</strong>','2 − 1 = +1',true),formula('L = ½(ŷ − y)² = <strong>½</strong>','½ × (2 − 1)² = 0.5',true)];
    const motion = createMotion();
    const gap=g.querySelector('[data-gap]'), area=g.querySelector('[data-area]');
    const gapLine=gap.querySelector('path'), areaLabels=area.querySelector('[data-area-labels]');
    const [square,half] = area.querySelectorAll('path'), baseCopy=g.querySelector('[data-base-copy]');
    const prediction=g.querySelector('[data-prediction]'), predictionLabel=prediction.querySelector('text');
    const measure=g.querySelector('[data-measure]'), errorLabel=gap.querySelectorAll('text')[1];
    return {
      enter(i,{animate}) {
        motion.settle();
        readout.innerHTML=E[i];
        display(gap, i>=1);display(area, i===2);display(baseCopy, false);
        gapLine.style.strokeDasharray='1';
        gapLine.style.strokeDashoffset='0';
        const answer=readout.querySelector('strong');
        prediction.removeAttribute('transform');predictionLabel.textContent='ŷ = 2';measure.setAttribute('d','');
        display(errorLabel,i>=1);
        if (!i) return motion.play({animate,duration:1420}, t=>{
          const [x]=along(tracks.edge,phase(t,.2,.85),[195,247],[321,247]);
          prediction.setAttribute('transform',`translate(${x-321} 0)`);
          predictionLabel.textContent=t<.22?'h = 1':t<.85?'× 2':'ŷ = 2';
          measure.setAttribute('d',t<.95 ? `M69 250H${x}` : '');
          display(answer,t>=.85);
        });
        if (i===1) return motion.play({animate,duration:1260},t=>{
          gapLine.style.strokeDashoffset = String(1-ease(phase(t,0,.82)));
          display(errorLabel,t>=.8);display(answer,t>=.8);
        });
        // Keep the length e on the original axis. Its copy becomes the square's base.
        return motion.play({animate,duration:1740},t=>{
          const [x,y]=along(tracks.copy,phase(t,0,.38),[195,172],[423,253]);
          const growth=ease(phase(t,.36,.68)), cut=ease(phase(t,.71,.93)), top=253-126*growth;
          display(baseCopy,t<1);
          baseCopy.setAttribute('d',`M${x} ${y}h126`);
          display(area,t>=.36);
          square.setAttribute('d',`M423 253H549V${top}H423Z`);
          half.setAttribute('d',`M423 253H549V${253-126*cut}Z`);
          areaLabels.style.opacity=String(ease(phase(t,.86,1)));
          display(answer,t>=.9);
        });
      },
      settle:motion.settle,dispose:motion.settle
    };
  },
};

export const forwardSlides = [network,weighted,activation,layer,loss];
