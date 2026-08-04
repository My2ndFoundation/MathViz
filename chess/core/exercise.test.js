'use strict';
const T = require('./_test.js');
const E = require('./exercise.js');

/* ---------- parse：正常路径 ---------- */

const SRC = [
  'function safe(r, c) {',
  '  // >>> BLANK id=safe-return level=1 fill="return true;" hint="会被攻击吗？" hintEn="Is it attacked?"',
  '  return !cols[c] && !diagDown[r + c];',
  '  // <<< BLANK',
  '}',
].join('\n');

const p = E.parse(SRC);
T.eq(p.blanks.length, 1, 'parse 找到一个挖空');
T.eq(p.blanks[0].id, 'safe-return', 'id 解析正确');
T.eq(p.blanks[0].level, 1, 'level 是数字 1，不是字符串');
T.eq(p.blanks[0].fill, 'return true;', 'fill 解析正确');
T.eq(p.blanks[0].hint.zh, '会被攻击吗？', 'zh 提示解析正确');
T.eq(p.blanks[0].hint.en, 'Is it attacked?', 'en 提示解析正确');
T.eq(p.blanks[0].body, '  return !cols[c] && !diagDown[r + c];', '挖空体保留原缩进');
T.eq(p.blanks[0].indent, '  ', 'indent 是挖空体第一行的前导空白');
T.eq(p.blanks[0].startLine, 3, 'startLine 是挖空体的 1-based 行号');
T.eq(p.blanks[0].endLine, 3, 'endLine 同上');

/* 占位版：两行指令与挖空体一起被换掉，fill 用挖空体的缩进 */
const lines = p.placeholder.split('\n');
/* 简报原文断言这里是 5，算术有误：SRC 共 5 行，挖空的两行指令 + 1 行
   挖空体（共 3 行）被换成 1 行注释 + 1 行 fill（共 2 行），5 - 3 + 2 = 4，
   不是 5。已用 node -e 打印 p.placeholder.split('\n') 核实为四行
   （function 行、注释行、return true; 行、闭花括号行），见
   task-1-report.md 的纠正记录。 */
T.eq(lines.length, 4, '占位版行数 = 4（1 行注释 + 1 行 fill 替换掉 3 行，净减 1 行）');
T.ok(lines[1].indexOf('会被攻击吗？') >= 0, '占位注释里带着中文提示');
T.eq(lines[2], '  return true;', 'fill 行用了挖空体的缩进');
T.ok(p.placeholder.indexOf('BLANK') === -1, '占位版里不再有 BLANK 指令');
T.ok(p.placeholder.indexOf('diagDown') === -1, '占位版里不再有参考答案');

/* 没有挖空的源码：blanks 为空，placeholder 与原文逐字节相同 */
const plain = E.parse('const a = 1;\nreturn a;');
T.eq(plain.blanks.length, 0, '没有指令时挖空清单为空');
T.eq(plain.placeholder, 'const a = 1;\nreturn a;', '没有指令时占位版就是原文');

/* 多个挖空 */
const two = E.parse([
  '// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A"',
  'x;',
  '// <<< BLANK',
  'mid;',
  '// >>> BLANK id=b level=2 fill="2;" hint="乙" hintEn="B"',
  'y;',
  'z;',
  '// <<< BLANK',
].join('\n'));
T.eq(two.blanks.length, 2, '两个挖空都找到');
T.eq(two.blanks[1].id, 'b', '第二个挖空的 id');
T.eq(two.blanks[1].body, 'y;\nz;', '多行挖空体用换行连接');
T.eq(two.blanks[1].startLine, 6, '第二个挖空体的起始行号');
T.eq(two.blanks[1].endLine, 7, '第二个挖空体的结束行号');

/* ---------- parse：属性乱序 + 提示文案里含子串 "id="/"level="（修复轮 1） ----------
   审查抓到的洞：scanBare/scanQuoted 原来用 line.indexOf('id=') 找子串，
   如果 hint 文案里恰好写了「设 id=5 的场景」，会先命中引号内部那个 id=，
   把它当成 id 的值——不抛、不报，静默取错。这条不需要属性乱序也能触发，
   但顺时把「属性顺序不作要求」也一并覆盖：id/level 放到 hint/fill 后面。 */

