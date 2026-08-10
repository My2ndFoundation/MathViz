'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const K = require('./knight-path.js');
const A = require('./field-bfs.js');

const W = 8;
/* 源摆四角，顺序 a1 → h8 → a8 → h1（规格 §4⑤ 9f ②）。
   滑杆「源的个数」1–4 取的就是这个列表的前 n 个。 */
const CORNERS = [0, 63, 56, 7];

/* ================= 宿主侧参照（§7.3：跟另一份思路完全不同的实现）=================

   被测的那一份是**逐层同步 + 递归**：`expand(frontier, d)` 拿着「正好 d 步能到
   的那一整层」，把下一层收成一张新表，再对下一层调用自己 —— 层号由递归深度
   带着走，一格的距离是「它出现在第几层」。

   下面这一份是**教科书那种「一条队列 + 一个 while」**：所有距离的格子挤在同一
   条队列里，一格的距离是 `dist[cur] + 1` 现算出来的，没有「层」这个概念，也
   没有一次递归。

   **为什么这样才叫独立**：两份共享的只有「马的八个偏移量」与「格子编号
   sq = 行 * W + 列」这两条题面事实 —— 那是题目本身，不是解法。控制流（递归
   铺层 vs 单层循环）、距离怎么得到（层号 vs 前驱 + 1）、什么时候确定一格
   （收下一层时 vs 出队时）三样全都不同。一个「把层号算错一位」或者「早停在
   层内」的缺陷不可能在两份里以同一种方式出现，所以逐格对拍才有判别力。
   如果参照抄的是同一个形状，对拍出来的只是「我抄得准不准」。 */
function hostField(w, srcs) {
  const DX = [1, 2, 2, 1, -1, -2, -2, -1], DY = [2, 1, -1, -2, -2, -1, 1, 2];
  const dist = new Array(w * w).fill(-1);
  const q = [];
  for (const s of srcs) { if (dist[s] === -1) { dist[s] = 0; q.push(s); } }
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], x = cur % w, y = (cur - x) / w;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      if (nx >= 0 && nx < w && ny >= 0 && ny < w) {
        const nb = ny * w + nx;
        if (dist[nb] === -1) { dist[nb] = dist[cur] + 1; q.push(nb); }
      }
    }
  }
  return dist;
}
/* 「整张场的最大值」= 够得到的格子里最远的那一个（−1 是够不到，不参与）。
   8×8 上够不到的格子恒为 0 个（规格 §4⑤ 9f ⑥），所以这两种说法在本题同义；
   写成这样是因为 max 的定义不该依赖那个巧合。 */
function hostFar(dist) {
  let far = 0;
  for (const d of dist) { if (d > far) { far = d; } }
  return far;
}

/* 跑一遍被测源码，把 mark 通道上收到的每一条原样记下来（**不过滤类型**：
   「收到的是不是数值」正是要断言的事，先过滤就把答案偷偷喂进去了）。 */
function runField(srcs) {
  const marks = [];
  const r = I.run(A.source({ sources: srcs, lang: 'zh' }), {
    host: { mark: function (sq, kind) { marks.push([sq, kind]); } },
  });
  return { result: r.result, trace: r.trace, marks: marks };
}
/* 从 mark 通道重建整张场。**只认数值**，而且**重复标同一格当场记成缺陷**
   —— 「每格恰好一次」是下面第 4 条要断的，这里顺手把证据攒出来。 */
function fieldFromMarks(marks) {
  const got = {}, dup = [], nonNumber = [];
  for (const m of marks) {
    if (typeof m[1] !== 'number') { nonNumber.push(m); continue; }
    if (Object.prototype.hasOwnProperty.call(got, m[0])) { dup.push(m[0]); }
    got[m[0]] = m[1];
  }
  return { got: got, dup: dup, nonNumber: nonNumber };
}

/* ---- 1 & 2：三档最远距离 + 逐格距离，都跟宿主侧参照对拍 ----

   ⚠ 期望值一个都不写死：6 / 5 / 3 是 hostField 现算出来的，不是抄来的。
   （报告里那三个数是这一段跑出来印的，不是这一段的输入。） */
let graded = 0;
for (const n of [1, 2, 3, 4]) {
  const srcs = CORNERS.slice(0, n);
  const f = runField(srcs);
  const want = hostField(W, srcs);
  const wantFar = hostFar(want);

  T.ok(!f.trace.truncated, n + ' 个源：没有撞上 STEP_LIMIT');
  T.eq(f.result, wantFar,
       n + ' 个源：返回的是整张场的最大值（参照算出来是 ' + wantFar + '）');

  const fm = fieldFromMarks(f.marks);
  const gotArr = [];
  for (let sq = 0; sq < W * W; sq++) {
    gotArr.push(Object.prototype.hasOwnProperty.call(fm.got, sq) ? fm.got[sq] : -1);
  }
  T.eq(gotArr, want, n + ' 个源：mark 通道上重建出来的场，与参照逐格相同（64 格）');
  graded++;
}
T.eq(graded, 4, '四档源数都对拍过（这条防上面那个循环空转）');

