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

   ── 空闲剔除为什么要按新增字符数缩放阈值（对简报的一处偏离，见 report）──
   simplest 版本是“两次 update 之间的间隔一超过 IDLE_PAUSE_MS 就整段按
   IDLE_PAUSE_MS 计”，这在“一次 update 只对应一次按键”的常见情况下是对的。
   但一次 update 也可能带来一大段新输入（比如批量赋值/粘贴式的测试用例），
   这时该次 update 内部实际发生了多次“打字”，用同一个阈值卡死会把一段正常
   的、只是打字慢一点的持续输入误判成“走神后突然爆发”。所以真正比较的是
   “平均每个新字符花了多久”：把阈值按本次新增字符数 n 放大成 IDLE_PAUSE_MS*n
   再和原始 delta 比较——n=1（逐键调用的常规场景）时这就退化成最朴素的版本，
   和 brief 的文字描述完全一致；n>1 时才体现出区别。 */
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

  function create(reference) {
    var refLines = reference.split('\n');
    /* “真实行数”排除仅由结尾换行符切出来的那一个空尾行——lineTimes 只为
       学生实际要打的行计时，参考文本末尾那个 '\n' 之后不存在的“第 N+1 行”
       不该被当成一行来等它“完成”。 */
    var realLineCount = (reference.length > 0 && reference.charAt(reference.length - 1) === '\n')
      ? Math.max(0, refLines.length - 1)
      : refLines.length;

    var session = {
      reference: reference,
      total: reference.length,
      realLineCount: realLineCount,
      firstWrong: null,   /* Set：首次输入时就错了的参考下标，永不移除 */
      seen: null,         /* Set：已经被输入过至少一次的参考下标 */
      backspaces: 0,
      lastTickAt: null,   /* 上一次 update 的时刻；null 表示还没有第一次 */
      firstTickAt: null,  /* 第一次 update 的时刻，作为 lineTimes[0] 的基准 */
      prevTypedLen: 0,    /* 上一次 update 时 typed 的长度，用来算本次新增了几个字符 */
      activeMs: 0,        /* 剔除空闲后的累计用时 */
      lineDone: null      /* number[]：每个真实行首次完成的时刻，未完成为 null */
    };

    function resetState() {
      session.firstWrong = new Set();
      session.seen = new Set();
      session.backspaces = 0;
      session.lastTickAt = null;
      session.firstTickAt = null;
      session.prevTypedLen = 0;
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

    function tick(typed) {
      var now = clock();
      if (session.lastTickAt !== null) {
        var delta = now - session.lastTickAt;
        var grown = typed.length - session.prevTypedLen;
        var n = grown > 0 ? grown : 1;
        var cap = IDLE_PAUSE_MS * n;
        session.activeMs += Math.max(0, Math.min(delta, cap));
      } else {
        session.firstTickAt = now;
      }
      session.lastTickAt = now;
      session.prevTypedLen = typed.length;
      return now;
    }

    function update(typed) {
      var now = tick(typed);
      var rows = alignLines(reference, typed);
      var marks = [];

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var len = row.typedFull.length;
        for (var j = 0; j < len; j++) {
          var index = row.refStart + j;
          var refChar = j < row.refFull.length ? row.refFull.charAt(j) : null;
          var state = (refChar !== null && row.typedFull.charAt(j) === refChar) ? 'ok' : 'bad';
          marks.push({ index: index, state: state });

          if (!session.seen.has(index)) {
            session.seen.add(index);
            if (state === 'bad') { session.firstWrong.add(index); }
          }
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

      return {
        marks: marks,
        stats: {
          correct: correct,
          total: total,
          errors: errors,
          backspaces: session.backspaces,
          elapsedMs: session.activeMs,
          cpm: cpm,
          accuracy: accuracy,
          lineTimes: lineTimes
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
