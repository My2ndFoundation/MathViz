'use strict';
const T = require('./_test.js');
const I = require('./interp.js');

function types(src) { return I.tokenize(src).map(t => t.type); }
function values(src) { return I.tokenize(src).filter(t => t.type !== 'eof').map(t => t.value); }

// ---- 基本类别 ----
T.eq(values('let x = 1'), ['let', 'x', '=', 1], '关键字/标识符/符号/数字');
T.eq(types('let x = 1'), ['kw', 'name', 'punct', 'num', 'eof'], '类别正确');
T.eq(values('x >= 10 && y !== 2'), ['x', '>=', 10, '&&', 'y', '!==', 2], '多字符运算符不被拆开');
T.eq(values('a.b[0]'), ['a', '.', 'b', '[', 0, ']'], '成员访问与下标');

// ---- 数字与字符串 ----
T.eq(values('1 2.5 0.75'), [1, 2.5, 0.75], '整数与小数');
T.eq(values("'hi' \"there\""), ['hi', 'there'], '两种引号');
T.eq(values("'a\\nb'"), ['a\nb'], '转义序列在词法阶段就解掉');

/* 数字里第二个小数点：I1 审查发现上一轮「数字扫描器遇到第二个 . 就
   throw」的修法过激——5..toFixed(2) 是合法原生写法（先一个数字字面量
   吃掉一个点，再一个成员访问点），会被那条特例误杀。改成「扫描器至多
   吃一个小数点然后停」，1.2.3 仍然会被拒绝，但拒绝的位置改到了解析层
   （点后面必须是属性名，数字不是），报错原因更贴切。 */
T.throws(() => I.parse('1.2.3;'), '数字里出现第二个小数点在解析层被拒绝');
T.throws(() => I.parse('let x = 1.2.3;'), '在语句里同样被拒绝');

T.eq(I.tokenize('1.5').filter(t => t.type !== 'eof')[0].value, 1.5, '正常小数');
T.eq(I.tokenize('42').filter(t => t.type !== 'eof')[0].value, 42, '整数');
T.eq(I.tokenize('a.b').filter(t => t.type !== 'eof').map(t => t.value), ['a', '.', 'b'],
     '标识符后的点仍然是成员访问运算符，不是数字的一部分');

/* 上一轮这里断言 '1 .5' 是三个 token（[1, '.', 5]），当时成立是因为
   词法器还不支持「前导小数点」。C4 补上前导小数点支持之后，'.5' 本身
   就是一个合法数字字面量（跟前面有没有空格无关——原生的数字文法是
   上下文无关的最长匹配，不会因为前面出现过 '1' 就把 '.' 让给成员访问）。
   用 node 亲自验证过：`new Function('return 1 .5;')()` 原生也抛
   "Unexpected number"——这正说明原生把 '.5' 词法成了一个数字 token，
   而不是留了一个 '.' 给成员访问，两个数字字面量挨在一起才在解析层报错。
   所以这条断言本身描述的行为在 C4 之后不再等于原生行为，随之更新，
   而不是保留一个「曾经通过、但与参照实现不一致」的断言。 */
T.eq(I.tokenize('1 .5').filter(t => t.type !== 'eof').map(t => t.value), [1, 0.5],
     "C4 之后 '.5' 本身就是数字字面量，'1 .5' 是两个数字 token（挨在一起会在解析层报错，" +
     '与原生 new Function 的 "Unexpected number" 一致，见报告）');

// ---- 模板字符串 ----
const tpl = I.tokenize('`try ${r},${c}`').filter(t => t.type !== 'eof');
T.eq(tpl.length, 1, '模板串是一个 token');
T.eq(tpl[0].type, 'tpl', '类别是 tpl');
T.eq(tpl[0].value.quasis, ['try ', ',', ''], '静态段（比表达式多一个）');
T.eq(tpl[0].value.exprs.map(s => s.trim()), ['r', 'c'], '内嵌表达式以源码片段保留，留给解析器');

/* C2：${...} 的花括号计深必须识别字符串边界，否则字符串里恰好出现的
   { / } 会提前打断（或延后）表达式的截取——审查用 `${ "}" }` 这种例子
   实证抓到了它。 */
function tplExprs(src) { return I.tokenize(src).filter(t => t.type !== 'eof')[0].value.exprs; }
T.eq(tplExprs('`${ "}" }`').map(s => s.trim()), ['"}"'],
     '表达式里字符串内的 } 不提前截断花括号计数');
T.eq(tplExprs("`${ '{' }`").map(s => s.trim()), ["'{'"],
     '表达式里字符串内的 { 不影响花括号计数');
T.eq(tplExprs('`${ f("}") }`').map(s => s.trim()), ['f("}")'],
     '函数调用参数里字符串的 } 不影响花括号计数');

/* N1：C2 新增的 skipNestedString/skipNestedTemplate（跳过 ${...} 内部的
   字符串/嵌套模板，专为花括号计深服务）必须重复一遍 C1 那条「单/双引号
   字符串不能裸换行」的检查，不能指望"反正 parseExpression 会对 exprs
   里的源码片段再 tokenize 一次，到时候会抓到"——这个词法器是公开导出
   的接口，阶段 3b 编辑器的语法高亮直接调 tokenize()，走不到"第二遍"，
   漏掉这里就是漏掉了高亮能看到的那一份检查（规格 §2.8）。
   嵌套模板串本身允许跨行（原生允许），这里特意验证了这一点不受影响，
   只有嵌套在其中的单/双引号字符串不行。 */
