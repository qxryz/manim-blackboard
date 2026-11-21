import sampled from './backward-geometry.json';
import { createMotion, ease } from './motion.js';

// One backward pass through the scalar network from the forward chapter.
const ivory = '#f1eee5';
const teal = '#87dbcd';
const amber = '#f1b47c';
const muted = '#b5b4ab';
const line = '#545b59';
const chapter = 'Backward pass';
const names = ['w₁', 'w₂', 'b', 'v', 'c'];
const start = [1, 0.5, -1, 2, 0];
const gradient = [2, 4, 2, 1, 1];

function frame(sequence, t) {
  return sequence[Math.round(Math.max(0,Math.min(1,t))*(sequence.length-1))];
}
function number(value, digits = 9) {
  return Number(value.toFixed(digits)).toString().replace('-', '−');
}
function label(x, y, content, size = 24, color = ivory, anchor = 'start', attrs = '') {
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}" ${attrs}>${content}</text>`;
}
function stroke(x1, y1, x2, y2, color = line, width = 2, extra = '') {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
}
function dot(x, y, r, color, attrs = '') {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" ${attrs}/>`;
}
function plotSetup(svg) {
  svg.setAttribute('viewBox', '0 0 620 345');
  svg.setAttribute('role', 'img');
}
function setReadout(host, lines) {
  host.innerHTML = `<div style="display:grid;gap:.24em;font-variant-numeric:tabular-nums">${lines.map(([value,color]) => `<div style="color:${color || ivory}">${value}</div>`).join('')}</div>`;
}
function weightAnchor(i) {
  return i < 2 ? `data-bb-anchor="weight-gradient-${i + 1}"` : '';
}
function updated(eta) {
  const values = start.map((value, i) => value - eta * gradient[i]);
  const [w1,w2,b,v,c] = values;
  const z = w1 + 2 * w2 + b;
  const yhat = v * Math.max(0,z) + c;
  return { values, z, yhat, loss:0.5 * (yhat - 1) ** 2 };
}

