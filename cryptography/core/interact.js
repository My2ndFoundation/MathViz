/* 交互内核：屏幕坐标下的命中区、hover / 拾取 / 拖拽、键盘绑定。
   纯逻辑 + 一层薄薄的 DOM 绑定 —— 工具负责画，本模块负责「鼠标现在在哪个东西上」。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   ⚠ 这个文件**不是** chess/core/interact.js 的 fork，尽管计划书
   （docs/superpowers/plans/2026-08-09-cryptography-scaffold.md Task 3 Step 1）
   写的是 `cp chess/core/interact.js cryptography/core/interact.js`。理由是那份
   同名文件与文件名承诺的东西无关——它是**国际象棋走法逻辑**（选子、合法走法
   高亮、走法栈 undo/redo、非法走法的理由、升变四选一），UMD 头部硬依赖
   `require('./chess-core.js')`，而 cryptography/core/ 下永远不会有那个文件。
   照抄的结果是：① node 里 require 直接 MODULE_NOT_FOUND；② 浏览器里
   factory(root.ChessCore) 拿到 undefined，模块加载不报错、一调用就炸；
   ③ 231 行棋规死代码被 inline_core.py 内联进每一个声明了 GENERATED:INTERACT
   的密码学工具页；④ 计划书自己 Step 2 的验收 `grep -n "chess" …/interact.js`
   当场就红——那条 grep 期望「只剩来源说明一行」，而照抄的文件里有
   `./chess-core.js`、`root.ChessCore` 与成片的棋子名。

   真正该住在这个文件名下的东西，由上游架构规范
   （docs/superpowers/cryptography.md §13）写明：
   pointer / drag / keyboard / slider interactions / selection / hover-inspection。
   chess 那边这些能力其实在 viz-engine.js 的 bindOrbit() 里（已随引擎 fork 过来），
   剩下的「命中区 + 拾取 + hover」上游没有可复用的实现，所以这里按规范新写。

   本期没有任何消费者依赖它的 API（计划书 §Type consistency 点名的五个全局
   名里没有它，_skeleton.html 的 GENERATED:INTERACT 区间是空的），因此这层
   接口是可以被后续任务自由重塑的。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CryptoInteract = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= 命中区 =================
     坐标系与 viz-engine 的 2D 图元层完全一致：CSS 像素、原点左上角。
     引擎在 resize() 里做的是 ctx.setTransform(DPR,…)，所以绘制坐标就是
     CSS 像素——alphabetWheel(cx, cy, r) 画在哪，就用同一组数字
     regions.circle(id, cx, cy, r) 注册在哪，中间不需要任何换算。
     两套坐标一旦分家，就会出现「看得见但点不中」这种最难查的错。 */
  function createRegions() {
    const items = [];
    const R = {
      items: items,

      clear: function () { items.length = 0; return R; },

      rect: function (id, x, y, w, h, data) {
        items.push({ kind: 'rect', id: id, x: x, y: y, w: w, h: h, data: data });
        return R;
      },

      circle: function (id, cx, cy, r, data) {
        items.push({ kind: 'circle', id: id, cx: cx, cy: cy, r: r, data: data });
        return R;
      },

      /* 倒序遍历：后注册的在上层。这与 canvas 的画家算法一致——后画的盖住
         先画的，那么后画的也该先被点中。正序遍历会让被盖住的东西抢走点击，
         而画面上完全看不出为什么。 */
      hit: function (x, y) {
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (it.kind === 'rect') {
            if (x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) return it;
          } else {
            const dx = x - it.cx, dy = y - it.cy;
            if (dx * dx + dy * dy <= it.r * it.r) return it;
          }
        }
        return null;
      }
    };
    return R;
  }

  /* ================= 指针绑定 =================
     bind(el, opts) -> unbind()

     opts:
       regions   命中区对象（或 getRegions() 返回一个）——每帧重建也没关系，
                 这里只在事件里取一次
       onHover(hit|null, ev)   命中项变化时才调用，不是每次 pointermove 都调
       onPick(hit, ev)         按下与抬起之间几乎没动，且命中了某项
       onDrag(info, ev)        info = { dx, dy, x, y, hit }，dx/dy 是相对上一次
       onDragEnd(info, ev)
       cursor    true 时命中/未命中自动切 pointer / default 光标

     ⚠ 与 viz-engine 的 bindOrbit(canvas) 绑在同一个元素上会打架：bindOrbit 的
     pointerdown 会 setPointerCapture 并把拖拽解释成转相机。纯 2D 的工具页
     不要调 bindOrbit；既要 3D 又要拾取的页面，把 2D 命中区绑到一层透明的
     覆盖元素上，或在 onDrag 里自己判断落点。 */
  function bind(el, opts) {
    opts = opts || {};
    const MOVE_SLOP = opts.slop == null ? 4 : opts.slop;   // 判「这是点击不是拖拽」的像素容差
    let hover = null;      // 当前命中项，用来把 pointermove 去重成「进/出」事件
    let drag = null;

    function regionsOf() {
      if (typeof opts.getRegions === 'function') return opts.getRegions();
      return opts.regions || null;
    }

    /* clientX/Y 减去元素的 bounding rect —— 不用 offsetX/offsetY：那两个值
       在事件目标是子元素时是相对子元素的，在 canvas 上覆盖 HTML 面板的
       布局里会突然偏移一大截。 */
    function local(ev) {
      const r = el.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    }

    function pick(ev) {
      const rs = regionsOf();
      if (!rs) return null;
      const p = local(ev);
      return rs.hit(p[0], p[1]);
    }

    function onDown(ev) {
      const p = local(ev);
      drag = { x0: p[0], y0: p[1], x: p[0], y: p[1], moved: 0, hit: pick(ev) };
    }

    function onMove(ev) {
      const p = local(ev);
      if (drag) {
        const dx = p[0] - drag.x, dy = p[1] - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        drag.x = p[0]; drag.y = p[1];
        if (opts.onDrag && drag.moved > MOVE_SLOP) {
          opts.onDrag({ dx: dx, dy: dy, x: p[0], y: p[1], hit: drag.hit }, ev);
        }
        return;                       // 拖拽期间不重算 hover：手指没离开，命中项不该跳
      }
      const h = pick(ev);
      if (h !== hover) {
        hover = h;
        if (opts.cursor && el.style) el.style.cursor = h ? 'pointer' : '';
        if (opts.onHover) opts.onHover(h, ev);
      }
    }

    function onUp(ev) {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.moved <= MOVE_SLOP) {
        /* 没怎么动 = 点击。命中项用**按下时**那一个，不是抬起时重新算的：
           抬起时重算会让「按下后画面自己动了一下」变成点中了别的东西。 */
        if (d.hit && opts.onPick) opts.onPick(d.hit, ev);
      } else if (opts.onDragEnd) {
        opts.onDragEnd({ dx: 0, dy: 0, x: d.x, y: d.y, hit: d.hit }, ev);
      }
    }

    function onLeave(ev) {
      if (hover !== null) {
        hover = null;
        if (opts.cursor && el.style) el.style.cursor = '';
        if (opts.onHover) opts.onHover(null, ev);
      }
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onLeave);

    return function unbind() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerleave', onLeave);
    };
  }

  /* ================= 键盘 =================
     bindKeys({ ' ': fn, 'r': fn, ArrowLeft: fn, … }) -> unbind()

     引擎的 bindKeyboard() 已经占了 T 与 1–9，且刻意没占 Space 与 r——它把
     那两个键留给工具（见 viz-engine.js 里那段注释）。播放/暂停、单步、重置
     正是本子项目每个工具都要的传输键，所以这里给一个统一入口，而不是让
     每个工具各写一遍「先判断焦点在不在输入框里」。

     输入框守卫是必须的：密码学工具几乎每一页都有明文/密钥输入框，少了这道
     判断，用户在框里敲空格就会把动画暂停掉。 */
  function bindKeys(map, target) {
    const host = target || (typeof window !== 'undefined' ? window : null);
    if (!host) return function () {};
    function onKey(ev) {
      const el = typeof document !== 'undefined' ? document.activeElement : null;
      const tag = el && el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
      const fn = map[ev.key] || map[String(ev.key).toLowerCase()];
      if (!fn) return;
      ev.preventDefault();
      fn(ev);
    }
    host.addEventListener('keydown', onKey);
    return function () { host.removeEventListener('keydown', onKey); };
  }

  return { createRegions: createRegions, bind: bind, bindKeys: bindKeys };
});