const collide = E.parse([
  '// >>> BLANK fill="1;" hint="设 id=5 的场景，注意 level=9 只是举例，fill= 也一样" id=a level=1 hintEn="mentions id=5 and level=9 too"',
  'x;',
  '// <<< BLANK',
].join('\n'));
T.eq(collide.blanks.length, 1, '属性乱序 + 提示文案含 id=/level=/fill= 子串：仍然找到一个挖空');
T.eq(collide.blanks[0].id, 'a', 'id 取到的是真正的 id= token，不是 hint 文案里的 "id=5"');
T.eq(collide.blanks[0].level, 1, 'level 取到的是真正的 level= token，不是 hint 文案里的 "level=9"');
T.eq(collide.blanks[0].fill, '1;', 'fill 取到的是真正的 fill= token，不是 hint 文案里提到的 "fill="');
T.ok(
  collide.blanks[0].hint.zh.indexOf('id=5') >= 0 && collide.blanks[0].hint.zh.indexOf('level=9') >= 0,
  'hint.zh 完整保留了文案里的 id=5 / level=9，没有被当成属性吃掉'
);
T.eq(collide.blanks[0].hint.en, 'mentions id=5 and level=9 too', 'hintEn 同样完整保留');

/* ---------- parse：引号值里的字面双引号（Task 2 并进的遗留） ----------
   `scanQuoted` 不支持转义（有意的设计边界）。但「不支持」有两种落法：
   静默截断，或者当场抛。静默截断是最坏的一种——Task 4/5 要手写六条真实
   中文提示文案，作者随手打了一个英文引号，提示就少半句而没有任何提示。
   两条**互补**的哨兵各挡一形，缺一形就漏（见 exercise.js 里两处注释）。 */

/* C 形：字面引号后面**没有**空白 —— token 化会把整段吞成一个 token，
   于是提取出来的值里**留着**字面引号，由 scanQuoted 的哨兵抓。 */
T.throws(function () {
  E.parse([
    '// >>> BLANK id=a level=1 fill="1;" hintEn="X" hint="他说"你好"的场景"',
    'x;',
    '// <<< BLANK',
  ].join('\n'));
}, 'C 形：引号值里残留字面双引号 —— 抛，不静默取一个含引号的怪值');

/* A 形：字面引号后面**紧跟空白**、且该属性是行内**最后一个** ——
   token 在那个引号处收尾，后面的「你好的场景"」变成一个没人认领的 token
   被丢掉，hint 从前被无声截断成「他说」。C 形那条哨兵**看不见**它（提取出来
   的值是「他说」，里面一个引号都没有），要靠 token 白名单那条抓。 */
T.throws(function () {
  E.parse([
    '// >>> BLANK id=a level=1 fill="1;" hintEn="X" hint="他说" 你好的场景"',
    'x;',
    '// <<< BLANK',
  ].join('\n'));
}, 'A 形：引号后跟空白且属性在行尾 —— 抛，不再把 hint 无声截断成半句');

/* 白名单不是「凡是没见过的都抛」的粗暴规则会误伤的那种：带引号的值里全是
   空白和符号也照样是一个完整 token。这两条是它的防误伤底线。 */
const spacey = E.parse([
  '// >>> BLANK id=a level=2 fill="for (let i = 0; i < n; i = i + 1) { }" ' +
    'hint="先想清楚：这一格 会不会 被攻击" hintEn="think first: is this square attacked"',
  'x;',
  '// <<< BLANK',
].join('\n'));
T.eq(spacey.blanks[0].fill, 'for (let i = 0; i < n; i = i + 1) { }',
  '带一堆空白和符号的 fill 仍然是一个完整 token');
T.eq(spacey.blanks[0].hint.zh, '先想清楚：这一格 会不会 被攻击',
  '中文提示里的空格不会把 token 切开');
T.eq(spacey.blanks[0].hint.en, 'think first: is this square attacked',
  'hintEn 与 hint 不会前缀互撞');