T.throws(() => I.tokenize("`x${ 'a\nb' }y`"),
         '模板表达式里嵌套的单引号字符串裸换行也要报错（N1）');
T.throws(() => I.tokenize('`x${ "a\nb" }y`'),
         '模板表达式里嵌套的双引号字符串裸换行也要报错（N1）');
let nestedTplErr = null;
try { I.tokenize('`x${ `a\nb` }y`'); } catch (e) { nestedTplErr = e; }
T.eq(nestedTplErr, null, '嵌套模板串本身允许跨行，不应被 N1 的检查误伤');

/* N2：I1 的招牌用例。数字扫描器至多吃一个小数点然后停，与原生一致。
   把这条规则改回「见第二个点就抛」，下面这条会红——复审时实测过，
   在没有这条断言之前整套仍然全绿，也就是说这个 bug 曾经可以无声地
   回来。'1 .5' 那条断言走的是空格分隔的另一条代码路径，保护不了这条。 */
T.eq(I.tokenize('5..toFixed(2)').filter(t => t.type !== 'eof').map(t => t.value),
     [5, '.', 'toFixed', '(', 2, ')'], '5..toFixed(2) 正常词法化，不被多小数点检查误伤');

// 模板串本身只验「不抛」——求值（把 quasis 和 exprs 拼起来）是后面任务的事。
let tplRunErr = null;
try { I.tokenize('`a${1+1}b`'); } catch (e) { tplRunErr = e; }
T.eq(tplRunErr, null, '正常模板串（含表达式）词法阶段不抛');

// ---- 注释：产出 token 供高亮，解析器自己跳过 ----
T.eq(types('// hi\nlet x = 1'), ['comment', 'kw', 'name', 'punct', 'num', 'eof'], '行注释是 token');
T.eq(types('/* a */ let'), ['comment', 'kw', 'eof'], '块注释是 token');

// ---- 位置信息（编辑器画波浪线全靠它）----
const pos = I.tokenize('let x = 1\nlet yy = 2');
const yy = pos.find(t => t.value === 'yy');
T.eq(yy.line, 2, '第二行');
T.eq(yy.col, 5, '第 5 列（1 起算）');
T.eq('let x = 1\nlet yy = 2'.slice(yy.start, yy.end), 'yy', 'start/end 能切回原文');
T.eq(pos[0].line, 1, '第一个 token 在第 1 行');
T.eq(pos[0].col, 1, '第一个 token 在第 1 列');

// ---- 坏输入：未闭合 ----
T.throws(() => I.tokenize("'abc"), '未闭合的字符串报错');
T.throws(() => I.tokenize('`abc'), '未闭合的模板串报错');
T.throws(() => I.tokenize('/* abc'), '未闭合的块注释报错');

/* ---- 与原生 JavaScript 对照（规格 §7.3：正确性判据是「跟原生一致」）----
   上一轮 21 条写死期望值的测试，一条都没抓到 1e10 被切成两个 token——
   写死的期望值只能覆盖测试作者想到的输入。这里反过来：不写死期望值，
   当场问原生 JS 要答案，任何一个我们没想到的分歧都会自己暴露。 */
function lexValue(src) {
  const t = I.tokenize(src).filter(x => x.type !== 'eof');
  return t.length === 1 ? t[0].value : t.map(x => x.value);
}
function nativeValue(src) { return new Function('return ' + src + ';')(); }
function sameAsNative(src, label) {
  T.eq(lexValue(src), nativeValue(src), label + ' —— 与原生一致：' + src);
}
sameAsNative('1e10', '科学计数法');
sameAsNative('1E10', '大写 E');
sameAsNative('1e-5', '负指数');
sameAsNative('1e+5', '正指数（带显式加号）');
sameAsNative('1.5e3', '小数 + 指数');
sameAsNative('0x1F', '十六进制');
sameAsNative('0X1f', '大写 X');
sameAsNative('.5', '前导小数点');
sameAsNative("'\\u0041'", '\\u 转义（定长 4 位）');
sameAsNative("'\\u{1F600}'", '\\u{...} 转义（码位形式，非 BMP 字符）');
sameAsNative("'\\x41'", '\\x 转义');

/* 八进制 / 二进制：规格没有点名要不要支持，但原生 JS 本身支持 0o / 0b
   字面量（node 里验证过 0o17 === 15、0b101 === 5），而我们的正确性判据
   就是「跟原生一致」——选择不支持、让它们走进「数字后面跟着一个不认识
   的标识符字符 o/b」这种含混错误，比选择支持更容易制造「表面正常、
   实际跑偏」的假象（数字面值和后面的字母粘在一起时，静默截断是 C3 已经
   踩过的坑）。而 parseInt(str, radix) 已经做了进制换算，多支持这两种
   前缀不比 0x 分支多花什么成本，所以选择支持，而不是选择报错。 */
sameAsNative('0o17', '八进制');
sameAsNative('0O17', '八进制（大写 O）');
sameAsNative('0b101', '二进制');
sameAsNative('0B101', '二进制（大写 B）');

