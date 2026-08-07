'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const E = require('../exercise.js');
const K = require('./knight-path.js');

/* 距离对拍一份宿主侧 BFS —— 独立参照，不是写死期望值。 */
function hostBFS(W, s, t) {
  const DX = [1, 2, 2, 1, -1, -2, -2, -1], DY = [2, 1, -1, -2, -2, -1, 1, 2];
  const dist = new Array(W * W).fill(-1); dist[s] = 0;
  const q = [s];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h]; if (cur === t) { break; }
    const x = cur % W, y = (cur - x) / W;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      if (nx >= 0 && nx < W && ny >= 0 && ny < W) {
        const nb = ny * W + nx;
        if (dist[nb] === -1) { dist[nb] = dist[cur] + 1; q.push(nb); }
      }
    }
  }
  return dist[t];
}

let cases = 0;
for (const [W, s, t] of [[8, 0, 63], [8, 0, 27], [6, 0, 35], [5, 0, 24], [8, 12, 40]]) {
  const r = I.run(K.source({ W: W, start: s, target: t, lang: 'zh' }), { host: {} });
  T.ok(!r.trace.truncated, W + 'x' + W + ' ' + s + '→' + t + ' 未截断');
  T.eq(r.result, hostBFS(W, s, t),
       W + 'x' + W + ' ' + s + '→' + t + ' 的最短距离与宿主侧 BFS 一致');
  cases++;
}
T.eq(cases, 5, '五组都对拍过');

// ---- mark 通道确实通着：8×8 上喊出了成百上千次 ----
/* ⚠ 标题曾经写的是「BFS 的层序：先访问的距离不大于后访问的」，那是**这条断言
   办不到的事**：`seen.length > 20` 只证明宿主的 mark 钩子被调过很多次，一份
   深度优先的实现照样能在 8×8 上喊出几百次并全绿通过。层序那道真门在下面
   「`ok` 标记的先后顺序按宿主侧距离单调不减」那一段，别把这一条当成它。 */
const seen = [];
I.run(K.source({ W: 8, start: 0, target: 63, lang: 'zh' }), { host: {
  mark: function (sq, kind) { seen.push([sq, kind]); },
} });
T.ok(seen.length > 20, 'BFS 确实在标记访问过的格子（' + seen.length + ' 次）');

/* ======== 以下都是简报之外补的，不改上面任何一条 ========

   补的第一条理由写在这里：简报里上面那一段原本挂着「BFS 的层序」的标题，可它
   真正断言的只有 `seen.length > 20` —— 一份深度优先的实现照样能在 8×8 上喊出
   几百次 mark 并全绿通过。层序这件事在简报的测试里**没有被任何一条断言碰到**。
   下面 hostDist + 单调性那一段才是那道门；上面那个骗人的标题也已经改掉了。 */

// ---- 源码必须在 interp.js 的 ES 子集里合法（三元运算符等等会当场抛）----
{
  let err = null;
  try { I.parse(K.source({ W: 8, start: 0, target: 63, lang: 'zh' })); } catch (e) { err = e; }
  T.ok(err === null, 'knight-path 的源码在子集里合法' + (err ? '：' + err.message : ''));
}

/* ---- 层序：`ok` 标记的先后顺序，按宿主侧距离必须单调不减 ----

   `mark(sq, 'ok')` 在这份源码里的意思是「这一格第一次被到达，而这就是它的
   最短步数」。把这些格子按被标记的先后排成一列，它们的距离必须是
   0,1,1,…,2,2,…,3,… —— 单调不减。这正是「一层铺完再铺下一层」的定义，
   也是 DFS 无论如何做不到的事（DFS 会先冲到距离 5 再回头捡距离 1）。 */