/* 认不出来的属性名也抛 —— 这条规则同时挡住了「写错属性名」这类笔误 */
T.throws(function () {
  E.parse([
    '// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A" tip="乙"',
    'x;',
    '// <<< BLANK',
  ].join('\n'));
}, '指令行上出现认不出来的属性名 —— 抛');

/* ---------- parse：每一条都必须大声失败（约束 6） ---------- */

T.throws(function () { E.parse(); }, 'parse() 少了 source —— 抛');
T.throws(function () { E.parse(123); }, 'parse(非字符串) —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK level=1 fill="1;" hint="甲" hintEn="A"\nx;\n// <<< BLANK');
}, '缺 id —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK id=a fill="1;" hint="甲" hintEn="A"\nx;\n// <<< BLANK');
}, '缺 level —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=1 hint="甲" hintEn="A"\nx;\n// <<< BLANK');
}, '缺 fill —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=1 fill="1;" hintEn="A"\nx;\n// <<< BLANK');
}, '缺 hint —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=1 fill="1;" hint="甲"\nx;\n// <<< BLANK');
}, '缺 hintEn —— 抛（英文是默认语言，缺了比缺中文更严重）');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=4 fill="1;" hint="甲" hintEn="A"\nx;\n// <<< BLANK');
}, 'level=4 越界 —— 抛');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A"\nx;');
}, '有 >>> 没有 <<< —— 抛');
T.throws(function () {
  E.parse('x;\n// <<< BLANK');
}, '有 <<< 没有 >>> —— 抛');
T.throws(function () {
  E.parse([
    '// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A"',
    '// >>> BLANK id=b level=1 fill="2;" hint="乙" hintEn="B"',
    'x;',
    '// <<< BLANK',
    '// <<< BLANK',
  ].join('\n'));
}, '嵌套 —— 抛');
T.throws(function () {
  E.parse([
    '// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A"',
    'x;',
    '// <<< BLANK',
    '// >>> BLANK id=a level=1 fill="2;" hint="乙" hintEn="B"',
    'y;',
    '// <<< BLANK',
  ].join('\n'));
}, '重复 id —— 抛（localStorage 的键靠它，撞了会互相覆盖）');
T.throws(function () {
  E.parse('// >>> BLANK id=a level=1 fill="1;" hint="甲" hintEn="A"\n// <<< BLANK');
}, '空挖空体 —— 抛');

/* hintAt 属于 Task 3，确认它确实还没导出（约束 7：用 typeof） */
T.ok(typeof E.hintAt === 'undefined', 'hintAt 属于 Task 3，本任务不导出');

/* ---------- judge ---------- */

const I = require('./interp.js');
const Q = require('./algos/queens.js');

/* 参考：交付的算法源码本身。N=5 有 10 个解、2,621 步，够小够快。 */
const REF = I.run(Q.source({ N: 5 }), { host: {} });
const CHECK = { result: true, boardOps: true, counters: ['solutions'] };

/* 参考答案通过自己的判定 —— 拿同一份源码再跑一遍 */
const same = I.run(Q.source({ N: 5 }), { host: {} });
const vSame = E.judge(REF, same, CHECK);
T.eq(vSame.status, 'pass', '参考答案与自己比对：pass');
T.eq(vSame.divergence, null, 'pass 时没有分歧点');

/* 错误变体：把 safe 的一条线删掉（漏查一条斜线），解数一定变多 */
const WRONG = Q.source({ N: 5 }).replace(
  '!diagUp[r - c + N]', 'true');
T.ok(WRONG !== Q.source({ N: 5 }), '错误变体确实改动了源码');
const RW = I.run(WRONG, { host: {} });
/* 实测：参考 10 解 / 2,621 步，变体 23 解 / 5,634 步 —— 简报「解数一定变多」成立 */
T.eq(REF.result, 10, '参考跑出 10 个解');
T.eq(RW.result, 23, '漏查一条斜线的变体跑出 23 个解（确实变多）');
const vWrong = E.judge(REF, RW, CHECK);
T.eq(vWrong.status, 'fail', '漏查一条斜线：fail');
T.eq(vWrong.divergence.kind, 'boardOps', '第一处分歧出现在棋盘事件上');
T.ok(vWrong.divergence.refStep >= 0, '分歧点带着参考侧的步号');
T.ok(vWrong.divergence.herStep >= 0, '分歧点带着她那一侧的步号');

