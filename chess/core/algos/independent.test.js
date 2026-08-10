'use strict';
const T = require('../_test.js');
const I = require('../interp.js');
const TM = require('../tree-model.js');
const A = require('./independent.js');

/* ================= 宿主侧的独立参照：枚举所有子集 =================

   规格 §7.3 的判据是「跟另一份**思路完全不同**的实现一致」，不是「跟一个
   写死的期望值一致」。所以下面这一份要说清楚它凭什么算「思路不同」：

     被测源码          逐格递归回溯（选 / 不选 → pick(at + 1, …)）
                       ＋ 上界剪枝 ＋「只查向后四个邻居」

     这一份            一个递归都没有、一条剪枝都没有。把每一格的攻击范围
                       预先压成一张位掩码，然后从 0 数到 2^(N²) − 1，把每
                       一个整数都当作「哪几格摆了马」的一种摆法，逐个验一
                       遍合不合法，取合法里最大的那个。

   它没有「顺序」这个概念，因此也就没有「向后邻居」这个概念 —— 它给每一格
   查的是**全部八个方向**。这一点是刻意的：被测源码最容易静默出错的地方
   正是「只查四个」，而一份同样只查四个的参照会跟着一起错。两份共享的只有
   题面本身（马怎么走、什么叫互不攻击）。

   代价是指数级：N=5 要验 2^25 = 33,554,432 个子集（实测 59 ms），N=6 就是
   687 亿个，跑不动。参照与被测同时在 N=5 到顶不是巧合 —— 两边撞的是同一堵
   组合爆炸的墙，而这正是这道题要教的那件事。 */

const KNIGHT = [[-1, -2], [-1, 2], [1, -2], [1, 2], [-2, -1], [-2, 1], [2, -1], [2, 1]];

function attackMasks(N) {
  const SQ = N * N;
  const out = [];
  for (let s = 0; s < SQ; s++) {
    const c = s % N, r = (s - c) / N;
    let m = 0;
    for (let k = 0; k < KNIGHT.length; k++) {
      const nr = r + KNIGHT[k][0], nc = c + KNIGHT[k][1];
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) m |= (1 << (nr * N + nc));
    }
    out.push(m);
  }
  return out;
}

function hostSubsets(N) {
  const SQ = N * N;
  const att = attackMasks(N);
  const total = 1 << SQ;
  let best = 0;
  for (let m = 0; m < total; m++) {
    let t = m, cnt = 0, ok = true;
    while (t !== 0) {
      const bit = t & -t;
      const s = 31 - Math.clz32(bit);
      if ((att[s] & m) !== 0) { ok = false; break; }   // 这一枚马攻击到集合里的另一枚
      cnt++;
      t ^= bit;
    }
    if (ok && cnt > best) best = cnt;
  }
  return best;
}

/* 打桩宿主：把五个桥接全接住，顺便把「盘上现在站着哪几枚子」也维护起来。
   occupied 是 place/clear 配对断言的地基，见下面那一段。 */
function runAt(N) {
  const src = A.source({ N: N, lang: 'zh' });
  const kinds = {};                 // kind → 次数
  const marks = [];                 // [sq, kind]
  const places = [];                // [sq, piece]
  const clears = [];                // sq
  const logs = [];
  const occupied = {};              // sq → true，实时的棋盘占用
  let doublePlace = 0;              // 往一个已经有子的格子上再摆一次
  let emptyClear = 0;               // 清一个本来就空着的格子
  let live = 0, maxLive = 0, negative = 0;
  const r = I.run(src, { host: {
    mark: function (sq, kind) { marks.push([sq, kind]); kinds[kind] = (kinds[kind] || 0) + 1; },
    place: function (sq, piece) {
      places.push([sq, piece]);
      if (occupied[sq]) doublePlace++;
      occupied[sq] = true;
      live++; if (live > maxLive) maxLive = live;
    },
    clear: function (sq) {
      clears.push(sq);
      if (!occupied[sq]) emptyClear++;
      delete occupied[sq];
      live--; if (live < 0) negative++;
    },
    log: function (s) { logs.push(s); },
  } });
  return { src: src, run: r, kinds: kinds, marks: marks, places: places, clears: clears,
           logs: logs, occupied: occupied, doublePlace: doublePlace, emptyClear: emptyClear,
           liveAtEnd: live, maxLive: maxLive, negative: negative };
}

const TIERS = [3, 4, 5];
const got = {};
for (const N of TIERS) got[N] = runAt(N);