// ---- 与原生对照：原生拒绝的，我们也要拒绝 ----
T.throws(() => I.tokenize("'a\nb'"), '字符串内未转义换行要报错');
T.throws(() => I.tokenize("'\\uZZZZ'"), '非法的 \\u 转义要报错');

/* 下面这组同样是「先问原生」，但原生对这些输入是抛错而不是给值，
   不能套用 sameAsNative（nativeValue 会直接把异常炸出测试文件）——
   所以先确认原生自己也抛，再确认我们抛，两者都断言，而不是只断言
   我们抛（那样万一我对原生行为的记忆有误，测试也发现不了）。 */
function nativeRejects(src, label) {
  let threwNatively = false;
  try { nativeValue(src); } catch (e) { threwNatively = true; }
  T.ok(threwNatively, label + '（先确认原生自己也拒绝）：' + src);
  T.throws(() => I.tokenize(src), label + '：' + src);
}
nativeRejects('0xZZ', '0x 后面一个合法十六进制数字都没有');
nativeRejects('0o19', '八进制里出现非法数字 9');
nativeRejects('0b12', '二进制里出现非法数字 2');
nativeRejects('1e', '指数标记后面没有数字');
nativeRejects('1ex', '指数标记后面跟的不是数字');
nativeRejects('5g', '数字字面量后面紧跟标识符字符');

/* ---- 额外验证：反斜杠 + 真实换行是「续行」，整体消失而不是被添成
   一个换行字符（原生在两种模式下都这样，不是严格模式限定的怪癖，
   跟上面 C1「裸换行必须报错」是两回事：这里的换行前面有转义反斜杠）---- */
sameAsNative("'a\\\nb'", '反斜杠 + 真实换行是续行，整体消失');

/* ---- 额外验证：前导零的旧式八进制/十进制字面量（017 / 08）----
   这条规格与审查都没点名，是我自己在实现 0o/0b 时顺手发现的邻近坑：
   `new Function` 默认非严格模式，017 会被当成旧式八进制（=15），
   08 会被当成「不算合法旧式八进制、但仍按十进制退让」的怪异值（=8）——
   两种都是历史包袱，且都不是「跟原生一致」这条判据本身要求我们必须
   模拟的通用语义（教学工具的 PARAMS/SCENES 心智模型里没有人会写
   017）。选择明确拒绝，而不是悄悄照抄这份非严格模式的历史兼容行为，
   或者更糟——两种都不模拟、静默给出第三种不上不下的值（之前就是这样：
   017 会被当成十进制 17，跟原生的两种解释都对不上）。这是一个不跟随
   sameAsNative 判据的主动选择，不是遗漏，已经在报告里向协调者点明。 */
T.throws(() => I.tokenize('017'), '前导零字面量：明确拒绝，不悄悄照抄非严格模式的历史兼容行为');
T.throws(() => I.tokenize('08'), '前导零字面量（08 在非严格模式下是十进制 8 这种更怪的历史包袱）：同样拒绝');
T.eq(I.tokenize('0').filter(t => t.type !== 'eof')[0].value, 0, '单独的 0 不受影响');
T.eq(I.tokenize('0.5').filter(t => t.type !== 'eof')[0].value, 0.5, '0 打头的正常小数不受影响');

// ---- 表达式解析：结构 ----
function P(src) { return I.parseExpression(src); }

T.eq(P('1').type, 'Num', '数字字面量');
T.eq(P('x').type, 'Ident', '标识符');
T.eq(P('true').value, true, 'true 是布尔不是标识符');
T.eq(P('null').type, 'Null', 'null 有自己的节点类型');

// 优先级：a + b * c 必须是 a + (b * c)
const prec = P('a + b * c');
T.eq(prec.op, '+', '顶层是加法');
T.eq(prec.right.op, '*', '乘法在右子树 —— 优先级正确');

// 左结合：a - b - c 必须是 (a - b) - c
const assoc = P('a - b - c');
T.eq(assoc.left.op, '-', '减法左结合');

// 逻辑运算与关系运算的相对优先级
const mix = P('a < b && c > d');
T.eq(mix.type, 'Logical', '顶层是逻辑与');
T.eq(mix.left.op, '<', '关系运算优先于逻辑运算');

// 成员、下标、调用可以链起来
const chain = P('a.b[0](x)');
T.eq(chain.type, 'Call', '最外层是调用');
T.eq(chain.callee.type, 'Member', '被调用的是成员表达式');
T.eq(chain.callee.computed, true, '最内一层是下标');
T.eq(chain.callee.obj.type, 'Member', '再里面是点访问');
T.eq(chain.callee.obj.computed, false, '点访问 computed=false');
T.eq(chain.callee.obj.prop, 'b', '点访问的属性名是字符串');

// 数组与对象
T.eq(P('[1, 2]').elements.length, 2, '数组字面量');
T.eq(P('{ a: 1, b: 2 }').props.map(p => p.key), ['a', 'b'], '对象字面量的键');

// 箭头函数
const arrow = P('(a, b) => a + b');
T.eq(arrow.type, 'Arrow', '箭头函数');
T.eq(arrow.params, ['a', 'b'], '参数名');
T.eq(arrow.expression, true, '表达式体');
T.eq(P('x => x').params, ['x'], '单参数可以不带括号');

