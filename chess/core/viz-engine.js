/* 3D 渲染引擎 —— 由 design-system/math-viz-starter.html 裁剪而来。
   保留：轨道相机、透视投影与近裁剪、绘图原语、设计令牌、UI 组件、i18n。
   删除：连续时间积分、历史样本环形缓冲、三角函数专用部件、
         浮点采样录制/回放骨架（阶段 2 Task 1——每条前提在棋类工具上都不
         成立：棋没有连续演算可供逐帧采样，见下面 state.dt 的说明）。
   编辑源，运行时被内联进 tools/*.html。

   模块顶层绝不触碰 document / window.matchMedia / localStorage / location ——
   这样 `require('./viz-engine.js')` 在没有 DOM 的 node 环境里也能装载
   （见 task-12 的 Step 5 导出检查）。任何要碰 DOM 的东西都挪进 init() /
   bindOrbit() / 事件回调里，只有真正在浏览器里调用它们时才会执行。

   SCENES / PARAMS / TOOL 等「工具专属声明」不在这里假定成同名全局——
   那样在 node 下 require，或在没有声明它们的最小页面里调用 init()，会在
   第一次访问处直接 ReferenceError。这里把它们做成 init() 的可选参数，
   默认是空容器，未提供时相关机制安静地不生效。 */
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
    /* 预置局面/预置内容的默认标签——场景可以用 SCENES[id].presetsLabel 覆盖它
       （如「棋种」而不是通用的「预置」），省略时退回这个通用词。 */
    presets: { zh: '预置', en: 'Preset' },
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

  /* state.dt：本帧的时长（秒），由 frame() 每帧写入，已 clamp 到 [0, 0.05]
     以熬过后台标签页的时间跳变。场景在 draw() 里读它来推进自己的动画——
     这是引擎唯一的时钟出口。工具不得自己再用 performance.now() 算一遍：
     同一个量两处计算必然漂移（阶段 1 的两个工具各自造了一份 frameDt()，
     阶段 2 Task 1 一并收口）。running 默认 false（载入即暂停）——不是继承自
     math-viz 引擎的 true——那边的工具天生是一段持续运行的连续模拟，
     「打开就在动」是常态；棋类工具没有连续模拟，running 目前唯一的效果是
     喂给播放按钮的文案，真正的「自动巡回演示」是每个工具自己的
     demoRunning/demoPlaying 在管。默认给 true 会让按钮在打开页面的瞬间就
     显示「暂停」，暗示着有什么正在跑，这正是用户在两个棋类工具上报的体验
     问题的根——用户到达页面时演示已经在切换，第一件事却要去找暂停键。
     默认 false 让「打开 = 静止，播放是你主动要的」对每一个未来要接这份
     引擎的棋类工具都成立，不必每个工具各自记得覆盖它。 */
  const state = { running: false, dt: 0 };
  let curTab = null;
  const RELABEL = [];        // 语言切换时需要重新取文案的回调列表
  const cams = {};           // tabId -> 该页签「首视角」对应的相机参数（启动 / 双击回正用）
  /* cam 是「唯一一份」可变对象：往后任何「换页签因而换相机」都用 Object.assign(cam, ...)
     原地改写，绝不 `cam = 别的对象`——否则导出的 VizEngine.cam 会在换页签后指向一个
     没人再更新的旧对象。默认值给一个通用的三视角，供没有 SCENES 的最小用法直接可用。 */
  let cam = { az: -0.6, el: 0.32, dist: 10, tx: 0, ty: 0, tz: 0 };
  let tween = null;
  const lastView = {};
  /* tabId -> 当前选中的预置内容 key（见「预置内容」一节）。与 lastView 同一手法：
     views 是相机角度的单选记忆，lastPreset 是内容（局面/棋种/……）的单选记忆——
     两者过去被 Task 6 误合并进同一份 views（onSelect 里塞内容加载），这里把它们
     拆成两份独立状态，谁也不再替谁背锅。 */
  const lastPreset = {};

  /* SCENES / PARAMS / TOOL / 版本号：工具专属声明，由 init() 可选注入。
     默认给空容器而不是假定同名全局已存在——这样 require() 或在没提供它们的
     最小页面上调用 init() 都不会在访问处抛 ReferenceError，机制只是安静地不生效。 */
  let SCENES = {};
  let PARAMS = [];
  let TOOL = { id: null, title: { zh: '', en: '' }, h1: { zh: '', en: '' } };
  let VERSION = '0.0.0';

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
  // 仰角安全范围：world up 取的是 (0,1,0)，el 趋近 ±π/2 时 forward 与它共线，
  // 下面 cross(f, [0,1,0]) 会退化成一个接近零的向量——右/上手基就此失定，
  // 不会报错，是整块画面悄悄塌缩成屏幕正中的一个点（norm() 对零向量的
  // 兜底是 0/1=0，不是抛异常）。bindOrbit() 里鼠标拖拽早就把 el 夹在这个
  // 范围内（见下面 pointermove 的 clamp），但那只管交互拖拽——SCENES 里
  // 声明的视角预设（tools/*.html 的 CAM_TOP 之类）是直接把 el 写进
  // tween.to 再原样赋给 cam.el 的，不经过那处 clamp。这里把同一对边界
  // 值搬到相机基本身的计算里，保证不管 cam.el 是被拖出来的还是被某个
  // 视角预设直接赋值出来的，算出来的基永远不会撞上这个奇点——单一出口，
  // 以后任何新工具写一个贴着 ±π/2 的 el 都不会把渲染悄悄弄坏。
  const EL_MIN = -1.45, EL_MAX = 1.53;
  function makeCam() {
    const elC = clamp(cam.el, EL_MIN, EL_MAX);
    const cp = Math.cos(elC), sp = Math.sin(elC);
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

      state.dt = dt;

      draw();
      if (ts - lastRO > 120) { lastRO = ts; updateReadout(); }
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

  /* ================= 预置内容（局面 / 棋种……）================= */
  /* Task 6 的原话是「预置局面（views 的 onSelect 里加载）」——把内容选择塞进
     相机角度控件里。这两件事其实互不相干：相机角度回答「从哪儿看」，预置
     内容回答「看什么」。合并的后果是两头都坏：选了某个局面，相机会跟着
     跳；想从顶视角看某个局面，view 一栏根本没有这个组合按钮。这里补一个
     独立控件——buildParams / buildToggles / buildViews 之外的第四种——
     专门表示「离散的、有名字的内容」：一组按钮，互斥选中，选中的 key 写进
     导出的 state，并调用调用方给的 onSelect（真正去加载那份内容，如
     Interact.create(FEN) 或切换 E.state 里的棋种索引）。

     声明形状：SCENES[id].presets = [{ key, label, onSelect }, ...]，
     可选 SCENES[id].presetsLabel 覆盖分组标签（省略时用通用的 UI.presets——
     「预置/Preset」——见上面的声明）。没有声明 presets 的场景，#presetsHost
     里对应那一行不会出现，与 toggles/views 的既有习惯一致。 */
  function buildPresets() {
    const host = document.getElementById('presetsHost');
    if (!host) return;
    Object.keys(SCENES).forEach(id => {
      const list = SCENES[id].presets;
      if (!list || !list.length) return;
      const row = document.createElement('div');
      row.className = 'presets';
      row.dataset.tab = id;
      const lab = document.createElement('span');
      lab.className = 'plabel';
      row.appendChild(lab);
      const labRelabel = () => { lab.textContent = t(SCENES[id].presetsLabel || UI.presets); };
      RELABEL.push(labRelabel);
      labRelabel();
      list.forEach(pr => {
        const b = document.createElement('button');
        b.className = 'btn pbtn';
        b.dataset.preset = pr.key;
        b.addEventListener('click', () => applyPreset(id, pr.key));
        row.appendChild(b);
        const relabel = () => { b.textContent = t(pr.label); };
        RELABEL.push(relabel);
        relabel();
      });
      host.appendChild(row);
      /* 建面板时就选中第一项——与 buildParams() 对滑杆默认值的处理同一条
         精神：面板刚搭好、用户还没机会点任何按钮之前，就该有一份确定的
         初始内容，而不是留白等第一次点击。传显式 id，不依赖 curTab——
         这时候 switchTab() 还没跑过，curTab 仍是 null，且这里本就是在给
         *每一个* tab（不只是即将成为首个可见 tab 的那个）建立初始状态。 */
      applyPreset(id, list[0].key);
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

  /* 选择器同样必须限定在 .presets 之内，理由与 refreshViewButtons() 一致。 */
  function refreshPresetButtons() {
    document.querySelectorAll('.presets .pbtn').forEach(b => {
      const row = b.closest('.presets');
      b.classList.toggle('active', b.dataset.preset === lastPreset[row.dataset.tab]);
    });
  }
  /* 显式接受 tabId，不像 applyView() 那样隐式用 curTab——预置内容的
     初始化（buildPresets() 建面板时、以及工具可能想在页面加载时就把
     几个不可见 tab 都摆到各自的默认局面）必须能在切到那个 tab 之前
     就把它的内容选好，等真正切过去时画面已经是对的，不需要「先切 tab
     再选内容」这道额外的手续。 */
  function applyPreset(tabId, key) {
    const sc = SCENES[tabId];
    const list = sc && sc.presets;
    const pr = list && list.find(p => p.key === key);
    if (!pr) return;
    if (pr.onSelect) pr.onSelect();
    lastPreset[tabId] = key;
    /* 若还有别的 tab 声明的 presets 是同一个数组引用（同一个对象，不是内容碰巧
       相等）——这就是「跨 tab 共享的同一份选择」（例如 chess-moves-geometry.html
       的六种棋子：piece/field/mobility 三个 tab 都读写同一份 E.state.pieceIdx，
       presets 声明也故意用的是同一个数组常量）。这些 tab 的按钮高亮要跟着同步，
       否则切到另一个 tab 会看见按钮组还停在初始项，尽管实际选择早已跟着共享
       状态变了。onSelect 不重复调用——它已经在上面跑过一次，副作用只与
       「选了哪个 key」有关，与是哪个 tab 触发的无关，重复调用不会更对，
       只会更容易踩到调用方自己没预料到的重入。 */
    Object.keys(SCENES).forEach(otherId => {
      if (otherId !== tabId && SCENES[otherId].presets === list) lastPreset[otherId] = key;
    });
    if (tabId === curTab) state.preset = key;
    refreshPresetButtons();
  }

  /* 只同步高亮，不调用 onSelect：给调用方已经自己完成了加载（例如工具③
     的 PGN 拖入 / FEN 粘贴 / 棋局浏览器直接选中某个 id）、只需要让预置
     按钮组的选中态跟上真实状态的场景。key 传 null/undefined 表示「清空
     高亮」——没有哪个按钮的 dataset.preset 会等于 undefined，所以这就是
     『不让按钮组停在一个已经不成立的选中态』的实现方式。跨 tab 共享同一份
     presets 数组引用时的同步逻辑与 applyPreset() 保持一致（否则切换 tab
     会看见按钮组用另一条路径的陈旧值重新亮起）。 */
  function syncPresetHighlight(tabId, key) {
    const sc = SCENES[tabId];
    const list = sc && sc.presets;
    lastPreset[tabId] = key || undefined;
    if (list) Object.keys(SCENES).forEach(otherId => {
      if (otherId !== tabId && SCENES[otherId].presets === list) lastPreset[otherId] = key || undefined;
    });
    if (tabId === curTab) state.preset = key || undefined;
    refreshPresetButtons();
  }

  let brandDescEl = null, tipsEl = null, roEl = null;

  function switchTab(id) {
    if (id === curTab) return;
    curTab = id;
    tween = null;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    document.querySelectorAll('.toggles[data-tab], .views[data-tab], .presets[data-tab]').forEach(el => {
      el.style.display = el.dataset.tab === id ? '' : 'none';
    });
    if (cams[id]) Object.assign(cam, cams[id]);   // 原地改写，VizEngine.cam 引用不变
    const sc = SCENES[id];
    if (brandDescEl && sc) brandDescEl.textContent = t(sc.brand);
    if (tipsEl && sc) tipsEl.textContent = t(sc.tips);
    syncParamVisibility();
    refreshViewButtons();
    /* 换 tab 时把导出的 state.preset 同步成这个 tab 自己记住的那一个——
       lastPreset[id] 在 buildPresets() 建面板时已经对每个声明了 presets
       的 tab 都填过一次（选中第一项），没声明 presets 的 tab 这里是
       undefined，state.preset 也就诚实地变成 undefined，不留一份别的
       tab 的陈旧数据。 */
    state.preset = lastPreset[id];
    refreshPresetButtons();
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
          cam.el = clamp(cam.el + dy * 0.0055, EL_MIN, EL_MAX);   // 与 makeCam() 共用同一对边界，见那里的注释
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
     没有删——它们仍然接在面板的按钮上，只是不再从键盘直接触发。 */
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
  /* VizEngine.init({ canvas, SCENES, PARAMS, TOOL, VERSION }) ——
     只有 canvas 是必需的。其余都是「工具专属声明」，省略时对应机制安静地不生效，
     这样本模块既可以被最小页面（如棋子预览页）直接用来拿相机与绘图原语，
     也能在将来的算法工具里接上完整的滑杆 / 页签机制。
     没有 ENGINE_VERSION 参数——它唯一的读者是阶段 2 Task 1 删掉的那份录制
     存档函数（下载 JSON 存档时把引擎版本写进文档头），删掉那份骨架后引擎
     自己不再需要这个值。工具仍然在 <meta name="engine-version"> 里声明它、
     给人读（§10 版本规范），只是不用再传进 init()。 */
  function init(opts) {
    opts = opts || {};
    canvas = opts.canvas;
    if (!canvas) throw new Error('VizEngine.init({ canvas }) 需要一个 canvas 元素');
    ctx = canvas.getContext('2d');

    if (opts.SCENES) SCENES = opts.SCENES;
    if (opts.PARAMS) PARAMS = opts.PARAMS;
    if (opts.TOOL) TOOL = opts.TOOL;
    if (opts.VERSION) VERSION = opts.VERSION;

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
    buildPresets();   // 在 switchTab(firstTab) 之前——它要读 lastPreset[id] 同步 state.preset

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
    syncPresetHighlight,
    cam,
    /* PARAMS/toggles 把滑杆与开关的值写进这个对象（buildParams 的
       state[p.key]、buildToggles 的 state[tg.key]），state.running / state.dt
       也在这里——它们都曾经只在引擎私有闭包内可见，工具的 SCENES（另一个
       <script> 块，另一个作用域）够不着。导出的是这个对象本身，不是
       拷贝或冻结视图：starter 的既有语义就是场景读写同一份 state（例如
       state.running 由 togglePlay() 写、由 frame() 读；state.dt 由 frame()
       写、工具自己的 frameDt() 读），拷贝或冻结都会破坏这一点。 */
    state
  };
});
