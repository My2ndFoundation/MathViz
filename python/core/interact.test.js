'use strict';
const T = require('./_test.js');
const PI = require('./interact.js');

/* interact.js 的决策逻辑全部是纯函数，所以这个文件在 node 下就能把它们测完；
   DOM 装配（mount）在 node 下没有 document，只测"它拒绝在没有根节点时装配"
   这一条——真正的 DOM 验收在 T13 Step 5 的浏览器里手工做。 */

const PROGS = [
  { id: 'a', level: 1, kind: 'syntax',  boards: ['AQA'],        lines: 10, requires: [] },
  { id: 'b', level: 3, kind: 'pattern', boards: ['OCR','AQA'],  lines: 40, requires: ['numpy'] },
  { id: 'c', level: 5, kind: 'pattern', boards: ['CIE'],        lines: 90, requires: ['numpy','pandas'] }
];

T.eq(PI.filterPrograms(PROGS, {}).map(p => p.id), ['a','b','c'], '空筛选不筛');
T.eq(PI.filterPrograms(PROGS, { level: [1,3] }).map(p => p.id), ['a','b'], '同一维度内是或');
T.eq(PI.filterPrograms(PROGS, { level: [3,5], kind: ['pattern'], boards: ['CIE'] }).map(p => p.id),
     ['c'], '多个维度是与');
T.eq(PI.filterPrograms(PROGS, { maxLines: 40 }).map(p => p.id), ['a','b'], '长度上限含等号');

T.eq(PI.requirementLine(PROGS[0]), null, '无依赖不显示 pip 行');
T.eq(PI.requirementLine(PROGS[2]), 'pip install numpy pandas', '依赖行按声明顺序');

/* 剪贴板里只有纯源码 —— 这是整套东西存在的理由 */
(function () {
  const prog = { id: 'x', source: 'print(1)\n', requires: ['numpy'] };
  T.eq(PI.copyPayload('read', prog, {}), 'print(1)\n', '读模式复制原程序');
  T.eq(PI.copyPayload('trace', prog, { typed: 'print(2)\n' }), 'print(2)\n', '临摹复制她打的');
  const out = PI.copyPayload('read', prog, {});
  T.ok(out.indexOf('pip install') === -1, 'pip 提示绝不进剪贴板');
})();

/* 分级提示 */
(function () {
  const blank = { level: 3, hint: '中一 · 中二 · 中三', hintEn: 'en1 · en2 · en3' };
  T.ok(PI.hintAt(blank, 1, 'en').length > 0, '第一级有内容');
  T.ok(PI.hintAt(blank, 3, 'zh').indexOf('中三') !== -1, '第三级到底');
  T.eq(PI.hintAt(blank, 9, 'zh'), PI.hintAt(blank, 3, 'zh'), '超过 level 就钳到 level');

  /* 上面三条**都挡不住**"任何 tier 都把整条提示端出去"这一种坏：
     第一条只看长度、第三条两边同样退化成整条。分级的全部意义在于"第一级
     看不到第三级"，所以下面两条才是真正守着它的。 */
  T.eq(PI.hintAt(blank, 1, 'zh'), '中一', '第一级**只**给第一段');
  T.ok(PI.hintAt(blank, 2, 'zh').indexOf('中三') === -1, '第二级看不到第三级');
  T.eq(PI.hintAt(blank, 0, 'zh'), '', '一级都没点开时什么都不给');

  /* 作者没有按分隔符分级时（ch01 的英文提示就有这样的），整条给出去，
     而不是给空串——她点了提示却什么都看不见是更坏的一种"正确"。 */
  const flat = { level: 2, hint: '只有一句话', hintEn: 'just one sentence' };
  T.eq(PI.hintAt(flat, 1, 'zh'), '只有一句话', '没有分隔符时第一级就是整条');
})();