// 前缀与后缀
T.eq(P('i++').type, 'Update', '后缀自增');
T.eq(P('i++').prefix, false, '后缀');
T.eq(P('!ok').type, 'Unary', '逻辑非');
T.eq(P('-n').op, '-', '一元负号');

// 赋值是右结合的表达式
T.eq(P('a = b').type, 'Assign', '赋值');
T.eq(P('a += 1').op, '+=', '复合赋值');

// 位置信息
const posn = I.parseExpression('a +\n  bbb');
T.eq(posn.right.line, 2, '右操作数在第 2 行');
T.eq(posn.right.col, 3, '右操作数在第 3 列');

// 三元不在子集内（规格 §2.6 的清单没有它；§9 说清单是硬边界）
try { P('a ? b : c'); T.ok(false, '三元运算符应当被拒绝'); }
catch (e) { T.eq(e.category, 'unsupported', '三元报的是 unsupported 而不是 syntax'); }

// ---- 语句解析 ----
function S(src) { return I.parse(src).body; }

T.eq(S('let x = 1;')[0].type, 'VarDecl', '变量声明');
T.eq(S('let x = 1;')[0].kind, 'let', 'kind 区分 let/const');
T.eq(S('x = 2;')[0].type, 'ExprStmt', '表达式语句');
T.eq(S('if (a) b(); else c();')[0].type, 'If', 'if/else');
T.ok(S('if (a) b();')[0].alt === null, '没有 else 时 alt 为 null');
T.eq(S('for (let i = 0; i < 3; i++) {}')[0].type, 'For', 'for');
T.eq(S('for (const v of xs) {}')[0].type, 'ForOf', 'for…of');
T.eq(S('for (const v of xs) {}')[0].name, 'v', 'for…of 的绑定名');
T.eq(S('while (a) {}')[0].type, 'While', 'while');
T.eq(S('function f(a, b) { return a; }')[0].type, 'FuncDecl', '函数声明');
T.eq(S('function f(a, b) { return a; }')[0].params, ['a', 'b'], '形参');
T.eq(S('{ let a = 1; }')[0].type, 'Block', '块语句');

// 分号可省（ASI 的极简版：换行或 } 处结束）
T.eq(S('let a = 1\nlet b = 2').length, 2, '不写分号也能解析出两条语句');

// ---- 不支持的语法：行、列、类别（阶段 3b 的波浪线全靠这三样）----
function bad(src) {
  try { I.parse(src); return null; }
  catch (e) { return { line: e.line, col: e.col, category: e.category, message: e.message }; }
}

const cls = bad('let a = 1;\nclass Foo {}');
T.eq(cls.category, 'unsupported', 'class 是 unsupported 不是 syntax');
T.eq(cls.line, 2, '报在第 2 行');
T.eq(cls.col, 1, '报在第 1 列');
T.ok(/class/.test(cls.message), '消息里点名了 class：' + cls.message);

T.eq(bad('try { a(); } catch (e) {}').category, 'unsupported', 'try/catch 不支持');
T.eq(bad('async function f() {}').category, 'unsupported', 'async 不支持');
T.eq(bad('const [a, b] = xs;').category, 'unsupported', '解构不支持');
T.eq(bad('f(...xs);').category, 'unsupported', '展开运算符不支持');
T.eq(bad('this.x = 1;').category, 'unsupported', 'this 不支持');
T.eq(bad('const r = /ab+/;').category, 'unsupported', '正则不支持');

// 真正的语法错误报 syntax
T.eq(bad('let x = ;').category, 'syntax', '缺少表达式是 syntax');
T.eq(bad('if (a { }').category, 'syntax', '缺少右括号是 syntax');

// 好代码不报错
T.eq(bad('let x = 1;'), null, '合法代码不抛');

// ---- 块体箭头函数（上一任务遗留的临时状态：本任务解开）----
// 上一个任务把 (a) => { ... } 暂时报成 unsupported，理由是当时还没有 Block
// 节点。现在语句解析（含 Block）已经落地，这里必须接上，Task 6 的差分测试
// 里 `const g = (a) => { return a * 2; }; return g(4);` 需要它。
const ab = I.parseExpression('(a) => { return a * 2; }');
T.eq(ab.type, 'Arrow', '块体箭头函数');
T.eq(ab.expression, false, '块体 → expression=false');
T.eq(ab.body.type, 'Block', '块体是 Block 节点');

// ---- 额外验证 1：for…in 与 for…of 的报错要点名 for…of（brief 测试没覆盖）----
// 只报「in 不支持」对使用者没用——她不知道该改成什么。文案必须提到 for...of。
const forIn = bad('for (const k in obj) {}');
T.eq(forIn.category, 'unsupported', 'for...in 是 unsupported');
T.ok(/for\.\.\.of/.test(forIn.message), 'for...in 的报错文案里点名了 for...of：' + forIn.message);

// ---- 额外验证 2：不支持关键字在不同位置时，行列要指向词本身（brief 测试没覆盖）----
const classSrc = 'let a = 1;\nlet b = 2;\n    class Foo {}';
const classPos = bad(classSrc);
T.eq(classPos.line, 3, 'class 出现在嵌套/缩进位置：报在第 3 行');
T.eq(classPos.col, classSrc.split('\n')[2].indexOf('class') + 1,
     'class 报的列正好指向 class 本身，不是行首');