// Both boards use the same SVG coordinates. The outgoing frame is available only
// to the scene mounted during the same navigation; a jump cannot inherit it later.
const departingSlope=new WeakMap();
const slopeSource=[526,76.5], lossEdge=[476,270];
function slopeToken(x,y,mode,attrs=''){
  return `<g transform="translate(${x} ${y})" ${attrs}>
    <path data-operator d="${mode==='plus'?sampled.operator[0]:sampled.operator.at(-1)}" transform="translate(-8 0) scale(12)"/>
    <path d="${sampled.digit[0]}" transform="translate(8 0) scale(16)"/>
  </g>`;
}
const lossSlope = {
  id:'loss-slope', chapter, title:'Which way is downhill?',
  steps:[
    {primary:'Keep the target at one. Our prediction lands on this bowl at a loss of one half.', secondary:'目标仍是 1。预测值落在这条损失曲线上，对应的损失是 0.5。'},
    {primary:'Bring the second prediction toward the first. The slope between them approaches the slope at a single point.', secondary:'让第二个预测点靠近第一个。两点之间的平均斜率，逐渐逼近这一点的瞬时斜率。'},
    {primary:'At a prediction of two the slope is +1. Lowering the prediction a little will lower the loss. This slope is what we send backward.', secondary:'预测为 2 时，斜率是 +1。把预测稍微调低，损失也会降低。反向传递的就是这个斜率。'}
  ],
  mount({svg,readout}) {
    plotSetup(svg);
    const px = value => 61 + (value + 0.5) * 154;
    const py = loss => 286 - loss * 155;
    const motion = createMotion();
    let step=0, dual=false;
    function render(animate=false) {
      motion.settle();
      const slopeLabel=`<g data-slope fill="${amber}">${label(px(2.15),py(1.3),'m =',23,amber)}${slopeToken(...slopeSource,'plus','data-departing-slope aria-label="+1"')}</g>`;
      const tangent = step >= 1 ? `<g>${stroke(px(1.57),py(.07),px(2.55),py(1.05),amber,3.5,'data-slope-line')}${step === 1 ? dot(px(2),py(.5),5,ivory,'data-neighbour visibility="hidden"') : `${stroke(px(2),py(.5),px(2.37),py(.5),amber,1.7,'stroke-dasharray="5 5" data-run')}${stroke(px(2.37),py(.5),px(2.37),py(.87),amber,1.7,'stroke-dasharray="5 5" data-rise')}${slopeLabel}`}</g>` : '';
      svg.innerHTML = `${stroke(52,286,570,286)}${stroke(61,294,61,46)}${label(48,37,'L',28,ivory)}${label(570,317,'ŷ',28,ivory)}
        ${[0,1,2].map(v=>`${stroke(px(v),282,px(v),294)}${label(px(v),319,String(v),21,muted,'middle')}`).join('')}
        ${stroke(55,py(.5),68,py(.5))}${label(48,py(.5)+7,'0.5',21,muted,'end')}
        ${stroke(px(2),py(.5),px(2),286,line,1.6,'stroke-dasharray="5 5"')}
        <path data-bowl fill="none" stroke="${teal}" stroke-linecap="round" stroke-width="3.5"/>${tangent}
        ${dot(px(1),286,5,teal)}${label(px(1),265,dual?'目标':'target',20,muted,'middle','data-target-label')}
        ${dot(px(2),py(.5),7,step?amber:teal,'data-bb-anchor="network-prediction"')}${label(px(2)-12,py(.5)-16,'(2, 0.5)',23,ivory,'end')}`;
      svg.setAttribute('aria-label',dual?'损失曲线：目标 1，预测 2，损失 0.5，切线斜率 +1。':'Loss curve. Target 1, prediction 2, loss 0.5. The tangent slope here is +1.');
      const curve=svg.querySelector('[data-bowl]');
      curve.setAttribute('d',sampled.curve.at(-1));
      if (step===0) {
        setReadout(readout,[['L = ½ (ŷ − y)²'],['L(2) = ½ (2 − 1)² = 0.5',teal]]);
        const result=readout.firstElementChild.lastElementChild;
        const point=svg.querySelector('[data-bb-anchor="network-prediction"]');
        return motion.play({animate,duration:1450},t=>{
          curve.setAttribute('d',frame(sampled.curve,t));
          const arrival=ease((t-.53)/.25);
          point.setAttribute('r',7*arrival);
          point.nextElementSibling.style.opacity=String(arrival);
          result.style.opacity=String(arrival);
        });
      }
      if (step===1) {
        setReadout(readout,[['m = ΔL / Δŷ'],['Δŷ <span data-gap></span>'],['<span data-secant-value></span>',amber]]);
        const secant=svg.querySelector('[data-slope-line]');
        const neighbour=svg.querySelector('[data-neighbour]');
        const gap=readout.querySelector('[data-gap]'), value=readout.querySelector('[data-secant-value]');
        return motion.play({animate,duration:1650},t=>{
          const [x,y,x1,y1,x2,y2]=frame(sampled.secant,t);
          const dx=Math.max(0,(x-px(2))/154);
          neighbour.setAttribute('cx',x); neighbour.setAttribute('cy',y);
          neighbour.setAttribute('visibility',t===1?'hidden':'visible');
          secant.setAttribute('x1',x1); secant.setAttribute('x2',x2);
          secant.setAttribute('y1',y1); secant.setAttribute('y2',y2);
          gap.textContent=t===1?'→ 0⁺':'= '+dx.toFixed(3);
          value.textContent=t===1?'∂L/∂ŷ = 1':'m = '+(1+dx/2).toFixed(3);
        });
      }
      setReadout(readout,[['∂L/∂ŷ = ŷ − y'],['= 2 − 1',amber]]);
      const run = svg.querySelector('[data-run]'), rise = svg.querySelector('[data-rise]'), slope = svg.querySelector('[data-slope]');
      return motion.play({animate, duration:1290}, t => {
        run.setAttribute('x2', px(2 + .37 * Math.min(1,t*2)));
        rise.setAttribute('y2', py(.5 + .37 * Math.max(0,t*2-1)));
        slope.style.opacity = String(ease((t-.66)/.3));
        readout.firstElementChild.lastElementChild.style.opacity=slope.style.opacity;
      });
    }
    function dispose(){
      motion.settle();
      if(step!==2)return;
      const stage=svg.closest('#stage');
      const fresh=svg.cloneNode(true);
      fresh.querySelector('[data-departing-slope]').remove();
      for(const anchor of fresh.querySelectorAll('[data-bb-anchor]'))anchor.removeAttribute('data-bb-anchor');
      departingSlope.set(stage,fresh);
      queueMicrotask(()=>{if(departingSlope.get(stage)===fresh)departingSlope.delete(stage);});
    }
    return {enter(s,o){step=s;dual=o.bilingual;return render(o.animate);}, languageChanged(b){dual=b;render();}, settle:motion.settle, dispose};
  }
};