/* 分歧点必须能真的把调试器送到两条轨道各自的位置上（§2.9 第 4 条）。
   实测曾为参考第 76 步、她第 79 步；这里只保证两者**不必相等**，不把那两个
   数字硬钉进断言（源码稍一改动它们就会漂，钉住只会得到一条脆断言）。 */
T.ok(vWrong.divergence.refStep !== vWrong.divergence.herStep,
  '两条轨迹的步号通常不相等，两个都得报出来');
T.eq(typeof vWrong.divergence.opIndex, 'number', 'boardOps 分歧带展平后的事件序号');
T.eq(vWrong.divergence.ref.sq, vWrong.divergence.her.sq, '这一处两边动的是同一格');
T.eq(vWrong.divergence.ref.to, 'cut', '参考认为这一格被攻击（cut）');
T.eq(vWrong.divergence.her.to, 'ok', '她的版本认为这一格安全（ok）—— 这就是那句话');
T.ok(typeof vWrong.divergence.ref.from === 'undefined',
  '比较用的取值里没有 from —— 它由影子盘的前缀唯一决定，进了比较也提供不出新信息');

/* boardOps 那两个步号是**真正的第一处分歧**：报出来的那一步上，两边确实各自
   写下了这条对不上的棋盘事件。这条把「能说成分歧的那一步」钉死在 boardOps 上。 */
function opsAt(run, step) {
  return (run.trace[step].boardOps || []).map(function (o) {
    return [o.kind, o.sq, o.to].join('|');
  });
}
T.ok(opsAt(REF, vWrong.divergence.refStep).indexOf('mark|6|cut') >= 0,
  'refStep 那一步上，参考确实写下了报出来的那条事件');
T.ok(opsAt(RW, vWrong.divergence.herStep).indexOf('mark|6|ok') >= 0,
  'herStep 那一步上，她确实写下了报出来的那条事件');

/* 等价改写：把 && 拆成三条 if —— 行为必须完全相同 */
const EQUIV = Q.source({ N: 5 }).replace(
  '  return !cols[c] && !diagDown[r + c] && !diagUp[r - c + N];',
  [
    '  if (cols[c]) { return false; }',
    '  if (diagDown[r + c]) { return false; }',
    '  if (diagUp[r - c + N]) { return false; }',
    '  return true;',
  ].join('\n'));
T.ok(EQUIV !== Q.source({ N: 5 }), '等价改写确实改动了源码');
const RE = I.run(EQUIV, { host: {} });
/* 实测：2,621 步 vs 3,014 步，棋盘事件两边都是 599 条且逐条相同 */
T.ok(RE.trace.length !== REF.trace.length, '等价改写的步数确实与参考不同');
const vEquiv = E.judge(REF, RE, CHECK);
T.eq(vEquiv.status, 'pass', '等价改写：pass —— 步数不同不算分歧');

/* 截断：任一边跑不完且分歧没在截断前出现 —— 不给判决 */
const short = I.run(Q.source({ N: 5 }), { host: {}, limit: 200 });
T.eq(short.trace.truncated, true, '限 200 步确实截断了');
const vTrunc = E.judge(REF, short, CHECK);
T.eq(vTrunc.status, 'unknown', '截断且未发现分歧：unknown，不是 fail');
T.eq(vTrunc.divergence, null, 'unknown 时没有分歧点');

/* 截断把 counters / result 一起作废掉：限 200 步时 solutions 末值是 1、
   result 是 undefined，跟参考的 10 完全对不上。**这两处差异不是分歧**，
   只是「还没跑到」——把它们当成分歧就会把正确答案判错，正是 null 不许
   变成布尔值的那条纪律。 */
T.eq(E.judge(REF, short, { result: true, boardOps: false, counters: [] }).status,
  'unknown', '截断时只比 result：unknown，不能拿 undefined 当分歧');
T.eq(E.judge(REF, short, { result: false, boardOps: false, counters: ['solutions'] }).status,
  'unknown', '截断时只比 counters：unknown，不能拿「还没数完」当分歧');