function hostDist(W, s) {
  const DX = [1, 2, 2, 1, -1, -2, -2, -1], DY = [2, 1, -1, -2, -2, -1, 1, 2];
  const dist = new Array(W * W).fill(-1); dist[s] = 0;
  const q = [s];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], x = cur % W, y = (cur - x) / W;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      if (nx >= 0 && nx < W && ny >= 0 && ny < W) {
        const nb = ny * W + nx;
        if (dist[nb] === -1) { dist[nb] = dist[cur] + 1; q.push(nb); }
      }
    }
  }
  return dist;
}
function discoveryOrder(W, s, t) {
  const order = [];
  I.run(K.source({ W: W, start: s, target: t, lang: 'zh' }), { host: {
    mark: function (sq, kind) { if (kind === 'ok') { order.push(sq); } },
  } });
  return order;
}
let orderChecked = 0;
for (const [W, s, t] of [[8, 0, 63], [6, 0, 35], [8, 12, 40]]) {
  const order = discoveryOrder(W, s, t);
  const dist = hostDist(W, s);
  T.ok(order.length > 5, W + 'x' + W + ' ' + s + '→' + t + '：确认了 ' + order.length + ' 个格子，这条门没有空转');
  T.eq(order[0], s, W + 'x' + W + ' ' + s + '→' + t + '：第一个被确认的就是出发格');
  let bad = null, prev = -1, dup = null;
  const once = Object.create(null);
  for (const sq of order) {
    if (once[sq]) { dup = sq; break; }
    once[sq] = 1;
    if (dist[sq] < prev) { bad = sq; break; }
    prev = dist[sq];
  }
  T.ok(dup === null, W + 'x' + W + ' ' + s + '→' + t + '：没有一格被确认两次' +
       (dup === null ? '' : '（' + dup + ' 重了）'));
  T.ok(bad === null, W + 'x' + W + ' ' + s + '→' + t +
       '：确认顺序按距离单调不减 —— 这就是层序' +
       (bad === null ? '' : '（走到 ' + bad + ' 时距离从 ' + prev + ' 掉到 ' + dist[bad] + '）'));
  T.eq(dist[order[order.length - 1]], hostBFS(W, s, t),
       W + 'x' + W + ' ' + s + '→' + t + '：最后一个被确认的就是目标格，它的层号就是答案');
  orderChecked++;
}
T.eq(orderChecked, 3, '三组都验过层序');

/* ---- 摆出来的那条路线：独立验证它真是一条合法的最短路 ----

   跟 tour.test.js 同一个理由：不能只看返回值。一个「返回 6 但盘上摆出一串
   乱七八糟的马」的实现会骗过所有只看 result 的断言，而盘上那串马正是她看到
   的东西。所以回放 place / clear 重建盘面，再独立验证：每一步都是合法马步、
   一头是出发格、另一头是目标格、长度恰好等于返回的最短距离 + 1。 */
function placedPath(W, s, t) {
  const seq = [];
  I.run(K.source({ W: W, start: s, target: t, lang: 'zh' }), { host: {
    place: function (sq) { seq.push(sq); },
    clear: function (sq) { const at = seq.lastIndexOf(sq); if (at >= 0) { seq.splice(at, 1); } },
  } });
  return seq;
}
function isKnightWalk(seq, W) {
  for (let i = 1; i < seq.length; i++) {
    const ax = seq[i - 1] % W, ay = (seq[i - 1] - ax) / W;
    const bx = seq[i] % W, by = (seq[i] - bx) / W;
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    if (!((dx === 1 && dy === 2) || (dx === 2 && dy === 1))) {
      return 'step ' + i + ' is not a knight move';
    }
  }
  const seen2 = {};
  for (const sq of seq) { if (seen2[sq]) { return 'square ' + sq + ' appears twice'; } seen2[sq] = 1; }
  return null;
}
let pathChecked = 0;
for (const [W, s, t] of [[8, 0, 63], [8, 0, 27], [5, 0, 24], [8, 12, 40]]) {
  const d = hostBFS(W, s, t);
  const seq = placedPath(W, s, t);
  T.eq(seq.length, d + 1,
       W + 'x' + W + ' ' + s + '→' + t + '：盘上摆着 ' + (d + 1) + ' 匹马（最短 ' + d + ' 步就是 ' + (d + 1) + ' 格）');
  const why = isKnightWalk(seq, W);
  T.ok(why === null, W + 'x' + W + ' ' + s + '→' + t + '：那串马是一条合法的马步路线' +
       (why ? '：' + why : ''));
  T.ok(seq.indexOf(s) >= 0 && seq.indexOf(t) >= 0,
       W + 'x' + W + ' ' + s + '→' + t + '：路线的两头正是出发格与目标格');
  pathChecked++;
}
T.eq(pathChecked, 4, '四组都验过盘上那条路线');

/* ---- 到不了的时候：返回 −1，盘上一匹马都不摆 ----
   2×2 上马一步都走不出去。**「到不了」必须是 −1，不许变成 0** —— 0 是
   「已经站在目标上」，把这两件事混成同一个数字是这一题最不能出的错。 */
{
  const r = I.run(K.source({ W: 2, start: 0, target: 3, lang: 'zh' }), { host: {} });
  T.eq(r.result, hostBFS(2, 0, 3), '2x2 0→3 到不了：与宿主侧 BFS 一致（−1）');
  T.eq(r.result, -1, '到不了返回 −1，不是 0');
  T.eq(placedPath(2, 0, 3).length, 0, '到不了的时候盘上一匹马都不摆');
}
// 出发格就是目标格：0 步，而且盘上就那一匹马。
{
  const r = I.run(K.source({ W: 8, start: 27, target: 27, lang: 'zh' }), { host: {} });
  T.eq(r.result, 0, '出发格就是目标格：0 步');
  T.eq(placedPath(8, 27, 27), [27], '这时候盘上只有出发格那一匹马');
}

