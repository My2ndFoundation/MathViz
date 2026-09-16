'use strict';
/* trace —— 影子临摹引擎。「影子临摹」把标准程序垫在最底层，透明度从 100% 调到 0%，
   学生跟着打字练习；这个模块只做逐字符比对 + 统计，不碰 DOM。

   ── 核心判断一：以行为同步单位，行内按位置对齐 ──────────────────────────
   如果把 typed 和 reference 当成两条不分行的字符流做全局位置比较，一旦某一行
   少打（或多打）一个字符，从那个位置起，后面的每一行都会与参考错位——本该
   全对的第二行、第三行会被第一行的一次疏漏拖累，通篇变红。
   这里改成：先按 '\n' 把两边都切成行（alignLines），再在每一对行内部按位置
   逐字符比较。每到一行的行首，对齐关系重新开始——这一行的错误不会传染到
   下一行。换行符本身也占一个可比较的位置：把它显式追加在“行内容”末尾一起
   比较，才能覆盖“提前按了回车”这类错误（该打字符时打了换行）。

   ── 核心判断二：正确率按「首次输入即正确」算 ────────────────────────────
   临摹练习要测的是“会不会一次打对”，不是“最终有没有改对”。所以内部维护一个
   firstWrong 集合，记录“第一次被输入到（不管对错）时就是错的”那些参考位置；
   一旦某个位置进了这个集合，之后哪怕改对了也不移除。配合 seen 集合（记录
   “这个位置是否已经被输入过一次”）保证 firstWrong 只在“第一次出现”那一刻
   写入，不会被后续的编辑重新判定。返回给 UI 的 marks[].state 则是“当前”对
   错（供实时着色用），两者刻意分开：一个报当下，一个记历史。

   ── 时钟必须外部注入 ────────────────────────────────────────────────────
   统计（cpm / 空闲剔除）全部依赖“现在几点”，读真实时间的模块没法测——而这
   恰恰是最容易悄悄算错的一类逻辑。Trace._useClock(fn) 是测试注入口，默认
   Date.now。本模块零依赖，factory() 无参是对的，不为了“看起来统一”造一个
   用不上的参数。

   ── 空闲剔除是定长规则，不按新增字符数缩放（裁决 R34）────────────────────
   第一版实现在这里按“本次新增字符数 n”把阈值放大成 IDLE_PAUSE_MS*n，理由是
   brief 原来给的 cpm 用例把 11 个新字符一次性塞进一次 update()，与定长规则
   算出的 72 cpm 对不上、只有按 n 缩放才能凑出 brief 要的 12 cpm。这个矛盾
   本身是真的（两个用例的裸 delta 都是 60000，却要求相反的处理），但矛盾的
   根源是那条 cpm 用例本身不真实——真实使用中 update() 是按键驱动的，一次
   对应一个字符，delta 就是击键间隔。按 n 缩放能让不真实的用例通过，代价是
   在真实场景里出问题：学生粘贴一大段文本（或任何一次 update 挟带很多新
   字符）时，n 很大，阈值被放得很宽，一段真实的长时间走神会被整段算进
   activeMs——统计是要给学生本人看的，一个把走神算进“打字速度”的数字，比
   没有数字更糟。所以裁决是反过来：**规则维持定长，把不真实的用例换成逐键
   模拟**（每次 update 只新增一个字符，delta 就是那次按键的间隔）。定长规则
   下，“一次 update 里挤进很多新字符、且距上次 update 隔了很久”这种情况会被
   正确地按空闲封顶，不会因为字符多就豁免——这一点由下面测试里的
   “一次性大跳跃仍按定长空闲处理”那条断言守着，也是它专门要防的退化。

   ── Critical：溢出字符不能抢占下一行的下标（裁决 R38）──────────────────
   上一版行内比较循环的上界取的是“打出来那一行”的长度（typedFull.length），
   不是“参考那一行”的长度（refFull.length）。一行被打超长时，多出来的字符
   会继续沿用 refStart+j 往后编号，而 refStart+row.refFull.length 恰好就是
   下一行的 refStart——于是溢出字符的下标撞进了下一行的地盘：下一行本该
   记一次“ok”的位置，会被溢出字符先占（先到先得的 seen 集合一旦写入就不再
   清空），永久记成错误；参考文本很短时甚至会把 index 推到 total 以外，
   errors 也能超过 total、accuracy 变成负数——直接违反“index 是 reference
   全文偏移”和“accuracy ∈ [0,1]”这两条契约。
   修法：行内比较的上界必须是 Math.min(typedFull.length, refFull.length)，
   不能只检查“index < total”（同一份复现里 index < total 依然成立，照样
   污染了下一行，说明这个更宽松的检查不够）。溢出出来的那部分字符不产出
   带 reference 下标的 mark，也不进 seen/firstWrong；但学生确实多打了，
   UI 需要能标红，所以单独开一个 `overflow` 数组承载
   `{ line, col }`（col 是这些字符在 typedFull 里的位置，不是 reference
   偏移——它们根本没有对应的 reference 偏移）。
   `errors <= total`、`accuracy ∈ [0,1]`、marks 的 index 全部 `< total`
   这三条不变量现在靠“上界永远不超过 refFull.length”这一处保证；测试里
   专门用退化用例（一整行的参考只有两个字符、却打了六个）验证过。

   ── Important：行数不匹配是诚实的错位，不做 LCS 对齐（裁决 R39）────────
   如果学生多打/少打了一个换行，从那一行起，按行下标配对的结果确实会
   “整体错位”——但这正是应该发生的：参考就垫在她下面，她自己也会看到画面
   整体错位了，如实报告错位比用 LCS 之类的算法“宽恕”那一行更符合“一字不差
   地临摹”这个练习的目的。所以这里刻意不引入最长公共子序列对齐，行还是按
   下标一一配对。唯一要补的是一个信号，让 UI 能对学生说清楚“不是你后面每个
   字都打错了，是你比参考多/少了一行”：`stats.lineDelta` =
   “本次 typed 的真实行数” − “reference 的真实行数”（真实行数的定义跟
   session.realLineCount 一致，见 realLineCountOf；用真实行数而不是裸的
   split 长度，是因为只要 typed 恰好以 '\n' 结尾就会在裸长度上多出一个
   空尾行，两边都用同一条“去掉纯粹由结尾换行切出的空尾行”的规则才不会被这
   个人为噪声干扰）。正号＝比参考多行，负号＝比参考少行（含相邻两行被误
   合并成一行的情况）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Trace = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var IDLE_PAUSE_MS = 10000;

  /* 时钟注入口，默认真实时间；测试用 _useClock 换成可控的假时钟。 */
  var clock = function () { return Date.now(); };
  function _useClock(fn) { clock = fn; }

  /* 按 '\n' 把 reference / typed 都切成行，逐行配对。
     行数以 reference 为准（reference.split('\n').length）——它是练习的固定骨架；
     typed 缺的行按空字符串补齐，多出来的行（typed 比 reference 长）直接忽略，
     因为参考文本里没有对应位置可以安放它们的下标。
     每一项除了原始行内容，还带上 refFull / typedFull：把“这一行是否有后续
     换行符”折算成末尾追加的 '\n'，换行符本身因此成为一个可参与逐字符比较的
     位置——这正是“提前按回车”被判错、以及行内比较不会越界污染下一行的关键。 */
  function alignLines(reference, typed) {
    var refLines = reference.split('\n');
    var typedLines = typed.split('\n');
    var rows = [];
    var pos = 0;
    for (var i = 0; i < refLines.length; i++) {
      var refLine = refLines[i];
      var refHasNL = i < refLines.length - 1;
      var typedLine = i < typedLines.length ? typedLines[i] : '';
      var typedHasNL = i < typedLines.length - 1;
      rows.push({
        refLine: refLine,
        typedLine: typedLine,
        refStart: pos,
        refFull: refLine + (refHasNL ? '\n' : ''),
        typedFull: typedLine + (typedHasNL ? '\n' : '')
      });
      pos += refLine.length + (refHasNL ? 1 : 0);
    }
    return rows;
  }

  /* “真实行数”排除仅由结尾换行符切出来的那一个空尾行——lineTimes 只为
     学生实际要打的行计时，参考文本末尾那个 '\n' 之后不存在的“第 N+1 行”
     不该被当成一行来等它“完成”；lineDelta（裁决 R39）也用同一条规则算
     reference 和 typed 双方的行数，两边规则一致，才不会被“typed 恰好也以
     '\n' 结尾”这种表面噪声干扰。 */
  function realLineCountOf(text) {
    var lines = text.split('\n');
    return (text.length > 0 && text.charAt(text.length - 1) === '\n')
      ? Math.max(0, lines.length - 1)
      : lines.length;
  }

  function create(reference) {
    var realLineCount = realLineCountOf(reference);

    var session = {
      reference: reference,
      total: reference.length,
      realLineCount: realLineCount,
      firstWrong: null,   /* Set：首次输入时就错了的参考下标，永不移除 */
      seen: null,         /* Set：已经被输入过至少一次的参考下标 */
      backspaces: 0,
      lastTickAt: null,   /* 上一次 update 的时刻；null 表示还没有第一次 */
      firstTickAt: null,  /* 第一次 update 的时刻，作为 lineTimes[0] 的基准 */
      activeMs: 0,        /* 剔除空闲后的累计用时 */
      lineDone: null      /* number[]：每个真实行首次完成的时刻，未完成为 null */
    };

    function resetState() {
      session.firstWrong = new Set();
      session.seen = new Set();
      session.backspaces = 0;
      session.lastTickAt = null;
      session.firstTickAt = null;
      session.activeMs = 0;
      session.lineDone = new Array(session.realLineCount).fill(null);
    }
    resetState();

    function noteBackspace() {
      session.backspaces++;
    }

    function reset() {
      resetState();
    }

    function tick() {
      var now = clock();
      if (session.lastTickAt !== null) {
        var delta = now - session.lastTickAt;
        /* 定长规则：超过 IDLE_PAUSE_MS 的那一段只记 IDLE_PAUSE_MS，不管这次
           update() 里挟带了多少新字符——不能因为一次性打字/粘贴的字符多，
           就把走神的时间也算成有效时间（裁决 R34）。 */
        session.activeMs += Math.max(0, Math.min(delta, IDLE_PAUSE_MS));
      } else {
        session.firstTickAt = now;
      }
      session.lastTickAt = now;
      return now;
    }

    function update(typed) {
      var now = tick();
      var rows = alignLines(reference, typed);
      var marks = [];
      var overflow = [];

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        /* 上界必须是 refFull.length，不能是 typedFull.length（裁决 R38）：
           这一行打超长时，超出参考长度的那部分字符没有对应的 reference
           偏移，绝不能继续沿用 refStart+j 编号——那会一路撞进下一行的
           下标空间。 */
        var matchLen = Math.min(row.typedFull.length, row.refFull.length);
        for (var j = 0; j < matchLen; j++) {
          var index = row.refStart + j;
          var state = (row.typedFull.charAt(j) === row.refFull.charAt(j)) ? 'ok' : 'bad';
          marks.push({ index: index, state: state });

          if (!session.seen.has(index)) {
            session.seen.add(index);
            if (state === 'bad') { session.firstWrong.add(index); }
          }
        }
        /* 溢出的字符单独收集，不占用任何 reference 偏移、不进 seen/firstWrong，
           UI 仍可以用 line/col 把它们标红。 */
        for (var j2 = matchLen; j2 < row.typedFull.length; j2++) {
          overflow.push({ line: i, col: j2 });
        }

        /* 某一真实行首次被完整、正确地打出来时，记下完成时刻（只记第一次）。 */
        if (i < session.realLineCount && session.lineDone[i] === null &&
            row.typedFull === row.refFull) {
          session.lineDone[i] = now;
        }
      }

      var correct = 0;
      for (var k = 0; k < marks.length; k++) {
        if (marks[k].state === 'ok') { correct++; }
      }

      var lineTimes = [];
      for (var li = 0; li < session.realLineCount; li++) {
        if (session.lineDone[li] === null) { break; }
        var prevDone = li === 0 ? session.firstTickAt : session.lineDone[li - 1];
        lineTimes.push(session.lineDone[li] - prevDone);
      }

      var total = session.total;
      var errors = session.firstWrong.size;
      var accuracy = total > 0 ? (total - errors) / total : 1;
      /* activeMs 为 0 时直接返回 0，绝不产出 Infinity（0/0 或 x/0）。 */
      var cpm = session.activeMs > 0 ? correct / (session.activeMs / 60000) : 0;
      /* 正号＝typed 比 reference 多行，负号＝少行（含误把两行合并成一行）；
         两边都用 realLineCountOf，排除各自末尾那个纯粹由结尾换行切出的
         空行，避免“typed 恰好也以 \n 结尾”这类表面噪声（裁决 R39）。 */
      var lineDelta = realLineCountOf(typed) - session.realLineCount;

      return {
        marks: marks,
        overflow: overflow,
        stats: {
          correct: correct,
          total: total,
          errors: errors,
          backspaces: session.backspaces,
          elapsedMs: session.activeMs,
          cpm: cpm,
          accuracy: accuracy,
          lineTimes: lineTimes,
          lineDelta: lineDelta
        }
      };
    }

    return {
      update: update,
      noteBackspace: noteBackspace,
      reset: reset
    };
  }

  return {
    create: create,
    alignLines: alignLines,
    IDLE_PAUSE_MS: IDLE_PAUSE_MS,
    _useClock: _useClock
  };
});