/* 清空范围 */
T.eq(PI.clearScope('program', PROGS, 'b'), ['b'], '单题只给自己');
T.eq(PI.clearScope('module', PROGS, 'b'), ['a','b','c'], '模块级给本页全部');
T.eq(PI.clearScope('all', PROGS, 'b'), null, '整项清空交给 Store.clearAll，不走 id 列表');

/* ==================== 简报清单之外、但同属决策层的三条 ====================
   下面三个也是"DOM 只负责画出来"的那一侧的判断，所以一并抽成纯函数并测。 */

/* ---- 读模式的第一级判断：剥掉指令行，不是裸 source（裁决 R16）---- */
(function () {
  const withBlank = [
    'def f(n):',
    '# >>> BLANK id=body level=1 hint="中一" hintEn="en1"',
    '    return n + 1',
    '# <<< BLANK',
    ''
  ].join('\n');
  const prog = { id: 'y', source: withBlank, requires: [] };

  const read = PI.copyPayload('read', prog, {});
  T.ok(read.indexOf('BLANK') === -1, '读模式复制出去的源码里没有出题标记');
  T.ok(read.indexOf('中一') === -1, '读模式复制出去的源码里没有中文提示');
  T.ok(read.indexOf('return n + 1') !== -1, '挖空体原文照留');
  T.eq(read, 'def f(n):\n    return n + 1\n', '读模式复制的就是 Exercise.clean 的产出');

  T.eq(PI.copyPayload('blank', prog, { answers: { body: '    return n - 1' } }),
       'def f(n):\n    return n - 1\n', '挖空模式复制她填的那一版');
  T.eq(PI.copyPayload('blank', prog, {}),
       'def f(n):\n    return n + 1\n', '一个空都没填时退回原 body');

  T.throws(function () { PI.copyPayload('nope', prog, {}); },
           '未知模式当场抛，不静默复制错东西', /read \/ blank \/ trace/);
})();

/* ---- 变体分组：读模式的并排对照靠它 ---- */
(function () {
  const V = [
    { id: 'max-if',      problem: 'max-of-three' },
    { id: 'hello',       problem: 'greet' },
    { id: 'max-builtin', problem: 'max-of-three' }
  ];
  T.eq(PI.variantsOf(V, V[0]).map(p => p.id), ['max-if','max-builtin'], '同一 problem 的写法聚一组，含自己');
  T.eq(PI.variantsOf(V, V[1]).map(p => p.id), ['hello'], '只有自己时也是一组');

  /* 没有 problem 字段的程序**不能**互相认作变体——naive 的
     `q.problem === p.problem` 会把两个 undefined 判成同一组。 */
  const W = [{ id: 'p' }, { id: 'q' }];
  T.eq(PI.variantsOf(W, W[0]).map(x => x.id), ['p'], '缺 problem 时不与别的缺 problem 程序混成一组');
})();