const thisSrc = 'let x = 1 + this.y;';
const thisPos = bad(thisSrc);
T.eq(thisPos.line, 1, 'this 出现在表达式中间：报在第 1 行');
T.eq(thisPos.col, thisSrc.indexOf('this') + 1,
     'this 报的列指向 this 本身，不是语句开头或文件开头');

const trySrc = 'if (a) {\n  if (b) {\n    try { c(); } catch (e) {}\n  }\n}';
const tryPos = bad(trySrc);
T.eq(tryPos.line, 3, 'try 出现在嵌套块里：报在第 3 行');
T.eq(tryPos.col, trySrc.split('\n')[2].indexOf('try') + 1,
     'try 报的列指向 try 本身，不是块开头');

// ============ §7.3 差分测试骨架 ============
/* 参照实现就是 JavaScript 自己：同一份源码交给自写解释器和原生 Function，
   比对返回值与宿主调用序列。任何不一致即失败。这是本阶段最强的一道门——
   不需要人工写期望值，也就不会出现「期望值本身写错了」这种事。 */
function diff(src, label) {
  const ops = [];
  const hostFor = (sink) => ({
    log: (m) => { sink.push(['log', m]); },
    mark: (sq, kind) => { sink.push(['mark', sq, kind]); },
    place: (sq, p) => { sink.push(['place', sq, p]); },
    clear: (sq) => { sink.push(['clear', sq]); },
    attacked: (sq) => { sink.push(['attacked', sq]); return false; },
  });

  const nativeOps = [];
  const nh = hostFor(nativeOps);
  let nativeVal, nativeErr = null;
  try {
    nativeVal = new Function('log', 'mark', 'place', 'clear', 'attacked',
      '"use strict";' + src)(nh.log, nh.mark, nh.place, nh.clear, nh.attacked);
  } catch (e) { nativeErr = String(e.message); }

  const interpOps = [];
  const ih = hostFor(interpOps);
  let interpVal, interpErr = null;
  try { interpVal = I.run(src, { host: ih }).result; }
  catch (e) { interpErr = String(e.message); }

  T.eq(interpErr, nativeErr, label + ' —— 抛错行为一致');
  T.eq(interpVal, nativeVal, label + ' —— 返回值一致');
  T.eq(interpOps, nativeOps, label + ' —— 宿主调用序列一致');
}

// ---- 算术与比较 ----
diff('return 1 + 2 * 3;', '运算优先级');
diff('return (1 + 2) * 3;', '括号');
diff('return 7 % 3;', '取模');
diff('return 7 / 2;', '除法保留小数');
diff('return -5 + 3;', '一元负号');
diff('return 1 < 2;', '小于');
diff('return 2 === 2;', '严格相等');
diff('return 2 !== 3;', '严格不等');
diff('return "a" + "b";', '字符串拼接');
diff('return "a" + 1;', '字符串与数字相加');

// ---- 短路求值：必须真的短路（宿主序列会暴露有没有多算）----
diff('return false && log("no");', '&& 短路：右侧不该被求值');
diff('return true || log("no");', '|| 短路：右侧不该被求值');
diff('log("a"); return true && log("b");', '&& 不短路时右侧要求值');
diff('return null;', 'null');
diff('return !0;', '逻辑非');

// ---- 变量 ----
diff('let a = 1; a = a + 1; return a;', '赋值');
diff('let a = 1; a += 5; return a;', '复合赋值');
diff('let i = 0; i++; return i;', '后缀自增');
diff('let i = 0; return i++;', '后缀自增返回旧值');
diff('let i = 0; return ++i;', '前缀自增返回新值');
diff('const c = 3; return c * 2;', 'const');

// ---- 数组与对象 ----
diff('const a = [1, 2, 3]; return a[1];', '数组下标');
diff('const a = [1, 2, 3]; a[0] = 9; return a[0];', '数组下标赋值');
diff('const a = [1, 2, 3]; return a.length;', '数组 length');
diff('const o = { x: 1 }; return o.x;', '对象属性');
diff('const o = { x: 1 }; o.y = 2; return o.y;', '对象属性赋值');
diff('const o = { x: 1 }; return o["x"];', '对象下标访问');

// ---- 模板串 ----
diff('const r = 3, c = 5; return `try (${r},${c})`;', '模板串插值');
diff('return `plain`;', '无插值的模板串');

// ---- 宿主桥接 ----
diff('log("hello"); return 1;', '宿主 log');
diff('mark(12, "trying"); clear(12); return 0;', '宿主 mark/clear');
diff('return attacked(9);', '宿主 attacked 的返回值');

// ---- 额外补充：短路求值的调用顺序（brief 只给了单个 &&/|| 短路，这里补
//      混合优先级下的调用顺序）。本任务还没有函数声明/递归（Task 6 才有），
//      所以调用顺序只能借宿主函数（log/mark/attacked）来暴露，不借用户
//      自定义函数——log 恒返回 undefined（假），attacked 恒返回 false（假），
//      正好够摆出「左边假才走右边」「左边真就跳过右边」两种局面。 ----
diff('return log("a") && log("b") || log("c");',
     'a && b || c：a 假（log 返回 undefined）跳过 b，落到 c');
