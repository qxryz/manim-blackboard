// Leave the stage to the surface, one measurement line and the spoken captions.
const layout = `
  #stage {padding:0; display:grid;place-items:center;background:#000;}
  #board {width:min(100vw,178dvh);height:min(100dvh,64vw);grid-template-rows:minmax(0,1fr) 17%;padding:2.2dvh 4% 0;}
  #scene {grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto; padding:0;min-height:0;}
  #visual {min-height:0;}
  #annotation {width:100%;padding:0;align-self:end;container-type:normal;}
  .readings {display:grid;grid-template-columns:1fr auto 1fr;align-items:baseline;justify-content:center;gap:clamp(16px,3.2vw,54px);
    min-height:1.65em;margin:0 0 clamp(10px,3.1dvh,27px);font:400 clamp(19px,2.6vw,40px)/1.22 var(--bb-font);}
  .quantity {display:inline-flex;gap:.24em;align-items:baseline;white-space:nowrap;}
   .quantity {grid-row:1;}
  .quantity:first-child {grid-column:2;justify-self:center;}
  .arc {color:#ff9b77;grid-column:1;justify-self:end;}.chord {color:#d8d9cb;grid-column:3;justify-self:start;}
  .quantity i {color:inherit;}.quantity b {font:inherit;font-variant-numeric:lining-nums tabular-nums;}
  .measure-label {font:normal max(13px,.61em)/1.25 var(--bb-font);margin-right:.1em;}
  .measure-label [lang] {font-family:var(--bb-font-zh);margin-left:.2em;color:inherit;}
  body[data-bilingual="false"] .measure-label [lang] {display:none;}
  #subtitles {width:94%;padding:0;text-align:center;font-size:clamp(17px,2.15cqw,34px);line-height:1.3;}
  #subtitles[data-dual="true"] {font-size:clamp(17px,1.98cqw,30px);}
  #subtitles #secondary {font-size:.87em; color:#c9ccbf; padding-top:.35em;}
  @media (orientation:portrait) {
    #board {width:100vw;height:min(100dvh,220vw);padding:3dvh 3.5% 0;grid-template-rows:minmax(0,1fr) max(20%,8.5rem);}
    .readings {font-size:clamp(17px,5.25vw,30px);gap:clamp(12px,4vw,24px);margin:0 0 3dvh;}
    #subtitles,#subtitles[data-dual="true"] {width:96%;font-size:clamp(16px,4.65vw,25px);}
  }
  @media (orientation:landscape) and (max-height:500px) {
    #board {width:100vw;height:100dvh;grid-template-rows:minmax(0,1fr) max(18%,53px);padding-top:0;}
    .readings {font-size:17px;min-height:1.25em;margin:0 0 6px;}
    #subtitles,#subtitles[data-dual="true"] {width:98%;font-size:14px;line-height:1.17;}
    #subtitles #secondary {padding-top:.2em;}
  }
`;

export function mountPlate(host) {
  const style = document.createElement('style');
  style.textContent = layout;
  document.head.append(style);
  host.innerHTML = `<p class="readings">
    <span class="quantity"><i>θ</i> = <b data-theta></b></span>
    <span class="quantity arc"><span class="measure-label">Arc<span lang="zh-Hans">弧长</span></span>= <b data-arc></b></span>
    <span class="quantity chord"><span class="measure-label">Chord<span lang="zh-Hans">弦长</span></span>= <b data-chord></b></span></p>`;
  const angle = host.querySelector('[data-theta]'), arc = host.querySelector('[data-arc]'), chord = host.querySelector('[data-chord]');
  return (theta, reveal, reading) => {
    const first = theta < 1e-8, end = Math.abs(theta - Math.PI / 2) < 1e-7, half = Math.abs(theta - Math.PI / 4) < 1e-7;
    angle.textContent = first ? '0' : end ? 'π/2' : half ? 'π/4' : (theta * 180 / Math.PI).toFixed(0) + '°';
    for (const item of [arc.parentElement,chord.parentElement]) {
      item.style.visibility = reveal < .001 ? 'hidden' : 'visible';
      item.style.opacity = String(Math.min(1, reveal * 5));
    }
    arc.textContent = Math.abs(reading.length - Math.PI) < 1e-7 ? 'π' : reading.length.toFixed(2);
    chord.textContent = Math.abs(reading.chord - Math.PI) < 1e-7 ? 'π' : end ? '2' : reading.chord.toFixed(2);
    host.dataset.theta = String(theta);
    host.dataset.arc = String(reading.length);
    host.dataset.chord = String(reading.chord);
  };
}