/* ---- 逐空判定的反馈：消息与光标位置（裁决 R30/R31）---- */
(function () {
  const ok = PI.blankFeedback('total = total + 1', 'total = total + 1', 'zh');
  T.ok(ok.ok, '一模一样就是对的');

  const diff = PI.blankFeedback('total = total - 1', 'total = total + 1', 'zh');
  T.ok(!diff.ok, '差一个运算符就是错的');
  T.eq(diff.kind, 'different', '错法是"某个 token 不同"');
  T.ok(diff.message.indexOf('+') !== -1, '消息点名期待的那个 token');
  T.eq(diff.caret, 'total = total '.length, '光标送到她写错的那个 token 的起点');

  /* kind==='indent' 那一支：index 是**物理行号**、expected/got 是**相对缩进数值**。
     照抄 token 分支（把 index 当 token 下标、把 expected 当字符串）会在这里露馅。 */
  const ind = PI.blankFeedback('for i in r:\nprint(i)', 'for i in r:\n    print(i)', 'zh');
  T.ok(!ind.ok, '缩进不对也算错');
  T.eq(ind.kind, 'indent', '错法是缩进');
  T.ok(ind.message.indexOf('4') !== -1, '缩进消息里带上期待的缩进数');
  T.ok(ind.message.indexOf('第 2 行') !== -1, '缩进消息报的是物理行号（0-based 的 1 → 第 2 行）');
  T.eq(ind.caret, 'for i in r:\n'.length, '缩进错时光标送到那一行行首');

  const miss = PI.blankFeedback('total = total', 'total = total + 1', 'zh');
  T.eq(miss.kind, 'missing', '少写了就是 missing');
  T.eq(miss.caret, 'total = total'.length, '少写时光标落在她写的末尾');

  /* Judge 比的是**行与行之间**的相对缩进，所以单行挖空体少掉开头那四格，
     它是看不见的（两边都只有一行，相对缩进都是 0）——可 Exercise.merge 会把
     她这一份原样贴回源码，粘进 PyCharm 就是 IndentationError。这一条守的
     正是 Judge 结构上观察不到的那个缺口。 */
  const lead = PI.blankFeedback('x = 1', '    x = 1', 'zh');
  T.ok(!lead.ok, '单行挖空体少了开头的缩进，必须算错');
  T.eq(lead.kind, 'lead-indent', '这种错单独一类，不混进 token 那几种');
  T.ok(require('./judge.js').compare('x = 1', '    x = 1').ok,
       '（对照）Judge 自己看不见这种错——所以上面那条不是多余的');
})();

/* ---- 临摹三层的中间层：每个字符一个状态 ---- */
(function () {
  const Trace = require('./trace.js');
  const ref = 'ab\ncd\n';
  const typed = 'ax\ncdX\n';
  const res = Trace.create(ref).update(typed);
  const st = PI.traceStates(ref, typed, res);

  T.eq(st.length, typed.length, '她打的每一个字符都有一个状态，一个不多一个不少');
  T.eq(st[0], 'ok', '第一个字符对了');
  T.eq(st[1], 'bad', '第二个字符打错了');
  T.eq(st[2], 'ok', '行尾换行符对了');
  T.eq(st[5], 'bad', '本行第三个字符与参考的换行符对不上，是 bad');
  T.eq(st[6], 'over', '打超出参考的那个字符是 over，不是 bad');

  /* 对齐是"按行重新对齐"，所以第一行打错一个字符**不会**让第二行整行变红。 */
  T.eq(st.slice(3, 5).join(','), 'ok,ok', '上一行的错不传染到下一行');

  /* ⚠ 上面那组用例里，两侧每一行长度恰好相同，于是"参考偏移"与"她打的偏移"
     处处相等——把 marks[].index（**参考侧**的下标）直接当成 typed 的下标用，
     那一组断言**一条都不会红**。下面这一组两侧行长不同，才真的把这一种错
     暴露出来：ref 第一行 3 个字符、她只打了 2 个，从第二行起两侧偏移就差 1。 */
  const ref2 = 'abc\ndef\n';
  const typed2 = 'ab\ndefX\n';
  const st2 = PI.traceStates(ref2, typed2, Trace.create(ref2).update(typed2));
  T.eq(st2.length, typed2.length, '状态数仍然逐字符对齐她打的文本');
  T.eq(st2[2], 'bad', '第一行少打一个字符：换行位置对不上参考的 c');
  T.eq(st2.slice(3, 6).join(','), 'ok,ok,ok', 'def 三个字符是对的（拿参考偏移去标就会错位）');
  T.eq(st2[6], 'bad', '多出来的 X 撞上参考的换行符，是 bad');
  T.eq(st2[7], 'over', '再往后的字符没有参考位置可占，是 over');
})();

/* ---- mount 在没有 DOM 的地方必须响亮地拒绝 ---- */
T.throws(function () { PI.mount({ programs: PROGS }); },
         'mount 没有根节点时当场抛，不静默什么都不做', /root/);

T.report('interact');
