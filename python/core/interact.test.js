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

/* 分级提示：唯一的分级标记是 ' || '（第 1 期设计 B1） */
(function () {
  const blank = { level: 3, hint: '中一 || 中二 || 中三', hintEn: 'en1 || en2 || en3' };
  T.ok(PI.hintAt(blank, 1, 'en').length > 0, '第一级有内容');
  T.ok(PI.hintAt(blank, 3, 'zh').indexOf('中三') !== -1, '第三级到底');
  T.eq(PI.hintAt(blank, 9, 'zh'), PI.hintAt(blank, 3, 'zh'), '超过 level 就钳到 level');

  /* 上面三条**都挡不住**"任何 tier 都把整条提示端出去"这一种坏：第一条只看长度、
     第三条两边同样退化成整条。分级的全部意义在于"第一级看不到第三级"。 */
  T.eq(PI.hintAt(blank, 1, 'zh'), '中一', '第一级**只**给第一段');
  T.ok(PI.hintAt(blank, 2, 'zh').indexOf('中三') === -1, '第二级看不到第三级');
  T.eq(PI.hintAt(blank, 0, 'zh'), '', '一级都没点开时什么都不给');
  T.eq(PI.hintAt(blank, 2, 'zh'), '中一 · 中二', '展开的几级用 · 连接——源码里的 || 是出题标记，不给她看');
  T.eq(PI.HINT_MARK, ' || ', '导出的分级标记');

  /* 旧的三分隔符链（' · ' / '；' / '; '）从此是普通标点。下面三条在旧实现下都会红：
     旧 hintAt 会把 level=1 的提示按标点切开、只给前半句——后半句被静默截掉。 */
  const semi = { level: 1, hint: '先拆 rest；再拆 total', hintEn: 'cut rest; then total' };
  T.eq(PI.hintAt(semi, 1, 'zh'), '先拆 rest；再拆 total', '「；」是标点，不是分级');
  T.eq(PI.hintAt(semi, 1, 'en'), 'cut rest; then total', '「; 」是标点，不是分级');
  const dot = { level: 1, hint: 'a · b', hintEn: 'a · b' };
  T.eq(PI.hintAt(dot, 1, 'en'), 'a · b', '「 · 」也不再是分级');

  /* 作者没有按标记分级时，整条给出去，而不是给空串。这是 hintAt 的**兜底**，不是
     允许的数据形状：blank_directive_check 要求段数 == level。 */
  const flat = { level: 2, hint: '只有一句话', hintEn: 'just one sentence' };
  T.eq(PI.hintAt(flat, 1, 'zh'), '只有一句话', '没有标记时第一级就是整条');
})();