/* ---- ① 三档结果与宿主侧参照一致 ---- */
for (const N of TIERS) {
  const g = got[N];
  T.ok(!g.run.trace.truncated,
       'N=' + N + '：没撞步数上限（' + g.run.trace.length + ' 步 / ' + I.STEP_LIMIT + '）');
  T.eq(g.run.result, hostSubsets(N),
       'N=' + N + '：最大独立集与「枚举所有子集」的参照一致');
}

/* ---- ② 同色下界 ⌈N²/2⌉ ----
   这是第二条判据，而且跟①**不是同一种东西**：①比的是两份实现，②比的是一个
   数学事实 —— 马永远落在异色格上，所以同色的那一半格子天然互不攻击，⌈N²/2⌉
   摆得下；而它同时也是上界（这道题的经典结论，n ≥ 3）。两份实现同时错成同一
   个数还要恰好等于 ⌈N²/2⌉，那是另一个量级的巧合。

   ⚠ **n ≥ 3 才成立**：2×2 上一匹马一步都走不出去，答案是 4 而不是 ⌈4/2⌉ = 2。
   这正是滑杆下限取 3 的真正理由（见 independent.js 文件头「四处自己验」的第
   一条 —— 计划与规格把这条理由挂在了「只查四个邻居」上，实测那是挂错了地方）。*/
for (const N of TIERS) {
  T.eq(got[N].run.result, Math.ceil(N * N / 2),
       'N=' + N + '：结果等于同色下界 ⌈N²/2⌉ = ' + Math.ceil(N * N / 2));
}

/* ---- ③ place / clear 配对，跑完盘上一枚子都不剩 ----
   ⚠ **这一条不是锦上添花，是补一个静默缺口**（9d 实测，bitboard.js 文件头也
   记着）：宿主没给 place 时解释器落到 NOOP_HOST，把源码里 `place(at, "wN")`
   整行删掉，result 不变、mark 通道不变、一个错都不抛。上面①②那些断言一条
   都不会红。

   ⚠ 这条断言**自己验过它真的能红**：把 independent.js 里 place 那一行删掉
   再跑 —— result 仍是 5 / 8 / 13、mark 通道一个数都没变、一个错都没抛（正是
   上面说的静默），而下面这一组**当场 18 条变红**（三档各 6 条：次数不等、
   收支为负、清了空格子、峰值对不上、ok 数对不上）。验完从备份 cp 还原。

   钉四件事，缺一件就漏掉一种真实的错法：
     · 次数相同 + 收尾归零   —— 少一次 clear 就是「回溯没还干净」
     · 从不摆到已占的格子     —— 同一格摆两次说明递归没退回来
     · 从不清空着的格子       —— 多一次 clear 就是把别人的子清掉了
     · 峰值 == 结果            —— 盘上同时站过的最多子数就是这道题的答案本身，
                                 这一条把「棋子层」和「返回值」钉在一起 */
for (const N of TIERS) {
  const g = got[N];
  T.eq(g.places.length, g.clears.length,
       'N=' + N + '：place 与 clear 次数相同（各 ' + g.places.length + ' 次）');
  T.eq(Object.keys(g.occupied).length, 0, 'N=' + N + '：跑完盘上一枚子都不剩');
  T.eq(g.liveAtEnd, 0, 'N=' + N + '：place/clear 收支归零');
  T.eq(g.negative, 0, 'N=' + N + '：任何时刻 clear 都没多于 place');
  T.eq(g.doublePlace, 0, 'N=' + N + '：从没往一个已经有子的格子上再摆一枚');
  T.eq(g.emptyClear, 0, 'N=' + N + '：从没清一个本来就空着的格子');
  T.eq(g.maxLive, g.run.result,
       'N=' + N + '：盘上同时站过的最多子数 = 返回值 ' + g.run.result);
}

/* 棋子代号：既有 algos 的约定是「数字格子 + 两位字符串代号」（tour-dfs.js /
   bitboard.js 都是 place(sq, "wN")）。逐次核，不只核第一次。 */
const badPiece = got[4].places.filter(function (p) { return p[1] !== 'wN'; });
T.eq(badPiece.length, 0, 'N=4：每一次 place 的棋子代号都是字符串 "wN"');
const badSq = got[4].places.filter(function (p) {
  return typeof p[0] !== 'number' || p[0] < 0 || p[0] >= 16;
});
T.eq(badSq.length, 0, 'N=4：每一次 place 的格子号都是 0–15 的整数');

