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
   “一次性大跳跃仍按定长空闲处理”那条断言守着，也是它专门要防的退化。 */
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
