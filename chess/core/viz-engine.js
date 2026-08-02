/* 3D 渲染引擎 —— 由 design-system/math-viz-starter.html 裁剪而来。
   保留：轨道相机、透视投影与近裁剪、绘图原语、设计令牌、UI 组件、
         i18n、录制回放骨架。
   删除：连续时间积分、历史样本环形缓冲、三角函数专用部件。
   编辑源，运行时被内联进 tools/*.html。

   模块顶层绝不触碰 document / window.matchMedia / localStorage / location ——
   这样 `require('./viz-engine.js')` 在没有 DOM 的 node 环境里也能装载
   （见 task-12 的 Step 5 导出检查）。任何要碰 DOM 的东西都挪进 init() /
   bindOrbit() / 事件回调里，只有真正在浏览器里调用它们时才会执行。

   SCENES / PARAMS / RECORD / TOOL 等「工具专属声明」不在这里假定成同名全局——
   那样在 node 下 require，或在没有声明它们的最小页面里调用 init()，会在
   第一次访问处直接 ReferenceError。这里把它们做成 init() 的可选参数，
   默认是空容器，未提供时相关机制安静地不生效（与 starter 里「不声明 RECORD
   就完全没有录制 UI」是同一条精神）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VizEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= i18n 核心（引擎区） ================= */
  const LANG_KEY = 'chess-lang';
  function resolveLang() {
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (q === 'en' || q === 'zh') return q;
      const s = localStorage.getItem(LANG_KEY);
      if (s === 'en' || s === 'zh') return s;
    } catch (e) { /* file:// 下 localStorage 可能不可用，或运行在无 DOM 环境（node） */ }
    return 'en';                       // 本子项目默认英文（规格 §1.6）
  }
  /* 默认值先摆一个字面量，真正的解析（碰 location / localStorage）延后到
     init() 才做——调用点是惰性的，模块顶层不触发它。 */
  let LANG = 'en';
  function t(s) { return (s && typeof s === 'object') ? (s[LANG] != null ? s[LANG] : s.en) : s; }
  // t() 的兜底是 s.en（与默认语言一致），不是 s.zh —— 否则缺 en 键时英文界面会突然冒出中文。

  const TAU = Math.PI * 2;

  /* 引擎级 UI 文案（英文默认；与 math-viz 的中文默认版本区分开）。
     这些是「按钮上写什么」层面的通用词汇，不属于任何单个工具，所以留在引擎里，
     不必由 init() 注入。 */
  const UI = {
    panelTitle: { zh: '参数与视角', en: 'Parameters & Views' },
    pause:  { zh: '⏸ 暂停', en: '⏸ Pause' },
    resume: { zh: '▶ 继续', en: '▶ Resume' },
    reset:  { zh: '↺ 重置', en: '↺ Reset' },
    views:  { zh: '视角', en: 'View' },
    /* 演算记录与回放（§11）。仅当调用方在 init() 里提供 RECORD 钩子时才出现。 */
    recRec:    { zh: '● 记录',   en: '● Record' },
    recStop:   { zh: '■ 停止',   en: '■ Stop' },
    recSave:   { zh: '⬇ 保存',   en: '⬇ Save' },
    recLoad:   { zh: '⬆ 载入',   en: '⬆ Load' },
    recExit:   { zh: '✕ 退出回放', en: '✕ Exit replay' },
    recPlay:   { zh: '▶',        en: '▶' },
    recPause:  { zh: '⏸',        en: '⏸' },
    recRewind: { zh: '⏮',        en: '⏮' },
    recRows:   { zh: ' 行',      en: ' rows' },
    recFull:   { zh: '已达行数上限，录制停止（数据完整，未截断）',
                 en: 'Row limit reached, recording stopped (data complete, not truncated)' },
    recRoundEnd: { zh: '本轮结束，录制自动停止', en: 'Round complete, recording stopped' },
    recReplay: { zh: '回放中', en: 'Replaying' },
    recVerifyOK: { zh: '种子比对：本机复现（δ = ', en: 'Seed check: reproduced here (δ = ' },
    recVerifyNo: { zh: '种子比对：本机复现不了（δ = ', en: 'Seed check: not reproducible here (δ = ' },
    recVerifyTail: { zh: '）—— 这不是 bug，见提示', en: ') — not a bug, see the tip' },
    /* 手势由 bindOrbit(canvas) 绑定，快捷键由 bindKeyboard() 绑定（见「交互」
       一节）——两组都是 init() 会自动接好的，提示语把它们列在一起。 */
    hint:   { zh: '拖拽旋转 · 滚轮 / 双指缩放 · 右键或 Shift 拖拽平移 · 双击回正 · 1–9 视角 · T 切换页签',
              en: 'Drag to rotate · Scroll / pinch to zoom · Right-click or Shift-drag to pan · Double-click to reset · 1–9 views · T to switch tabs' }
  };

  /* ================= 常量与状态（引擎区，以下一般无需改动） ================= */
  const NEAR = 0.15;       // 近裁剪面

  const FONT_CN = 'ui-sans-serif,-apple-system,"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';
  const FONT_MATH = 'Georgia,"Times New Roman","Songti SC","Noto Serif SC",serif';

  /* window.matchMedia 的结果；只在 init() 里读一次（硬约束：模块顶层不碰 window）。 */
  let REDUCED = false;

  /* state.t 保留给录制骨架当「引擎时钟」用；state 里的连续相位（θ 积分）已删除——
     棋没有连续时间驱动，参见 task-12 brief 的删除表。 */
  const state = { running: true, t: 0 };
  let curTab = null;
  const RELABEL = [];        // 语言切换时需要重新取文案的回调列表
  const cams = {};           // tabId -> 该页签「首视角」对应的相机参数（启动 / 双击回正用）
  /* cam 是「唯一一份」可变对象：往后任何「换页签因而换相机」都用 Object.assign(cam, ...)
     原地改写，绝不 `cam = 别的对象`——否则导出的 VizEngine.cam 会在换页签后指向一个
     没人再更新的旧对象。默认值给一个通用的三视角，供没有 SCENES 的最小用法直接可用。 */
  let cam = { az: -0.6, el: 0.32, dist: 10, tx: 0, ty: 0, tz: 0 };
  let tween = null;
  const lastView = {};

  /* SCENES / PARAMS / RECORD / TOOL / 版本号：工具专属声明，由 init() 可选注入。
     默认给空容器而不是假定同名全局已存在——这样 require() 或在没提供它们的
     最小页面上调用 init() 都不会在访问处抛 ReferenceError，机制只是安静地不生效。 */
  let SCENES = {};
  let PARAMS = [];
  let RECORD = {};
  let TOOL = { id: null, title: { zh: '', en: '' }, h1: { zh: '', en: '' } };
  let VERSION = '0.0.0';
  let ENGINE_VERSION = '0.0.0';

  /* ================= 画布 ================= */
  let canvas = null, ctx = null;
  let W = 0, H = 0, DPR = 1, FOCAL = 900, CX = 0, CY = 0, bgGrad = null;

  function resize() {
    if (!canvas) return;
    DPR = Math.min(2.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W / 2; CY = H / 2;
    FOCAL = 1.2 * Math.min(H, W * 1.1);
    bgGrad = ctx.createRadialGradient(W*0.5, H*0.3, 0, W*0.5, H*0.42, Math.max(W, H)*0.95);
    bgGrad.addColorStop(0, '#0c1526');
    bgGrad.addColorStop(1, '#05070d');
  }

  /* ================= 基础数学 ================= */
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const wrapPI = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const ease = k => k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3) / 2;
  const fmt = (x, d = 2) => x.toFixed(d);
  const fmtS = (x, d = 2) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d);

  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };

  /* ================= 轨道相机与投影 ================= */
  function makeCam() {
    const cp = Math.cos(cam.el), sp = Math.sin(cam.el);
    const eye = [
      cam.tx + cam.dist * cp * Math.sin(cam.az),
      cam.ty + cam.dist * sp,
      cam.tz + cam.dist * cp * Math.cos(cam.az)
    ];
    const f = norm(sub([cam.tx, cam.ty, cam.tz], eye));
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    return { eye, f, r, u };
  }
  function camPt(C, p) {
    const d = sub(p, C.eye);
    return [dot3(d, C.r), dot3(d, C.u), dot3(d, C.f)];
  }
  function scr(c) { const s = FOCAL / c[2]; return [CX + c[0]*s, CY - c[1]*s]; }
  function proj(C, p) { const c = camPt(C, p); return c[2] < NEAR ? null : scr(c); }
  function clipNear(a, b) {
    const tt = (NEAR - a[2]) / (b[2] - a[2]);
    return [a[0] + (b[0]-a[0])*tt, a[1] + (b[1]-a[1])*tt, NEAR];
  }

  /* proj() 的反方向：给一个屏幕点，把「相机 eye 出发经过该像素的那条射线」
     与世界平面 z = planeZ 求交，返回世界坐标 [x, y, planeZ]，射线与平面
     平行（或恰好落在平面内，同样无唯一解）或交点落在相机之后都返回 null。
     推导：scr() 是 cz=1 那层的仿射投影，把它反过来，屏幕点 (sx,sy) 对应
     相机空间方向 (cx, cy, 1)（cx=(sx-CX)/FOCAL, cy=(CY-sy)/FOCAL），
     camPt() 的基是正交的 {r,u,f}，所以世界方向就是 cx·r + cy·u + 1·f——
     和 camPt() 互为逆变换，同一份 FOCAL/CX/CY 用两次，谁都不用再猜一遍。
     这是 BoardRender.pickSquare（点击选子）能成立的唯一依据。 */
  function unproject(C, screenXY, planeZ) {
    if (planeZ == null) planeZ = 0;
    const cx = (screenXY[0] - CX) / FOCAL;
    const cy = (CY - screenXY[1]) / FOCAL;
    const dir = [
      cx * C.r[0] + cy * C.u[0] + C.f[0],
      cx * C.r[1] + cy * C.u[1] + C.f[1],
      cx * C.r[2] + cy * C.u[2] + C.f[2]
    ];
    if (Math.abs(dir[2]) < 1e-9) return null;             // 射线与平面平行（或共面），无唯一交点
    const tt = (planeZ - C.eye[2]) / dir[2];
    if (tt <= 0) return null;                              // 交点在相机之后（或恰在相机上）
    return [C.eye[0] + dir[0]*tt, C.eye[1] + dir[1]*tt, planeZ];
  }

  /* 投影常量的只读访问器——FOCAL/CX/CY/W/H 是模块私有的，之前每个消费方
     只能各自重新推一遍 FOCAL = 1.2·min(H, W·1.1) 的公式；棋子预览页就吃过
     这个亏（算错一次，全部棋子跟着错位）。往后任何要自己做投影相关计算
     的调用方，都从这里取权威值，不再重新推导。 */
  function viewInfo() { return { FOCAL: FOCAL, CX: CX, CY: CY, W: W, H: H }; }

  /* 让「ctx 参数」名副其实：drawBoard/drawPiece 这类跨模块的绘制函数把
     ctx 当参数注入，是为了能在 node 下装载、能给第二块画布画图（如规则
     工具要并排画伪合法/合法两块棋盘）。但 strokePoly/label3 等图元一直画
     在本模块 init() 时钉死的模块私有 ctx 上，从不重新指向别的画布——于是
     drawBoard(someOtherCanvas, …) 的输出会被悄悄劈成两半。withContext()
     在 fn() 执行期间把私有 ctx 换成调用方给的目标画布，结束后原样复原；
     选它而不是给每个图元加 ctx 形参，是因为改动只集中在一处，图元本身、
     调用点都不用逐个改签名。 */
  function withContext(targetCtx, fn) {
    const prev = ctx;
    ctx = targetCtx;
    try { return fn(); }
    finally { ctx = prev; }
  }

  /* 折线路径（支持 null 断点 + 近平面裁剪）；返回 [首点, 末点] 屏幕坐标 */
  function polyPath(C, pts) {
    if (pts.length < 2) return null;
    let head = null, tail = null, contin = false, prev = null;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const P = pts[i];
      if (P === null) { prev = null; contin = false; continue; }
      const cur = camPt(C, P);
      if (prev !== null) {
        let a = prev, b = cur;
        const av = a[2] >= NEAR, bv = b[2] >= NEAR;
        if (av || bv) {
          if (!av) a = clipNear(a, b);
          if (!bv) b = clipNear(b, a);
          const sA = scr(a), sB = scr(b);
          if (!contin) ctx.moveTo(sA[0], sA[1]);
          ctx.lineTo(sB[0], sB[1]);
          if (!head) head = sA;
          tail = sB;
          contin = bv;
        } else {
          contin = false;
        }
      }
      prev = cur;
    }
    return head ? [head, tail] : null;
  }

  function strokePoly(C, pts, o) {
    const ht = polyPath(C, pts);
    if (!ht) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = o.width || 2;
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.dash) ctx.setLineDash(o.dash);
    if (o.fade) {
      const h = ht[0], tt = ht[1];
      if (Math.hypot(tt[0]-h[0], tt[1]-h[1]) < 2) {
        ctx.strokeStyle = o.fade[0];
      } else {
        const g = ctx.createLinearGradient(h[0], h[1], tt[0], tt[1]);
        g.addColorStop(0, o.fade[0]);
        g.addColorStop(1, o.fade[1]);
        ctx.strokeStyle = g;
      }
    } else {
      ctx.strokeStyle = o.color;
    }
    ctx.stroke();
    ctx.restore();
  }
  const line3 = (C, a, b, o) => strokePoly(C, [a, b], o);

  function glowDot(s, r, core, mid) {
    const g = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], r);
    g.addColorStop(0, core);
    g.addColorStop(0.35, mid);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s[0], s[1], r, 0, TAU);
    ctx.fill();
  }
  function solidDot(C, p, r, color) {
    const s = proj(C, p);
    if (!s) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(s[0], s[1], r, 0, TAU);
    ctx.fill();
  }

  function label3(C, p, text, o) {
    const s = proj(C, p);
    if (!s) return;
    ctx.save();
    ctx.font = o.font || ((o.size || 12) + 'px ' + FONT_CN);
    ctx.fillStyle = o.color || '#c4d2e6';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(3,6,12,.85)';
    ctx.shadowBlur = 4;
    ctx.fillText(text, s[0] + (o.dx || 0), s[1] + (o.dy || 0));
    ctx.restore();
  }

  function arrowAt(C, tip3, before3, color) {
    const tp = proj(C, tip3), b = proj(C, before3);
    if (!tp || !b) return;
    const a = Math.atan2(tp[1]-b[1], tp[0]-b[0]);
    const L = 9;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tp[0], tp[1]); ctx.lineTo(tp[0]-L*Math.cos(a-0.42), tp[1]-L*Math.sin(a-0.42));
    ctx.moveTo(tp[0], tp[1]); ctx.lineTo(tp[0]-L*Math.cos(a+0.42), tp[1]-L*Math.sin(a+0.42));
    ctx.stroke();
    ctx.restore();
  }

  /* ================= 常用场景部件 ================= */
  const AXIS = 'rgba(159,176,200,0.9)';
  const AXIS_DIM = 'rgba(159,176,200,0.5)';

  /* 坐标轴：o = { ex, ey, yTicks:[], xTicks:[] }。
     starter 版本还有个 tAxis（z 轴当连续时间轴用，靠一个「波形可视长度」常量定长、
     按秒打刻度）——棋没有连续时间驱动，这条分支随那个时间长度常量一起删掉了，
     只留平面上的 x/y 两轴。 */
  function drawAxes(C, o) {
    const ex = o.ex, ey = o.ey;
    line3(C, [-ex, 0, 0], [ex, 0, 0], { width: 1.4, color: AXIS });
    arrowAt(C, [ex, 0, 0], [ex - 0.2, 0, 0], AXIS);
    label3(C, [ex + 0.22, 0, 0], 'x', { font: 'italic 15px ' + FONT_MATH, color: '#c4d2e6', align: 'center' });
    line3(C, [0, -ey, 0], [0, ey, 0], { width: 1.4, color: AXIS });
    arrowAt(C, [0, ey, 0], [0, ey - 0.2, 0], AXIS);
    label3(C, [0, ey + 0.18, 0], 'y', { font: 'italic 15px ' + FONT_MATH, color: '#c4d2e6', align: 'center' });
    for (const k of (o.yTicks || [])) {
      for (const yv of [k, -k]) {
        line3(C, [-0.05, yv, 0], [0.05, yv, 0], { width: 1.2, color: AXIS_DIM });
        label3(C, [-0.13, yv, 0], (yv < 0 ? '−' : '') + Math.abs(yv), { size: 10, color: 'rgba(159,176,200,.7)', align: 'right' });
      }
    }
    for (const k of (o.xTicks || [])) {
      for (const xv of [k, -k]) {
        line3(C, [xv, -0.05, 0], [xv, 0.05, 0], { width: 1.2, color: AXIS_DIM });
        label3(C, [xv, -0.24, 0], (xv < 0 ? '−' : '') + Math.abs(xv), { size: 10, color: 'rgba(159,176,200,.55)', align: 'center' });
      }
    }
  }

  /* z=0 平面方格网格（几何类场景） */
  function drawGridXY(C, g, step) {
    const n = Math.round(g / step);
    for (let i = -n; i <= n; i++) {
      if (i === 0) continue;
      const u = i * step;
      line3(C, [u, -g, 0], [u, g, 0], { width: 1, color: 'rgba(148,163,184,0.08)' });
      line3(C, [-g, u, 0], [g, u, 0], { width: 1, color: 'rgba(148,163,184,0.08)' });
    }
  }

  /* ================= 主绘制与主循环 ================= */
  function draw() {
    if (!ctx) return;
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    const C = makeCam();
    if (curTab != null && SCENES[curTab] && typeof SCENES[curTab].draw === 'function') {
      SCENES[curTab].draw(C);
    }
  }

  function updateReadout() {
    if (!roEl || curTab == null || !SCENES[curTab] || typeof SCENES[curTab].readout !== 'function') return;
    roEl.innerHTML = SCENES[curTab].readout();
  }

  /* 帧级异常兜底：同一页签的同一条错误只报一次，否则 60 fps 会把控制台刷爆。
     resetSim() 会清空它——用户主动重置后应当允许重新报。 */
  const frameErrSeen = Object.create(null);
  function frameError(err) {
    const k = curTab + '|' + ((err && err.message) || err);
    if (frameErrSeen[k]) return;
    frameErrSeen[k] = 1;
    console.warn('[frame] 场景「' + curTab + '」抛出异常，已跳过该帧并继续渲染循环：', err);
  }

  function resetSim() {
    Object.keys(frameErrSeen).forEach(k => delete frameErrSeen[k]);
    state.t = 0;
  }

  /* 推进一步「引擎时钟」。starter 版本这里还会积分连续相位、驱动场景滑杆、
     记一条历史采样——三样棋都用不上，删掉后只剩 state.t 前进，供录制骨架的
     固定步长回放使用。真正的棋局推演（落子、算法单步）由消费方在
     draw() / 自己的钩子里做。
     现状记录：state.t 眼下除了录制/回放子系统（recPush 起点、recStep 回放
     时钟、recVerify 的核对与复原）之外没有别的读者——键盘不再驱动它
     （见 bindKeyboard 处的说明），也没有任何 draw()/readout() 在读它。
     是否整体拿掉这份「引擎时钟」是阶段 2 接 PGN 回放时才能定的架构决定，
     这里先如实记一笔，不做改动。 */
  function simAdvance(d) {
    state.t += d;
  }

  let lastTs = 0, lastRO = 0;
  function frame(ts) {
    try {
      if (!lastTs) lastTs = ts;
      const dt = clamp((ts - lastTs) / 1000, 0, 0.05);
      lastTs = ts;

      if (tween) {
        const k = Math.min(1, (ts - tween.t0) / tween.dur);
        const e = ease(k);
        const f = tween.from, o = tween.to;
        cam.az = f.az + wrapPI(o.az - f.az) * e;
        cam.el = f.el + (o.el - f.el) * e;
        cam.dist = f.dist + (o.dist - f.dist) * e;
        cam.tx = f.tx + (o.tx - f.tx) * e;
        cam.ty = f.ty + (o.ty - f.ty) * e;
        cam.tz = f.tz + (o.tz - f.tz) * e;
        if (k >= 1) tween = null;
      }

      /* 回放冻结的是「演算」，不是「观察」：相机 tween 在上面已经走过了，
         视角、开关、绘制全部照常——与「暂停只冻结模拟」同一条精神（§11.7）。 */
      if (recState.mode === 'replay') {
        recStep(dt);
      } else if (state.running) {
        if (recState.mode === 'recording') {
          recState.acc += dt;
          let guard = 0;
          while (recState.acc >= REC_DT && guard++ < 64) { recState.acc -= REC_DT; simAdvance(REC_DT); recPush(); }
        } else {
          simAdvance(dt);
        }
      }

      draw();
      if (ts - lastRO > 120) { lastRO = ts; updateReadout(); refreshRecInfo(); }
    } catch (err) {
      frameError(err);
    } finally {
      requestAnimationFrame(frame);
    }
  }

  /* ================= UI 生成（由消费方通过 init() 提供的 PARAMS / SCENES 声明驱动） ================= */
  const paramWraps = {};   // key -> { wrap, input, val, p }

  function buildParams() {
    const host = document.getElementById('paramsHost');
    if (!host || !PARAMS) return;
    PARAMS.forEach(p => {
      const wrap = document.createElement('div');
      wrap.className = 'ctl';
      wrap.innerHTML = '<div class="top"><label></label><span class="val"></span></div>';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = p.min; input.max = p.max; input.step = p.step; input.value = p.value;
      const val = wrap.querySelector('.val');
      const render = () => { val.textContent = p.fmt(parseFloat(input.value)); };
      const upd = () => {
        const raw = parseFloat(input.value);
        state[p.key] = p.map ? p.map(raw) : raw;
        render();
      };
      input.addEventListener('input', upd);
      wrap.appendChild(input);
      host.appendChild(wrap);
      paramWraps[p.key] = { wrap, input, val, p };
      upd();                       // 建面板时用默认刻度初始化 state
      const relabel = () => { wrap.querySelector('label').innerHTML = t(p.label); render(); };
      RELABEL.push(relabel);
      relabel();
    });
  }

  /* 按当前页签的 params 显隐滑块。省略 params = 全部显示（向后兼容）。 */
  function syncParamVisibility() {
    const list = SCENES[curTab] && SCENES[curTab].params;
    Object.keys(paramWraps).forEach(k => {
      paramWraps[k].wrap.style.display = (!list || list.indexOf(k) >= 0) ? '' : 'none';
    });
  }

  function buildToggles() {
    const host = document.getElementById('togglesHost');
    if (!host) return;
    Object.keys(SCENES).forEach(id => {
      const grp = document.createElement('div');
      grp.className = 'toggles';
      grp.dataset.tab = id;
      (SCENES[id].toggles || []).forEach(tg => {
        if (!(tg.key in state)) state[tg.key] = tg.checked;
        const lab = document.createElement('label');
        lab.className = 'tg';
        lab.innerHTML = '<input type="checkbox" data-key="' + tg.key + '"' + (state[tg.key] ? ' checked' : '') + '>' +
          '<i class="dot" style="--c:' + tg.color + '"></i><span class="tgl"></span>';
        const cb = lab.querySelector('input');
        cb.addEventListener('change', () => {
          state[tg.key] = cb.checked;
          document.querySelectorAll('input[data-key="' + tg.key + '"]').forEach(o => { o.checked = cb.checked; });
        });
        const relabel = () => { lab.querySelector('.tgl').innerHTML = t(tg.label); };
        RELABEL.push(relabel);
        relabel();
        grp.appendChild(lab);
      });
      host.appendChild(grp);
    });
  }

  function buildViews() {
    const host = document.getElementById('viewsHost');
    if (!host) return;
    Object.keys(SCENES).forEach(id => {
      const row = document.createElement('div');
      row.className = 'views';
      row.dataset.tab = id;
      const lab = document.createElement('span');
      lab.className = 'vlabel';
      row.appendChild(lab);
      const labRelabel = () => { lab.textContent = t(UI.views); };
      RELABEL.push(labRelabel);
      labRelabel();
      Object.keys(SCENES[id].views || {}).forEach(name => {
        const b = document.createElement('button');
        b.className = 'btn vbtn';
        b.dataset.view = name;
        b.addEventListener('click', () => applyView(name));
        row.appendChild(b);
        const relabel = () => { b.textContent = t(SCENES[id].views[name].label); };
        RELABEL.push(relabel);
        relabel();
      });
      host.appendChild(row);
    });
  }

  function buildTabs() {
    const nav = document.getElementById('tabsNav');
    if (!nav) return;
    Object.keys(SCENES).forEach(id => {
      const b = document.createElement('button');
      b.className = 'tab';
      b.dataset.tab = id;
      b.addEventListener('click', () => switchTab(id));
      nav.appendChild(b);
      const relabel = () => { b.textContent = t(SCENES[id].label); };
      RELABEL.push(relabel);
      relabel();
    });
  }

  /* ================= 视角与页签 ================= */
  /* 选择器必须限定在 .views 之内：.vbtn 只是个样式类，工具可能为了复用外观
     把它挂到别处的按钮上。不限定的话 closest('.views') 会返回 null，这里
     当场抛错，视角高亮从此再不更新。 */
  function refreshViewButtons() {
    document.querySelectorAll('.views .vbtn').forEach(b => {
      const row = b.closest('.views');
      b.classList.toggle('active', row.dataset.tab === curTab && b.dataset.view === lastView[curTab]);
    });
  }
  function viewDist(d) { return (W < 820 || W < H) ? d * 1.4 : d; }
  function applyView(name) {
    const sc = SCENES[curTab];
    const vw = sc && sc.views && sc.views[name];
    if (!vw) return;
    if (vw.onSelect) vw.onSelect();   /* 可选联动：如自动开启该视角对应的曲线开关 */
    tween = {
      from: { az: cam.az, el: cam.el, dist: cam.dist, tx: cam.tx, ty: cam.ty, tz: cam.tz },
      to:   { az: vw.az, el: vw.el, dist: viewDist(vw.dist), tx: vw.tx || 0, ty: vw.ty || 0, tz: vw.tz || 0 },
      t0: performance.now(),
      dur: REDUCED ? 1 : 750
    };
    lastView[curTab] = name;
    refreshViewButtons();
  }

  let brandDescEl = null, tipsEl = null, roEl = null;

  /* ══════════════ 演算记录与回放（规范 §11）══════════════
     整体搬运自 starter：序列化 / 下载上传 / 回放时钟 / 校验 / 种子比对全在这里，
     消费方只提供 RECORD 里的六个钩子。「存档格式」的序列化细节留成钩子——
     阶段 2 会把它接到 PGN 上（规格 §1.3）。这里只搬骨架，并确认在没有
     RECORD 声明时（默认 RECORD = {}）完全静默——recHooks() 恒为 null，
     所有 rec* 函数第一行就 early-return。 */
  const REC_FORMAT = 'chess-viz-run';
  const REC_FORMAT_VERSION = 1;
  const REC_DT = 0.02;         // 采样间隔（模拟秒）
  const REC_MAX_ROWS = 20000;  // 行数上限；到顶停录并提示，绝不静默截断（§11.4）
  const REC_PREC = 12;         // 数值有效位；比对基线要把这项舍入计入（§11.4）

  const recState = {
    mode: 'live',              // 'live' | 'recording' | 'replay'
    rows: [], fields: null, shape: null,
    seed: null, tab: null, srcName: null,
    i: 0, playing: true, rate: 1, acc: 0, t0: 0,
    roundAt: null, note: null,
    verify: null               // { delta, reproduced } —— §11.2 的种子比对结论
  };

  function recHooks(tab) { return (RECORD && RECORD[tab || curTab]) || null; }

  /* 唯一的只读判据访问器。工具的 draw()/readout() 要查模式一律走它，不得自己
     伸手进 recState 拼一份判据——那是留给下一个人的陷阱（同一判据两种写法
     必然漂移）。导出为 VizEngine.recInfo：SCENES 现在由消费方在另一个作用域
     声明，不再和这份引擎代码共享同一个顶层作用域，裸标识符 recInfo 够不着，
     必须真正跨过模块边界才能履行这份对录制感知场景的承诺。 */
  function recInfo() {
    if (!recHooks()) return null;
    return {
      mode: recState.mode,
      rows: recState.rows.length,
      i: recState.i,
      playing: recState.playing,
      srcName: recState.srcName,
      verify: recState.verify,
      note: recState.note
    };
  }

  /* capture() 的对象 → 一行数字。展开顺序由第一次调用的结构冻结（§11.6）。 */
  function recShapeOf(o) {
    const f = [];
    (function walk(v, path) {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, path + '[' + i + ']'));
      else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], path ? path + '.' + k : k));
      else f.push(path);
    })(o, '');
    return f;
  }
  function recFlatten(o) {
    const out = [];
    (function walk(v) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k]));
      else out.push(typeof v === 'number' ? +v.toPrecision(REC_PREC) : v);
    })(o);
    return out;
  }
  function recUnflatten(row, tmpl) {
    let i = 0;
    return (function walk(v) {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => { o[k] = walk(v[k]); }); return o; }
      return row[i++];
    })(tmpl);
  }

  function recStartRecording() {
    const h = recHooks(); if (!h) return;
    /* 起录前先把本页签重置到一轮的开头（§11.3）——引擎的责任，不是消费方
       在 seed() 里偷偷做。 */
    if (h.reseed && h.seed) h.reseed(h.seed());
    const snap = h.capture();
    recState.mode = 'recording';
    recState.rows = []; recState.tab = curTab;
    recState.shape = snap; recState.fields = recShapeOf(snap);
    recState.seed = h.seed(); recState.roundAt = h.roundOf();
    recState.t0 = state.t;          // 录制起点的引擎时钟；回放要照它复原，见 recStep
    recState.note = null; recState.verify = null; recState.acc = 0;
    recPush();                                      // 立即记下第 0 行
    buildRecRow();
  }
  function recStopRecording(note) {
    if (recState.mode !== 'recording') return;
    recState.mode = 'live';
    recState.note = note || null;
    buildRecRow();
  }

  /* 记一行。不做时间节流——录制态下 frame() 已经把推进量子化成整数个
     REC_DT，一格一行即可。 */
  function recPush() {
    if (recState.mode !== 'recording') return;
    const h = recHooks(); if (!h) return;
    if (h.roundOf() !== recState.roundAt) { recStopRecording(UI.recRoundEnd); return; }  // §11.3 录一轮
    recState.rows.push(recFlatten(h.capture()));
    if (recState.rows.length >= REC_MAX_ROWS) recStopRecording(UI.recFull);
  }

  /* 回放推进：按 rate 走行号，restore 后照常推进读数与绘制。 */
  function recStep(dt) {
    const h = recHooks(); if (!h || !recState.rows.length) return;
    if (recState.playing) {
      recState.acc += dt * recState.rate;
      while (recState.acc >= REC_DT && recState.i < recState.rows.length - 1) { recState.acc -= REC_DT; recState.i++; }
      if (recState.i >= recState.rows.length - 1) { recState.acc = 0; recState.playing = false; buildRecRow(); }
    }
    h.restore(recUnflatten(recState.rows[recState.i], recState.shape));
    /* 从录制起点算起，不是从 0——录制未必始于 t = 0。 */
    state.t = recState.t0 + recState.i * REC_DT;
  }

  function recExitReplay() {
    if (recState.mode !== 'replay') return;
    recState.mode = 'live';
    recState.rows = []; recState.i = 0; recState.srcName = null; recState.verify = null; recState.note = null;
    resetSim();
    buildRecRow();
  }

  function recSave() {
    if (!recState.rows.length) return;
    const doc = {
      format: REC_FORMAT, formatVersion: REC_FORMAT_VERSION,
      tool: { id: TOOL.id, version: VERSION, engine: ENGINE_VERSION },
      tab: recState.tab, recordedAt: new Date().toISOString(),
      seed: recState.seed,
      trace: { dt: REC_DT, t0: recState.t0, fields: recState.fields, rows: recState.rows }
    };
    const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (TOOL.id || 'run') + '-' + recState.tab + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* 加载校验（§11.5）：任一不过即明确拒绝，不做兼容性猜测。 */
  function recValidate(doc) {
    if (!doc || doc.format !== REC_FORMAT) return { zh: '不是本引擎的存档文件', en: 'Not a valid run file for this engine' };
    if (doc.formatVersion !== REC_FORMAT_VERSION)
      return { zh: '存档格式版本 ' + doc.formatVersion + ' 本工具不认识', en: 'Unknown archive format version ' + doc.formatVersion };
    if (!doc.tool || doc.tool.id !== TOOL.id)
      return { zh: '这份存档属于「' + ((doc.tool && doc.tool.id) || '?') + '」，不是本工具',
               en: 'This archive belongs to "' + ((doc.tool && doc.tool.id) || '?') + '", not this tool' };
    const h = recHooks(doc.tab);
    if (!h) return { zh: '存档的页签「' + doc.tab + '」在本工具中不可录制', en: 'Tab "' + doc.tab + '" is not recordable here' };
    const want = recShapeOf(h.capture());
    const got = (doc.trace && doc.trace.fields) || [];
    if (want.length !== got.length || want.some((k, i) => k !== got[i]))
      return { zh: '存档的字段与本版本不一致，拒绝载入（字段错位会画出看似合理实则错误的图）',
               en: 'Field set does not match this version; refusing to load (a mismatch would draw a plausible but wrong picture)' };
    if (!doc.trace.rows || !doc.trace.rows.length) return { zh: '存档里没有数据行', en: 'Archive contains no rows' };
    return null;
  }

  /* §11.2：用种子在本机重新推演，与记录的轨迹逐点比对。
     工具没给 reseed/seed 就跳过（返回 null），不阻塞回放。 */
  function recVerify(doc) {
    const h = recHooks(doc.tab);
    if (!h || !h.reseed || !doc.seed) return null;
    /* 重算是一次「离线」推演：它会走 simAdvance，因而动到 state.t。
       全部存下来在 finally 里还原——比对不该在用户的现场留下任何痕迹。 */
    const keep = h.capture();
    const keepT = state.t;
    try {
      h.reseed(doc.seed);
      let worst = 0;
      const n = Math.min(doc.trace.rows.length, 400);
      for (let k = 0; k < n; k++) {
        const mine = recFlatten(h.capture()), theirs = doc.trace.rows[k];
        for (let j = 0; j < mine.length; j++) {
          const a = +mine[j], b = +theirs[j];
          if (isFinite(a) && isFinite(b)) worst = Math.max(worst, Math.abs(a - b));
        }
        /* 走与录制时完全相同的推进路径（同一个 simAdvance、同一个 REC_DT）。 */
        if (k < n - 1) simAdvance(REC_DT);
      }
      /* 阈值要把 toPrecision(REC_PREC) 的舍入算进去（§11.4）。 */
      return { delta: worst, reproduced: worst < 1e-9 };
    } catch (e) {
      return null;
    } finally {
      h.restore(keep);
      state.t = keepT;
    }
  }

  function recLoadDoc(doc, name) {
    const bad = recValidate(doc);
    if (bad) { recState.note = bad; buildRecRow(); return false; }
    const h = recHooks(doc.tab);
    if (doc.tab !== curTab) switchTab(doc.tab);
    recState.verify = recVerify(doc);
    recState.mode = 'replay';
    recState.rows = doc.trace.rows;
    recState.fields = doc.trace.fields;
    recState.shape = h.capture();
    recState.seed = doc.seed; recState.tab = doc.tab; recState.srcName = name;
    recState.t0 = +doc.trace.t0 || 0;
    recState.i = 0; recState.acc = 0; recState.playing = true; recState.rate = 1; recState.note = null;
    buildRecRow();
    return true;
  }

  /* 状态行的文案只有这一处出处（buildRecRow 建行、refreshRecInfo 每 120ms 刷新，
     两边都读它）——曾经因为两处各写一份文案，导致回放进度停在「1 / N」不动。 */
  function recInfoText() {
    const bits = [];
    if (recState.mode === 'replay') {
      bits.push(t(UI.recReplay) + ' ' + (recState.i + 1) + ' / ' + recState.rows.length);
      if (recState.srcName) bits.push(recState.srcName);
      if (recState.verify) {
        bits.push(t(recState.verify.reproduced ? UI.recVerifyOK : UI.recVerifyNo) +
                  recState.verify.delta.toExponential(1) +
                  (recState.verify.reproduced ? '）' : t(UI.recVerifyTail)));
      }
    } else {
      bits.push(recState.rows.length + t(UI.recRows));
    }
    if (recState.note) bits.push(t(recState.note));
    return bits.join(' · ');
  }

  /* 录制 / 回放行（§11）。只在当前页签声明了 RECORD 钩子时出现。 */
  function buildRecRow() {
    const host = document.getElementById('recHost');
    if (!host) return;
    host.innerHTML = '';
    if (!recHooks()) return;

    const row = document.createElement('div');
    row.className = 'row recrow';
    const mk = (labObj, fn, cls) => {
      const b = document.createElement('button');
      b.className = 'btn' + (cls ? ' ' + cls : '');
      b.textContent = t(labObj);
      b.addEventListener('click', fn);
      return b;
    };

    if (recState.mode === 'replay') {
      row.appendChild(mk(recState.playing ? UI.recPause : UI.recPlay,
        () => { recState.playing = !recState.playing; buildRecRow(); }));
      row.appendChild(mk(UI.recRewind, () => { recState.i = 0; recState.acc = 0; recState.playing = true; buildRecRow(); }));
      const rate = document.createElement('button');
      rate.className = 'btn';
      rate.textContent = recState.rate + '×';
      rate.addEventListener('click', () => {
        const steps = [0.25, 0.5, 1, 2, 4];
        recState.rate = steps[(steps.indexOf(recState.rate) + 1) % steps.length];
        buildRecRow();
      });
      row.appendChild(rate);
      row.appendChild(mk(UI.recExit, recExitReplay));
    } else if (recState.mode === 'recording') {
      row.appendChild(mk(UI.recStop, () => recStopRecording(null), 'wide'));
      row.appendChild(mk(UI.recSave, recSave));
    } else {
      row.appendChild(mk(UI.recRec, recStartRecording, 'wide'));
      row.appendChild(mk(UI.recSave, recSave));
      row.appendChild(mk(UI.recLoad, () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'application/json,.json';
        inp.addEventListener('change', () => {
          const f = inp.files && inp.files[0];
          if (!f) return;
          const rd = new FileReader();
          rd.onload = () => {
            let doc = null;
            try { doc = JSON.parse(rd.result); }
            catch (e) { recState.note = { zh: '文件不是合法 JSON', en: 'File is not valid JSON' }; buildRecRow(); return; }
            recLoadDoc(doc, f.name);
          };
          rd.readAsText(f);
        });
        inp.click();
      }));
    }
    host.appendChild(row);

    const info = document.createElement('div');
    info.className = 'recinfo';
    info.textContent = recInfoText();
    info.dataset.rec = '1';
    host.appendChild(info);

    refreshRecLocks();
  }

  /* 录制中的行数、回放中的进度都是每帧在变的，而 buildRecRow() 只在状态切换时
     跑——只改这一行文本，别整行重建。判据是「不是 live」而不是「是 recording」：
     回放同样每帧在走，漏掉它就等于让进度数字停在原地。 */
  function refreshRecInfo() {
    if (recState.mode === 'live') return;
    const el = document.querySelector('#recHost .recinfo[data-rec]');
    if (!el) return;
    el.textContent = recInfoText();
  }

  /* 回放期间种子滑杆置灰——改它们等于改种子，画面与数据会脱节（§11.7）。 */
  function refreshRecLocks() {
    const h = recHooks();
    const lock = (recState.mode === 'replay' && h && h.lock) || [];
    Object.keys(paramWraps).forEach(k => {
      const e = paramWraps[k];
      if (!e) return;
      const on = lock.indexOf(k) >= 0;
      e.input.disabled = on;
      e.wrap.style.opacity = on ? '0.45' : '';
    });
  }

  function switchTab(id) {
    if (id === curTab) return;
    curTab = id;
    tween = null;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    document.querySelectorAll('.toggles[data-tab], .views[data-tab]').forEach(el => {
      el.style.display = el.dataset.tab === id ? '' : 'none';
    });
    if (cams[id]) Object.assign(cam, cams[id]);   // 原地改写，VizEngine.cam 引用不变
    const sc = SCENES[id];
    if (brandDescEl && sc) brandDescEl.textContent = t(sc.brand);
    if (tipsEl && sc) tipsEl.textContent = t(sc.tips);
    /* 换页签 = 换实验：正在录的那一轮不再对应画面，停录并保留已录数据；
       回放态则整个退出——存档是绑定页签的（§11.4 的 tab 字段）。 */
    if (recState.mode === 'recording' && recState.tab !== id) recStopRecording(null);
    if (recState.mode === 'replay' && recState.tab !== id) recExitReplay();
    buildRecRow();
    syncParamVisibility();
    refreshViewButtons();
    updateReadout();
  }

  /* ================= 播放 / 重置 / 折叠 ================= */
  let btnPlay = null, btnFold = null, panelEl = null;
  function togglePlay() {
    state.running = !state.running;
    if (btnPlay) btnPlay.textContent = state.running ? t(UI.pause) : t(UI.resume);
  }

  /* ================= 语言切换 ================= */
  function applyLang() {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
    document.title = t(TOOL.title);
    const h1 = document.querySelector('.brand h1');
    if (h1) h1.textContent = t(TOOL.h1);
    const panelTitleEl = document.getElementById('panelTitle');
    if (panelTitleEl) panelTitleEl.textContent = t(UI.panelTitle);
    const hintEl = document.querySelector('.hint');
    if (hintEl) hintEl.textContent = t(UI.hint);
    const btnLangEl = document.getElementById('btnLang');
    if (btnLangEl) btnLangEl.textContent = LANG === 'zh' ? 'EN' : '中';
    if (btnPlay) btnPlay.textContent = state.running ? t(UI.pause) : t(UI.resume);
    const btnResetEl = document.getElementById('btnReset');
    if (btnResetEl) btnResetEl.textContent = t(UI.reset);
    RELABEL.forEach(f => f());
    buildRecRow();               // 录制行的文案是建行时取的 t()，整行重建即跟随语言
    const sc = SCENES[curTab];
    if (brandDescEl && sc) brandDescEl.textContent = t(sc.brand);
    if (tipsEl && sc) tipsEl.textContent = t(sc.tips);
    updateReadout();
  }
  function setLang(l) {
    LANG = l;
    try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
    try {
      const u = new URL(location.href);
      u.searchParams.set('lang', l);
      history.replaceState(null, '', u);
    } catch (e) {}
    applyLang();
  }

  /* ================= 交互：旋转 / 平移 / 缩放 ================= */
  function pan(dx, dy) {
    const C = makeCam();
    const s = cam.dist / FOCAL;
    cam.tx = clamp(cam.tx - C.r[0]*dx*s + C.u[0]*dy*s, -6, 6);
    cam.ty = clamp(cam.ty - C.r[1]*dx*s + C.u[1]*dy*s, -5, 5);
    cam.tz = clamp(cam.tz - C.r[2]*dx*s + C.u[2]*dy*s, -3, 11);
  }

  /* 绑定拖拽旋转 / 右键或 Shift 拖拽平移 / 滚轮或双指缩放 / 双击回正到给定 canvas。
     只在浏览器里调用才会碰 DOM 事件，模块顶层不会自动执行这段。
     双击回正：若当前页签在 SCENES 里声明了 views，就补间回它的第一个视角
     （规范里「首视角即双击回正的家」）；没有 SCENES 的最小用法里则安静地不做事。 */
  function bindOrbit(canvasEl) {
    const pointers = new Map();
    let pinch = null;

    canvasEl.addEventListener('pointerdown', e => {
      canvasEl.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, btn: e.button });
      tween = null;
      lastView[curTab] = null;
      refreshViewButtons();
      if (pointers.size === 2) {
        const vs = Array.from(pointers.values());
        pinch = {
          gap: Math.hypot(vs[0].x - vs[1].x, vs[0].y - vs[1].y),
          cx: (vs[0].x + vs[1].x) / 2,
          cy: (vs[0].y + vs[1].y) / 2
        };
      }
      canvasEl.classList.add('dragging');
    });

    canvasEl.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        const panMode = e.shiftKey || (e.buttons & 2) || p.btn === 2 || p.btn === 1;
        if (panMode) {
          pan(dx, dy);
        } else {
          cam.az -= dx * 0.0055;
          cam.el = clamp(cam.el + dy * 0.0055, -1.45, 1.53);
        }
      } else if (pointers.size === 2 && pinch) {
        const vs = Array.from(pointers.values());
        const gap = Math.hypot(vs[0].x - vs[1].x, vs[0].y - vs[1].y);
        const cx = (vs[0].x + vs[1].x) / 2, cy = (vs[0].y + vs[1].y) / 2;
        if (gap > 1) cam.dist = clamp(cam.dist * pinch.gap / gap, 4.5, 60);
        pan(cx - pinch.cx, cy - pinch.cy);
        pinch = { gap: gap, cx: cx, cy: cy };
      }
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) canvasEl.classList.remove('dragging');
    }
    canvasEl.addEventListener('pointerup', endPointer);
    canvasEl.addEventListener('pointercancel', endPointer);
    canvasEl.addEventListener('contextmenu', e => e.preventDefault());

    canvasEl.addEventListener('wheel', e => {
      e.preventDefault();
      tween = null;
      cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), 4.5, 60);
    }, { passive: false });

    canvasEl.addEventListener('dblclick', () => {
      const sc = SCENES[curTab];
      const names = sc && sc.views && Object.keys(sc.views);
      if (names && names.length) applyView(names[0]);
    });
  }

  /* 全局键盘快捷键：T 切换页签、1–9 选视角。这两组快捷键都只驱动引擎本体
     已经实现、且已经接在按钮上的函数（switchTab / applyView），不需要
     消费方提供任何东西，所以放在这里而不是要求每个工具各自重新接一遍。
     绑在 window 上，不是 canvas 上——这是键盘事件，和 bindOrbit() 的
     canvas 指针事件是两回事，混在一起会把两者都说不清楚。

     Space 与 r 不在这里绑定——它们属于工具，不属于引擎。math-viz 的设计
     规格把 Space 定为所有五个棋类工具的播放/暂停/单步这枚统一的传输键
     （阶段 3 的复盘工具还要用它当「下一步」），r 同理是工具自己的重置键；
     若引擎在这里先用 preventDefault() 抢注，工具将来接自己的处理器时
     只会和引擎打架，而不是真正拿到这个键。resetSim()/togglePlay() 本身
     没有删——它们仍然接在面板的按钮上，只是不再从键盘直接触发。
     （state.t 目前只有录制子系统在读，见 simAdvance 处的说明。） */
  function bindKeyboard() {
    window.addEventListener('keydown', e => {
      const el = document.activeElement;
      const tag = el && el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;

      if (e.key === 't' || e.key === 'T') {
        const keys = Object.keys(SCENES);
        if (keys.length) switchTab(keys[(keys.indexOf(curTab) + 1) % keys.length]);
      } else if (e.key >= '1' && e.key <= '9') {
        const sc = SCENES[curTab];
        const names = sc && sc.views && Object.keys(sc.views);
        if (!names) return;
        const i = +e.key - 1;
        if (i < names.length) applyView(names[i]);   // 越界就什么也不做，不抛也不落到 undefined
      }
    });
  }

  /* ================= 启动 ================= */
  /* VizEngine.init({ canvas, SCENES, PARAMS, RECORD, TOOL, VERSION, ENGINE_VERSION }) ——
     只有 canvas 是必需的。其余都是「工具专属声明」，省略时对应机制安静地不生效
     （与 starter「不声明 RECORD 就没有录制 UI」同一条精神），这样本模块既可以
     被最小页面（如棋子预览页）直接用来拿相机与绘图原语，也能在将来的算法工具里
     接上完整的滑杆 / 页签 / 录制机制。 */
  function init(opts) {
    opts = opts || {};
    canvas = opts.canvas;
    if (!canvas) throw new Error('VizEngine.init({ canvas }) 需要一个 canvas 元素');
    ctx = canvas.getContext('2d');

    if (opts.SCENES) SCENES = opts.SCENES;
    if (opts.PARAMS) PARAMS = opts.PARAMS;
    if (opts.RECORD) RECORD = opts.RECORD;
    if (opts.TOOL) TOOL = opts.TOOL;
    if (opts.VERSION) VERSION = opts.VERSION;
    if (opts.ENGINE_VERSION) ENGINE_VERSION = opts.ENGINE_VERSION;

    try {
      REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { REDUCED = false; }
    LANG = resolveLang();   // 惰性求值：只在这里才碰 location / localStorage

    resize();
    window.addEventListener('resize', resize);

    brandDescEl = document.getElementById('brandDesc');
    tipsEl = document.getElementById('tips');
    roEl = document.getElementById('readout');
    btnPlay = document.getElementById('btnPlay');
    panelEl = document.getElementById('panel');
    btnFold = document.getElementById('btnFold');

    if (btnPlay) btnPlay.addEventListener('click', togglePlay);
    const btnResetEl = document.getElementById('btnReset');
    if (btnResetEl) btnResetEl.addEventListener('click', resetSim);
    if (btnFold && panelEl) {
      btnFold.addEventListener('click', () => {
        const c = panelEl.classList.toggle('collapsed');
        btnFold.textContent = c ? '+' : '−';
      });
      if (window.innerWidth < 760) {
        panelEl.classList.add('collapsed');
        btnFold.textContent = '+';
      }
    }
    const btnLangEl = document.getElementById('btnLang');
    if (btnLangEl) btnLangEl.addEventListener('click', () => setLang(LANG === 'zh' ? 'en' : 'zh'));
    const verBadge = document.getElementById('verBadge');
    if (verBadge) verBadge.textContent = 'v' + VERSION;

    buildTabs();
    buildParams();
    buildToggles();
    buildViews();

    Object.keys(SCENES).forEach(id => {
      const views = SCENES[id].views || {};
      const first = Object.keys(views)[0];
      if (!first) return;
      const v = views[first];
      cams[id] = { az: v.az, el: v.el, dist: viewDist(v.dist), tx: v.tx || 0, ty: v.ty || 0, tz: v.tz || 0 };
      lastView[id] = first;
    });
    const firstTab = Object.keys(SCENES)[0];
    if (firstTab) {
      curTab = null;           // 让 switchTab 的 `id === curTab` 短路检查失效，确保首次真正执行
      switchTab(firstTab);
    }

    bindOrbit(canvas);
    bindKeyboard();
    applyLang();
    resetSim();
    /* autoLoop 默认 true——数学可视化工具的动画从一个持续运行的时钟驱动，
       "每个 vsync 都重画" 是它们的常态，引擎自带循环因此默认开启。
       棋类不是这个模型：棋是离散的——重画只该发生在一步棋、一次相机拖拽、
       或一次显式动画之后，从不该有一个"正在跑的时钟"替它决定何时重画。
       task-14 的 32 子帧率探针踩过这个坑：_piece-preview.html 自己起了
       第二条 rAF 循环（drawHarness），engine 的 frame() 同时也在跑——
       两条循环每个 vsync 都各画一次同一块 canvas：engine 先铺一层昂贵的
       径向渐变背景（SCENES 为空，铺完就没别的可画），harness 紧接着用
       一次纯色 fill 把它整个盖掉再画棋盘和棋子。径向渐变因此是纯浪费
       （量过：1.03ms vs 纯色 fill 的 0.07ms，15 倍开销，且立刻被覆盖）。
       给 init() 加这个开关，让像 _piece-preview.html 这样自己驱动循环的
       调用方能关掉引擎自己的循环——以后棋类工具大概率都要这个开关，
       所以放在引擎里而不是让每个工具各自想办法绕开它。 */
    if (opts.autoLoop !== false) requestAnimationFrame(frame);
  }

  return {
    makeCam, proj, unproject, viewInfo, withContext, strokePoly, line3,
    glowDot, solidDot, label3, arrowAt,
    drawAxes, drawGridXY,
    clamp, fmt, fmtS, t,
    init, bindOrbit,
    cam, recInfo
  };
});