/* ---- 3：源格自己的距离是 0，而且 0 真的从 mark 通道以**数值**送出去了 ----

   这是「探针跑完的裁定②」的算法侧那一半：**0 是真值，不是「没有值」**。
   三种退化各钉一条 —— 缺席（源格根本没标）、字符串（"0" 而不是 0）、
   被别的值覆盖。只断言 `got[s] === 0` 是不够的：`T.eq` 眼里 0 与 "0"
   已经不同，但「一次都没发」在 got 里长得像 −1，得单独查在场。 */
let zeroChecked = 0;
for (const n of [1, 2, 4]) {
  const srcs = CORNERS.slice(0, n);
  const f = runField(srcs);
  for (const s of srcs) {
    const hits = f.marks.filter(function (m) { return m[0] === s; });
    T.eq(hits.length, 1, n + ' 个源：源格 ' + s + ' 恰好被 mark 了一次');
    T.ok(hits.length === 1 && typeof hits[0][1] === 'number',
         n + ' 个源：源格 ' + s + ' 收到的是数值，不是字符串（收到 ' +
         (hits.length === 1 ? typeof hits[0][1] : '共 ' + hits.length + ' 次') + '）');
    T.eq(hits.length === 1 ? hits[0][1] : null, 0,
         n + ' 个源：源格 ' + s + ' 的距离是数值 0（0 是真值，不是「没有值」）');
    zeroChecked++;
  }
}
T.eq(zeroChecked, 7, '1 + 2 + 4 个源共七个源格都查过 0');

/* ⚠ **那些 0 是在种子那一步发出去的，不在 `expand` 里** —— 这是计划 Step 5
   第 3 条要自己验的那一处。判据是**顺序**：种子循环在 `expand(SRC, 0)` 之前
   跑完，所以 mark 通道上**最前面那 n 条必须恰好是 SRC 里那 n 个源、值全是 0**，
   后面才轮到第 1 层。若哪天有人把 `mark(s, 0)` 挪进 `expand`（比如让它在铺完
   一层之后补标），源格的 0 会混到后面去，这一条当场红。
   只断言「源格的值是 0」是抓不住这件事的：挪到哪里标，值都还是 0。 */
let seedOrderChecked = 0;
for (const n of [1, 2, 4]) {
  const srcs = CORNERS.slice(0, n);
  const f = runField(srcs);
  T.eq(f.marks.slice(0, n), srcs.map(function (s) { return [s, 0]; }),
       n + ' 个源：mark 通道最前面 ' + n + ' 条恰好是 SRC 里那几个源、值全是 0 ' +
       '—— 0 是种子那一步发的，不是 expand 发的');
  seedOrderChecked++;
}
T.eq(seedOrderChecked, 3, '三档都验过「0 发生在种子那一步」');

/* ---- 4：mark 的值域，以及「每一格恰好被 mark 一次」 ----

   BFS 不该重复标：一格被确认一次就定了距离，再碰到它只是「早就到过了」。
   逐层同步 BFS 里 `dist[nb] < 0` 那道闸是唯一的保证，这一条就是它的门。
   ⚠ 上界 6 不写死成常数比较，而是拿参照的最远值当上界 —— 写死 6 的话，
   哪天源的摆法变了，这条门会在一份完全正确的实现上变红。 */
let rangeChecked = 0;
for (const n of [1, 2, 3, 4]) {
  const srcs = CORNERS.slice(0, n);
  const f = runField(srcs);
  const fm = fieldFromMarks(f.marks);
  const hi = hostFar(hostField(W, srcs));

  T.eq(fm.nonNumber, [], n + ' 个源：mark 通道上没有一条非数值（这道题的 kind 是纯数值域）');
  T.eq(fm.dup, [], n + ' 个源：没有一格被 mark 两次（BFS 不重复标）');
  T.eq(f.marks.length, W * W, n + ' 个源：64 格每一格恰好被 mark 一次，一共 ' + (W * W) + ' 条');
  const out = f.marks.filter(function (m) { return !(m[1] >= 0 && m[1] <= hi); });
  T.eq(out, [], n + ' 个源：所有 mark 值都落在 0..' + hi + ' 之内');
  rangeChecked++;
}
T.eq(rangeChecked, 4, '四档都验过值域与「恰好一次」');

