'use strict';
const T = require('./_test.js');
const Ex = require('./exercise.js');

const SRC = [
  'def binary_search(items, target):',
  '    lo, hi = 0, len(items) - 1',
  '    while lo <= hi:',
  '# >>> BLANK id=mid level=2 hint="用整除" hintEn="floor division"',
  '        mid = (lo + hi) // 2',
  '# <<< BLANK',
  '        if items[mid] == target:',
  '            return mid',
  '# >>> BLANK id=narrow level=3 hint="两侧各走一步" hintEn="move one side"',
  '        elif items[mid] < target:',
  '            lo = mid + 1',
  '        else:',
  '            hi = mid - 1',
  '# <<< BLANK',
  '    return -1',
  ''
].join('\n');

const p = Ex.parse(SRC);
T.eq(p.blanks.length, 2, '两个空');
T.eq(p.blanks[0].id, 'mid', '第一个空的 id');
T.eq(p.blanks[0].level, 2, 'level 解析成数字');
T.eq(p.blanks[0].hint, '用整除', '中文提示');
T.eq(p.blanks[0].hintEn, 'floor division', '英文提示');
T.eq(p.blanks[0].body, '        mid = (lo + hi) // 2', '单行挖空体');
T.eq(p.blanks[0].indent, '        ', '缩进取挖空体第一行的前导空白');
/* 第二个空的挖空体逐行数：'elif …' / 'lo = mid + 1' / 'else:' / 'hi = mid - 1'
   四行——brief 原文里这条断言写的是 5，跟它自己给出的 SRC 逐行数出来对不上
   （已用 node 实测校验），是 brief 的笔误，这里按实测的真值改成 4。 */
T.eq(p.blanks[1].body.split('\n').length, 4, '多行挖空体保留全部四行');
T.eq(p.blanks[1].indent, '        ', '多行空的缩进取第一行');
T.eq(p.blanks[0].line, 3, 'blanks[0].line 是它在 stripped 里的行号');
T.eq(p.blanks[1].line, 6, 'blanks[1].line 是它在 stripped 里的行号');

/* 占位版：指令行消失，挖空体塌成一行 `<indent>___` */
const lines = p.stripped.split('\n');
T.eq(lines[3], '        ___', '第一个空塌成一行占位');
T.eq(lines[2], '    while lo <= hi:', '占位上方的代码原样');
T.eq(lines[4], '        if items[mid] == target:', '占位下方的代码原样');
T.eq(p.lineMap[3].kind, 'blank', 'lineMap 标出这一行是空');
T.eq(p.lineMap[3].blankId, 'mid', 'lineMap 带上是哪个空');
T.eq(p.lineMap[2].kind, 'code', 'lineMap 标出代码行');
T.eq(p.lineMap.length, lines.length, 'lineMap 与 stripped 行数一致');

/* merge：填回去等于原文（去掉指令行） */
const answers = { mid: '        mid = (lo + hi) // 2',
                  narrow: p.blanks[1].body };
const merged = Ex.merge(SRC, answers);
T.ok(merged.indexOf('BLANK') === -1, 'merge 的结果里没有指令行');
T.ok(merged.indexOf('mid = (lo + hi) // 2') !== -1, 'merge 填回了答案');
T.eq(merged.split('\n')[0], 'def binary_search(items, target):', 'merge 不动其他行');

/* 缺的 id 用原 body 兜底 */
const partial = Ex.merge(SRC, { mid: '        mid = 0' });
T.ok(partial.indexOf('mid = 0') !== -1, '给了的空用答案');
T.ok(partial.indexOf('elif items[mid] < target:') !== -1, '没给的空用原文');

/* 没有指令的源码：零个空，stripped 逐字节等于原文 */
(function () {
  const plain = 'x = 1\ny = 2\n';
  const q = Ex.parse(plain);
  T.eq(q.blanks.length, 0, '没有指令就没有空');
  T.eq(q.stripped, plain, 'stripped 逐字节等于原文');
})();

/* ---- DIRECTIVE_OPEN / DIRECTIVE_CLOSE 是导出的公开成员，且扫描逻辑真的
   走它们（不是一份跟实际行为脱节的假文档）---- */