const reverseChain = {
  id:'reverse-chain', chapter, title:'Pass the slope backward',
  steps:[
    {primary:'The tangent supplies the multiplier on the last edge. Start a separate gradient at the loss itself: changing L by one changes L by one.',secondary:'切线的斜率成为最后一条边上的乘数。反向传播另从损失本身出发：L 增加 1，L 自身就增加 1，所以起始梯度是 1。'},
    {primary:'Cross the loss operation. Multiply the incoming one by the local slope of the loss, which we just found to be one.',secondary:'反向越过损失计算。把传入的 1 乘以刚刚求出的局部斜率 1。'},
    {primary:'The output multiplied h by v = 2. A small change in h therefore changes the loss twice as fast here.',secondary:'输出层把 h 乘以 v = 2。因此在这里，h 的微小变动会让损失以两倍的速率变化。'},
    {primary:'At z = 1 the ReLU gate is open. Its local slope is one, so the gradient reaching z stays at two.',secondary:'此时 z = 1，ReLU 处在开启区间，局部斜率为 1。因此传到 z 的梯度仍为 2。'}
  ],
  mount({svg,readout}) {
    plotSetup(svg);
    const stage=svg.closest('#stage');
    const incoming=departingSlope.get(stage);
    departingSlope.delete(stage);
    let repeatHandoff=false;
    const xs=[63,229,395,557], symbols=['z','h','ŷ','L'], values=['1','1','2','0.5'];
    const local=[1,2,1], accumulated=[2,2,1,1];
    const rules=[['∂L/∂L = 1'],['∂L/∂ŷ = 1 × (ŷ − y)','= 1 × 1 = 1'],['∂L/∂h = (∂L/∂ŷ) v','= 1 × 2 = 2'],['∂L/∂z = (∂L/∂h) ReLU′(z)','= 2 × 1 = 2']];
    const motion = createMotion();
    let marks=label(18,45,'Forward values',22,teal,'start','data-forward-label');
    for(let i=0;i<3;i++){
      const a=xs[i]+32,b=xs[i+1]-32;
      marks+=`${stroke(a,128,b,128,line,2,'data-chain-wire')}<path d="M${b-7},124 l7,4 -7,4" fill="none" stroke="${line}" stroke-width="2"/>`;
    }
    for(let i=0;i<4;i++){
      const key = i === 2 ? 'data-bb-anchor="network-prediction"' : '';
      marks+=`<circle data-chain-node cx="${xs[i]}" cy="128" r="30" fill="#070c0b" stroke="${teal}" stroke-width="1.8" ${key}/>${label(xs[i],139,symbols[i],31,ivory,'middle')}${label(xs[i],194,values[i],25,teal,'middle')}`;
    }
    marks+=label(18,252,'Backward gradients',22,amber,'start','data-backward-label');
    marks+=stroke(xs[2]+24,303,xs[3]-24,303,line,1.3,'stroke-dasharray="3 6"');
    for(let i=0;i<4;i++){
      const key = i === 0 ? ' data-bb-anchor="input-upstream-gradient"' : '';
      marks+=`<g data-gradient="${i}">${label(xs[i],315,accumulated[i],37,amber,'middle','data-result'+key)}`;
      if(i<3){
        const a=xs[i]+24, b=xs[i+1]-24;
        marks+=`${stroke(a,303,b,303,amber,2.3)}<polygon fill="${amber}" points="${a},303 ${a+9},297 ${a+9},309"/>${i===2?'':label((a+b)/2,278,`× ${local[i]}`,22,muted,'middle','data-factor')}`;
      }
      marks+='</g>';
    }
    marks+=`<g data-carried visibility="hidden" aria-hidden="true">${label(0,0,'',37,amber,'middle','data-digit style="paint-order:stroke;stroke:#000;stroke-width:5px"')}<path data-morph fill="${amber}" stroke="#000" stroke-width=".13" paint-order="stroke"/></g>`;
    marks+=`<path data-seed fill="none" stroke="${amber}" stroke-width="2" stroke-dasharray="3 5"/>`;
    svg.innerHTML=`<g data-chain>${marks}</g>${slopeToken(...lossEdge,'times',`data-local-slope fill="${amber}" aria-label="×1"`)}`;
    const chain=svg.querySelector('[data-chain]'), factorMark=svg.querySelector('[data-local-slope]');
    const operator=factorMark.querySelector('[data-operator]');
    const groups=[...svg.querySelectorAll('[data-gradient]')];
    const carried=svg.querySelector('[data-carried]');
    function languageChanged(dual) {
      svg.querySelector('[data-forward-label]').textContent=dual?'前向值':'Forward values';
      svg.querySelector('[data-backward-label]').textContent=dual?'反向梯度':'Backward gradients';
      svg.setAttribute('aria-label',dual?'上方从左向右是前向值，下方从右向左是已经求出的梯度。':'Forward values run left to right; computed gradients return right to left.');
    }
    function enter(s, {animate, bilingual, reason}){
      motion.settle();
      const active=3-s;
      groups.forEach(g=>{const r=g.querySelector('[data-result]'); r.style.opacity='1'; r.setAttribute('y',315);});
      groups.forEach((group,i)=>{ group.style.display=i>=active?'':'none'; });
      languageChanged(bilingual);
      setReadout(readout,rules[s].map((value,i)=>[value,i?amber:ivory]));
      const seed=svg.querySelector('[data-seed]');
      seed.setAttribute('d','');
      factorMark.setAttribute('fill',s===0?amber:muted);
      if (!s) {
        if(reason!=='replay')repeatHandoff=Boolean(incoming&&animate&&['navigate','page'].includes(reason));
        const old=repeatHandoff&&animate?incoming.cloneNode(true):undefined;
        const result=groups[3].querySelector('[data-result]');
        const oldCurve=old?.querySelector('[data-bowl]'), tangent=old?.querySelector('[data-slope-line]');
        if(old){
          old.querySelector('[data-target-label]').textContent=bilingual?'目标':'target';
          old.removeAttribute('id');old.setAttribute('aria-hidden','true');
          old.setAttribute('data-handoff-source','');old.setAttribute('pointer-events','none');
          svg.insertBefore(old,chain);
        }
        const strokes=[...chain.querySelectorAll('[data-chain-node],[data-chain-wire]')].map(mark=>[mark,mark.getTotalLength()]);
        return motion.play({animate,duration:old?1980:1240},t=>{
          if(old){
            const erase=ease((t-.025)/.30), travel=(t-.08)/.56;
            oldCurve.setAttribute('d',frame(sampled.curve,1-erase));
            tangent.setAttribute('x1',379.78+(446-379.78)*erase);
            tangent.setAttribute('y1',275.15+(208.5-275.15)*erase);
            tangent.setAttribute('x2',530.7+(446-530.7)*erase);
            tangent.setAttribute('y2',123.25+(208.5-123.25)*erase);
            old.style.opacity=String(1-ease((t-.08)/.23));
            const [along,lift]=frame(sampled.route,travel);
            const gx=slopeSource[0]+(lossEdge[0]-slopeSource[0])*along+lift*125;
            const gy=slopeSource[1]+(lossEdge[1]-slopeSource[1])*along;
            factorMark.setAttribute('transform',`translate(${gx} ${gy})`);
            operator.setAttribute('d',frame(sampled.operator,(t-.46)/.20));
            chain.style.opacity=String(ease((t-.30)/.20));
            for(const [mark,length] of strokes){
              const p=ease((t-.28)/.34);
              mark.style.strokeDasharray=p===1?'':String(length);
              mark.style.strokeDashoffset=p===1?'':String(length*(1-p));
            }
            if(t===1)old.remove();
          }
          const write=old?ease((t-.52)/.45):t;
          seed.setAttribute('d',`M${xs[3]} 205V${205+67*ease(write/.68)}`);
          result.style.opacity=String(ease((write-.45)/.42));
          result.setAttribute('y',311+4*ease((write-.45)/.42));
          readout.firstElementChild.style.opacity=result.style.opacity;
        });
      }
      const group=groups[active], factor=active===2?factorMark:group.querySelector('[data-factor]');
      const wire=group.querySelector('line'), arrow=group.querySelector('polygon'), result=group.querySelector('[data-result]');
      const startX=xs[active+1], endX=xs[active], centre=(startX+endX)/2;
      const rhs=readout.firstElementChild.lastElementChild;
      const origin=groups[active+1].querySelector('[data-result]');
      const digit=carried.querySelector('[data-digit]'), morph=carried.querySelector('[data-morph]');
      return motion.play({animate, duration:1630}, t=>{
        const secondHalf=t>.5;
        const [along,lift]=frame(sampled.route,secondHalf?(t-.58)/.42:t/.40);
        const x=secondHalf?centre+(endX-centre)*along:startX+(centre-startX)*along;
        const y=315+lift*20;
        const changed=accumulated[active]!==accumulated[active+1] && document.documentElement.dataset.bbTypeface==='classic';
        carried.setAttribute('visibility',t>0 && t<1?'visible':'hidden');
        carried.setAttribute('transform',`translate(${x} ${y})`);
        origin.style.opacity=t===0?'1':String(ease((Math.abs(x-startX)-24)/18));
        digit.textContent=String(t<.5?accumulated[active+1]:accumulated[active]);
        digit.style.display=changed?'none':'';
        morph.style.display=changed?'':'none';
        if(changed){
          morph.setAttribute('d',frame(sampled.digit,(t-.37)/.26));
          morph.setAttribute('transform','translate(0 -12.5) scale(25)');
        }
        wire.setAttribute('x1',Math.min(startX-24,Math.max(endX+24,x)));
        factor.setAttribute('fill',Math.abs(x-centre)<30?amber:muted);
        arrow.setAttribute('visibility',x<=endX+24?'visible':'hidden');
        result.style.opacity=t===1?'1':'0';
        rhs.style.opacity=String(ease((t-.65)/.3));
      });
    }
    return { enter, languageChanged, settle:motion.settle, dispose:motion.settle };
  }
};