/* ---- 缺参数当场抛（阶段 5 约束 6：省略参数已经是本仓库抓到过五次的缺陷类）----

   ⚠ **这一组故意一个 `lang` 都不传，而且每条都带第三参 pattern。** 两件事
   缺一不可，合起来这一组才同时是**校验顺序**那道门：`source()` 自身那三个
   参数的校验在最前、`lang` 由 render() 在最后校验 —— 所以一个只给了
   start / target 的调用撞上的必须仍旧是「少了 W」。

   补第三参之前（`T.throws(fn, label)`，pattern 是 undefined），这八条退化成
   「抛了就算过」：审查的突变 M10 把 lang 校验提到 W 前面，77 + 175 条断言
   **全绿** —— 那个设计当时根本没有门。撤掉 lang 也是同一件事的一半：只要这
   一组还传着 `lang: 'zh'`，lang 校验挪到哪里都照样绿（它一次都不会被撞上）。

   pattern 之间不许共享前缀（阶段 7 栽过：三条消息同前缀，一个正则匹到每一条，
   等于没钉是哪一条）。这里八条分成四个互斥的形状：少了 W / 少了 start /
   少了 target / X 必须是，实测把任一条的 pattern 换到另一条上都会红。 */
T.throws(function () { K.source({ start: 0, target: 63 }); }, '缺 W 当场抛', /少了 W/);
T.throws(function () { K.source({ W: 8, target: 63 }); }, '缺 start 当场抛', /少了 start/);
T.throws(function () { K.source({ W: 8, start: 0 }); }, '缺 target 当场抛', /少了 target/);
T.throws(function () { K.source(); }, '连 opts 都没有也当场抛', /少了 W/);
T.throws(function () { K.source({ W: 8, start: 64, target: 0 }); }, 'start 越界当场抛', /start 必须是/);
T.throws(function () { K.source({ W: 8, start: 0, target: 64 }); }, 'target 越界当场抛', /target 必须是/);
T.throws(function () { K.source({ W: 8, start: -1, target: 0 }); }, 'start 为负当场抛', /start 必须是/);
T.throws(function () { K.source({ W: 8.5, start: 0, target: 1 }); }, 'W 不是整数当场抛', /W 必须是/);
// 但**不**校验「跑不跑得完」，也不校验「到不到得了」：那两件事要跑出来给她看。
{
  let err = null;
  try { K.source({ W: 2, start: 0, target: 3, lang: 'zh' }); } catch (e) { err = e; }
  T.ok(err === null, '明知到不了的 2×2 照常吐源码');
}

/* ---- 约束 7：断言「某个导出不存在」要用 typeof ----
   `JSON.stringify(function(){})` 与 `JSON.stringify(undefined)` 都是 undefined，
   写成 T.eq(K.N_MAX, undefined) 会在 K.N_MAX 是个函数时照样绿。 */
T.ok(typeof K.source === 'function', '导出的形状与 queens / tour 同形：{ source }');

/* ---- 双语三道门（规格 §7.5）----

   守的是「可执行代码没有偷偷分岔」，**不是**「英文翻得对不对」——后者机器
   判不了，是人工审查项。

   ⚠ **别把 queens.test.js 那句「三道各有对方才拦得住的漏」搬到这里来**：
   那句话对**这一份**说过头了。这份源码里没有字符串参与控制流，所以步数门
   在这里**没有独立战果** —— 审查逐条突变实测，凡能让步数门变红的改动，
   行数门或 normalizeSource 门总会先红。三道仍旧全留着：它们在别的文件上
   各有战果，而且这份源码哪天长出一条字符串分支，第一个拦住它的就是这里。
   只是不必在这里给它们记一笔并不存在的战功。 */
for (const target of [10, 24]) {
  const zh = K.source({ W: 5, start: 0, target: target, lang: 'zh' });
  const en = K.source({ W: 5, start: 0, target: target, lang: 'en' });

  T.eq(en.split('\n').length, zh.split('\n').length,
       'target=' + target + '：两种语言行数相同');
  T.eq(T.normalizeSource(en), T.normalizeSource(zh),
       'target=' + target + '：抽掉注释与字符串之后，两种语言逐字节相同');
  T.eq(I.run(en, { host: {} }).trace.length, I.run(zh, { host: {} }).trace.length,
       'target=' + target + '：两种语言的解释器步数相同');
}

