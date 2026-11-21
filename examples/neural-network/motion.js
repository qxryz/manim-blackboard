// One user-paced mathematical operation. Every exit path paints the exact endpoint.
export function createMotion() {
  let frame = 0;
  let finish;

  function settle() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (finish) {
      const complete = finish;
      finish = undefined;
      complete();
    }
  }

  function play({ animate, duration }, paint) {
    settle();
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(1);
      return;
    }
    paint(0);
    return new Promise(resolve => {
      const start = performance.now();
      finish = () => { paint(1); resolve(); };
      function tick(now) {
        const t = Math.max(0, Math.min(1, (now - start) / duration));
        if (t === 1) { settle(); return; }
        paint(t);
        frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    });
  }

  return { play, settle };
}

export function ease(progress) {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}
