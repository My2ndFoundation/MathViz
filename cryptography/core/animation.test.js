'use strict';
const T = require('./_test.js');
const A = require('./animation.js');

/* 每步 1 秒、共 4 步（下标 0..3）。 */
function mk(extra) {
  const seen = [];
  const tl = A.createTimeline(Object.assign({
    steps: 4, stepDuration: 1, onStep: function (i, prev) { seen.push([prev, i]); }
  }, extra || {}));
  return { tl: tl, seen: seen };
}

/* ---- 初始状态 ---- */
let m = mk();
T.eq(m.tl.index, 0, '初始 index 0');
T.eq(m.tl.progress, 0, '初始 progress 0');
T.eq(m.tl.playing, false, '初始不播放');
T.eq(m.seen, [], '构造时不触发 onStep');

/* ---- 暂停时 tick 不动 ---- */
m.tl.tick(0.5);
T.eq(m.tl.index, 0, '暂停时 tick 不推进 index');
T.eq(m.tl.progress, 0, '暂停时 tick 不推进 progress');

/* ---- 播放 ---- */
m.tl.play();
T.eq(m.tl.playing, true, 'play() 之后 playing 为 true');
m.tl.tick(0.5);
T.eq(m.tl.index, 0, '半步还在第 0 步');
T.eq(m.tl.progress, 0.5, 'progress 到 0.5');
m.tl.tick(0.5);
T.eq(m.tl.index, 1, '满一步进到第 1 步');
T.eq(m.tl.progress, 0, '跨步后 progress 归零');
T.eq(m.seen, [[0, 1]], 'onStep 收到 (prev=0, i=1)');

/* ---- 一次 tick 跨多步也要逐步回调，不能只报最后一步 ---- */
m = mk(); m.tl.play(); m.tl.tick(2.5);
T.eq(m.tl.index, 2, '2.5 秒推进到第 2 步');
T.eq(m.tl.progress, 0.5, '余下 0.5 落在 progress 上');
T.eq(m.seen, [[0, 1], [1, 2]], '跨两步要有两次 onStep');

/* ---- 到末尾停住（默认不循环）---- */
m = mk(); m.tl.play(); m.tl.tick(99);
T.eq(m.tl.index, 3, '停在最后一步 index 3');
T.eq(m.tl.progress, 0, '末尾 progress 归零');
T.eq(m.tl.playing, false, '跑到末尾自动停止播放');
T.eq(m.seen, [[0, 1], [1, 2], [2, 3]], '末尾之前每一步都回调过');

/* ---- 循环模式 ---- */
m = mk({ loop: true }); m.tl.play(); m.tl.tick(4);
T.eq(m.tl.index, 0, 'loop 模式绕回第 0 步');
T.eq(m.tl.playing, true, 'loop 模式不自动停');

/* ---- 单步与回退 ---- */
m = mk();
m.tl.step(1);
T.eq(m.tl.index, 1, 'step(+1)');
T.eq(m.seen, [[0, 1]], 'step 也触发 onStep');
m.tl.step(-1);
T.eq(m.tl.index, 0, 'step(-1) 回退');
m.tl.step(-1);
T.eq(m.tl.index, 0, '第 0 步再回退仍是 0（非 loop 时夹住）');
m.tl.seek(3); m.tl.step(1);
T.eq(m.tl.index, 3, '末步再前进仍是 3');

/* ---- seek / reset ---- */
m = mk(); m.tl.play(); m.tl.tick(0.7); m.tl.seek(2);
T.eq(m.tl.index, 2, 'seek 到 2');
T.eq(m.tl.progress, 0, 'seek 清掉 progress');
m.tl.reset();
T.eq(m.tl.index, 0, 'reset 回到 0');
T.eq(m.tl.playing, false, 'reset 停止播放');

/* ---- 慢放：rate 缩放的是时间，不是步长 ---- */
m = mk(); m.tl.play(); m.tl.setRate(0.5); m.tl.tick(1);
T.eq(m.tl.index, 0, 'rate=0.5 时 1 秒只走半步');
T.eq(m.tl.progress, 0.5, 'progress 0.5');

/* ---- 参数校验 ---- */
T.throws(function () { A.createTimeline({ steps: 0, stepDuration: 1 }); },
         'steps 必须为正', /steps/);
T.throws(function () { A.createTimeline({ steps: 3, stepDuration: 0 }); },
         'stepDuration 必须为正', /stepDuration/);

T.report('animation');