diff('return attacked(1) || log("fallback");',
     'a || b：a 假（attacked 恒 false）才调用 b');
diff('return attacked(1) && log("never") || mark(2, "x");',
     'a && b || c：a 假跳过 b，c 仍执行（混合宿主调用的短路顺序）');
diff('let a = [1]; return a.length && log("nonempty");',
     '&&：非调用的真值左操作数（数组 length）仍然让右边求值');

// ---- 额外补充：内建函数——每加一个都要有差分测试盯着原生边界行为 ----
diff('const a = []; a.push(1); a.push(2); return a;', 'push 返回/追加');
diff('const a = [1, 2, 3]; const v = a.pop(); return [v, a];', 'pop 返回被弹出的值');
diff('const a = []; return a.pop();', '空数组 pop 返回 undefined');
diff('return Math.abs(-5);', 'Math.abs 负数');
diff('return Math.abs(5);', 'Math.abs 正数');
diff('return Math.max(1, 5, 3);', 'Math.max 多参数');
diff('return Math.min(1, 5, 3);', 'Math.min 多参数');
diff('return Math.floor(2.7);', 'Math.floor 正数');
diff('return Math.floor(-0.5);', 'Math.floor 负数：向下取整不是截断');

// ---- 控制流（全部走差分）----
diff('if (1 < 2) { log("y"); } else { log("n"); } return 0;', 'if 走 then 分支');
diff('if (1 > 2) { log("y"); } else { log("n"); } return 0;', 'if 走 else 分支');
diff('if (0) log("y"); return 1;', '无 else 的 if');
diff('let s = 0; for (let i = 0; i < 5; i++) { s += i; } return s;', 'for 累加');
diff('for (let i = 0; i < 3; i++) log(i); return 0;', 'for 的宿主序列');
diff('let s = 0; for (const v of [1,2,3]) { s += v; } return s;', 'for…of 数组');
diff('for (const c of "abc") log(c); return 0;', 'for…of 字符串');
diff('let i = 0; while (i < 3) { log(i); i++; } return i;', 'while');
diff('for (let i = 0; i < 5; i++) { if (i === 2) break; log(i); } return 0;', 'break');
diff('for (let i = 0; i < 5; i++) { if (i === 2) continue; log(i); } return 0;', 'continue');
diff('let i = 0; while (true) { i++; if (i > 3) break; } return i;', 'while(true) + break');
diff('for (const v of [1,2,3]) { if (v === 2) continue; log(v); } return 0;', 'for…of 里 continue');

// 嵌套循环里的 break 只跳出内层
diff('let n = 0; for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) { if (j === 1) break; n++; } } return n;',
     '嵌套 break 只跳内层');

// 块作用域：内层的 let 不该泄漏到外层
diff('let a = 1; { let a = 2; log(a); } log(a); return a;', '块作用域遮蔽');
diff('for (let i = 0; i < 2; i++) {} let i = 9; return i;', 'for 的 i 不泄漏到外层');

// ---- 携带项 A：同作用域重复声明要报错，不同作用域遮蔽合法（上面已有一条差分在测遮蔽）----
diff('let a = 1; let a = 2; return a;', '同作用域重复 let 声明：原生 SyntaxError');
diff('const a = 1; let a = 2; return a;', '同作用域先 const 后 let 重复声明：原生 SyntaxError');
diff('let a = 1; const a = 2; return a;', '同作用域先 let 后 const 重复声明：原生 SyntaxError');
// 宿主桥接名（log/mark/place/clear/attacked）在求值器里是根环境的 const
// 绑定——这条设计选择要跟差分测试的参照实现（new Function('log', ...,
// src) 把它们当形参）在「顶层用 let 重新声明同名变量」这件事上表现一致：
// 形参名同样占据函数体的顶层作用域，let 重新声明它一样是原生 SyntaxError。
diff('let log = 5; return log;', '顶层用 let 重新声明宿主桥接名 log：原生视作形参重声明，SyntaxError');

// ---- 携带项 B：for 头部支持逗号多声明 ----
// 更新部分只用 i++（单表达式）：逗号操作符（sequence expression，i++, j--
// 这种写法）不在这个子集内——parseExpr 没有实现它，这条差分测试只验证
// brief 要求的那一件事（for 头部的逗号多声明能解析、能求值），不顺带
// 引入一个子集边界之外的语法点。
diff('let n = 0; for (let i = 0, j = 3; i < j; i++) { n++; } return n;', 'for 头部逗号多声明');

// ---- 每轮迭代新建一层环境：闭包捕获要与原生 let 语义一致 ----
// 函数调用是下一个任务（Task 6）才实现，这里借数组 + 立即执行的箭头函数
// （Arrow 节点在 Task 4 已经能构造出来，但调用它要等 Task 6）不可行；
// 改用「每轮迭代把当次的 i 存进数组，最后返回数组」的方式验证同一件事：
// 如果 for 每轮不新建环境，所有闭包/引用会共享同一个绑定。这里用数组
// 元素直接观测每轮迭代看到的 i 值本身（而不是闭包），已经能被差分测试
// 覆盖到「for 头部声明的变量在语义上是每轮一份」这件事的最基本形式；
// 闭包捕获的差异要等 Task 6 才能真正暴露（届时应补一条 diff）。
diff('const xs = []; for (let i = 0; i < 3; i++) { xs.push(i); } return xs;',
     'for 每轮迭代的 i 各自独立（数组快照）');

