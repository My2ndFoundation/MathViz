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

/* judge / hintAt 本任务还没有，确认它们确实还没导出（约束 7：用 typeof） */
T.ok(typeof E.judge === 'undefined', 'judge 属于 Task 2，本任务不导出');
T.ok(typeof E.hintAt === 'undefined', 'hintAt 属于 Task 3，本任务不导出');

T.report();
