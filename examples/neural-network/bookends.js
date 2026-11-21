import { createMotion, ease } from './motion.js';
import openingVectors from './opening-vectors.json';

const ink = '#f2efe7';
const teal = '#8bddcc';
const amber = '#f2b078';

// Inline figures contain only fixed course text. A label's Chinese line is shown
// in study mode, which also updates the two captions through the deck player.
function note(readout, english, chinese, bilingual) {
  readout.replaceChildren();
  for (const [text, lang] of [[english, 'en'], [chinese, 'zh-Hans']]) {
    if (!bilingual && lang !== 'en') continue;
    const line = document.createElement('div');
    line.textContent = text;
    line.lang = lang;
    if (lang !== 'en') line.style.cssText = 'font-size:.77em;color:#a8b2ae;margin-top:.18em';
    readout.append(line);
  }
}

export const cover = {
  id: 'opening', chapter: 'Forward pass', title: 'A neural network, by hand', titleZh: '手推一个神经网络',
  steps: openingVectors.captions.map(([primary,secondary])=>({primary,secondary})),
  mount({svg}) {
    const {viewBox, geometry, items, beats, anchors}=openingVectors;
    svg.setAttribute('viewBox',viewBox.join(' '));
    svg.setAttribute('role','img');
    svg.removeAttribute('aria-labelledby');
    const paint=openingVectors.paint.map(style=>Array.from(style.matchAll(/([\w-]+)="([^"]+)"/g), match=>[match[1],match[2]]));
    const motion=createMotion();
    let previousFrame;
    function draw(frame,anchor) {
      if (previousFrame===frame) return;
      frame.forEach((item,slot)=>{
        if (previousFrame?.[slot]===item) return;
        const [shape,ink]=items[item];
        const path=document.createElementNS(svg.namespaceURI,'path');
        path.setAttribute('d',geometry[shape]);
        for (const [name,value] of paint[ink]) path.setAttribute(name,value);
        if (item===anchor) path.dataset.bbAnchor='network-prediction';
        if (svg.children[slot]) svg.children[slot].replaceWith(path);
        else svg.append(path);
      });
      while (svg.children.length>frame.length) svg.lastElementChild.remove();
      previousFrame=frame;
    }
    return {
      enter(step,{animate}) {
        motion.settle();
        svg.setAttribute('aria-label',step
          ? 'Prediction minus target. An arrow goes from 1 to 2 on the number line: a signed error of plus one.'
          : 'Target y equals 1. Prediction y hat equals 2.');
        const {frames,duration}=beats[step];
        return motion.play({animate,duration:duration*1000},t=>{
          draw(frames[Math.round(t*(frames.length-1))],anchors[step]);
        });
      },
      settle:motion.settle,dispose:motion.settle
    };
  }
};

export const contextSlide = {
  id:'context', chapter:'Self-attention', title:'Which “bank” do you mean?', titleZh:'这里的 bank 是什么意思？',
  steps:[
    {primary:'A fixed embedding gives “bank” the same starting vector in both phrases. A linear map of that vector alone returns the same result twice.',secondary:'两句中的 bank 起初共用同一个词向量。只对这个向量做线性变换，两次的结果仍然相同。'},
    {primary:'“River” and “loan” supply different evidence. Attention lets the representation of one token use information from the others.',secondary:'river 和 loan 提供了不同线索。注意力让一个词元的表示能够用到其他词元的信息。'},
    {primary:'A query asks what to look for. Each key is compared with it. The resulting weights determine how much of each value to mix.',secondary:'查询向量说明要找什么，键向量参与匹配。匹配得到的权重决定每个值向量混入多少。'}
  ],
  mount({svg,readout}) {
    svg.setAttribute('viewBox','0 0 630 380');
    const motion = createMotion();
    const words = ['river', 'loan'];
    const meanings = ['river’s edge', 'financial institution'];
    svg.innerHTML = words.map((word, i) => {
      const y = 109 + 163 * i;
      return `<g class="phrase" text-anchor="middle">
        <g fill="${ink}" font-size="47"><text x="135" y="${y}">${word}</text><text x="438" y="${y}">bank</text></g>
        <path d="M385 ${y+15}h106" stroke="#6f7873" stroke-width="2"/>
        <path class="key" d="M393 ${y-31} Q290 ${y-91} 180 ${y-31}" fill="none" stroke="${amber}" stroke-width="3" pathLength="1" stroke-dasharray="1"/>
        <path class="value" d="M182 ${y+5} Q291 ${y+63} 390 ${y+5}" fill="none" stroke="${teal}" stroke-width="3" pathLength="1" stroke-dasharray="1"/>
        <circle class="signal" r="6.5" fill="${teal}"/><text class="meaning" x="438" y="${y+52}" fill="${teal}" font-size="24">${meanings[i]}</text></g>`;
    }).join('');
    const phrases = Array.from(svg.querySelectorAll('.phrase'), group => {
      const key = group.querySelector('.key'), value = group.querySelector('.value');
      return {key, value, keyLength:key.getTotalLength(), valueLength:value.getTotalLength(), signal:group.querySelector('.signal'), meaning:group.querySelector('.meaning')};
    });
    let step = 0;
    function label(dual) {
      const notes = [['Same starting vector','相同的起始向量'],['Same word, different context','上下文改变词义'],['Compare keys → mix values','查询与键匹配，再按权重汇总值']];
      note(readout,...notes[step],dual);
    }
    function paint(t) {
      phrases.forEach(({key,value,keyLength,valueLength,signal,meaning}, i) => {
        const phase = (t - .09*i) / .91;
        const matching = step === 2 ? ease(phase / .48) : 0;
        const mixing = step === 2 ? ease((phase - .48) / .52) : step === 1 ? ease(phase) : 0;
        key.style.strokeDashoffset = 1 - matching;
        value.style.strokeDashoffset = 1 - mixing;
        const onKey = step === 2 && phase < .48;
        const distance = onKey ? matching : mixing;
        const at = onKey ? key.getPointAtLength(keyLength * distance) : value.getPointAtLength(valueLength * distance);
        signal.setAttribute('cx',at.x); signal.setAttribute('cy',at.y);
        signal.setAttribute('fill',onKey ? amber : teal);
        signal.style.opacity = distance > 0 && distance < 1 ? 1 : 0;
        meaning.style.opacity = step ? ease((mixing - .55) / .45) : 0;
      });
    }
    return {
      enter(n,{bilingual,animate}) {
        step = n; label(bilingual);
        return motion.play({animate:animate && n > 0, duration:n === 2 ? 1720 : 1320},paint);
      },
      languageChanged:label, settle:motion.settle, dispose:motion.settle
    };
  }
};

const problems = [
  { prompt:'What is ∂L/∂w₂?',zh:'损失对 w₂ 的导数是多少？', answer:-4, given:['ŷ = 2,   y = 3','v = 2,   x₂ = 2','ReLU′(z) = 1'], hint:'Multiply the signed error by v, the gate slope and x₂.',hintZh:'把带符号的误差、输出权重、门的斜率与第二个输入相乘。', proof:'(2 − 3) × 2 × 1 × 2 = −4'},
  { prompt:'What is the first coordinate of oᴬ?',zh:'A 的输出向量第一个分量是多少？', answer:2,given:['Vᴬ = (2, 0)','Vᴮ = (0, 1)','Vᶜ = (2, 1)'],hint:'With a causal mask, the first token can use only its own value.',hintZh:'加上因果掩码后，第一个词元只能读自己的值。',proof:'1 × 2 + 0 × 0 + 0 × 2 = 2'}
];

export const exerciseSlide = {
  id:'try-it',chapter:'Check your work',title:'Try the calculation', titleZh:'自己算一遍',
  steps:[
    {primary:'Keep the original network and change only its target to 3. Predict the sign and size of the second weight’s gradient.',secondary:'保留原网络，只把目标改为 3。试算第二个输入权重的梯度，注意符号。'},
    {primary:'Token A comes first. With the causal mask in place, which values can contribute to its output?',secondary:'A 是第一个词元。加上因果掩码后，哪些值还能影响它的输出？'}
  ],
  mount({svg,readout,controls}) {
    svg.setAttribute('viewBox','0 0 620 330');
    controls.innerHTML = `<form class="nn-answer" style="display:flex;gap:.4em;align-items:center;flex-wrap:wrap"><input inputmode="decimal" type="text" autocomplete="off" aria-label="Your numerical answer" style="width:5em;background:black;color:inherit;border:1px solid #71817b;border-radius:.2em;padding:.23em .5em;font:inherit"><button type="submit"></button><button type="button"></button></form><div role="status" aria-live="polite" style="color:#d1dfd8;min-height:1.3em;font-size:.9em"></div>`;
    const form=controls.querySelector('form'), input=form.querySelector('input'), [check,reveal]=form.querySelectorAll('button'), feedback=controls.querySelector('[role=status]');
    let problem, dual, outcome='';
    function feedbackText() {
      if (outcome==='proof') feedback.textContent=problem.proof;
      else if(outcome==='correct') feedback.textContent=(dual?'Correct · 正确　':'Correct　') + problem.proof;
      else if(outcome==='hint') feedback.textContent=dual?`${problem.hint} ${problem.hintZh}`:problem.hint;
      else feedback.textContent='';
    }
    function draw() {
      svg.innerHTML=problem.given.map((line,i)=>`<text x="80" y="${82+81*i}" fill="${i===0?teal:ink}" font-size="42">${line}</text>`).join('');
      note(readout,problem.prompt,problem.zh,dual);
      check.textContent=dual?'Check · 检查':'Check'; reveal.textContent=dual?'Solution · 解法':'Solution';feedbackText();
    }
    form.addEventListener('submit',e=>{e.preventDefault();const text=input.value.trim().replace('−','-');outcome=text!=='' && Number(text)===problem.answer?'correct':'hint';feedbackText();});
    reveal.addEventListener('click',()=>{outcome='proof';feedbackText();});
    input.addEventListener('input',()=>{outcome='';feedbackText();});
    return {enter(i,{bilingual}){problem=problems[i];dual=bilingual;input.value='';outcome='';draw();},languageChanged(bilingual){dual=bilingual;draw();}};
  }
};

export const ending = {
  id:'takeaway',chapter:'Check your work',title:'What attention learns',titleZh:'注意力到底在学什么',
  steps:[
    {primary:'The forward pass builds an answer from stored intermediate values. The backward pass reuses those values to compute how the loss changes with each parameter.',secondary:'前向传播通过一系列中间量算出答案。反向传播复用这些中间量，算出损失对各参数的导数。'},
    {primary:'Follow the gradient back to W. A training step subtracts a small multiple of that gradient from the projection weights used on the next forward pass.',secondary:'沿梯度回到 W。训练从投影权重里减去学习率乘以梯度，下一次前向计算就用更新后的权重。'}
  ],
  mount({svg,readout,navigate}) {
    svg.setAttribute('viewBox','0 0 620 330');
    svg.innerHTML = `<g font-size="38" text-anchor="middle" fill="${ink}">
      <text x="60" y="104">X</text><g class="projection" data-interact="" tabindex="0" role="link" style="cursor:pointer"><title>Revisit the Q, K, V projections</title><rect x="158" y="58" width="150" height="57" fill="transparent"/><text x="233" y="104">Q, K, V</text></g><text x="415" y="104">O</text><text x="551" y="104">L</text></g>
      <g fill="none" stroke="${teal}" stroke-width="3">
      <path d="M92 91h64"/><path d="M318 91h61"/><path d="M451 91h66"/></g>
      <g fill="none" stroke="${amber}" stroke-width="3"><path d="M551 123v61q0 25-25 25H287"/><path d="M217 206v-67"/></g>
      <text class="update" x="220" y="237" text-anchor="middle" fill="${amber}" font-size="35">W</text>
      <text class="update-prime" x="239" y="227" fill="${amber}" font-size="31">′</text>
      <text class="gradient" x="410" y="261" text-anchor="middle" fill="${amber}" font-size="27">∇<tspan baseline-shift="sub" font-size="65%">W</tspan> L</text>
      <circle class="travel" r="6"/>`;
    const motion = createMotion();
    const paths = Array.from(svg.querySelectorAll('path'), path => {
      path.setAttribute('pathLength','1'); path.style.strokeDasharray = '1';
      return {path, length:path.getTotalLength()};
    });
    const travel = svg.querySelector('.travel'), gradient = svg.querySelector('.gradient'), update = svg.querySelector('.update');
    const prime = svg.querySelector('.update-prime');
    const projection = svg.querySelector('.projection');
    projection.addEventListener('click', () => navigate('qkv-projections'));
    projection.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); navigate('qkv-projections'); }
    });
    let current = 0;
    function label(dual) {
      projection.setAttribute('aria-label', dual ? 'Revisit Q, K, V · 回看投影' : 'Revisit the Q, K, V projections');
      note(readout, current ? '' : 'X → Q, K, V → O → L', current ? '用梯度更新投影矩阵' : '从输入向前算到损失，再沿图往回走', dual);
      if (current) readout.firstElementChild.innerHTML = '<i>W</i> ← <i>W</i> − η ∇<sub>W</sub> <i>L</i>';
    }
    function paint(t) {
      const stages = current ? [1,1,1,ease(t / .65),ease((t - .65) / .35)] :
        [ease(t/.21), ease((t-.21)/.21), ease((t-.42)/.20), ease((t-.62)/.38), 0];
      travel.style.opacity = 0;
      paths.forEach(({path,length}, i) => {
        const f = stages[i];
        path.style.strokeDashoffset = 1 - f;
        if (f <= 0 || f >= 1) return;
        const position = path.getPointAtLength(length*f);
        travel.setAttribute('cx',position.x); travel.setAttribute('cy',position.y);
        travel.setAttribute('fill',i < 3 ? teal : amber); travel.style.opacity = 1;
      });
      gradient.style.opacity = ease((stages[3] - .7)/.3);
      update.style.opacity = Math.max(.55, current ? stages[4] : .55);
      prime.style.opacity = current ? ease((t - .60) / .08) : 0;
    }
    return {
      enter(n,{bilingual,animate}) {
        current = n; label(bilingual);
        return motion.play({animate,duration:current ? 1500 : 2000},paint);
      },
      languageChanged:label, settle:motion.settle, dispose:motion.settle
    };
  }
};