/* 截断之前就已经分歧 —— 这时候可以判 */
const shortWrong = I.run(WRONG, { host: {}, limit: 2000 });
T.eq(shortWrong.trace.truncated, true, '限 2000 步的错误变体确实截断了');
const vTruncWrong = E.judge(REF, shortWrong, CHECK);
T.eq(vTruncWrong.status, 'fail', '截断前已分歧：照样判 fail');
T.eq(vTruncWrong.divergence.kind, 'boardOps', '截断前的分歧同样定位到棋盘事件');

/* counters 单独起作用：只比解数，不比棋盘事件 */
const vCountOnly = E.judge(REF, I.run(WRONG, { host: {} }),
                           { result: false, boardOps: false, counters: ['solutions'] });
T.eq(vCountOnly.status, 'fail', '只比 counters 也能抓到漏查斜线');
T.eq(vCountOnly.divergence.kind, 'counters', '这时分歧类型是 counters');
T.eq(vCountOnly.divergence.opIndex, null, 'counters 分歧没有棋盘事件序号');
T.eq(vCountOnly.divergence.ref.value, 10, 'counters 分歧并排显示参考的末值');
T.eq(vCountOnly.divergence.her.value, 23, 'counters 分歧并排显示她的末值');
T.eq(vCountOnly.divergence.ref.name, 'solutions', 'counters 分歧带着计数器名字，UI 才知道在显示哪一个');

/* counters 的 refStep/herStep **不是**「分歧的第一步」——比的是末值，
   没有第一步可言。它们的契约是「该计数器**最后一次被赋值**的那一步」。
   下面两条把这个语义钉住（不钉具体数字：源码一改就漂）：报出来的那一步上
   确实有一条给它赋这个值的 varDelta，而且**再往后不会有第二条**。 */
function assertLastAssign(run, step, name, value, who) {
  const deltas = (run.trace[step].varDelta || []).filter(function (d) { return d.name === name; });
  T.ok(deltas.length > 0 && deltas[deltas.length - 1].to === value,
    who + '：报出来的那一步上确实有一条把 ' + name + ' 赋成 ' + value + ' 的 varDelta');
  let later = 0;
  for (let s = step + 1; s < run.trace.length; s++) {
    later += (run.trace[s].varDelta || []).filter(function (d) { return d.name === name; }).length;
  }
  T.eq(later, 0, who + '：那一步之后 ' + name + ' 再没有被赋过值 —— 它确实是「末次赋值处」');
}
assertLastAssign(REF, vCountOnly.divergence.refStep, 'solutions', 10, 'counters/参考侧');
assertLastAssign(RW, vCountOnly.divergence.herStep, 'solutions', 23, 'counters/她那一侧');

/* result 单独起作用 */
const vResOnly = E.judge(REF, RW, { result: true, boardOps: false, counters: [] });
T.eq(vResOnly.status, 'fail', '只比 result 也能抓到漏查斜线');
T.eq(vResOnly.divergence.kind, 'result', '这时分歧类型是 result');
T.eq(vResOnly.divergence.ref, 10, 'result 分歧直接给两边的返回值');
T.eq(vResOnly.divergence.her, 23, 'result 分歧直接给两边的返回值');
/* result 的步号契约：各自的**末步**，不是分歧处（返回值不发生在某一步）。 */
T.eq(vResOnly.divergence.refStep, REF.trace.length - 1, 'result 分歧给参考轨迹的末步');
T.eq(vResOnly.divergence.herStep, RW.trace.length - 1, 'result 分歧给她那条轨迹的末步');

/* ---------- judge：计数器名字对不上（参考侧是权威） ----------
   旧版本在这里有一个静默的「永远判对」：两边 lastCounter 都返回 null 就算
   相同，于是一个打错字的计数器名会让 10 解 vs 23 解判成 pass。
   注意反例必须用**真的不一样**的两次运行（RW，不是 same）——拿 same 当反例
   的断言分不清「null 对 null 不算分歧」和「这条判定什么都没比」。 */

T.throws(function () {
  E.judge(REF, RW, { result: false, boardOps: false, counters: ['solutionz'] });
}, '计数器名字在参考轨迹里从未出现 —— 抛（出题配置错误，不许静默判对）');