/* ---- ④ mark 通道：三种 kind 都得真的出现过 ----
   ⚠ 'cut' 这一条是**计划骨架里没有的**：计划给的可执行骨架在剪枝那一支
   只有 `return;`，不发任何 mark，而规格 §4⑤⑤ 明写「上界剪枝这一条给 cut
   那种 mark，是图例里『剪枝』那一行的来源」。不发就等于图例上挂着一行永远
   不会亮的说明。这里按规格补上了，并复测了三档步数（见 independent.js
   文件头的实测表）。

   ⚠ **没有 'try'**：queens 每试一格发一次 try，这道题的 pick 节点数是
   108 / 758 / 7,894，N=5 补一条 try 就是每个节点多一步 —— **实测**（真的
   加上去跑过一次）N=5 当场 truncated、result 变成 undefined。所以这道题的
   kinds 是 ok / cut / back 三行，没有 try。这不是省略，是 N=5 那 3.4% 的
   余量买不起。 */
for (const N of TIERS) {
  const k = got[N].kinds;
  T.ok(k.ok > 0, 'N=' + N + '：发过 "ok"（选中了这一格）');
  T.ok(k.cut > 0, 'N=' + N + '：发过 "cut"（上界剪枝真的剪到过，' + k.cut + ' 次）');
  T.ok(k.back > 0, 'N=' + N + '：发过 "back"（回溯撤销）');
  T.eq(Object.keys(k).sort(), ['back', 'cut', 'ok'],
       'N=' + N + '：mark 只发这三种 kind，没有第四种混进来');
}
/* ok 与 back 必须一一对应：每选中一格，退出来的时候都要标一次撤销。 */
for (const N of TIERS) {
  T.eq(got[N].kinds.ok, got[N].kinds.back,
       'N=' + N + '：ok 与 back 次数相同（选中几次就撤销几次）');
  T.eq(got[N].kinds.ok, got[N].places.length,
       'N=' + N + '：ok 的次数就是 place 的次数（标记层与棋子层同步）');
}

/* ---- ⑤ log 通道：每破一次纪录喊一声 ----
   这条同时是第③道双语门的牙齿所在，见下面那一段。 */
for (const N of TIERS) {
  T.ok(got[N].logs.length > 0, 'N=' + N + '：至少喊过一次「新纪录」');
}
T.ok((got[5].logs.length ? got[5].logs[got[5].logs.length - 1] : '').indexOf('13') >= 0,
     'N=5：最后一句 log 里带着最终答案 13');

/* ---- ⑥ 调用栈深度：调用深度 = 第几格 ----
   规格 §4⑤ 9e ④ 靠这个数定 spanZ（Task 2 声明的是 spanZ = 0.20），
   而「调用栈深度 = SQ + 1」这件事今天没有任何别的地方在守。TreeModel.build
   认 'pick' 帧，树深从 0 数起，所以深度 = 最大树深 + 1。
   ⚠ **这一条钉的是调用栈深度，不是画出来的塔。** 塔的层号来自 mark 的调用深度，
   而最深那一帧（at === SQ）一个 mark 都不写，所以**画出来的塔是 SQ 层**
   （实测 towerTop：N=4 → 16、N=5 → 25）。两个数别混。 */
for (const N of TIERS) {
  const tree = TM.build(got[N].run.trace, 'pick');
  let maxd = -1;
  for (const id in tree.nodes) if (tree.nodes[id].depth > maxd) maxd = tree.nodes[id].depth;
  T.eq(maxd + 1, N * N + 1,
       'N=' + N + '：调用栈深度 ' + (maxd + 1) + ' = SQ + 1（画出来的塔是 SQ 层，两个数别混）');
}

/* ---- ⑦ 三道双语门（规格 §7.5）---- */
for (const N of TIERS) {
  const zh = A.source({ N: N, lang: 'zh' });
  const en = A.source({ N: N, lang: 'en' });
  T.ok(zh !== en, 'N=' + N + '：两种语言真的不一样');
  T.eq(zh.split('\n').length, en.split('\n').length,
       'N=' + N + '：① 行数同一（规格 §1.6 的逐行对齐）');
  T.eq(I.run(zh, { host: {} }).trace.length, I.run(en, { host: {} }).trace.length,
       'N=' + N + '：② 步数同一（注释不产生步）');
}
const zh3 = A.source({ N: 3, lang: 'zh' });
const en3 = A.source({ N: 3, lang: 'en' });
T.ok(/[一-鿿]/.test(zh3), '中文那一份里有汉字');