// ============ Task 6：函数、闭包与递归 ============

// ---- 函数 ----
diff('function f(a, b) { return a + b; } return f(1, 2);', '函数声明与调用');
diff('function f() { } return f();', '无返回值的函数返回 undefined');
diff('function f(a) { if (a) { return 1; } return 2; } return f(0);', '提前 return');
diff('const g = (a) => a * 2; return g(4);', '箭头函数表达式体');
diff('const g = (a) => { return a * 2; }; return g(4);', '箭头函数块体');
diff('const g = x => x + 1; return g(1);', '单参数箭头函数');

// 函数声明提升：调用写在声明之前也要能跑（原生 JS 会提升）
diff('return f(); function f() { return 42; }', '函数声明提升');

// 闭包
diff('function mk(n) { return () => n; } const a = mk(1), b = mk(2); return a() + b();', '闭包各自捕获');
diff('let c = 0; function inc() { c++; } inc(); inc(); return c;', '闭包写外层变量');

// 递归 —— 回溯算法的核心
diff('function fact(n) { if (n <= 1) { return 1; } return n * fact(n - 1); } return fact(6);', '阶乘');
diff('function fib(n) { if (n < 2) { return n; } return fib(n-1) + fib(n-2); } return fib(12);', '斐波那契（深递归）');

// 互递归
diff('function ev(n) { if (n === 0) { return true; } return od(n-1); } ' +
     'function od(n) { if (n === 0) { return false; } return ev(n-1); } return ev(10);', '互递归');

// 数组作为参数按引用传递（与原生一致）
diff('function push2(a) { a.push(2); } const xs = [1]; push2(xs); return xs.length;', '数组按引用传');

// 回溯的形状：递归 + 撤销
diff('function go(d, acc) { if (d === 0) { log(acc.length); return; } acc.push(d); go(d-1, acc); acc.pop(); } ' +
     'go(3, []); return 0;', '回溯：进入时 push、返回后 pop');

// ---- Task 5 遗留的待验证点：for/for…of 每轮新环境模型，现在有函数调用
//      （闭包）了，可以真正验证——不能自己判断哪个数字对，让原生说话。 ----
diff([
  'const fs = [];',
  'for (let i = 0; i < 3; i++) { fs.push(() => i); }',
  'return fs[0]() + fs[1]() + fs[2]();',
].join('\n'), 'for 的每轮迭代各自捕获自己的 i（原生 let 语义）');

diff([
  'const fs = [];',
  'for (const v of [10, 20, 30]) { fs.push(() => v); }',
  'return fs[0]() + fs[1]() + fs[2]();',
].join('\n'), 'for…of 的每轮迭代各自捕获自己的循环变量');

// 对照：while 没有「每轮新建一层环境」的语义——它没有循环头声明这个概念，
// 循环变量 i 声明在 while 外面，全程只有一份绑定，所有闭包捕获的是
// 同一个 i，读到的都是循环结束后的最终值（原生：3+3+3=9），与上面 for
// 的 0+1+2=3 形成对比。
diff([
  'const fs = [];',
  'let i = 0;',
  'while (i < 3) { fs.push(() => i); i++; }',
  'return fs[0]() + fs[1]() + fs[2]();',
].join('\n'), 'while 没有每轮新环境：闭包共享同一个 i（与 for 不同）');

// ---- 调用深度上限：不用 diff——原生栈溢出的 RangeError 文案跟我们主动
//      拦截报出的教学向文案不是一回事，比较文案没有意义。
//
//      这条测试的历史：MAX_DEPTH 最初按计划稿写的是 1000，但实测发现
//      在嵌套生成器的委托链下，V8 自己的裸栈溢出在**远早于** 1000 层
//      就会先发生——也就是说旧的 1000 这个守卫实际上永远不会被真正
//      触发，使用者拿到的是一个对她毫无意义的引擎崩溃，而不是我们想给
//      的解释。复审后把 MAX_DEPTH 降到 500（常量旁边的注释记录了完整的
//      实测方法与数字），这条断言就是用来盯住「越界时抛的确实是我们的
//      报错、不是引擎的裸 RangeError」——没有这条断言，没有任何测试能
//      证明这道防线是活的。
//
//      递归形状特意选成「递归调用嵌在算术表达式里」（`return 1 + f(k -
//      1);`，而不是纯尾调用）——这更贴近真实的教学算法写法（回溯类算法
//      常把递归调用嵌进 `+=`/`+` 之类的表达式），也是实测中更容易先撞见
//      裸栈溢出的形状，用它来验证余量更保守、更可信。深度探测值 600 已
//      经在冷启动（全新 node 进程，只跑这一段）与预热后（跟在这个文件
//      其余 diff() 测试后面跑，讲 evalStmt/evalExpr/callInterpreted 这条
//      热路径先被 JIT 摸过一遍）两种状态下各自反复验证过，结果一致：
//      两种状态都稳稳落在 MAX_DEPTH=500 与实测真实栈上限（冷启动约
//      650～700 层、预热后约 900～1000 层）之间，不是卡在边界上凑巧
//      通过。 ----
let deepErr = null;
try {
  I.run('function f(k){ if(k<=0){return 0;} return 1+f(k-1); } return f(600);', { host: {} });
} catch (e) { deepErr = e; }
T.ok(deepErr, '超过深度上限要抛错');
T.eq(deepErr && deepErr.category, 'runtime', '抛的是我们的 runtime 错，不是引擎的 RangeError');
T.ok(deepErr && /depth/i.test(deepErr.message), '消息提到深度：' + (deepErr && deepErr.message));
T.eq(deepErr && deepErr.message,
     'Maximum call depth exceeded (500). Either this recursion is missing its base case, ' +
     'or it simply nests deeper than this interpreter supports — try rewriting it as a loop.',
     'MAX_DEPTH 报错文案：给出限值、两种成因、一条出路');

