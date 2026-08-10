/* 马的攻击格（位盘 · 一次挪整块盘）的**算法源码生成器**（规格 §2.1）。
   零依赖；node 与浏览器双用。编辑源，运行时被内联进 tools/*.html。

   跟 `queens.js` / `path-count.js` / `knight-path.js` / `tour-*.js` /
   `minimax.js` / `king-greedy.js` / `king-exact.js` 是同一个形状：这个模块
   本身不算任何攻击格 —— 它吐出一段**字符串**。那段字符串同时是喂给
   `Interp.run` 去真跑的程序、和喂给 `Editor.mount` 摆在使用者眼前的那份
   源码。一份字符串两个用途，所以「看到的」和「跑的」不可能漂移。

   **生成出来的那段源码里的注释和命名，是写给一个没学过棋、正在学算法的
   十六岁读者的**。本文件自己的注释（就是你正在读的这些）是给维护者的，
   两套读者，两种口吻。

   ---- 题面 ----

   前六道题的棋盘都是「一格一个数组下标」；这道题换一种表示法：把整块
   8×8 盘塞进**一个 BigInt** 里，64 个格子对应 64 个二进制位。移一次位
   （`<<` / `>>`）就是「所有子同时挪一步」，不用一格一格循环 —— 这是位盘
   比数组快的全部原因，也是这道题唯一要教的东西。给定马所在格 `SQ`，一次
   算出它能攻击的全部格子，用 `atk`（一个 BigInt）表示。

   ---- 这道题唯一的教学落点：移位不认识棋盘的边 ----

   `<<` / `>>` 只对二进制位做事，完全不知道「第 7 位挨着第 8 位」在棋盘上
   意味着从 h 线滑到了下一行的 a 线。a 线上的马往左移一位，不会报错，会
   悄没声地借位跳到 h 线去 —— 结果依然是一个合法的 BigInt，只是错的。四张
   掩码（`NOT_A` / `NOT_H` / `NOT_AB` / `NOT_GH`）就是用来把这种「跑过界」
   的位抹掉的。⚠ **抹的时机是移位之后**（`<<` 比 `&` 结合得紧，
   `(one << 17n) & NOT_A` 先移后掩）——**掩码筛的是「落点」，不是「出发点」**。
   这句话初稿在本文件写反过两处（维护者注释一处、生成源码的教学注释一处），
   而写反它的直接后果是计划里那条 `tips` 让读者删错了掩码、删完什么都看不见
   （阶段 9d 第七、八处订正）。源码里写的是完整正确的一份，**不许写成
   `if (USE_MASK)` 这类人造开关** —— 将来 `tips` 会叫读者亲手删掉某一张
   试试，删完就得看见错误答案，那才是这道题的落点。

   ---- 四处「自己验」的结论（阶段 9d task 1 brief 明确要求）----

   ① **八个方向与四张掩码的配对**：brief 给的配对是「推的」，要求用 node
      把 64 格全跑一遍对拍宿主侧参照实现。**已核对，brief 给的配对完全
      正确，没有配错的档**（用一份完全独立的「按 (Δ文件, Δ行) 找哪张掩码
      能让 64 格结果都对上」的算法反推了一遍，八个方向全部落在 brief 给的
      掩码上；这也正是 chessprogramming.org 上广为人知的马位盘偏移量，
      `<<17/NOT_A, <<15/NOT_H, <<10/NOT_AB, <<6/NOT_GH,`
      `>>17/NOT_H, >>15/NOT_A, >>10/NOT_GH, >>6/NOT_AB`）。

   ② **四张掩码的十六进制常量**：打印成二进制数过——`NOT_A`/`NOT_H` 各是
      56 个 1（8×7，挡一条线）、`NOT_AB`/`NOT_GH` 各是 48 个 1（8×6，挡两条
      线），挡掉的正是各自名字说的那几条线。而「它们不会在第 63 位以上悄悄
      带一串隐含的 1」这件事，理由是**四个字面量都恰好写成 16 位十六进制数，
      值必然小于 2^64** —— 跟最高位是几无关。四张的位长实测是：
      `NOT_A`（`0xfefe…`）**64**、`NOT_AB`（`0xfcfc…`）**64**、
      `NOT_H`（`0x7f7f…`）**63**、`NOT_GH`（`0x3f3f…`）**62**
      （`0xfe = 1111_1110`、`0xfc = 1111_1100`，最高位都是 1；
      `0x7f = 0111_1111`、`0x3f = 0011_1111`，最高位才是 0）。

      ⚠ **这一句被写错过两次，方向相反**：初稿写「四张最高位都是 1」（对
      A/AB 真、对 H/GH 假），订正时矫枉过正成「后三张最高位都是 0」（对
      H/GH 真、对 **AB** 假），终审复验时才数出来。**两次都是没去数。**
      记在这里是因为这正是本阶段反复犯的那一种错 —— 写下一个看着合理的
      数，而没有去数它。

   ③ **`b & FULL` 这一步是否必须**：**不是必须的，是防御性的**。②已经
      证实四张掩码的位长都 ≤ 64，跟它们 `&` 之后，
      任何移位越过第 63 位产生的高位早就被掩码天然清零了，不需要再 `& FULL`
      一次。留着它的理由是防御纵深：万一将来有人（比如做 Step 7 的删掩码
      实验）把某张掩码整个删掉，`b & FULL` 至少还能保证 `atk` 不会带上一个
      跑到第 63 位以外的、连「合法棋盘格子」都算不上的位——虽然本次验证
      发现即便去掉 `& FULL`，Step 7 的测试照样会因为「落错格」而报错（越界
      的高位比对不上宿主侧任何一个 0–63 的格子，`T.eq` 一样会失败），所以
      它对**这道题的测试判据**是多余的，但对**这段代码本身的正确性纪律**
      不是坏事，brief 给的固定代码块含这一行，原样保留。

   ④ **`lowBit` 对 `b === 0n` 会死循环**：确认过，唯一调用点在 `addDir`
      里被 `if (b !== 0n) { let t = b; while (t !== 0n) { ... lowBit(t) ... } }`
      包住——`lowBit` 永远只在 `t !== 0n` 已经成立之后才被调用，保护充分。

   ---- 几处必须写下来的约定 ----

   · **入口函数叫 `addDir`**（对应将来 `PROBLEMS.bitboard.entry`）。它按
     方向序号 `k`（0–7）**递归**试遍八个方向，顶层是
     `addDir(0); return atk;`——`TreeModel.build(trace, 'addDir')` 认到的
     帧因此一层套一层，深度塔正好是「试到第几个方向」。**这一条测不出来**：
     Task 1 Step 8 把尾调用 `addDir(k + 1)` 换成外层 `for` 循环 `for (let k
     = 0; k < 8; k = k + 1) { addDir(k); }`，六十四格全跑对拍、四个写死的
     锚点、mark 通道、三道双语门全部照样全绿（Step 8 亲手验过，结论同
     path-count.js 记录的那一次）——结果正确性与调用栈深度是两件独立的
     事，第三根轴只能靠 Task 5 的浏览器验收去看深度塔立起来没有。

   · **格子编号 `sq = r * 8 + c`**，r 是行、c 是列，r=0 是棋盘最下面一行、
     c=0 是最左列，0 号格就是 a1 —— 跟 `queens.js` / `path-count.js` /
     `knight-path.js` 同向。

   · **本任务调两个桥接**：`place(SQ, "wN")` 与 `mark(sq, "ok")`。⚠ **「要不要
     摆一枚真的马」曾经是未决项，现已裁定为「摆」**（阶段 9d：Task 2 实跑判定
     「要摆」，控制者裁定采纳，Task 1b 回头加的这一行）。三条理由：规格 §4⑤①
     原话就是「摆**真的马**（`place(sq, 'wN')`）」；代价只有一行源码、整趟只多
     一次宿主调用（`addDir` 外面调，不在递归里，不随八个方向放大）；而不摆的话
     Task 2 实跑确认**「哪一格是马」在画面上没有任何东西说得出来**——`sq` 是这道
     题唯一的滑杆参数，滑杆一动盘上却看不出动了什么，那个参数就等于不存在。
     这道题另外三个桥接（`attacked` 反查、`clear`、`log`）确定不需要：只调两个
     不代表桥接总集缩水——`clear`/`log`/`attacked` 仍然都在根环境里，只是这道题
     没有调用它们，跟 `path-count.js` 只用 `mark`+`log` 两个、`queens.js` 用另一套
     组合是同一件事：五个桥接名固定，各题按需取用。
     ⚠ **`place` 的漏是静默的**：宿主没给 `place` 时解释器落到 NOOP_HOST，删掉
     这一行源码不会抛、不会改 `result`、也不会动 `mark` 通道。所以
     `bitboard.test.js` 里专门有一条打桩 host 的断言钉着「恰好调一次、格子号
     === SQ、棋子代号是字符串 "wN"」——没那条断言，这一行删了没人知道。

   · **BigInt 与位运算子集**：`123n` 字面量、`0x..n` 十六进制字面量、
     `BigInt(x)` 内建、`& | ^ ~ << >>` 六个位运算符，全部是阶段 9b 加进
     解释器的（规格 §7.7），`declareVar` 把 `BigInt` 当成 `Math` 同级的根
     环境常量，走的是原生 `fn.apply` 调用路径。这份文件是全仓第一份真正
     用到它们的算法生成器。

   · 子集约束（规格 §2.6）：**没有模板字面量、没有正则字面量、没有
     `for…in`、没有 `try/catch`**，字符串用 `+` 拼；可用 `let`/`const`、
     数组与索引、对象字面量、`if/else`、`for`、`for…of`、`while`、函数与
     箭头函数、递归、BigInt 字面量、`BigInt(x)`、六个位运算符。生成出来的
     这份源码只用到了 `if`、函数、递归、`while`、位运算和 BigInt 字面量，
     没用到 `for`/`for…of`/箭头函数/对象字面量，子集用得比允许的更窄，不
     代表那几种不可用。

   ---- 实测（`Interp.STEP_LIMIT`）----

   64 格全跑一遍，每格递归深度固定 8 层、每层最多剥一个 1 出来 mark 一次，
   总步数远小于 `Interp.STEP_LIMIT`（200000）——这题离撞步数上限比
   `path-count.js` 还远：路径数好歹是 O(N²) 格子，这里恒定 8 个方向、恒定
   64 格，没有任何随参数增长的维度。四个写死的锚点（a1/h8/d4/a4）与六十四
   格的全量对拍都在 `bitboard.test.js` 里，判据同前几份：两份思路完全不同
   的实现同时算错成同一个数，概率远低于哪个常量抄错了一个字符。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlgoBitboard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= 双语渲染（规格 §1.6 / §7.5）=================

     ⚠ **这一整段在七份 algos/*.js 里逐字节相同**，check.py 的
     bilingual_algos_check() 会核对。改这里就得七份一起改。
     不抽成共用模块，是因为这些文件是被 inline_core.py 当**字符串**逐份
     内联、再各自求值成 AlgoXxx 全局的 —— 抽出去就凭空多一条求值顺序
     依赖，而那类缺陷要到浏览器里 ALGOS['queens.js'] 是 undefined 才发作
     （阶段 5 建页当天撞过一次）。七份重复 + 一道字节级门，是阶段 7
     king-greedy / king-exact 共用段用过的同一个套路。

     `parts` 的元素只有两种：
       字符串                 —— 一行，两种语言下逐字相同
                                 （代码、空行、// >>> BLANK 指令行）
       { zh: [], en: [] }     —— 一段散文，两边都是**行数组**

     **两边行数必须相等**，不是洁癖：生成的源码是按行索引的 —— 解释器
     每一步记 line，第 4 级提示靠 pristine 与编辑器逐行对齐划出 answerRange，
     判定靠 judge.herSrc 比对。行数一差，切一次语言这四样同时指错地方。
     行数一对齐，轨迹在两种语言下逐字节相同，切语言就只是换掉编辑器里的
     文本，不重跑解释器。

     BLANK 指令行**不翻译**：它本来就同时带着 hint 与 hintEn，两种语言
     变体里那一行逐字相同，parse() 一点不用改。所以它是**字符串**片段。 */
  function render(parts, lang) {
    if (lang === undefined || lang === null) {
      throw new Error(
        'source({ lang }) 少了 lang —— 源码的注释与日志要用哪种语言没有' +
        '默认值，必须写明 "zh" 或 "en"（默认成任何一种，都是让同一个缺陷' +
        '换个地方复活）'
      );
    }
    if (lang !== 'zh' && lang !== 'en') {
      throw new Error('source({ lang }) 的 lang 只认 "zh" 或 "en"，收到：' +
                      JSON.stringify(lang));
    }
    const out = [];
    for (let i = 0; i < parts.length; i = i + 1) {
      const p = parts[i];
      if (typeof p === 'string') { out.push(p); continue; }
      if (!p || !Array.isArray(p.zh) || !Array.isArray(p.en)) {
        throw new Error('第 ' + i + ' 个片段既不是字符串、也不是 ' +
                        '{ zh: [], en: [] }');
      }
      if (p.zh.length !== p.en.length) {
        throw new Error(
          '第 ' + i + ' 个片段两种语言行数不等：zh ' + p.zh.length + ' 行 / en ' +
          p.en.length + ' 行 —— 生成的源码按行索引，行数一差，切一次语言 ' +
          'Step.line / pristine / answerRange / judge.herSrc 同时指错地方' +
          '（规格 §1.6）'
        );
      }
      const lines = p[lang];
      for (let j = 0; j < lines.length; j = j + 1) out.push(lines[j]);
    }
    return out;
  }

  /* 普通字符串拼，不用模板字面量：这段文本本身会被原样贴进 html，
     反引号在那个上下文里比在这里更容易出事（照抄 queens.js 的理由）。
     生成出来的源码里用反引号只是为了在注释里高亮代码片段，比如
     `` `one << 17n` ``——那是注释文字的一部分，不是模板字面量，
     normalizeSource() 会连同它所在的整条注释一起抽掉，不会被当成代码扫。

     元素两种：字符串（代码 / 空行，两语逐字相同）与 `{ zh: [], en: [] }`
     （一段散文，两边行数必须相等）——见上面 render()。这一份**一个挖空
     都没有**，所以没有 BLANK 指令行那一类。
     英文不是逐句直译，是照中文那一版的意思与语气重写的，行数对齐落在
     「段」上：段内句子怎么重组都行，段的行数必须一样。 */
  const HEAD = [
    {
      zh: [
        '/* ============ 位盘 · 一步挪动一整块棋盘 ============',
        '   前面几道题里，棋盘上每一格是数组里单独的一个位置，要看一格就单独',
        '   碰它。这道题换一种表示法：把整块 8×8 的棋盘塞进**一个数**里——64 个',
        '   格子，对应一个数的 64 个二进制位，第 sq 位是 1，就表示第 sq 格上有子。',
        '   这一个数，就是一整块盘。',
        '',
        '   为什么要换：把马「放上去」变成 `1n << BigInt(SQ)`——只挪一次；而',
        '   `one << 17n` 这一下移位，是**64 个位同时跟着挪**，不是一个个循环着搬。',
        '   这正是位盘比「一格一格算」快的全部原因：一次运算顶一整块棋盘。',
        '',
        '   格子编号：sq = r * 8 + c，第 0 行是棋盘最下面那一行，第 0 列最左，',
        '   0 号格就是 a1。 */',
      ],
      en: [
        '/* ============ Bitboards · Moving the Whole Board in One Step ============',
        '   In earlier problems, each square was one separate slot in an array — looking',
        '   at a square meant touching it alone. This problem switches representation:',
        '   the whole 8x8 board fits into **one number** — its 64 bits correspond to the',
        '   64 squares, and bit sq being 1 means square sq holds a piece.',
        '',
        '   Why bother: placing the knight becomes `1n << BigInt(SQ)` — one single shift.',
        '   A shift like `one << 17n` moves **all 64 bits at once**, not one square',
        '   looped at a time — that is the whole reason a bitboard beats "square by square".',
        '',
        '   Square numbering: sq = r * 8 + c, row 0 is the bottom row, column 0 is the',
        '   leftmost column, so square 0 is a1. */',
      ],
    },
    '',
    {
      zh: [
        '/* ⚠ 这道题唯一的坑，也是唯一的收获：移位不认识棋盘的边。',
        '   `one` 只是一个整数，`<<` 只处理它的二进制位——它根本不知道棋盘的边界',
        '   在哪儿。a 线（最左一列）上的马往左移一位，理论上该落到第 -1 位，',
        '   可 BigInt 压根没有「负一位」这种东西。',
        '   真正发生的是**借位**：数值悄没声地从这一行的最左边，跳到了上一行的',
        '   最右边——也就是说，一步之内，马从 a 线滑到了 h 线。',
        '   这一步不会报任何错——算出来的照样是一个合法的数字，',
        '   只是那个数字是错的。',
        '   错得悄无声息，比抛一个异常更难发现。',
        '',
        '   下面四张掩码（NOT_A / NOT_H / NOT_AB / NOT_GH）就是专门堵这个洞的：',
        '   移位**之后**才 & 上去，把「落错了线」的位抹掉——掩码筛的是**落点**，',
        '   不是出发点。想亲眼看看没有它们会怎样：把马拖到 a 线（比如 a4），把',
        '   末尾带 `& NOT_H` 与 `& NOT_GH` 的那四行删掉再跑——幽灵格冒在 g、h 线。 */',
      ],
      en: [
        '/* Warning: this problem has exactly one trap, and it doubles as the one lesson',
        '   — a shift has no idea where the edge of the board is.',
        '   `one` is just an integer, and `<<` only touches its binary digits; it has',
        '   no notion of a board edge at all.',
        '   Shift a knight on the a-file (leftmost column) one step left, and bit 0',
        '   should land on bit "-1" — but BigInt has no such bit. What really happens',
        '   is a **carry**: the value silently wraps from the left edge of one row to',
        '   the right edge of the row above — the knight slides from a-file to h-file.',
        '   No error is raised at all — it is silently wrong, which is worse.',
        '',
        '   The four masks below (NOT_A / NOT_H / NOT_AB / NOT_GH) plug that hole. They',
        '   are applied **after** the shift, wiping bits that landed on a file they had',
        '   no business reaching: a mask filters **destinations**, not origins. To watch',
        '   it fail, put the knight on a4 and delete the four `& NOT_H` / `& NOT_GH`. */',
      ],
    },
    '',
    'const NOT_A  = 0xfefefefefefefefen;',
    'const NOT_AB = 0xfcfcfcfcfcfcfcfcn;',
    'const NOT_H  = 0x7f7f7f7f7f7f7f7fn;',
    'const NOT_GH = 0x3f3f3f3f3f3f3f3fn;',
    '',
    {
      zh: [
        '// FULL 是「64 个 1」，用来把结果钉在棋盘的 64 位范围内——BigInt 完全',
        '// 没有「宽度」这种概念，移位越界不会自动截断，得自己动手钉一下。',
      ],
      en: [
        '// FULL is "64 ones," pinning the result inside the board\'s 64-bit range —',
        '// BigInt has no built-in notion of "width"; an overflowing shift never truncates.',
      ],
    },
    'const FULL = (1n << 64n) - 1n;',
    '',
    {
      zh: [
        '// lowBit(b) 数出 b 最低那个 1 在第几位——从最低位开始一位位挪，挪到',
        '// 摸到 1 为止。只能在 b 不是 0 的时候调用它：0 没有「最低的 1」，这个',
        '// while 会一直挪下去，永远挪不出头——下面唯一调用它的地方，已经用',
        '// while (t !== 0n) 挡住了这种情况。',
      ],
      en: [
        '// lowBit(b) counts which bit position holds b\'s lowest 1 — shifting one bit',
        '// at a time from the bottom until it feels a 1. Only ever call it when b is',
        '// not zero: zero has no "lowest 1," and this while loop would spin forever —',
        '// the one call site below already guards it with while (t !== 0n).',
      ],
    },
    'function lowBit(b) {',
    '  let i = 0;',
    '  let t = b;',
    '  while ((t & 1n) === 0n) { t = t >> 1n; i = i + 1; }',
    '  return i;',
    '}',
  ];

  const BODY = [
    '',
    {
      zh: [
        '// one 就是「把马放上去」之后的那块盘：只有第 SQ 位是 1，其余全是 0。',
        '// atk 用来累加八个方向算出来的攻击格，一开始空空如也。',
      ],
      en: [
        '// one is the board with the knight already placed: only bit SQ is a 1, every',
        '// other bit is 0. atk accumulates the eight directions\' attacks; it starts empty.',
      ],
    },
    'const one = 1n << BigInt(SQ);',
    {
      zh: [
        '// 可是 one 里的那匹马，眼下只是一个二进制位 —— 棋盘上没有任何东西说',
        '// 「马站在这一格」。place 把这件抽象的事摆到真棋盘上：SQ 这一格立刻',
        '// 站上一枚白马，下面标出来的每一个攻击格，才有一个看得见的出发点。',
        '// 位盘算的是位，读者看的是盘，这一行就是这两件事之间的那座桥。',
      ],
      en: [
        '// But the knight inside one is, so far, only a single binary digit — nothing on the',
        '// board says "the knight is standing here". place puts that abstract fact onto the',
        '// real board: a white knight now stands on SQ, so every attacked square marked',
        '// below has a visible origin. Bitboards reason in bits, readers read a board.',
      ],
    },
    'place(SQ, "wN");',
    'let atk = 0n;',
    '',
    {
      zh: [
        '/* addDir(k) 依次试第 k 个方向。八个 if 分支各对应骑士「日」字的一种',
        '   走法——挪多远、往哪个方向挪，决定了该用哪张掩码挡越界（掩码见上）。',
        '   挪完、掩完，b 要么是空的（这个方向没有合法目标），要么正好剩一个',
        '   1（挪到的那一格）。',
        '   下面这段 `while (t !== 0n) { mark(lowBit(t), "ok"); t = t & (t - 1n); }`',
        '   是「一位一位剥出一个位盘里所有 1」的写法：`t & (t - 1n)` 把 t 里',
        '   最低的那个 1 关掉，t 变成 0 就剥完了。',
        '   最后 `addDir(k + 1)` 递归试下一个方向，试完第 7 个、k >= 8，',
        '   就收手。 */',
      ],
      en: [
        '/* addDir(k) tries direction k in turn. Each of the eight if-branches is one',
        '   of the knight\'s L-shaped moves — how far and which way it shifts decides',
        '   which mask guards against wrapping off the board (masks are defined above).',
        '   After shifting and masking, b is either empty (no legal target this way) or',
        '   holds exactly one 1 (the landing square).',
        '   The line `while (t !== 0n) { mark(lowBit(t), "ok"); t = t & (t - 1n); }` is',
        '   how you peel every 1 out of a bitboard one at a time: `t & (t - 1n)` turns',
        '   off t\'s lowest 1, and t reaching zero means the peel is done.',
        '   Finally `addDir(k + 1)` recurses into the next direction, stopping at k >= 8. */',
      ],
    },
    'function addDir(k) {',
    '  if (k >= 8) { return; }',
    '  let b = 0n;',
    '  if (k === 0) { b = (one << 17n) & NOT_A;  }',
    '  if (k === 1) { b = (one << 15n) & NOT_H;  }',
    '  if (k === 2) { b = (one << 10n) & NOT_AB; }',
    '  if (k === 3) { b = (one <<  6n) & NOT_GH; }',
    '  if (k === 4) { b = (one >> 17n) & NOT_H;  }',
    '  if (k === 5) { b = (one >> 15n) & NOT_A;  }',
    '  if (k === 6) { b = (one >> 10n) & NOT_GH; }',
    '  if (k === 7) { b = (one >>  6n) & NOT_AB; }',
    '  b = b & FULL;',
    '  atk = atk | b;',
    '  if (b !== 0n) {',
    '    let t = b;',
    '    while (t !== 0n) {',
    '      mark(lowBit(t), "ok");',
    '      t = t & (t - 1n);',
    '    }',
    '  }',
    '  addDir(k + 1);',
    '}',
    '',
    {
      zh: ['// 从方向 0 开始，把八个方向全试一遍，最后把整块攻击位盘交回去。'],
      en: ['// Starting from direction 0, try all eight, then hand back the whole attack bitboard.'],
    },
    'addDir(0);',
    'return atk;',
  ];

  /* source({ sq, lang }) → string

     sq 与 lang 都不给默认值，缺了直接抛（阶段 5 约束 6：公开导出的省略
     参数已经是本仓库抓到过多次的缺陷类）。马站在哪一格、注释用哪种语言，
     默默变成某个默认值都会让界面看到的和实际跑的对不上。 */
  function source(opts) {
    const o = opts || {};
    if (o.sq === undefined || o.sq === null) {
      throw new Error('source({ sq }) 少了 sq —— 马站在哪一格没有默认值，必须写明');
    }
    const sq = o.sq;
    if (typeof sq !== 'number' || !isFinite(sq) || Math.floor(sq) !== sq ||
        sq < 0 || sq > 63) {
      throw new Error('sq 必须是 0 到 63 之间的整数（8×8 的格子编号），收到：' + sq);
    }
    return render(HEAD, o.lang)
      .concat(['const SQ = ' + sq + ';'])
      .concat(render(BODY, o.lang))
      .join('\n');
  }

  return { source: source };
});