/* ⚠ 第③道门在**这份文件上是有牙的**，而这不是白捡的 —— 9d 实测过：对
   「双语片段全部是注释」的文件（bitboard.js 就是），这道门恒真，因为正则
   先把注释抽光了，剩下的代码行两语逐字相同，本来就不可能有汉字。

   这份文件之所以不是那种情况，是因为它有一行 `log("新纪录：…")` ——
   **字符串字面量在注释外面**，两种语言各写各的。抽掉注释之后它还在，
   汉字就藏不住。实测（突变验证）：把 en 那一支的 log 文案换成中文，这一
   条当场变红；换回去恢复绿。所以这里是三道门里唯一真的在守「英文变体
   没混进中文」的那一条，不是形状统一的摆设。

   顺带说清楚为什么 log 这一行值得存在（它不是为了给这道门喂牙）：pick 走到
   at === SQ 时手上是一个完整摆法，而「破了纪录」是整段搜索里唯一值得停下来
   看一眼的时刻 —— 跟 queens 数出一个解时喊一声是同一个位置。它一共只喊
   2 / 1 / 4 次（三档实测），步数代价 ≤ 4 步。 */
T.ok(!/[一-鿿㐀-䶿　-〿＀-￯]/.test(
       en3.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
     '③ 英文变体抽掉注释后没有汉字');

/* 额外一道（不在规格那三道里，但它是最强的一条，且免费）：抽掉注释与
   字符串字面量之后，两种语言必须逐字节相同 —— 守的是「可执行代码没有
   偷偷分岔」。①只看行数，②只看步数，两者都漏得掉「同一行、同样步数、
   不同代码」（queens.test.js 那段注释里逐条写了这三道各自漏什么）。 */
for (const N of TIERS) {
  T.eq(T.normalizeSource(A.source({ N: N, lang: 'en' })),
       T.normalizeSource(A.source({ N: N, lang: 'zh' })),
       'N=' + N + '：抽掉注释与字符串之后，两种语言逐字节相同');
}

/* ---- ⑧ lang 与 N 的守卫 ----
   ⚠ pattern 一律写成**完整消息（固定文案 + 那一次的插值）**，不写成只有
   固定文案的一段：固定文案对越界那几条是共享的，一条 pattern 会同时匹中
   好几条消息；而 `收到：2` 与 `收到：four` 归一化之后是**两种不同的结构
   形状**（check.py 的 _throws_msg_shape 只抹 ASCII 双引号里的内容和数字，
   不抹裸字符串），共享 pattern 会被第九道门判成「无判别力」。带上插值
   之后，每条 pattern 各自只匹中它自己那一条。 */
T.throws(function () { A.source({ N: 4 }); }, 'lang 缺席当场抛',
         'source({ lang }) 少了 lang');
T.throws(function () { A.source({ N: 4, lang: 'fr' }); }, 'lang 只认 zh / en',
         'source({ lang }) 的 lang 只认 "zh" 或 "en"，收到："fr"');
T.throws(function () { A.source({ lang: 'zh' }); }, 'N 缺席当场抛',
         'source({ N }) 少了 N');

const G = 'N 必须是 3 到 5 之间的整数（这道题的盘面边长），收到：';
T.throws(function () { A.source({ N: 2, lang: 'zh' }); },
         'N 越下界当场抛（2×2 上一匹马一步都走不出去，⌈N²/2⌉ 也不成立）', G + '2');
T.throws(function () { A.source({ N: 6, lang: 'zh' }); },
         'N 越上界当场抛（6×6 实测撞 200,000 步上限）', G + '6');
T.throws(function () { A.source({ N: 4.5, lang: 'zh' }); }, 'N 不是整数当场抛', G + '4.5');
T.throws(function () { A.source({ N: NaN, lang: 'zh' }); }, 'N 不是有限数当场抛', G + 'NaN');
T.throws(function () { A.source({ N: 'four', lang: 'zh' }); },
         'N 是字符串当场抛（只认数字，不认英文数词）', G + 'four');

/* 滑杆边界导出给页面层用（Task 2 的 params）。与 queens.js 不同：那边的
   N_MIN/N_MAX 只约束界面、不约束 source()（N=9 撞墙要生成出来给她看）；
   这边 source() 自己就把 3–5 钉死了，因为 N=6 连跑都跑不完，生成一份
   注定被截断的源码没有任何教学价值，只会让页面拿到一个 undefined 的结果。 */
T.eq([A.N_MIN, A.N_MAX], [3, 5], '导出的滑杆边界是 3–5');

T.report();