/* 反向：英文必须真的是英文。上面三道门在「en 原样返回中文」时全绿 ——
   把 lang 接进来却没接上，长得跟接上了一模一样。 */
const kpZh = K.source({ W: 5, start: 0, target: 24, lang: 'zh' });
const kpEn = K.source({ W: 5, start: 0, target: 24, lang: 'en' });
T.ok(kpZh !== kpEn, '两种语言的源码不是同一份');
T.ok(/[一-鿿㐀-䶿　-〿＀-￯]/.test(kpZh), '中文那一份里有汉字');

/* ⚠ 「英文那一份里一个汉字都没有」这一条要**扣掉 BLANK 指令行**才成立：
   指令行不翻译（它本来就同时带着 hint 与 hintEn），那两句中文 hint 就必然
   把汉字留在英文变体的原文里。而那两行根本不是读者读的东西：`exercise.js`
   的 parse() 把 >>> / <<< 两行从 `clean` 里剥掉，提示由 hintAt 按语言各取
   一支。所以这里断言的是**送到编辑器里的那一份**。

   ⚠ 剥指令行这件事**只许问 parse()，不许自己写一个**。queens.test.js 里
   原先有一个本地 `readerFacing()`，实测就已经跟 parse() 分岔了（差的正是
   两行 `// <<< BLANK`），修复轮删掉了。同一段知识只留一份实现。 */
T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(E.parse(kpEn, 'en').clean),
     '送进编辑器的那一份英文源码（parse().clean）里一个汉字都没有');

/* 下面这两行是**挑出**指令行，不是剥掉 —— parse() 没有对应 API（它只吐
   blanks / clean / placeholder，不吐原始指令行），所以本地选择器保留。
   别照着这两行再写一个「剥」的：剥要用 parse().clean，理由见上一段。 */
const blanksZh = kpZh.split('\n').filter(function (l) { return l.trim().indexOf('// >>> BLANK') === 0; });
const blanksEn = kpEn.split('\n').filter(function (l) { return l.trim().indexOf('// >>> BLANK') === 0; });
T.eq(blanksEn.length, 2, '英文变体里有两条 BLANK 指令（on-board 与 seen-test）');
T.eq(blanksEn, blanksZh, 'BLANK 指令行在两种语言下逐字节相同 —— parse() 一点不用改');

/* ---- hintEn 真的是英文 ----

   两条 BLANK 的 hintEn 是她在提示面板第 1 级读到的原文，而这个工具**默认
   英文界面**。上面所有门对 hintEn 的内容一句话都没说：把 hintEn 整段换成
   中文，那些门全绿放行 —— 指令行在两语间逐字节相同（那条还是绿的），
   normalizeSource 把整行当注释抽掉，parse().clean 又把整行剥掉。
   拿 parse().blanks 的结构去断言，不自己解析指令行（同上一段的理由）。 */
const blanksParsed = E.parse(kpEn, 'en').blanks;
T.eq(blanksParsed.length, 2, 'parse() 认出两个挖空');
let hintEnChecked = 0;
for (const b of blanksParsed) {
  T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(b.hint.en), b.id + ' 的 hintEn 里一个汉字都没有');
  T.ok(/[一-鿿㐀-䶿　-〿＀-￯]/.test(b.hint.zh), b.id + ' 的 hint（中文那一支）里有汉字');
  hintEnChecked++;
}
T.eq(hintEnChecked, 2, '两个挖空的 hintEn 都真的查过（这条防上面那个循环空转）');

/* ---- lang 必填，且只认两个值 ----

   ⚠ 第三个参数才是 pattern：`T.throws(fn, label, pattern)`（见 _test.js）。
   写在第二个位置上，pattern 就是 undefined，退化成「抛了就算过」——
   这三条要钉的恰恰是**抛的是哪一条**（少了 lang vs 只认两个值）。 */
T.throws(function () { K.source({ W: 5, start: 0, target: 24 }); },
         'knight-path：缺 lang 必须抛', /少了 lang/);
T.throws(function () { K.source({ W: 5, start: 0, target: 24, lang: 'fr' }); },
         'knight-path：lang=fr 必须抛', /只认/);
T.throws(function () { K.source({ W: 5, start: 0, target: 24, lang: '' }); },
         'knight-path：lang 是空串必须抛（空串不当默认值用）', /只认/);

T.report();