const parameterGradients = {
  id:'parameter-gradients', chapter, title:'Which weight matters more?',
  steps:[
    {primary:'Trace w₁ into z. Its local multiplier is x₁, so its gradient is the incoming two times one.',secondary:'沿着 w₁ 追到 z。它的局部乘数是输入 x₁，所以梯度等于传来的 2 乘以 1。'},
    {primary:'Now compare the input weights. Both receive the same upstream slope, but the second input is twice as large.',secondary:'比较两个输入权重。它们收到同一个上游梯度，但第二个输入是第一个的两倍。'},
    {primary:'The biases add one copy of themselves. The output weight multiplies h. Their bars reach one or two according to the slope they receive.',secondary:'偏置直接相加，输出权重则乘以 h。在这个样本中，这三项的局部乘数都是 1，它们的梯度就等于传来的梯度。'}
  ],
  mount({svg,readout}) {
    plotSetup(svg);
    svg.setAttribute('role','group');
    const partials=['x₁','x₂','1','h','1'], parents=['z','z','z','ŷ','ŷ'];
    const multipliers=[1,2,1,1,1], upstream=[2,2,2,1,1];
    const base=131, unit=69, motion=createMotion();
    let step=0, dual=false, selected=0;
    const baseY=i=>83+50*i, stages=[[0],[1],[2,3,4]];
    svg.innerHTML=label(23,34,'',23,muted,'start','data-heading')+names.map((name,i)=>{
      const y=baseY(i);
      return `<g data-row="${i}">
        ${label(57,y+8,name,29,muted,'middle','data-name')}
        ${stroke(base,y,base+4*unit,y,line,1)}
        <g data-bar="${i}">
          ${stroke(base,y,base,y,amber,7)}${dot(base,y,5,amber)}
          ${label(base,y+8,gradient[i],25,amber,'start',weightAnchor(i))}
          ${label(508,y+7,`${upstream[i]} × ${multipliers[i]}`,22,muted,'middle','data-product')}
        </g>
        <rect x="22" y="${y-22}" width="562" height="44" fill="transparent"/>
      </g>`;
    }).join('');
    const rows=[...svg.querySelectorAll('[data-row]')];
    const bars=rows.map(row=>row.querySelector('[data-bar]'));
    function highlight(index) {
      selected=index;
      rows.forEach((row,i)=>{
        const active=i===index;
        row.setAttribute('aria-pressed',String(active));
        const color=active?amber:teal, bar=bars[i];
        bar.querySelector('line').setAttribute('stroke',color);
        bar.querySelector('circle').setAttribute('fill',color);
        bar.querySelector('text').setAttribute('fill',color);
        bar.querySelector('[data-product]').setAttribute('fill',active?ivory:muted);
      });
      const p=parents[index], incoming=p==='z'?`<span data-bb-anchor="input-upstream-gradient">${upstream[index]}</span>`:upstream[index];
      setReadout(readout,[[`∂L/∂${names[index]}`],[`= (∂L/∂${p}) · ${partials[index]}`],[`= ${incoming} × ${multipliers[index]} = <span data-total>${gradient[index]}</span>`,amber]]);
    }
    function drawBar(i,progress){
      const right=base+unit*gradient[i]*ease(progress), bar=bars[i];
      bar.querySelector('line').setAttribute('x2',right);
      bar.querySelector('circle').setAttribute('cx',right);
      const result=bar.querySelector('text');
      result.setAttribute('x',right+15);
      result.setAttribute('opacity',ease((progress-.55)/.43));
    }
    function makeAvailable(i,available){
      const row=rows[i];
      row.setAttribute('tabindex',available?'0':'-1');
      row.querySelector('[data-name]').setAttribute('fill',available?ivory:muted);
      bars[i].setAttribute('visibility',available?'visible':'hidden');
      row.style.cursor=available?'pointer':'';
      if(available){
        row.setAttribute('role','button');row.setAttribute('data-interact','');
        row.setAttribute('aria-label',dual?`查看 ${names[i]} 的梯度`:`Inspect gradient of ${names[i]}`);
      }else{
        row.removeAttribute('role');row.removeAttribute('data-interact');row.removeAttribute('aria-label');
      }
    }
    rows.forEach((row,i)=>{
      const choose=e=>{
        if(row.getAttribute('tabindex')!=='0')return;
        e.stopPropagation();
        if(e.type==='keydown')e.preventDefault();
        motion.settle();highlight(i);
      };
      row.addEventListener('click',choose);
      row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')choose(e);});
    });
    function enter(s,{animate,bilingual}){
      motion.settle();
      step=s;dual=bilingual;
      svg.querySelector('[data-heading]').textContent=dual?'各参数的损失梯度':'Loss gradient by parameter';
      svg.setAttribute('aria-label',dual?'按参数比较梯度':'Compare the gradients of the parameters');
      const sequence=stages[s], first=sequence[0];
      rows.forEach((_,i)=>{makeAvailable(i,i<first);drawBar(i,i<first?1:0);});
      let current=-1;
      return motion.play({animate,duration:sequence.length===1?1240:2050},t=>{
        const position=t*sequence.length, part=Math.min(sequence.length-1,Math.floor(position));
        const index=sequence[part], u=Math.min(1,position-part);
        if(current!==index){
          for(let i=first;i<=index;i++){makeAvailable(i,true);drawBar(i,i===index?0:1);}
          current=index;highlight(index);
        }
        drawBar(index,u);
        readout.querySelector('[data-total]').style.opacity=String(ease((u-.55)/.4));
      });
    }
    function languageChanged(b){
      motion.settle();
      const previous=selected;
      enter(step,{animate:false,bilingual:b});
      highlight(previous);
    }
    return {enter,languageChanged,settle:motion.settle,dispose:motion.settle};
  }
};