/* ---- 5：与 `knightPath` 的「差一行」—— 唯一的机器证据 ----

   `tips` 要说的那句话是「这道题跟最短路那一题只差队列初始塞了几个起点」。
   一句文案是证明不了自己的：**把 SRC 换成单个起点，整张场必须跟
   `knight-path.js` 跑出来的距离逐格相同。**

   ⚠ 这里**真的去 require 那份文件、真的用 interp 跑它**，不是在测试里另写
   一份单源 BFS 再自我对照 —— 那样证明的只是「我写的两份一致」，跟工具⑤ 里
   她实际会切过去看的那个 tab 没有任何关系。`knightPath` 的返回值是「起点到
   target 的最短步数」，所以取整张场要把 target 轮着换 64 次（实测 64 次跑完
   不到 0.1 秒）。 */
function knightPathField(start) {
  const d = [];
  for (let t = 0; t < W * W; t++) {
    d.push(I.run(K.source({ W: W, start: start, target: t, lang: 'zh' }), { host: {} }).result);
  }
  return d;
}
let oneLineChecked = 0;
for (const start of [0, 63, 27]) {
  const f = runField([start]);
  const fm = fieldFromMarks(f.marks);
  const mine = [];
  for (let sq = 0; sq < W * W; sq++) {
    mine.push(Object.prototype.hasOwnProperty.call(fm.got, sq) ? fm.got[sq] : -1);
  }
  const theirs = knightPathField(start);
  T.eq(mine, theirs,
       '单个起点 ' + start + '：fieldBFS 的整张场与 knight-path.js 跑出来的距离逐格相同 ' +
       '—— 这就是「差一行」那句话的机器证据');
  T.eq(f.result, Math.max.apply(null, theirs),
       '单个起点 ' + start + '：返回的最远距离与 knightPath 那张场的最大值相同');
  oneLineChecked++;
}
T.eq(oneLineChecked, 3, '三个单起点都跟 knightPath 对过');

/* ---- 源码必须在 interp.js 的 ES 子集里合法（中英各一份）----
   最硬的验法不是 parse，是**真的跑**：上面每一条断言都跑过中文那一份，
   这里补英文那一份，两语都真的进过解释器。 */
for (const lang of ['zh', 'en']) {
  let err = null;
  try { I.parse(A.source({ sources: CORNERS, lang: lang })); } catch (e) { err = e; }
  T.ok(err === null, 'lang=' + lang + ' 的源码在 ES 子集里合法' + (err ? '：' + err.message : ''));
  const r = I.run(A.source({ sources: CORNERS, lang: lang }), { host: {} });
  T.ok(!r.trace.truncated, 'lang=' + lang + ' 的源码真的跑完了（没截断）');
}

/* ---- 6：三道双语门（规格 §7.5）---- */
for (const n of [1, 4]) {
  const srcs = CORNERS.slice(0, n);
  const zh = A.source({ sources: srcs, lang: 'zh' });
  const en = A.source({ sources: srcs, lang: 'en' });

  T.ok(zh !== en, n + ' 个源：两种语言的源码不是同一份');
  T.eq(en.split('\n').length, zh.split('\n').length, n + ' 个源：① 行数同一（规格 §1.6 的逐行对齐）');
  T.eq(T.normalizeSource(en), T.normalizeSource(zh),
       n + ' 个源：抽掉注释与字符串之后两种语言逐字节相同');
  T.eq(I.run(en, { host: {} }).trace.length, I.run(zh, { host: {} }).trace.length,
       n + ' 个源：② 步数同一（注释不产生步）');
}
const zh1 = A.source({ sources: CORNERS, lang: 'zh' });
const en1 = A.source({ sources: CORNERS, lang: 'en' });
T.ok(/[一-鿿㐀-䶿　-〿＀-￯]/.test(zh1), '中文那一份里有汉字');

/* ⚠ **第③道门在这份文件上是恒真的，它在这里没有牙。** 实测：往 en 散文里
   塞汉字，这一条照样绿。原因跟 9d 的 `bitboard.js` 一模一样 —— 这道题的双语
   片段**全部是注释**，正则先把它们抽光了；剩下的代码行里唯一的字符串字面量
   是 `place(s, "wN")`，两种语言下逐字相同，本来就不可能有汉字。
   （`knight-path.js` 有牙是因为它有 `log("到不了：…")` —— 字符串字面量在
   注释外面。这道题的顶层被钉成 `return expand(SRC, 0);`，没有 log。）

   留着它是**形状统一**：哪天这份源码长出一条 `log("…")`，第一个拦住它的
   就是这一行。写下这段是因为「一道你从不查看的门等于没有保护，而让它看
   起来在守什么比它不存在更糟」—— 真正在守本文件双语正确性的是 ① 与 ②，
   还有上面那条 normalizeSource。 */
