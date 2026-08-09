(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CryptoAnim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 统一的离散时间轴。密码学工具几乎都是"一轮一轮"的：Enigma 的每次按键、
     DES/AES 的每一轮、hash 的每个 block、BB84 的每个光子。它们共享的是
     "第几步 + 步内进度"这一对状态，而不是一条连续曲线——所以时间轴的
     基本单位是 step，不是秒。

     progress 是**步内**归一化进度（0..1），给插值用：第 i 步到第 i+1 步之间
     的中间画面靠它算。跨步时归零而不是累加，工具页因此永远不必自己取模。 */
  function createTimeline(opts) {
    opts = opts || {};
    const steps = opts.steps;
    const stepDuration = opts.stepDuration;
    if (!(steps > 0)) throw new Error('createTimeline: steps 必须是正数，收到 ' + steps);
    if (!(stepDuration > 0)) throw new Error('createTimeline: stepDuration 必须是正数，收到 ' + stepDuration);
    const loop = !!opts.loop;
    const onStep = typeof opts.onStep === 'function' ? opts.onStep : null;

    const tl = {
      index: 0,
      progress: 0,
      playing: false,
      rate: opts.rate > 0 ? opts.rate : 1,
      steps: steps
    };

    function fire(prev, next) {
      if (prev === next) return;
      tl.index = next;
      if (onStep) onStep(next, prev);
    }

    tl.play = function () { tl.playing = true; return tl; };
    tl.pause = function () { tl.playing = false; return tl; };
    tl.toggle = function () { tl.playing = !tl.playing; return tl; };
    tl.setRate = function (r) { if (r > 0) tl.rate = r; return tl; };

    tl.seek = function (i) {
      const next = loop ? ((i % steps) + steps) % steps
                        : Math.max(0, Math.min(steps - 1, i));
      const prev = tl.index;
      tl.progress = 0;
      fire(prev, next);
      return tl;
    };

    tl.step = function (d) { return tl.seek(tl.index + (d || 0)); };

    tl.reset = function () {
      tl.playing = false;
      tl.progress = 0;
      const prev = tl.index;
      tl.index = 0;
      if (onStep && prev !== 0) onStep(0, prev);
      return tl;
    };

    /* 一次 tick 可能跨过好几步（后台标签页回来、或慢机器掉帧）。
       必须**逐步**触发 onStep 而不是直接跳到最后一步：工具页的 onStep 里
       往往在累积状态（比如把这一轮的输出接到下一轮的输入上），跳步等于
       算错。这也是把"步"而不是"秒"当基本单位换来的好处——补步是精确的。

       ⚠ 调用方必须自己夹住 dt。loop 模式下这个 while 每一圈只吃掉 1，
       所以 tick(1e6) 会真的转一百万圈——引擎的 frame() 已经把 state.dt
       夹在 [0, 0.05]，工具页照着用即可；直接把 performance.now() 的差值
       灌进来的调用方要自己夹。这里刻意不加内部上限：静默丢步比卡一帧
       更难查，而"每一步都回调过"正是上面那段注释要保住的性质。 */
    tl.tick = function (dt) {
      if (!tl.playing || !(dt > 0)) return tl;
      let p = tl.progress + dt * tl.rate / stepDuration;
      while (p >= 1) {
        p -= 1;
        if (!loop && tl.index >= steps - 1) {
          tl.progress = 0;
          tl.playing = false;
          return tl;
        }
        const prev = tl.index;
        const next = loop ? (tl.index + 1) % steps : tl.index + 1;
        fire(prev, next);
      }
      tl.progress = p;
      return tl;
    };

    return tl;
  }

  return { createTimeline };
});