/* 面板行注的模式白名单 —— 三个模式都要点到名 */
(function () {
  const notes = [
    { at: '    seconds = rest % 60', zh: '…', en: '…' },
    { at: '    return hours, minutes, seconds', zh: '…', en: '…' }
  ];
  const prog = { id: 'divmod-and-floor', lineNotes: notes };

  T.eq(PI.panelLineNotes(prog, 'read'), notes, '读模式：行注照给');

  /* 挖空模式：面板把 note.at 的整行原文逐字打出来，而锚可以落在挖空体里。 */
  T.eq(PI.panelLineNotes(prog, 'blank'), [], '挖空模式：一条都不给');

  /* 临摹模式：与上一条**对称**，而且不是"顺手也挡一下"。临摹有 alphaBlind 档
     （S.alpha = 0，影子层全透明，她凭记忆敲）——那一档下右侧面板照样印着整行
     原文，泄的是同一件事，只换了个模式。
     这一条是这个文件里唯一会因为把判据写回 `!== 'blank'` 而变红的断言。 */
  T.eq(PI.panelLineNotes(prog, 'trace'), [], '临摹模式：一条都不给（盲打档下同样是泄题）');

  /* 白名单而不是黑名单：没见过的模式默认**不**给。黑名单在加第四个模式时
     会默认放行，而"默认放行"正是这个洞的形状。 */
  T.eq(PI.panelLineNotes(prog, 'whatever'), [], '未知模式：默认不给');

  T.eq(PI.panelLineNotes({ id: 'x' }, 'read'), [], '没有 lineNotes 的程序：空数组，不是 undefined');
  T.eq(PI.panelLineNotes(null, 'read'), [], '没有当前程序：空数组，不抛');
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

/* ==================== 评审修复轮 1：①②③ 各自的断言 ==================== */

/* ---- ① 一次 run 只有一个 Trace session；接着草稿打的那一遍不计成绩 ---- */
(function () {
  const Trace = require('./trace.js');
  const ref = 'total = 0\nfor c in s:\n    total += 1\n';

  /* 对照断言（先证明"被守着的那个坏"真的存在）：
     连续会话记得住"她打错过一次"，而把同样的终文本一次喂进新 session 记不住。
     这正是"模式切一圈就刷出 100%"的机制。 */
  const live = Trace.create(ref);
  let buf = '';
  const type = (s) => { buf += s; return live.update(buf); };
  type('total = 0\nfor c in s:\n    total += 2');
  live.noteBackspace(); buf = buf.slice(0, -1);
  const a = type('1\n').stats;
  const fresh = Trace.create(ref).update(buf).stats;
  T.eq(buf, ref, '（前提）两边喂的终文本逐字节相同');
  T.eq(a.errors, 1, '（对照）连续会话记得住那一次打错');
  T.eq(fresh.errors, 0, '（对照）新建 session 一次喂完，错误史被洗光——所以 run 必须跨模式存活');

  /* 跨模式切换必须复用同一个 run */
  const run = PI.newRun('p1', ref, '');
  T.ok(PI.reuseRun(run, 'p1', ref), '同一题同一份参考：run 复用，不重建 session');
  T.ok(!PI.reuseRun(run, 'p2', ref), '换了题就不能复用');
  T.ok(!PI.reuseRun(run, 'p1', ref + '\n'), '参考变了就不能复用');
  T.ok(!PI.reuseRun(null, 'p1', ref), '还没有 run 时当然不能复用');

  /* 从草稿接着打的那一遍：标记 resumed，且不写 progress */
  T.eq(PI.newRun('p1', ref, '').resumed, false, '从零开始的 run 不是 resumed');
  T.eq(PI.newRun('p1', ref, 'total = 0\n').resumed, true, '带着草稿起的 run 是 resumed');

  const done = { total: 10, correct: 10 };
  T.ok(PI.shouldSaveBest(PI.newRun('p1', ref, ''), done), '干净地打完了：成绩算数');
  T.ok(!PI.shouldSaveBest(PI.newRun('p1', ref, 'x'), done),
       '接着草稿打完的：**不写进 progress**（bestAcc 走 Math.max 且熬得过清空）');
  T.ok(!PI.shouldSaveBest(PI.newRun('p1', ref, ''), { total: 10, correct: 9 }), '没打完不算');
  T.ok(!PI.shouldSaveBest(PI.newRun('p1', ref, ''), { total: 0, correct: 0 }), '空参考不算');
  const once = PI.newRun('p1', ref, '');
  once.saved = true;
  T.ok(!PI.shouldSaveBest(once, done), '同一遍只记一次，不重复落盘');
})();

/* ---- ② 清空必须先 flush，否则排队中的防抖写会让草稿自己回来 ---- */
(function () {
  const Store = require('./store.js');
  function fakeStorage() {
    const m = Object.create(null);
    return {
      getItem: (k) => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: (k) => { delete m[k]; },
      key: (i) => Object.keys(m)[i] === undefined ? null : Object.keys(m)[i],
      get length() { return Object.keys(m).length; }
    };
  }

  /* 对照：Store 的 cancelPending 只被 setDraft/scheduleDraft 调用，**清空不取消
     排队中的那次写**。这里用 flush() 代替"400ms 定时器到期"——两条路径走的是
     同一句 writeKey，可观察的结果相同，而测试不必真睡 400 毫秒。 */
  Store._useStorage(fakeStorage());
  Store.scheduleDraft('p', 'trace', 'X');
  Store.clearProgram('p');
  T.eq(Store.getDraft('p', 'trace'), null, '清空的那一刻确实看不见了');
  Store.flush();
  T.eq(Store.getDraft('p', 'trace'), 'X',
       '（对照）没先 flush 的话，排队中的那次写会把草稿送回来——UI 已经说"已清空"');

  /* 正确顺序：先 flush 再清空。之后再 flush 也回不来（队列里已经没有东西了）。 */
  Store._useStorage(fakeStorage());
  Store.scheduleDraft('p', 'trace', 'X');
  Store.flush();
  Store.clearProgram('p');
  Store.flush();
  T.eq(Store.getDraft('p', 'trace'), null, '先 flush 再清空：草稿不会复活');

  /* 次序本身也要测，不能只测"Store 有这个毛病"：clearRecords 收一个 store
     形状的对象，正是为了在这里把调用顺序钉死。 */
  function recorder() {
    const calls = [];
    return {
      calls: calls,
      flush: () => calls.push('flush'),
      clearAll: () => calls.push('clearAll'),
      clearProgram: (id) => calls.push('clearProgram:' + id),
      clearMany: (ids) => calls.push('clearMany:' + ids.join(','))
    };
  }
  let r = recorder();
  PI.clearRecords(r, 'program', ['b']);
  T.eq(r.calls, ['flush', 'clearProgram:b'], '单题：flush 排在清之前');
  r = recorder();
  PI.clearRecords(r, 'module', ['a', 'b']);
  T.eq(r.calls, ['flush', 'clearMany:a,b'], '模块：flush 排在清之前');
  r = recorder();
  PI.clearRecords(r, 'all', null);
  T.eq(r.calls, ['flush', 'clearAll'], '整项：flush 排在 clearAll 之前');

  /* 真跑一遍：排着一次防抖写的时候调 clearRecords，草稿必须清掉且不复活 */
  Store._useStorage(fakeStorage());
  Store.scheduleDraft('p', 'trace', 'X');
  PI.clearRecords(Store, 'program', ['p']);
  Store.flush();
  T.eq(Store.getDraft('p', 'trace'), null, 'clearRecords 走完，排队里的写也不会把草稿送回来');
  Store._useStorage(null);
})();

/* ---- ③ 硬拦截的两个决策函数（原先锁在 mount 闭包里，取不到也测不到）---- */
(function () {
  const ref = 'for c in s:\n    total += 1\nprint(total)';

  /* expectedCharAt：三条边界正是最容易写错的地方 */
  T.eq(PI.expectedCharAt(ref, 'f', 0), 'f', '行内正常一格');
  T.eq(PI.expectedCharAt(ref, 'for c in s:', 11 - 1), ':', '行尾最后一个字符');
  T.eq(PI.expectedCharAt(ref, 'for c in s:X', 11), '\n', '本行打满了、后面还有行 → 期待换行符');
  T.eq(PI.expectedCharAt(ref, ref + 'X', ref.length), null,
       '参考最后一行之后没有换行符可打 → null，不是空串');
  T.eq(PI.expectedCharAt(ref, 'a\nb\nc\nd', 6), null, '整行超出参考行数 → null');

  T.ok(PI.charMatches(ref, 'f', 0), '打对了就放行');
  T.ok(!PI.charMatches(ref, 'X', 0), '打错了就拦');
  T.ok(!PI.charMatches(ref, ref + 'X', ref.length), '参考没有内容的地方一律拦');

  /* ④ 的那个死角：她在第 2 行按了回车，applyEnter 把 4 格缩进带到了第 3 行，
     而参考第 3 行顶格。从此她在第 3 行打的**每一个字符**都对不上参考的同一列，
     硬拦截档会把它们全部拒掉，而屏幕上原本什么都不说。
     offset 27 = 第 3 行第 1 格（她打的是那 4 个空格里的第一个）。 */
  const short = 'for c in s:\n    total += 1\nx = 1';
  const typed = 'for c in s:\n    total += 1\n    x = 1';  // 她多带了 4 格缩进
  T.eq(typed.charAt(27), ' ', '（前提）第 27 格正是被自动缩进带进来的那个空格');
  T.eq(PI.expectedCharAt(short, typed, 27), 'x', '参考那一格是顶格的 x');
  T.ok(!PI.charMatches(short, typed, 27), '多出来的缩进让她打什么都被拦——这就是那个死角');
  T.ok(PI.blockedHint(short, typed, 27, 'zh').length > 8, '拒绝必须有一句能读的说明，不能是空字符串');

  /* 真实时序：那 4 格缩进是 applyEnter **程序化**插进去的（不经过 beforeinput），
     所以第一次被拒的按键落在缩进之后 —— offset 31 的 'x'，col = 4。
     这一格之前整行都是空格、且比参考深，就直接说多了几格、按几次退格，
     而不是让她自己去数"第 1 格应该是 x"。 */
  T.eq(typed.charAt(31), 'x', '（前提）第 31 格是她在缩进之后打的第一个字符');
  T.ok(!PI.charMatches(short, typed, 31), '缩进之后第一个字符同样被拦');
  T.ok(PI.blockedHint(short, typed, 31, 'zh').indexOf('多了 4 格') !== -1,
       '缩进过深时直接说多了几格');
  T.ok(PI.blockedHint(short, typed, 31, 'zh').indexOf('退格') !== -1, '并指出按退格这条出路');
  /* 光标之前不全是空格时，走的是"第几行第几格应该是什么"那一支 */
  T.ok(PI.blockedHint(ref, 'for X', 4, 'zh').indexOf('第 1 行') !== -1,
       '行内普通打错仍然报行号与列号');
  T.ok(PI.blockedHint(ref, 'for c in s:X', 11, 'zh').indexOf('换行') !== -1,
       '该换行的时候要说"该换行了"');
  T.ok(PI.blockedHint(ref, ref + 'X', ref.length, 'zh').indexOf('退格') !== -1,
       '超出参考末尾时要告诉她按退格——否则整个键盘看上去就是不响了');

  /* "整行都在参考之外"是另一条分支（refLines[line] === undefined），
     上面那条走的是"本行打超长"。负控制抓到过这个覆盖缺口：改坏这一支时
     上面几条断言一条都不红。 */
  const two = 'a\nb';
  T.eq(PI.expectedCharAt(two, 'a\nb\nc', 4), null, '第 3 行整行不在参考里 → null');
  T.ok(PI.blockedHint(two, 'a\nb\nc', 4, 'zh').indexOf('只有 2 行') !== -1,
       '整行超出时要说清参考一共几行');
  T.ok(PI.blockedHint(two, 'a\nb\nc', 4, 'zh').indexOf('退格') !== -1,
       '整行超出时同样要指出退格这条出路');
  T.ok(PI.blockedHint(ref, 'f', 0, 'en').indexOf('line 1') !== -1, '英文档也要说得出行号');

  /* applyFollowEnter：跳到参考下一行的缩进位 */
  const r1 = PI.applyFollowEnter(ref, 'for c in s:', 11);
  T.eq(r1.value, 'for c in s:\n    ', '跳到参考第 2 行的 4 格缩进');
  T.eq(r1.selStart, 16, '光标落在缩进之后');
  T.eq(r1.selEnd, r1.selStart, 'selEnd 恒等于 selStart（与 applyTab/applyEnter 同形）');
  const r2 = PI.applyFollowEnter(ref, ref, ref.length);
  T.eq(r2.value, ref + '\n', '参考已经到底：不猜缩进，只换行');
})();

/* ============ 修复轮 2：修复本身引入的两个缺陷，两侧各自钉住 ============
   两条都是"只在某一侧才发生"的失败——留在原地 / 清当前这一题，永远看不见。 */

/* ---- 新缺陷 ① 延时回调在 UI 已经拆掉之后醒来 ---- */
(function () {
  function fakeUi() {
    const removed = [];
    return {
      removed: removed,
      input: { classList: { remove: (c) => removed.push(c), add: () => {} } },
      blockNote: { hidden: false }
    };
  }

  /* 一侧：她留在原地，回调正常执行——红边撤掉、说明收起 */
  const ui = fakeUi();
  PI.clearFlash(ui);
  T.eq(ui.removed, ['py-blocked'], '留在原地时：回调真的把红边撤掉了');
  T.eq(ui.blockNote.hidden, true, '留在原地时：说明也收起来了');

  /* 另一侧：1.6 秒之内她切走了模式 / 换了程序，renderStage 已经把 traceUI 置空。
     回调此刻醒来**必须安全返回**，而不是抛一个未捕获的 TypeError。 */
  /* 每一次调用都包在 safe() 里：守卫被拿掉时这些调用会**抛**，不包的话
     整个文件当场崩在这里，T.report 根本跑不到——负控制看上去"红了"，
     却一条失败标签都打不出来（第一版就是这样，改回来了）。 */
  function safe(fn) { try { fn(); return true; } catch (e) { return false; } }
  T.ok(safe(() => PI.clearFlash(null)), 'UI 已经拆掉（null）时回调必须安全返回');
  T.ok(safe(() => PI.clearFlash(undefined)), 'undefined 同样安全');

  /* 半拆的残壳（只剩 blockNote，input 已经没了）：既不许抛，也不许"顺手清一半" */
  const shell = { blockNote: { hidden: false } };
  T.ok(safe(() => PI.clearFlash(shell)), '半拆状态（没有 input）同样安全');
  T.eq(shell.blockNote.hidden, false, '残壳上什么都不做，不是"顺手清一半"');
})();

/* ---- 新缺陷 ② 清别人的草稿，不许动她自己这一遍 ---- */
(function () {
  /* 一侧：清的就是当前这一题 → 该重置（草稿没了，下一遍要从零重新算） */
  T.ok(PI.clearHitsCurrent(['b'], 'b'), '单题清空清的正是当前这一题：命中');
  T.ok(PI.clearHitsCurrent(['a', 'b', 'c'], 'b'), '模块清空包含当前这一题：命中');
  T.ok(PI.clearHitsCurrent(null, 'b'), '整项清空（ids 为 null）一定包含当前这一题');

  /* 另一侧：清的是别人 → 不许动。这正是回归本身：她正临摹 A、顺手清掉 B，
     若照样重置，一遍从未被打断的临摹会被标成 resumed，成绩不计。 */
  T.ok(!PI.clearHitsCurrent(['b'], 'a'), '清的是别的程序：不命中，当前这一遍不受影响');
  T.ok(!PI.clearHitsCurrent(['b', 'c'], 'a'), '清的是别的几个程序：同样不命中');
  T.ok(!PI.clearHitsCurrent([], 'a'), '空 id 列表不命中');
  T.ok(!PI.clearHitsCurrent(['a'], null), '还没有当前程序时谈不上命中');

  /* 与 clearScope 串起来看：清别的程序时，run 不该被作废 */
  const PROGS2 = [{ id: 'a' }, { id: 'b' }];
  T.ok(!PI.clearHitsCurrent(PI.clearScope('program', PROGS2, 'b'), 'a'),
       '「⋯ → 清空本题」点在别人身上时，当前这一遍不作废');
  T.ok(PI.clearHitsCurrent(PI.clearScope('module', PROGS2, 'b'), 'a'),
       '模块清空扫到了她，那就该作废');
})();

/* ---- mount 在没有 DOM 的地方必须响亮地拒绝 ---- */
T.throws(function () { PI.mount({ programs: PROGS }); },
         'mount 没有根节点时当场抛，不静默什么都不做', /root/);

/* token 类型 × 配色（第 1 期设计 B2）：每个类型要么有 .tok-<type> 规则，要么在
   显式的不上色名单里。第 0 期 decorator 这个类型是专为高亮合成的（CPython 没有它），
   R14 整套裁决都为它服务——而它没有任何 CSS 规则，@property / @dataclass 一直是白字。 */
(function () {
  const PyLex = require('./py-lex.js');
  const CORPUS = [
    '@dataclass\nclass P:\n    x: int = 0\n',
    '@property\ndef area(self) -> float:\n    return self.w * self.h  # note\n',
    'm = a @ b\n',
    's = f"{name!r:>10}" + r"\\d" + b"x" + """doc"""\n',
    'n = 0x1f + 1_000 + 1.5j\n',
    'match cmd:\n    case "go":\n        pass\n    case _:\n        print(len(cmd))\n',
    'total = a \\\n    + b\n',
    'if (y := 3):\n    z = [i for i in range(y)]\n'
  ].join('');
  const UNCOLORED = {
    ws: '空白：透出底色即可',
    nl: '换行：不可见'
  };

  T.ok(Array.isArray(PyLex.TYPES) && PyLex.TYPES.length > 0, 'PyLex.TYPES 是非空数组');
  const types = Array.isArray(PyLex.TYPES) ? PyLex.TYPES : [];
  const seen = {};
  PyLex.tokenize(CORPUS).forEach(function (tk) { seen[tk.type] = true; });
  Object.keys(seen).forEach(function (ty) {
    T.ok(types.indexOf(ty) !== -1, '词法器吐出的类型 ' + ty + ' 登记在 PyLex.TYPES 里');
  });
  T.ok(seen.decorator === true, '语料里真的切出了 decorator（否则下面对它的断言无话可说）');

  const styled = {};
  /* 先剥掉 CSS 注释：字符串里若有人写 "/* 参考 .tok-name * /" 这样的说明性注释，
     裸扫会把它当成一条真的规则数进 styled——剥注释关掉这个假阳性口子。 */
  const cssNoComments = String(PI.STYLE_CSS || '').replace(/\/\*[\s\S]*?\*\//g, '');
  cssNoComments.replace(/\.tok-([a-z]+)/g, function (m, ty) { styled[ty] = true; return m; });
  types.forEach(function (ty) {
    T.ok(styled[ty] === true || Object.prototype.hasOwnProperty.call(UNCOLORED, ty),
         'token 类型 ' + ty + ' 要么有 .tok-' + ty + ' 配色，要么在不上色名单里');
  });
  Object.keys(UNCOLORED).forEach(function (ty) {
    T.ok(types.indexOf(ty) !== -1, '不上色名单里的 ' + ty + ' 必须是真实类型（名单不许过期）');
  });
})();

/* 说明面板顶部的元数据（第 1 期设计 B7） */
(function () {
  T.ok(typeof PI.panelMeta === 'function', 'panelMeta 已导出');
  if (typeof PI.panelMeta !== 'function') { return; }
  const prog = { id: 'm', level: 2, kind: 'pattern', lines: 23, boards: ['AQA', 'OCR'],
                 tags: ['selection', 'if-elif-else'], runtime: 'cpython' };
  const zh = PI.panelMeta(prog, 'zh', 2);
  T.eq(zh.map(function (r) { return r.key; }), ['summary', 'boards', 'tags'], 'cpython 不显示运行环境行');
  T.eq(zh[0].items, ['难度 L2 · 惯用模式 · 23 行 · 2 个空'], '中文摘要行');
  T.eq(PI.panelMeta(prog, 'en', 2)[0].items, ['Level 2 · Pattern · 23 lines · 2 blank(s)'], '英文摘要行');
  T.eq(zh[1].label, '考试局', '考试局行的标签');
  T.eq(zh[1].items, ['AQA', 'OCR'], '考试局按声明顺序原样给');
  T.eq(zh[2].items, ['selection', 'if-elif-else'], '标签原样给（英文标识符，不翻译）');
  T.eq(PI.panelMeta(Object.assign({}, prog, { boards: [] }), 'zh', 2)[1].items, ['未标注'],
       '考试局为空时显式写未标注（program_meta_check 要求非空，这是 UI 兜底）');
  T.eq(PI.panelMeta(Object.assign({}, prog, { tags: [] }), 'zh', 2).map(function (r) { return r.key; }),
       ['summary', 'boards'], '没有标签就不出标签行');
  T.eq(PI.panelMeta(prog, 'zh', null)[0].items, ['难度 L2 · 惯用模式 · 23 行'], '空数算不出来时不编一个');
  const pico = Object.assign({}, prog, { runtime: 'micropython-pico' });
  const picoRows = PI.panelMeta(pico, 'en', 1);
  T.eq(picoRows.map(function (r) { return r.key; }), ['summary', 'boards', 'tags', 'runtime'], '非 cpython 才显示运行环境');
  T.eq(picoRows[3].items, ['MicroPython · Pico'], '运行环境用标签而不是枚举值');
  T.eq(PI.panelMeta(null, 'zh', 0), [], '没有当前程序：空数组');

  T.eq(PI.KINDS, ['syntax', 'pattern', 'algorithm', 'project', 'embedded'], 'KINDS 导出且有序');
  PI.KINDS.forEach(function (k) {
    T.ok(PI.kindLabel(k, 'zh') !== k && PI.kindLabel(k, 'en') !== k, 'kind ' + k + ' 中英标签都存在');
  });
  T.eq(PI.kindLabel('quiz', 'zh'), 'quiz', '未知 kind 原样给出，不给空串');
})();

T.report('interact');