/* 配置错误不该因为 boardOps 恰好先分歧就被吞掉：三项全开时也照样抛 */
T.throws(function () {
  E.judge(REF, RW, { result: true, boardOps: true, counters: ['solutionz'] });
}, '名字打错时，即使 boardOps 会先分歧也照样抛 —— 配置错误不被结果吞掉');

/* 参考里有、她那边一次都没出现（她把变量改名了）：这是一处真分歧，不是相等 */
const RENAMED = I.run(Q.source({ N: 5 }).split('solutions').join('total'), { host: {} });
T.eq(RENAMED.result, 10, '改名版本本身跑得对（10 解），只是不再有这个变量名');
const vRenamed = E.judge(REF, RENAMED, { result: false, boardOps: false, counters: ['solutions'] });
T.eq(vRenamed.status, 'fail', '参考里有、她那边从没出现过 —— fail，不是「都不知道所以相等」');
T.eq(vRenamed.divergence.kind, 'counters', '这一处的分歧类型是 counters');
T.eq(vRenamed.divergence.her.value, null, '她那一侧的取值是 null（从没出现过）');
T.eq(vRenamed.divergence.herStep, null, '她那一侧没有可跳过去的位置 —— null，不编步号');
T.eq(typeof vRenamed.divergence.refStep, 'number', '参考那一侧的步号照报');

/* 上面那一组**分辨不出** `found` 与 `value === null` 的区别：参考末值是 10，
   `sameValue(10, null)` 本来就不等，把 found 那条分支删掉它照样是绿的
   （变异测过，确实不红）。真正只有这条分支管得着的情形是**参考末值恰好
   就是 null**：那时「她根本没有这个变量」与「她数出来是 null」在数值上
   一模一样，只有 found 分得开。用手搭轨迹把它打出来。 */
function fakeCounterRun(perStepDeltas, truncated) {
  const trace = perStepDeltas.map(function (deltas) {
    return { line: 0, depth: 0, frameOp: null, frameName: null,
             varDelta: deltas, boardOps: [], out: null };
  });
  trace.truncated = truncated === true;
  return { result: null, trace: trace };
}
const ONLY_C = { result: false, boardOps: false, counters: ['c'] };
const refNull = fakeCounterRun([[{ name: 'c', from: 0, to: null }]], false);
const herNever = fakeCounterRun([[{ name: 'other', from: 0, to: 1 }]], false);
const herNull = fakeCounterRun([[{ name: 'c', from: 0, to: null }]], false);

const vNullVsNever = E.judge(refNull, herNever, ONLY_C);
T.eq(vNullVsNever.status, 'fail',
  '参考末值是 null、她那边根本没有这个变量 —— fail（「没有」不等于「数出来是 null」）');
/* 这一条要在「判成 pass」时给出**干净的失败**而不是崩在读 null 上——
   它正是用来盯 found 那条分支的，信号不能是一句堆栈。 */
T.eq(vNullVsNever.divergence ? vNullVsNever.divergence.herStep : '没有分歧点', null,
  '她那一侧仍然没有步号');
T.eq(E.judge(refNull, herNull, ONLY_C).status, 'pass',
  '两边都真的把它数成了 null —— 这才算相等');

/* 判定顺序：boardOps 在前（它能给出步号，反馈最有用） */
const vOrder = E.judge(REF, RW, CHECK);
T.eq(vOrder.divergence.kind, 'boardOps',
  '三项全开时先报 boardOps，不报 counters/result —— 顺序是规定的');

/* ---------- judge：棋盘事件流长度不同 ----------
   真实变体几乎总是在「内容」上先分歧（漏查斜线那一份在第 6 条事件就分了），
   所以「一边比另一边少做了几件事」这条路径拿手搭的最小轨迹来测。
   judge 只认 { result, trace }，trace 里只认 boardOps / varDelta —— 这里
   顺手证明了这一点：它不需要知道任何一道题。 */

function fakeRun(result, ops, truncated) {
  const trace = ops.map(function (op) {
    return { line: 0, depth: 0, frameOp: null, frameName: null,
             varDelta: [], boardOps: op === null ? [] : [op], out: null };
  });
  trace.truncated = truncated === true;
  return { result: result, trace: trace };
}