T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(
       en1.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
     '③ 英文变体抽掉注释后没有汉字（⚠ 这一条在本文件上恒真，见上面那段注释）');

/* ---- 一个挖空都没有（规格：挖空是 opt-in，不在本阶段）----
   `knight-path.js` 里有两条 `// >>> BLANK` 指令行。照抄它的时候**没有**把那
   两行抄过来，这一条把「没抄」钉住 —— 否则 `exercise.js` 会认出两个本阶段
   根本没设计过的挖空，而那是静默的。 */
for (const lang of ['zh', 'en']) {
  const src = A.source({ sources: CORNERS, lang: lang });
  const blanks = src.split('\n').filter(function (l) { return l.trim().indexOf('// >>> BLANK') === 0; });
  T.eq(blanks, [], 'lang=' + lang + '：源码里一条 BLANK 指令都没有');
}

/* ---- 约束 7：断言「某个导出不存在」要用 typeof ---- */
T.ok(typeof A.source === 'function', '导出的形状与其余八题同形：{ source }');

/* ---- 7：`sources` 的守卫 ----

   ⚠ pattern 一律写成**完整消息（固定文案 + 那一次的插值）**，不写只含固定
   文案的一段：越界那条守卫在不同下标上会吐好几条消息，只含固定文案的 pattern
   会同时匹中它们里结构不同的那些，被 check.py 第九道门判成「无判别力」。
   带上插值之后每条 pattern 各自只匹中它自己那一条。

   ⚠ 这一组**故意一个 `lang` 都不传**：`sources` 自己的校验在最前、`lang` 由
   render() 在最后校验，所以一个只给了 sources 的调用撞上的必须仍旧是 sources
   那条。把 lang 的校验挪到前面来，这一组当场红（撞上的会变成「少了 lang」，
   pattern 对不上）—— 这是 knight-path.test.js 那条经验的同一道门。 */
T.throws(function () { A.source({}); }, 'sources 缺席当场抛',
         'source({ sources }) 少了 sources —— 起点列表没有默认值，必须写明');
T.throws(function () { A.source(); }, '连 opts 都没有也当场抛',
         'source({ sources }) 少了 sources —— 起点列表没有默认值，必须写明');
T.throws(function () { A.source({ sources: 0 }); }, 'sources 不是数组当场抛（数字）',
         'sources 必须是一个数组（多源 BFS 的起点列表），收到：0');
T.throws(function () { A.source({ sources: [] }); }, 'sources 是空数组当场抛',
         'sources 至少要有一个起点，收到的是空数组');
T.throws(function () { A.source({ sources: [0, 64] }); }, 'sources 里有越界的格子号',
         'sources 里第 1 个起点必须是 0 到 63 之间的整数（8×8 的格子编号），收到：64');
T.throws(function () { A.source({ sources: [-1] }); }, 'sources 里有负的格子号',
         'sources 里第 0 个起点必须是 0 到 63 之间的整数（8×8 的格子编号），收到：-1');
T.throws(function () { A.source({ sources: [2.5] }); }, 'sources 里有不是整数的格子号',
         'sources 里第 0 个起点必须是 0 到 63 之间的整数（8×8 的格子编号），收到：2.5');
T.throws(function () { A.source({ sources: [0, 63, 0] }); }, 'sources 里有重复的起点',
         'sources 里有重复的起点：格子 0 出现了不止一次');

/* ---- lang 必填，且只认两个值 ----
   ⚠ 第三个参数才是 pattern（见 _test.js）；写在第二个位置上就退化成
   「抛了就算过」，而这三条要钉的恰恰是**抛的是哪一条**。 */
T.throws(function () { A.source({ sources: [0] }); },
         'field-bfs：缺 lang 必须抛', 'source({ lang }) 少了 lang');
T.throws(function () { A.source({ sources: [0], lang: 'fr' }); },
         'field-bfs：lang=fr 必须抛', 'source({ lang }) 的 lang 只认 "zh" 或 "en"，收到："fr"');
T.throws(function () { A.source({ sources: [0], lang: '' }); },
         'field-bfs：lang 是空串必须抛（空串不当默认值用）',
         'source({ lang }) 的 lang 只认 "zh" 或 "en"，收到：""');

/* ---- 实测印出来：这三个数是报告与 tips 的来源，不是抄来的 ---- */
for (const n of [1, 2, 3, 4]) {
  const srcs = CORNERS.slice(0, n);
  const f = runField(srcs);
  const dist = hostField(W, srcs);
  const unreach = dist.filter(function (d) { return d < 0; }).length;
  console.log('  [实测] ' + n + ' 个源 ' + JSON.stringify(srcs) +
              '：最远 ' + f.result + ' 步 / ' + f.trace.length + ' 步解释器 / 不可达 ' + unreach + ' 格');
}

T.report();