const descentStep = {
  id:'descent-step', chapter, title:'Take one learning step',
  steps:[
    {primary:'Freeze all five gradients at the original network. Subtract the learning rate times each gradient from its own parameter.',secondary:'先固定原网络算出的五个梯度。每个参数都减去学习率乘以自己的梯度，五个更新同时进行。'},
    {primary:'Run the same input through the updated network. Recompute the preactivation, apply ReLU, then read out a fresh prediction.',secondary:'让同一个输入再次通过更新后的网络。先重新算 z，再经过 ReLU，最后得到新的预测。'},
    {primary:'A step of 0.025 cuts the loss to about 0.064. Farther right the curve climbs back above its starting height: a larger step can overshoot.',secondary:'学习率取 0.025 时，损失降到约 0.064。沿曲线继续向右，损失会重新超过最初的 0.5：步子太大就会越过谷底。'}
  ],
  mount({svg,controls,readout}) {
    plotSetup(svg);
    controls.innerHTML='<label style="display:flex;align-items:center;gap:.45em"><span>η</span><input data-eta type="range" min="0" max="0.1" step="0.001" value="0.025" style="max-width:14em;width:60%;min-width:4em"><output style="display:inline-block;min-width:4.2ch;font-variant-numeric:tabular-nums">0.025</output></label>';
    const slider=controls.querySelector('input'), output=controls.querySelector('output');
    let step=0, dual=false;
    const motion=createMotion();
    let paintRate;
    slider.addEventListener('input',()=>{
      const requested=slider.valueAsNumber;
      motion.settle();
      paintRate?.(requested,true);
    });
    function compareRates(eta,animate){
      const ox=76, oy=269, width=449, height=185;
      const x=a=>ox+width*a/.1, y=a=>oy-height*updated(a).loss/.605;
      const curve=Array.from({length:151},(_,i)=>`${i?'L':'M'}${x(i/1500).toFixed(2)} ${y(i/1500).toFixed(2)}`).join(' ');
      svg.innerHTML=`${label(48,45,"L′",27,ivory)}${stroke(ox,60,ox,oy+5)}${stroke(ox-8,oy,552,oy)}
        ${[0,.025,.05,.075,.1].map(a=>stroke(x(a),oy,x(a),oy+7)+label(x(a),oy+29,number(a),19,muted,'middle')).join('')}
        ${label(567,oy+8,'η',27,ivory)}${stroke(ox-6,y(0),ox+6,y(0))}
        ${label(ox-12,y(0)+6,'0.5',20,muted,'end')}${stroke(x(0),y(0),x(.1),y(0),line,1.5,'stroke-dasharray="5 6"')}
        <path d="${curve}" fill="none" stroke="${line}" stroke-width="3"/><path data-loss-trace d="${curve}" fill="none" stroke="${teal}" stroke-width="4"/>
        ${label(x(.1),y(.1)-12,'0.605',20,muted,'middle')}${dot(x(0),y(0),6,ivory)}${dot(x(eta),y(eta),8,amber,'data-live-loss')}`;
      svg.setAttribute('aria-label',dual?'沿当前梯度改变学习率时的损失':'Loss after one simultaneous update, as a function of the learning rate');
      const trace=svg.querySelector('[data-loss-trace]'), marker=svg.querySelector('[data-live-loss]');
      const length=trace.getTotalLength();
      trace.setAttribute('stroke-dasharray',`${length} ${length}`);
      // The SVG path is parameterized by distance; locate the prefix ending at the chosen η.
      function tracedLength(a) {
        let lo=0,hi=length;
        for(let i=0;i<14;i++){
          const mid=(lo+hi)/2;
          if(trace.getPointAtLength(mid).x<x(a))lo=mid;
          else hi=mid;
        }
        return a===0?0:a===.1?length:(lo+hi)/2;
      }
      setReadout(readout,[['L′ = ½ (ŷ′ − 1)²'],['ŷ′ = <span data-prediction></span>',teal],['<span data-bb-anchor="original-network-loss">0.5</span> → <span data-loss-value></span>',amber]]);
      const pred=readout.querySelector('[data-prediction]'), visibleLoss=readout.querySelector('[data-loss-value]');
      paintRate=(a,exact)=>{
        const current=updated(a);
        marker.setAttribute('cx',x(a));marker.setAttribute('cy',y(a));
        trace.setAttribute('stroke-dashoffset',length-tracedLength(a));
        pred.textContent=number(current.yhat,exact?9:3);
        visibleLoss.textContent=number(current.loss,exact?11:4);
        output.textContent=number(a,exact?9:3);
        slider.value=String(a);
      };
      return motion.play({animate,duration:1510},t=>paintRate(eta*ease(t),t===1));
    }
    function render(animate=false){
      motion.settle();
      const eta=slider.valueAsNumber;
      output.textContent=number(eta);
      controls.hidden=step<2;
      slider.setAttribute('aria-label',dual?'学习率':'Learning rate');
      if(step===2)return compareRates(eta,animate);
      paintRate=undefined;
      const {values,z,yhat}=updated(eta);
      const left=34,center=194,right=381;
      const columns=dual?['原参数','梯度','新参数']:['Before','Gradient','After'];
      let marks=`${label(left,29,columns[0],22,teal)}${label(center,29,columns[1],22,amber)}${label(right,29,columns[2],22,ivory)}${stroke(25,48,583,48)}`;
      for(let i=0;i<names.length;i++){
        const y=89+51*i;
        marks+=`${label(left,y,`${names[i]} = ${number(start[i])}`,28,teal)}${label(center+23,y,String(gradient[i]),28,amber,'start',weightAnchor(i))}${stroke(267,y-9,342,y-9)}<path d="M332,${y-15} l10,6 -10,6" fill="none" stroke="${line}" stroke-width="2"/>${label(right,y,number(values[i]),29,ivory,'start','data-updated-parameter')}`;
      }
      svg.innerHTML=marks;
      svg.setAttribute('aria-label',names.map((name,i)=>`${name}: ${number(start[i])} → ${number(values[i])}`).join(', '));
      if(step===0){
        setReadout(readout,[['θ′ = θ − η ∇L'],['η = <span data-rate>0.025</span>',amber],['w₂′ = 0.5 − <span data-rate>0.025</span> × 4'],['= <span data-weight>0.4</span>',teal]]);
        if (!animate) return;
        const next=[...svg.querySelectorAll('[data-updated-parameter]')];
        const rates=readout.querySelectorAll('[data-rate]'), secondWeight=readout.querySelector('[data-weight]');
        return motion.play({animate, duration:1460}, t=>{
          const rate=Number((eta*ease(t)).toFixed(4));
          const applied=updated(rate).values;
          next.forEach((cell,i)=>{cell.textContent=number(applied[i],4);});
          rates.forEach(cell=>{cell.textContent=number(rate,4);});
          secondWeight.textContent=number(applied[1],4);
        });
      }else if(step===1){
        setReadout(readout,[
          ['z′ = <span data-term><span data-operand>0.95</span></span><span data-term> + <span data-operand>0.4</span> × 2</span><span data-term> <span data-operand>−1.05</span></span>'],
          [`h′ = ReLU(${number(z)}) = ${number(Math.max(0,z))}`,teal],
          ['ŷ′ = <span data-term><span data-operand>1.975</span> × 0.7</span><span data-term> <span data-operand>−0.025</span></span>'],
          [`= ${number(yhat)}`,ivory]
        ]);
        if (!animate) return;
        const terms=[...readout.querySelectorAll('[data-term]')];
        const outputs=[...svg.querySelectorAll('[data-updated-parameter]')];
        const rows=[...readout.firstElementChild.children];
        const operands=[...readout.querySelectorAll('[data-operand]')];
        const flight=document.createElement('span');
        flight.setAttribute('aria-hidden','true');
        flight.style.cssText='position:fixed;top:0;left:0;pointer-events:none;color:'+amber+';white-space:nowrap;';
        const style=getComputedStyle(operands[0]);
        flight.style.font=style.font;
        document.body.append(flight);
        const routes=operands.map((operand,i)=>{
          const from=outputs[i].getBoundingClientRect(), to=operand.getBoundingClientRect();
          return [from.x+from.width/2,from.y+from.height/2,to.x+to.width/2,to.y+to.height/2];
        });
        return motion.play({animate, duration:2060}, t=>{
          if(t===1)flight.remove();
          const pos=t*5.4, beat=Math.min(4,Math.floor(pos)), u=Math.min(1,pos-beat);
          const [x0,y0,x1,y1]=routes[beat], [along,lift]=frame(sampled.route,u);
          flight.textContent=operands[beat].textContent;
          flight.style.transform=`translate(${x0+(x1-x0)*along}px,${y0+(y1-y0)*along+lift*40}px) translate(-50%,-50%)`;
          flight.style.opacity=String(u<.03||u>.96?0:1);
          terms.forEach((term,i)=>{
            term.style.opacity=i<beat || (i===beat && u>.90)?'1':'0';
            outputs[i].setAttribute('fill',i===beat&&u<.9?amber:ivory);
          });
          rows[1].style.opacity=beat>=3?'1':'0';
          rows[2].style.opacity=beat>=3?'1':'0';
          rows[3].style.opacity=String(ease((pos-4.96)/.4));
        });
      }
    }
    return {enter(s,o){step=s;dual=o.bilingual;motion.settle();slider.value='0.025';return render(o.animate);},languageChanged(b){dual=b;render();},settle:motion.settle,dispose:motion.settle};
  }
};

export const backwardSlides=[lossSlope,reverseChain,parameterGradients,descentStep];