const OP_A = { kind: 'mark', sq: 0, to: 'try', from: null };
const OP_B = { kind: 'place', sq: 0, to: 'wQ', from: null };
const ONLY_OPS = { result: false, boardOps: true, counters: [] };

const longer = fakeRun(1, [OP_A, OP_B], false);
const shorterDone = fakeRun(1, [OP_A], false);
const shorterCut = fakeRun(undefined, [OP_A], true);

const vShort = E.judge(longer, shorterDone, ONLY_OPS);
T.eq(vShort.status, 'fail', '她少做了一件棋盘事件、而且跑完了 —— fail');
T.eq(vShort.divergence.opIndex, 1, '分歧就落在她那一边用完的位置上');
T.eq(vShort.divergence.refStep, 1, '参考侧还有第 1 步这件事');
T.eq(vShort.divergence.herStep, null, '她那一侧没有对应位置 —— null，不编一个步号出来');
T.eq(vShort.divergence.her, null, '她那一侧也没有可并排显示的取值');
T.eq(vShort.divergence.ref.kind, 'place', '参考那一件事是 place');
T.ok(typeof vShort.divergence.ref.from === 'undefined', '同样不把 from 带进比较值');

const vShortCut = E.judge(longer, shorterCut, ONLY_OPS);
T.eq(vShortCut.status, 'unknown', '短的那一边是被截断的 —— 少几件事不算分歧');
T.eq(vShortCut.divergence, null, 'unknown 时没有分歧点');

const vRefShort = E.judge(shorterDone, longer, ONLY_OPS);
T.eq(vRefShort.status, 'fail', '反过来：她多做了一件事，参考跑完了 —— 同样 fail');
T.eq(vRefShort.divergence.refStep, null, '这次是参考侧没有对应位置');
T.eq(vRefShort.divergence.herStep, 1, '她那一侧的步号照报');

/* 长度相同、内容也相同，但有一边截断 —— 仍然是 unknown，不是 pass */
T.eq(E.judge(longer, fakeRun(1, [OP_A, OP_B], true), ONLY_OPS).status, 'unknown',
  '比过的那一段全都一致，但她没跑完 —— 不知道就是不知道，不许算 pass');

/* check 的每一个键都必须显式给出（§2.9：不许有默认值） */
T.throws(function () { E.judge(REF, same); }, 'judge 少了 check —— 抛');
T.throws(function () { E.judge(REF, same, { result: true }); }, 'check 缺 boardOps —— 抛');
T.throws(function () { E.judge(REF, same, { result: true, boardOps: true }); }, 'check 缺 counters —— 抛');
T.throws(function () { E.judge(REF, same, { result: false, boardOps: false, counters: [] }); },
         'check 三项全关 —— 抛（这样的判定永远判对，等于没判）');
T.throws(function () { E.judge(same, undefined, CHECK); }, 'judge 少了 herRun —— 抛');
T.throws(function () { E.judge(undefined, same, CHECK); }, 'judge 少了 refRun —— 抛');

/* 「显式」是指真的布尔 / 真的数组，不是「真值」—— 1 和 'yes' 不算 */
T.throws(function () { E.judge(REF, same, { result: 1, boardOps: true, counters: [] }); },
         'check.result 是 1 不是 true —— 抛（真值不等于显式声明）');
T.throws(function () { E.judge(REF, same, { result: true, boardOps: 'yes', counters: [] }); },
         'check.boardOps 是字符串 —— 抛');
T.throws(function () { E.judge(REF, same, { result: true, boardOps: true, counters: 'solutions' }); },
         'check.counters 是字符串不是数组 —— 抛');
T.throws(function () { E.judge(REF, same, { result: true, boardOps: true, counters: [''] }); },
         'check.counters 里有空名字 —— 抛');
T.throws(function () { E.judge({ result: 1 }, same, CHECK); }, 'refRun 没有 trace —— 抛');
T.throws(function () { E.judge(REF, { result: 1 }, CHECK); }, 'herRun 没有 trace —— 抛');

T.report();