// 深递归但没超限：fib(12) 已经覆盖了「有意义深度但没触顶」的情形（见上）；
// 这里额外确认 N 皇后规模（N=12）的递归深度稳稳落在上限之内。
diff('function depth(n) { if (n <= 0) { return 0; } return 1 + depth(n - 1); } return depth(12);',
     '递归深度 12（N 皇后 N≤12 的规模）远低于 MAX_DEPTH，正常返回');

// 合法的深递归（节点数上千，但调用深度只有 15）仍然要能正常跑完——
// 降低 MAX_DEPTH 不能误伤这类教学场景常见的深度。
diff('function fib(n){ if(n<2){return n;} return fib(n-1)+fib(n-2); } return fib(15);',
     '深递归 fib(15)：调用深度仅 15，节点数上千，压一压性能与正确性');

// ============ Task 7：宿主桥接与可反放的轨迹 ============
// 逐字采用任务简报 task-7-brief.md 里给出的测试代码。

// ---- 轨迹结构 ----
const tr1 = I.run('let a = 1;\nlet b = 2;\na = 3;', { host: {} }).trace;
T.ok(tr1.length >= 3, '三条语句至少三步');
T.eq(tr1.map(s => s.line).slice(0, 3), [1, 2, 3], '每步记下它所在的行');
T.eq(tr1[0].varDelta, [{ name: 'a', from: undefined, to: 1 }], '声明记为 from=undefined');
T.eq(tr1[2].varDelta, [{ name: 'a', from: 1, to: 3 }], '赋值记下旧值 —— 反放要靠它撤销');

// depth：步入/步过/步出的唯一依据
const tr2 = I.run('function f() { return 1; }\nf();', { host: {} }).trace;
T.ok(tr2.some(s => s.depth > 0), '进入函数后 depth 增大');
T.ok(tr2.some(s => s.frameOp === 'push'), '有入帧标记');
T.ok(tr2.some(s => s.frameOp === 'pop'), '有出帧标记');
T.eq(tr2[tr2.length - 1].depth, 0, '跑完回到深度 0');

// 宿主 op 自带撤销信息
const ops = I.run('mark(5, "trying");\nmark(5, "confirmed");', { host: {} }).trace
  .filter(s => s.boardOps.length).map(s => s.boardOps[0]);
T.eq(ops[0], { kind: 'mark', sq: 5, to: 'trying', from: null }, '首次标记 from=null');
T.eq(ops[1], { kind: 'mark', sq: 5, to: 'confirmed', from: 'trying' }, '再次标记记下旧值');

// 日志进 out
const outs = I.run('log("a");\nlog("b");', { host: {} }).trace.filter(s => s.out).map(s => s.out);
T.eq(outs, ['a', 'b'], '日志逐步记进 out');

// ---- 决定 3：轨迹存深拷贝，不存活引用 ----
/* 这条是本任务最容易做错、也最难在别处发现的地方：如果 varDelta 里存的是
   同一个数组引用，那么程序后续对它的修改会「改写历史」—— 回放到第 2 步时
   看到的是第 4 步的内容。 */
const alias = I.run('const xs = [];\nxs.push(1);\nxs.push(2);', { host: {} }).trace;
const firstXs = alias[0].varDelta.find(d => d.name === 'xs');
T.eq(firstXs.to, [], '第 1 步记下的 xs 必须仍然是空数组（不能被后续 push 改写）');

// ---- 反放：沿轨迹倒着撤销，能回到初始状态 ----
/* 这是「后退」功能的正确性判据。用一个纯函数模拟调试器的做法：
   正放时应用 to，反放时应用 from。 */
function replayVars(trace, upto) {
  const env = {};
  for (let i = 0; i < upto; i++) for (const d of trace[i].varDelta) env[d.name] = d.to;
  return env;
}
function rewindVars(trace, from, to) {
  const env = replayVars(trace, from);
  for (let i = from - 1; i >= to; i--) {
    for (const d of trace[i].varDelta) {
      if (d.from === undefined) delete env[d.name]; else env[d.name] = d.from;
    }
  }
  return env;
}
const rw = I.run('let a = 1;\na = 2;\na = 3;', { host: {} }).trace;
T.eq(replayVars(rw, 3).a, 3, '正放到第 3 步 a=3');
T.eq(rewindVars(rw, 3, 1).a, 1, '从第 3 步反放回第 1 步，a 回到 1');
T.eq(rewindVars(rw, 3, 0).a, undefined, '反放到第 0 步，a 不存在');

T.report();
