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
   下面两条先把当前行为钉住，再谈怎么改（见文件里 scanQuoted 的注释）。 */

/* C 形：字面引号后面**没有**空白 —— token 化会把整段吞成一个 token，
   于是提取出来的值里**留着**字面引号。这一条在补哨兵之前是绿的（值被
   静默读成带引号的一串），补上哨兵之后改成 T.throws。 */
T.throws(function () {
  E.parse([
    '// >>> BLANK id=a level=1 fill="1;" hintEn="X" hint="他说"你好"的场景"',
    'x;',
    '// <<< BLANK',
  ].join('\n'));
}, '引号值里残留字面双引号 —— 抛，不静默取一个含引号的怪值');

/* A 形：字面引号后面**紧跟空白**、且该属性是行内**最后一个** ——
   token 在那个引号处收尾，后面的「你好的场景"」变成一个没人认领的 token
   被丢掉，hint 被无声截断成「他说」。**这是一个已知缺口，下面这条断言
   记录的是现状、不是期望行为。** 上面那条哨兵（值里残留引号就抛）覆盖不到
   它：这里提取出来的值是「他说」，里面一个引号都没有。封住它需要另一条
   规则（>>> BLANK 之后每个 token 都必须是已知的 key= 形状，否则抛），
   属于本轮裁定之外的范围，已在 task-2-report.md 里报出待裁定。
   等它被封住时，下面这条会变红 —— 那正是提醒你把它改成 T.throws 的信号。 */
const quoteGap = E.parse([
  '// >>> BLANK id=a level=1 fill="1;" hintEn="X" hint="他说" 你好的场景"',
  'x;',
  '// <<< BLANK',
].join('\n'));
T.eq(quoteGap.blanks[0].hint.zh, '他说',
  '【现状记录，非期望】引号后跟空白且属性在行尾：hint 被静默截断（缺口待裁定）');

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

/* 分歧点必须能真的把调试器送到两条轨道各自的位置上（§2.9 第 4 条）：
   实测这一处是参考第 76 步、她第 79 步 —— 同一件事、不同步号。 */
T.ok(vWrong.divergence.refStep !== vWrong.divergence.herStep,
  '两条轨迹的步号通常不相等，两个都得报出来');
T.eq(typeof vWrong.divergence.opIndex, 'number', 'boardOps 分歧带展平后的事件序号');
T.eq(vWrong.divergence.ref.sq, vWrong.divergence.her.sq, '这一处两边动的是同一格');
T.eq(vWrong.divergence.ref.to, 'cut', '参考认为这一格被攻击（cut）');
T.eq(vWrong.divergence.her.to, 'ok', '她的版本认为这一格安全（ok）—— 这就是那句话');
T.ok(typeof vWrong.divergence.ref.from === 'undefined',
  '比较用的取值里没有 from —— 它是影子盘算出来的派生量，不参与判定');

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

/* result 单独起作用 */
const vResOnly = E.judge(REF, RW, { result: true, boardOps: false, counters: [] });
T.eq(vResOnly.status, 'fail', '只比 result 也能抓到漏查斜线');
T.eq(vResOnly.divergence.kind, 'result', '这时分歧类型是 result');
T.eq(vResOnly.divergence.ref, 10, 'result 分歧直接给两边的返回值');
T.eq(vResOnly.divergence.her, 23, 'result 分歧直接给两边的返回值');

/* 从没出现过的计数器：两边都是 null（「不知道」），不算分歧 */
const vGhost = E.judge(REF, same, { result: false, boardOps: false, counters: ['nosuchcounter'] });
T.eq(vGhost.status, 'pass', '两边都没有这个计数器 —— null 对 null，不是分歧');

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