T.ok(typeof Ex.DIRECTIVE_OPEN.test === 'function', 'DIRECTIVE_OPEN 导出为正则');
T.ok(typeof Ex.DIRECTIVE_CLOSE.test === 'function', 'DIRECTIVE_CLOSE 导出为正则');
T.ok(Ex.DIRECTIVE_OPEN.test('# >>> BLANK id=a level=1 hint="x" hintEn="y"'), 'DIRECTIVE_OPEN 匹配标准开标记');
T.ok(Ex.DIRECTIVE_CLOSE.test('# <<< BLANK'), 'DIRECTIVE_CLOSE 匹配标准闭标记');

(function () {
  /* #、>>>、BLANK 之间塞进多余空白——只有当 scanBlocks 真的调用
     DIRECTIVE_OPEN/CLOSE（而不是内部另一份要求恰好一个空格的字符串前缀
     判断）时，这种写法才会被识别成一个挖空块。 */
  const loose = [
    'x = 1',
    '#   >>>   BLANK   id=z level=1 hint="h" hintEn="e"',
    'y = 2',
    '#  <<<   BLANK',
    'z = 3',
    ''
  ].join('\n');
  const pl = Ex.parse(loose);
  T.eq(pl.blanks.length, 1, '扫描逻辑真的用 DIRECTIVE_OPEN/CLOSE 的宽松空白识别指令行');
  T.eq(pl.blanks[0].id, 'z', '宽松空白指令行仍能正确解出 id');
})();

/* ---- 裸值正则不能被引号文本里的假属性咬到（R11 裁决：id/level 必须
   先把 hint/hintEn 的引号段摘掉，再在剩余文本上取裸值）---- */
(function () {
  const eaten = Ex.parse(
    '# >>> BLANK hint="see id=5 example" id=real level=2 hintEn="y"\nbody\n# <<< BLANK\n'
  );
  T.eq(eaten.blanks[0].id, 'real', 'hint 引号文本里的假 id= 不会被裸值正则咬到');
  T.eq(eaten.blanks[0].level, 2, '同一构造下 level 也不受干扰');
})();

/* ---- clean()：剥掉两种指令行，挖空体原文原样保留，读模式/临摹模式用 ---- */
(function () {
  const cleaned = Ex.clean(SRC);
  T.ok(cleaned.indexOf('BLANK') === -1, 'clean 的结果里没有指令行');
  T.ok(cleaned.indexOf('        mid = (lo + hi) // 2') !== -1, 'clean 保留第一个挖空体原文');
  T.ok(cleaned.indexOf('            hi = mid - 1') !== -1, 'clean 保留第二个挖空体最后一行原文');
  // SRC 里恰好 4 条指令行（两个 >>> + 两个 <<<），clean 只删这 4 行，别的原样保留。
  T.eq(cleaned.split('\n').length, SRC.split('\n').length - 4, 'clean 的行数 = 原文行数 - 4 条指令行');

  const plain = 'x = 1\ny = 2\n';
  T.eq(Ex.clean(plain), plain, '没有指令的源码：clean 逐字节等于原文');
})();

/* ---- 错误形状必须抛，不能悄悄放过 ---- */
T.throws(function () {
  Ex.parse('# >>> BLANK id=a level=1 hint="x" hintEn="y"\nbody\n');
}, '开标记没有对应的闭标记要抛', /未闭合|unclosed/i);

T.throws(function () {
  Ex.parse('# >>> BLANK id=a level=1 hint="x"\nbody\n# <<< BLANK\n');
}, '缺 hintEn 要抛', /hintEn/);

T.throws(function () {
  Ex.parse('# >>> BLANK id=a level=9 hint="x" hintEn="y"\nbody\n# <<< BLANK\n');
}, 'level 越界要抛', /level/);

T.throws(function () {
  Ex.parse('# >>> BLANK id=a level=1 hint="x" hintEn="y"\n# <<< BLANK\n');
}, '空的挖空体要抛', /空|empty/i);

T.throws(function () {
  const dup = '# >>> BLANK id=a level=1 hint="x" hintEn="y"\nb1\n# <<< BLANK\n'
            + '# >>> BLANK id=a level=1 hint="x" hintEn="y"\nb2\n# <<< BLANK\n';
  Ex.parse(dup);
}, '同页重复 id 要抛', /重复|duplicate/i);

T.report('exercise');
