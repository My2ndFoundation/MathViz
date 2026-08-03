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
T.ok(typeof rewindVars(rw, 3, 0).a === 'undefined', '反放到第 0 步，a 不存在');

// ---- Gap 1（协调者审查发现）：块作用域遮蔽下，扁平按名回放必须与
//      程序的真实语义一致。没有「声明记下被遮蔽的旧值」+「作用域退出时
//      补一条恢复 delta」这两件事，调试器的变量面板会在块结束后继续
//      显示内层的值——对一个教学工具，显示一个错的变量值比崩溃更糟，
//      她会以为是自己理解错了。 ----
const sh = I.run('let a = 1;\n{ let a = 2; }\nreturn a;', { host: {} }).trace;
T.eq(replayVars(sh, sh.length).a, 1, '正放到末尾，a 是外层的 1 而不是内层的 2');
T.eq(rewindVars(sh, sh.length, 1).a, 1, '反放回第 1 步，a 是外层的 1');
T.ok(typeof rewindVars(sh, sh.length, 0).a === 'undefined', '反放到第 0 步，a 尚不存在');

// 顺带确认 for 的「每轮新环境」（Task 5 按 ECMA-262 实现的那个）在同一套
// 规则下也正确——循环变量在整个 for 语句退出后必须从扁平回放里消失，
// 不能继续显示循环体内最后一轮的值。
const forSh = I.run('let i = 99;\nfor (let i = 0; i < 3; i++) {}\nreturn i;', { host: {} }).trace;
T.eq(replayVars(forSh, forSh.length).i, 99,
     'for 头部声明的 i 遮蔽外层同名变量，for 退出后扁平回放要看到外层的 99，不是循环体最后的 3');

// ---- 步数上限：同时是死循环保护（规格 §2.8）----
// 复审 I3：50,000 装不下本文件自己后面测的 N 皇后 N=8（实测 73,904 步），
// 改成 200,000（约 2.7 倍余量），细节与实测数字见 interp.js 里
// STEP_LIMIT 常量旁边的注释。
T.eq(I.STEP_LIMIT, 200000, '默认上限 200,000 步（复审 I3：50,000 装不下 N=8 皇后）');

const loop = I.run('let i = 0;\nwhile (true) { i++; }', { host: {}, limit: 500 });
T.eq(loop.trace.truncated, true, '死循环被上限截住，不是卡死');
T.eq(loop.trace.limit, 500, '记下当时生效的上限');
T.ok(loop.trace.length <= 500, '轨迹不超过上限');

/* 不编造「省略了 N 步」：到达上限时执行已经停止，我们并不知道还剩多少步，
   而要知道就得跑完 —— 可上限的另一个身份正是死循环保护。规格 §2.6 那句
   「省略 N 步」与 §2.8 的「执行上限」互相冲突，本阶段按 §2.8 裁定。 */
T.ok(typeof loop.trace.omitted === 'undefined', '不报一个我们不知道的数字');

// 正常结束的程序不该被标 truncated
const fine = I.run('let s = 0; for (let i = 0; i < 10; i++) { s += i; } return s;', { host: {} });
T.eq(fine.trace.truncated, false, '正常结束不标截断');
T.eq(fine.result, 45, '正常结束返回正确结果');

// 调用深度上限（Task 6）在这里一并回归
let depthErr = null;
try { I.run('function f() { return f(); } return f();', { host: {} }); }
catch (e) { depthErr = e; }
T.ok(depthErr, '无穷递归被拦住');
T.eq(depthErr.category, 'runtime', '类别是 runtime');
T.ok(/depth/i.test(depthErr.message), '消息提到深度：' + (depthErr && depthErr.message));

// ============ 六道算法题的形状（为阶段 3a 排雷）============
/* 阶段 5 才写真正的六道题，但**它们的范式**现在就能验：回溯、贪心启发式、
   BFS、匹配、支配集。如果某个范式现在在这个子集里写不出来，等到阶段 5
   才发现就晚了 —— 那时要改的是解释器，而解释器已经被四个工具内联了。 */

// ① N 皇后（回溯 + 剪枝）—— tourDFS/queens/independent 共用这个范式
diff([
  'function solve(N) {',
  '  const cols = [], d1 = [], d2 = [];',
  '  let count = 0;',
  '  function place(r) {',
  '    if (r === N) { count++; return; }',
  '    for (let c = 0; c < N; c++) {',
  '      if (cols[c] || d1[r + c] || d2[r - c + N]) { continue; }',
  '      cols[c] = 1; d1[r + c] = 1; d2[r - c + N] = 1;',
  '      mark(r * N + c, "trying");',
  '      place(r + 1);',
  '      cols[c] = 0; d1[r + c] = 0; d2[r - c + N] = 0;',
  '      clear(r * N + c);',
  '    }',
  '  }',
  '  place(0);',
  '  return count;',
  '}',
  'return solve(6);',
].join('\n'), '① N 皇后 N=6（解数应为 4，由原生 JS 自己算）');

// ② 骑士巡游 · Warnsdorff（贪心启发式）
diff([
  'const DX = [1,2,2,1,-1,-2,-2,-1], DY = [2,1,-1,-2,-2,-1,1,2];',
  'function tour(n, sr, sc) {',
  '  const seen = [];',
  '  for (let i = 0; i < n * n; i++) { seen.push(0); }',
  '  function deg(r, c) {',
  '    let d = 0;',
  '    for (let k = 0; k < 8; k++) {',
  '      const nr = r + DY[k], nc = c + DX[k];',
  '      if (nr >= 0 && nr < n && nc >= 0 && nc < n && !seen[nr * n + nc]) { d++; }',
  '    }',
  '    return d;',
  '  }',
  '  let r = sr, c = sc, steps = 1;',
  '  seen[r * n + c] = 1;',
  '  place(r * n + c, "N");',
  '  for (let s = 1; s < n * n; s++) {',
  '    let best = -1, bd = 9, br = -1, bc = -1;',
  '    for (let k = 0; k < 8; k++) {',
  '      const nr = r + DY[k], nc = c + DX[k];',
  '      if (nr < 0 || nr >= n || nc < 0 || nc >= n) { continue; }',
  '      if (seen[nr * n + nc]) { continue; }',
  '      const d = deg(nr, nc);',
  '      if (d < bd) { bd = d; br = nr; bc = nc; best = k; }',
  '    }',
  '    if (best < 0) { break; }',
  '    r = br; c = bc; seen[r * n + c] = 1; steps++;',
  '    place(r * n + c, "N");',
  '  }',
  '  return steps;',
  '}',
  'return tour(5, 0, 0);',
].join('\n'), '② 骑士巡游 Warnsdorff 5×5');

// ③ 马的最短路（BFS）
diff([
  'const DX = [1,2,2,1,-1,-2,-2,-1], DY = [2,1,-1,-2,-2,-1,1,2];',
  'function bfs(n, sr, sc, tr, tc) {',
  '  const dist = [];',
  '  for (let i = 0; i < n * n; i++) { dist.push(-1); }',
  '  let q = [sr * n + sc];',
  '  dist[sr * n + sc] = 0;',
  '  while (q.length > 0) {',
  '    const nq = [];',
  '    for (const cell of q) {',
  '      const r = (cell - cell % n) / n, c = cell % n;',
  '      if (r === tr && c === tc) { return dist[cell]; }',
  '      for (let k = 0; k < 8; k++) {',
  '        const nr = r + DY[k], nc = c + DX[k];',
  '        if (nr < 0 || nr >= n || nc < 0 || nc >= n) { continue; }',
  '        if (dist[nr * n + nc] >= 0) { continue; }',
  '        dist[nr * n + nc] = dist[cell] + 1;',
  '        mark(nr * n + nc, "frontier");',
  '        nq.push(nr * n + nc);',
  '      }',
  '    }',
  '    q = nq;',
  '  }',
  '  return -1;',
  '}',
  'return bfs(8, 0, 0, 7, 7);',
].join('\n'), '③ 马的最短路 a1→h8（原生 JS 会算出 6）');

// ④ 二分图匹配的增广路（rookCover 的范式）
diff([
  'function match(n, adj) {',
  '  const to = [];',
  '  for (let i = 0; i < n; i++) { to.push(-1); }',
  '  function aug(u, seen) {',
  '    for (const v of adj[u]) {',
  '      if (seen[v]) { continue; }',
  '      seen[v] = 1;',
  '      if (to[v] < 0) { to[v] = u; return true; }',
  '      if (aug(to[v], seen)) { to[v] = u; return true; }',
  '    }',
  '    return false;',
  '  }',
  '  let m = 0;',
  '  for (let u = 0; u < n; u++) {',
  '    const seen = [];',
  '    for (let i = 0; i < n; i++) { seen.push(0); }',
  '    if (aug(u, seen)) { m++; log("matched " + u); }',
  '  }',
  '  return m;',
  '}',
  'return match(3, [[0,1],[0],[1,2]]);',
].join('\n'), '④ 二分图匹配增广路');

// ⑤ 贪心支配集（kingDominate 的范式）
diff([
  'function greedy(n, sets) {',
  '  const covered = [];',
  '  for (let i = 0; i < n; i++) { covered.push(0); }',
  '  let picked = 0, left = n;',
  '  while (left > 0) {',
  '    let best = -1, bestGain = 0;',
  '    for (let s = 0; s < sets.length; s++) {',
  '      let gain = 0;',
  '      for (const v of sets[s]) { if (!covered[v]) { gain++; } }',
  '      if (gain > bestGain) { bestGain = gain; best = s; }',
  '    }',
  '    if (best < 0) { break; }',
  '    for (const v of sets[best]) { if (!covered[v]) { covered[v] = 1; left--; } }',
  '    picked++;',
  '    mark(best, "confirmed");',
  '  }',
  '  return picked;',
  '}',
  'return greedy(6, [[0,1,2],[2,3],[3,4,5],[1,4]]);',
].join('\n'), '⑤ 贪心集合覆盖');

// ⑥ 极小博弈树 + α-β（工具④ 的范式）
diff([
  'const LEAF = [3,5,6,9,1,2,0,-1];',
  'let visited = 0;',
  'function ab(i, d, a, b, maxing) {',
  '  visited++;',
  '  if (d === 0) { return LEAF[i]; }',
  '  if (maxing) {',
  '    let best = -999;',
  '    for (let k = 0; k < 2; k++) {',
  '      const v = ab(i * 2 + k, d - 1, a, b, false);',
  '      if (v > best) { best = v; }',
  '      if (best > a) { a = best; }',
  '      if (b <= a) { log("prune"); break; }',
  '    }',
  '    return best;',
  '  }',
  '  let best = 999;',
  '  for (let k = 0; k < 2; k++) {',
  '    const v = ab(i * 2 + k, d - 1, a, b, true);',
  '    if (v < best) { best = v; }',
  '    if (best < b) { b = best; }',
  '    if (b <= a) { log("prune"); break; }',
  '  }',
  '  return best;',
  '}',
  'const r = ab(0, 3, -999, 999, true);',
  'log("visited " + visited);',
  'return r;',
].join('\n'), '⑥ α-β 剪枝（剪枝序列必须与原生逐条一致）');

// ============ 最终审核修复轮（final-review.md 的 A/B/C 三节）============

// ---- A-1：'++'/'--' 必须先做 ToNumber，不能对字符串做拼接 ----
// 复审 C1：'--' 侥幸正确（一元 '-' 本身就强制转数字），'++' 原来
// `old + 1` 对字符串是拼接不是加法。六种组合逐一锁住，覆盖前缀/后缀、
// 变量/数组下标/对象属性三种赋值目标。
diff('let x = "5"; x++; return x;', 'A1: 字符串 x++（后缀，读结果）');
diff('let x = "5"; let y = x++; return y;', 'A1: 字符串 x++ 的返回值也是数字，不是原字符串');
diff('let x = "5"; return ++x;', 'A1: 字符串 ++x（前缀，返回新值）');
diff('let a = ["3"]; a[0]++; return a[0];', 'A1: 数组元素 a[0]++');
diff('let o = { v: "3" }; o.v++; return o.v;', 'A1: 对象属性 o.v++');
diff('let x = "7"; let y = x++; return y + 1;', 'A1: 字符串 x++ 返回值参与后续运算');
diff('let x = "5"; x--; return x;', 'A1 对照: 字符串 x--（回归，"--" 本来就是对的）');
diff('let x = true; x++; return x;', 'A1 对照: 布尔值 ++（回归）');
diff('let x = null; x++; return x;', 'A1 对照: null 的 ++（回归）');

// ---- A-2：snap() 遇到环形引用不能把引擎栈打爆 ----
// 复审 C2：四种最普通的写法（closeScope / 函数返回 / 形参绑定 /
// assignVar）都会让一个环形引用值经过 snap()，改之前全部无限递归、
// 报无行列信息的引擎 RangeError。
const circularCases = [
  { src: '{ const o = {}; o.self = o; }', label: '块退出（closeScope）遇到环形引用' },
  { src: 'function f(){ const o={}; o.self=o; return 1; } return f();', label: '函数返回时环形引用经过声明快照' },
  { src: 'function f(x){ return 1; } const o={}; o.self=o; return f(o);', label: '形参绑定时环形引用经过 declareVar' },
  { src: 'let o={},p={}; o.p=p; p.o=o; o = 1; return 0;', label: '重新赋值经过 assignVar 时的双向环' },
];
for (const c of circularCases) {
  let threw = null, result;
  try { result = I.run(c.src, { host: {} }).result; } catch (e) { threw = e; }
  T.eq(threw, null, 'A2 不崩：' + c.label + (threw ? ('（实际抛出：' + threw.message + '）') : ''));
}
// 用带块退出的写法（而不是顶层）——顶层 Program 不会在 run() 结束时补
// closeScope，property 写入本身也不产生 varDelta，必须让 o 真正离开一层
// 块作用域才会触发 snap()。
const circTrace = I.run('{ const o = {}; o.self = o; }', { host: {} }).trace;
T.ok(JSON.stringify(circTrace).indexOf('环形引用') >= 0,
     'A2: 环形引用在轨迹快照里显示占位符，而不是被深拷贝到无限深');

// ---- A-3：函数值不能泄漏解释器内部对象（params/body/closure/expression）----
// 复审 C3：makeFunction 的 __fn 对象 typeof 是 'object'，改之前 getProp 的
// hasOwnProperty 通道会把这些内部字段照单全收，被解释的程序可以据此关掉
// MAX_DEPTH/STEP_LIMIT 两道守卫、伪造轨迹。只留 name/length 两个原生也有
// 的属性可读，其余一律 undefined；写入一律报错。
diff('function f(){} return f.closure;', 'A3: f.closure 不可见（原生本来就是 undefined）');
diff('function f(){} return f.body;', 'A3: f.body 不可见');
diff('function f(){} return f.params;', 'A3: f.params 不可见');
diff('function f(){} return f.expression;', 'A3: f.expression 不可见');
diff('function f(a, b) {} return f.length;', 'A3: f.length 返回形参个数（原生行为，不是内部字段）');
diff('function foo() {} return foo.name;', 'A3: foo.name 返回函数名（原生行为）');

let closureLeakErr = null;
try {
  I.run('function f(k){ if(k<=0){return 0;} f.closure.callDepth.n = 0; return 1+f(k-1); } return f(100000);',
        { host: {} });
} catch (e) { closureLeakErr = e; }
T.ok(closureLeakErr, 'A3: 试图用 f.closure.callDepth 关掉 MAX_DEPTH 守卫必须失败');
T.eq(closureLeakErr && closureLeakErr.category, 'runtime',
     'A3: 失败原因是"closure 不存在"，不是绕过守卫后引擎自己的 RangeError');

let traceForgeErr = null;
try { I.run('function f(){} f.closure.rec.trace.pop();', { host: {} }); }
catch (e) { traceForgeErr = e; }
T.ok(traceForgeErr, 'A3: 试图用 f.closure.rec.trace 伪造轨迹必须失败');

let setFnPropErr = null;
try { I.run('function f(){} f.closure = 1;', { host: {} }); }
catch (e) { setFnPropErr = e; }
T.ok(setFnPropErr, 'A3: 不能给函数值设置属性');
T.eq(setFnPropErr && setFnPropErr.message, 'Cannot set properties of a function', 'A3: setProp 报错文案');

// ---- B-1：'return' 后遇到换行必须触发 ASI，不能把下一行当成返回值 ----
diff('function f(){ return\n5; }\nreturn f();', 'B1: return 后换行触发 ASI，函数返回 undefined 而不是 5');
diff('function f(){\n  return\n}\nreturn f();', 'B1 对照: return 后直接是 } 换行（回归）');
diff('function f(){ return 5; }\nreturn f();', 'B1 对照: return 与返回值同一行仍然正常工作（回归）');

// ---- B-2：暂时性死区（TDZ）——块内提前引用外层同名变量必须报错 ----
diff('let x = 1;\n{ let y = x; let x = 2; return y; }',
     'B2: TDZ - 块内 let y=x 提前引用了本层稍后才声明的 x，必须报 ReferenceError（不能静默读到外层的 1）');
diff('{ x; let x = 2; return 0; }',
     'B2: TDZ - 单纯的表达式语句提前引用同一层稍后声明的名字，同样受 TDZ 约束');
diff('{ let a = 5; return a; }', 'B2 对照: 正常声明后使用（回归）');
diff('function f(){ let a = 1; return a; } return f();', 'B2 对照: 函数体内 let 不受影响（回归）');

/* 复审二轮：TDZ 在函数自己的顶层 body 里也要生效。callInterpreted 有一套
   独立于 evalBlockBody 的语句循环（为了 push/pop 帧跟踪），最初只给
   evalBlockBody 接了 hoistLexicalDecls，于是函数体顶层的前向引用绕过了
   TDZ —— 两边都抛，但抛的不是同一件事（原生："Cannot access 'x' before
   initialization"；我们改之前："x is not defined"）。 */
diff('function f(){ let y = x; let x = 2; return y; } return f();', 'B2 二轮: 函数体顶层的 TDZ');

// ---- B-4：boardOps 的撤销信息按棋子层/标记层分开记 ----
// 复审 I5：place 与 mark 曾经共用同一个影子槽，同一格先 place 再 mark
// 会把棋子的旧值当成标记的旧值读出来，clear 时只找得回后写的那一层。
{
  const ops = I.run('place("d4", "Q");\nmark("d4", "attacked");\nclear("d4");', { host: {} }).trace
    .flatMap(function (s) { return s.boardOps; });
  T.eq(ops[0], { kind: 'place', sq: 'd4', to: 'Q', from: null },
       'B4: place 记自己那层的旧值（棋子层，第一次是 null）');
  T.eq(ops[1], { kind: 'mark', sq: 'd4', to: 'attacked', from: null },
       'B4: mark 记自己那层的旧值（标记层，不该被 place 的 "Q" 污染）');
  T.eq(ops[2], { kind: 'clear', sq: 'd4', to: null, from: { piece: 'Q', mark: 'attacked' } },
       'B4: clear 清空整格，撤销信息要同时带上棋子层与标记层的旧值');
}

// ---- B-5：子集外的现代语法要分类为 unsupported，且消息要点名具体 ----
// 复审 I4：'?.'/'??' 原来的消息说自己是"三元运算符"——一句错误的提示；
// '**'/'**='/位运算符是半成品状态（词法器认识、解析器没接住）；默认/
// 剩余参数、对象简写/计算键/方法简写、标签语句都被通用 syntax 错误
// 兜底，看不出这是"不支持"而不是"写错了"。
function unsupportedCheck(src, mustContain, label) {
  let caught = null;
  try { I.parse(src); } catch (e) { caught = e; }
  T.ok(caught, label + ' —— 应该报错');
  T.eq(caught && caught.category, 'unsupported', label + ' —— category 应为 unsupported，实际: ' + (caught && caught.category));
  T.ok(caught && caught.message.indexOf(mustContain) >= 0,
       label + ' —— 消息应提到 "' + mustContain + '"，实际: ' + (caught && caught.message));
}
unsupportedCheck('return 2 ** 3;', '**', 'B5: ** 运算符（原来是 syntax："expected \\";\\" but got \\"**\\""）');
unsupportedCheck('let a = 2; a **= 3;', '**=', 'B5: **= 复合赋值');
unsupportedCheck('return 1 & 2;', '&', 'B5: 位运算 &（原来词法器直接报 Unexpected character）');
unsupportedCheck('return 1 | 2;', '|', 'B5: 位运算 |');
unsupportedCheck('return 1 ^ 2;', '^', 'B5: 位运算 ^');
unsupportedCheck('return ~1;', '~', 'B5: 按位取反 ~');
unsupportedCheck('return 1 << 2;', '<<', 'B5: 左移 <<');
unsupportedCheck('return 1 >> 2;', '>>', 'B5: 右移 >>');
unsupportedCheck('const o = {}; return o?.x;', 'optional chaining', 'B5: 可选链 ?. 的消息必须点名"可选链"');
unsupportedCheck('return a ?? 1;', '??', 'B5: 空值合并 ?? 的消息必须点名 ??');
unsupportedCheck('function f(a = 1) {}', 'default parameters', 'B5: 默认参数');
unsupportedCheck('function f(...a) {}', 'rest parameters', 'B5: 剩余参数');
unsupportedCheck('const x = 1; return { x };', 'object shorthand', 'B5: 对象属性简写');
unsupportedCheck('const k = 1; return { [k]: 1 };', 'computed object keys', 'B5: 计算属性键');
unsupportedCheck('return { f() {} };', 'method shorthand', 'B5: 方法简写');
unsupportedCheck('outer: for (;;) { break; }', 'labeled statements', 'B5: 标签语句');
// 专门确认旧的错误消息（"三元运算符"）不会再出现在 ?./?? 的报错里——
// 只查类别/关键词不够，得确认真的换掉了那句误导性的话。
(function () {
  let e1 = null, e2 = null;
  try { I.parse('const o = {}; return o?.x;'); } catch (e) { e1 = e; }
  try { I.parse('return a ?? 1;'); } catch (e) { e2 = e; }
  T.ok(e1 && e1.message.indexOf('ternary') === -1, 'B5: ?. 的消息不再提"三元运算符"');
  T.ok(e2 && e2.message.indexOf('ternary') === -1, 'B5: ?? 的消息不再提"三元运算符"');
})();
// 回归：尾随逗号一直是允许的（复审 M34：没有专门的断言盯着，未来被
// 误删也不会被发现）。
diff('const a = [1, 2, 3,]; return a.length;', 'M34 回归: 数组字面量允许尾随逗号');
diff('const o = { a: 1, b: 2, }; return o.b;', 'M34 回归: 对象字面量同样允许尾随逗号');

// ============ C 节：沙箱核心保证 + 其余几条低成本补测 ============
// 复审发现这三条改坏之后 442 条测试仍然全绿——不是"写了拦不住"，是
// "压根没写断言"。每一条都在这次修复里做过一次变异往返（改坏 → 确认
// 变红 → 还原），实际输出记在 final-fix-report.md 里，这里补的是让它们
// 从此有牙的永久断言。

// ---- M16：不走原型链读——只读自有属性 ----
// 注意：constructor/toString 泄漏出来的是一个真的原生函数值——_test.js
// 的 T.eq 用 JSON.stringify 比较，而 JSON.stringify(函数) 和
// JSON.stringify(undefined) 都是 JS 的 undefined（不是字符串），两者会
// 被误判成相等！第一版这里直接 T.eq(result, undefined, ...) 在做变异
// 往返验证时被现场揪出这个假阳性（M16 的 constructor/toString 两条改坏
// 后没有变红）——改成 typeof 比较（'undefined' 字符串 vs 'function'
// 字符串，二者在 JSON.stringify 下是不同的字符串）才是真的有牙。
// __proto__ 泄漏出来的是 Object.prototype（一个对象，没有可枚举自有
// 属性），JSON.stringify 后是 "{}"，跟 JSON.stringify(undefined) 不同，
// 这一条本身就有牙，不需要 typeof。
T.eq(typeof I.run('const o = {}; return o.constructor;', { host: {} }).result, 'undefined',
     'M16: o.constructor 读到 undefined（原生会经原型链读到 Object，这是有意的沙箱分歧）');
T.eq(typeof I.run('const o = {}; const k = "constructor"; return o[k];', { host: {} }).result, 'undefined',
     'M16: 计算属性键读取同样挡住原型链');
T.eq(I.run('const o = {}; return o.__proto__;', { host: {} }).result, undefined,
     'M16: __proto__ 读取同样挡住');
T.eq(typeof I.run('const o = {}; return o.toString;', { host: {} }).result, 'undefined',
     'M16: 继承来的方法（toString 等）读不到——只有 hasOwnProperty 为真的自有属性可读');

// ---- M17：setProp 拒绝 __proto__/constructor/prototype 写入 ----
function throwsCheck(src, label) {
  let e = null;
  try { I.run(src, { host: {} }); } catch (err2) { e = err2; }
  T.ok(e, label);
  return e;
}
throwsCheck('const o = {}; o.__proto__ = 1;', 'M17: 写 __proto__ 被拒绝');
throwsCheck('const o = {}; o.constructor = 1;', 'M17: 写 constructor 被拒绝');
throwsCheck('const o = {}; o.prototype = 1;', 'M17: 写 prototype 被拒绝');
throwsCheck('const a = []; a.__proto__ = 1;', 'M17: 数组的 __proto__ 写入同样被拒绝');

// ---- M29：const 不可重新赋值（此前只有一条只读的 diff，写入路径没有
//      任何断言真的盯着它） ----
const constErr = throwsCheck('const c = 3; c = 4;', 'M29: 给 const 变量重新赋值必须报错');
T.eq(constErr && constErr.message, 'Assignment to constant variable.', 'M29: 报错文案与原生一字不差');
T.eq(constErr && constErr.category, 'runtime', 'M29: 类别是 runtime');
throwsCheck('const c = 3; c += 1;', 'M29: 复合赋值给 const 同样要报错');
throwsCheck('const c = 3; c++;', 'M29: 自增给 const 同样要报错（顺带覆盖 A1 的 ToNumber 路径与 const 检查的交互）');

// ---- M32：数组方法白名单只有 push/pop ----
const shiftErr = throwsCheck('const a = [1, 2, 3]; a.shift();', 'M32: shift 不在白名单里，必须被拒绝');
T.ok(shiftErr && /push\/pop/.test(shiftErr.message), 'M32: 报错要点名"只有 push/pop"');

// ---- M08：调用实参按从左到右求值（宿主调用序列可验证顺序）----
diff('function f(a, b) { return 0; } return f(log("first"), log("second"));',
     'M08: 实参求值顺序从左到右');

// ---- M18：复合赋值先读旧值、再求值右手边（ECMA-262 13.15.3）----
diff('let a = 1; function bump() { a = 100; return 1; } a += bump(); return a;',
     'M18: a+=bump() 先读旧值 1，bump() 把 a 改成 100 不影响这次读到的旧值，最终写回 1+1=2');

// ---- M26：没有提供 host 时，attacked 缺省返回 false（不是 undefined）----
T.eq(I.run('return attacked(1);', {}).result, false,
     'M26: 没有 host 时 attacked 走 NOOP_HOST，缺省返回 false');

// ---- M37：形参与实参个数不一致时按原生规则处理（多余丢弃/缺失补 undefined）----
diff('function f(a, b) { return [a, b]; } return f(1);', 'M37: 实参少于形参，缺失的补 undefined');
diff('function f(a) { return a; } return f(1, 2, 3);', 'M37: 实参多于形参，多余的被丢弃');

/* ============================================================
   任务 4.5 ①：入帧步（frameOp:'push'）的 varDelta 只含本次调用的形参绑定

   3a 的 callInterpreted 在注释里断言过这件事，但它不成立：stepBoundary
   打包的是 env.rec.pending，而 pending 里可能已经攒着**调用方**自上一次
   语句边界以来的改动。最典型的形状就是阶段 5 六道题全都在用的
   「for 头部声明循环变量 + 循环体第一条语句就是递归调用」——for 的
   init（`let c = 0`）在调用发生之前只进了 pending，还没有任何
   stepBoundary 把它打包出去，于是它被搭进了被调方那条 push 步里。
   后果不是"记多了一点"：调试器的变量面板据此把调用方的 c 挂到被调方的
   帧上（而拥有它的那一帧反而看不到它），而且**任何轨迹消费方都修不回来**
   ——两类 delta 一旦合并就再也分不开。所以必须在源头分开。 */

/* 一次调用里所有 push 步的 varDelta 名字表；顺带把 frameName 带出来。 */
function pushDeltas(src) {
  return I.run(src, { host: {} }).trace
    .map(function (s, k) { return { k: k, s: s }; })
    .filter(function (e) { return e.s.frameOp === 'push'; })
    .map(function (e) {
      return { at: e.k, depth: e.s.depth, fn: e.s.frameName,
               names: e.s.varDelta.map(function (d) { return d.name; }) };
    });
}

/* 阶段 5 六道题共同的形状：递归 + for 头部声明的循环变量。 */
const T45_LOOPCALL = [
  'function go(row) {',
  '  if (row === 2) { return 1; }',
  '  for (let c = 0; c < 2; c = c + 1) {',
  '    go(row + 1);',
  '  }',
  '  return 0;',
  '}',
  'return go(0);'].join('\n');

{
  const pushes = pushDeltas(T45_LOOPCALL);
  T.ok(pushes.length > 1, '4.5①前提：这个形状确实产生了多次入帧');
  const bad = pushes.filter(function (p) { return JSON.stringify(p.names) !== '["row"]'; });
  T.eq(bad, [], '4.5①: go 的每一条入帧步的 varDelta 都只有形参 row —— ' +
                '调用方 for 头部的 c 不得被搭进被调方的帧');
}

/* 通用化：一批形状里，每条 push 步的 varDelta 名字必须恰好等于被调函数的
   形参名单（顺序也一致，declareVar 是按形参顺序跑的）。这样将来任何一种
   「调用点之前攒了未打包的改动」的新形状都会在这里失败，而不是只堵住
   上面那一个具体程序。 */
const T45_PARAM_SHAPES = [
  { name: 'for 头部声明 + 循环体首句递归', src: T45_LOOPCALL, params: { go: ['row'] } },
  { name: '同一条语句里先赋值再调用',
    src: ['function f(a, b) { return a + b; }',
          'let t = 0;',
          'for (let i = 0; i < 3; i = i + 1) { t = f(i, 1); }',
          'return t;'].join('\n'),
    params: { f: ['a', 'b'] } },
  { name: 'for…of 头部绑定 + 体内调用',
    src: ['function g(v) { return v * 2; }',
          'let s = 0;',
          'for (const v of [1, 2, 3]) { s = s + g(v); }',
          'return s;'].join('\n'),
    params: { g: ['v'] } },
  { name: '声明语句的初始化式里直接调用（init 与调用在同一条语句）',
    src: ['function h(x) { return x + 1; }',
          'const r = h(1);',
          'return r;'].join('\n'),
    params: { h: ['x'] } },
  { name: '嵌套调用：实参本身是一次调用',
    src: ['function inner(p) { return p; }',
          'function outer(q) { return q; }',
          'return outer(inner(3));'].join('\n'),
    params: { inner: ['p'], outer: ['q'] } },
  { name: '无形参函数的入帧步必须是空 delta',
    src: ['function noop() { return 1; }',
          'let z = 9;',
          'for (let i = 0; i < 2; i = i + 1) { noop(); }',
          'return z;'].join('\n'),
    params: { noop: [] } },
];
for (let s45 = 0; s45 < T45_PARAM_SHAPES.length; s45++) {
  const shape = T45_PARAM_SHAPES[s45];
  const pushes = pushDeltas(shape.src);
  T.ok(pushes.length > 0, '4.5① 形状「' + shape.name + '」确实有入帧步');
  const wrong = pushes.filter(function (p) {
    return JSON.stringify(p.names) !== JSON.stringify(shape.params[p.fn]);
  });
  T.eq(wrong, [], '4.5① 形状「' + shape.name + '」：每条入帧步的 varDelta 恰好是该函数的形参名单');
}

/* 分出去的那条 delta 不能凭空消失——它属于**调用方**，必须以调用方的深度
   单独成一步留在轨迹里。只断言"push 干净了"是不够的：把 pending 直接丢掉
   同样能让上面几条通过，而那会让面板永远看不到 c 的初始值。 */
{
  const tr45 = I.run(T45_LOOPCALL, { host: {} }).trace;
  const c0 = tr45.filter(function (s) {
    return s.varDelta.some(function (d) { return d.name === 'c' && d.to === 0; });
  });
  T.ok(c0.length > 0, '4.5①: `let c = 0` 的 delta 仍然在轨迹里（没有被丢掉）');
  T.eq(c0.filter(function (s) { return s.frameOp !== null; }), [],
       '4.5①: 承载 `let c = 0` 的那些步都不是进/出帧步');
  /* 深度必须是**调用方**的深度。for 头部在 go 的第一层调用体里跑，
     所以第一条 c=0 的深度是 1（不是被调方的 2）。 */
  T.eq(c0[0].depth, 1, '4.5①: 调用方攒下的 delta 记在调用方的深度上');
}

/* ============================================================
   任务 4.5 ②（约束 6）：块前置（提升扫描）只能有一份

   3a 最后一轮修的 TDZ 缺口，根因是 callInterpreted 与 evalBlockBody 各有
   一套语句循环，而两处的"前置"是分别手写的——只给其中一处加了
   hoistLexicalDecls，函数体顶层的前向引用就绕过了 TDZ。把两行抽成一个
   共用 helper，两处都调，下一次往前置里加东西时就不会再漏一次。

   下面两道守卫各堵一半，缺一不可：
   （a）行为对拍：同一段语句，放在**块/顶层**里跑与放在**函数体顶层**跑，
        可观察结果必须一致，并且各自还要等于事先写死的期望值（否则"两边
        一样地坏"也能过）。
   （b）结构守卫：源码里所有 hoist*(…) 调用点都必须落在那个 helper 内部。
        （a）只能发现"新加的前置改变了这批程序的行为"，发现不了"新加了一个
        前置、但这批程序恰好观察不到"；（b）不看行为，直接钉住"前置只有
        一处"这个结构事实。 */
function prologueOutcome(src) {
  try { return { ok: true, value: I.run(src, { host: {} }).result }; }
  catch (e) { return { ok: false, message: e.message, category: e.category }; }
}
const T45_PROLOGUE_SHAPES = [
  { name: 'TDZ：前向引用本层稍后声明的 let',
    body: 'let y = x; let x = 2; return y;',
    expect: { ok: false, message: "Cannot access 'x' before initialization", category: 'runtime' } },
  { name: '函数声明提升：调用点在声明之前',
    body: 'return f(); function f() { return 7; }',
    expect: { ok: true, value: 7 } },
  { name: '互递归：谁写在前面都不重要',
    body: 'return even(4); function even(n) { if (n === 0) { return 1; } return odd(n - 1); } ' +
          'function odd(n) { if (n === 0) { return 0; } return even(n - 1); }',
    expect: { ok: true, value: 1 } },
  { name: '同层重复 let 声明',
    body: 'let a = 1; let a = 2; return a;',
    expect: { ok: false, message: "Identifier 'a' has already been declared", category: 'syntax' } },
  { name: '前置只扫本层：嵌套块里的 let 不该被提到外层',
    body: 'let x = 1; { let y = x; } return x;',
    expect: { ok: true, value: 1 } },
  { name: '正常声明后使用（对照，前置不该改变它）',
    body: 'let a = 5; return a;',
    expect: { ok: true, value: 5 } },
];
for (let p45 = 0; p45 < T45_PROLOGUE_SHAPES.length; p45++) {
  const shape = T45_PROLOGUE_SHAPES[p45];
  // evalBlockBody 这一路：语句直接放在 Program 顶层
  const viaBlock = prologueOutcome(shape.body);
  // callInterpreted 这一路：同一批语句当函数体顶层，立刻调用
  const viaCall = prologueOutcome('function __probe() { ' + shape.body + ' }\nreturn __probe();');
  T.eq(viaBlock, shape.expect, '4.5②(a)「' + shape.name + '」在块/顶层这一路的结果符合期望');
  T.eq(viaCall, shape.expect, '4.5②(a)「' + shape.name + '」在函数体顶层这一路的结果符合期望');
  T.eq(viaCall, viaBlock, '4.5②(a)「' + shape.name + '」两条语句循环的前置行为一致');
}

/* （b）结构守卫。读的是 interp.js 的源码本身——测试文件跑在 node 里，
   读文件是允许的（editor.test.js 已有先例）；被读的 interp.js 本身仍然
   零依赖、不碰任何宿主 API。 */
{
  const fs45 = require('fs');
  const path45 = require('path');
  /* 先把块注释整段抹成等长空格再扫（保长度是为了行号仍然对得上）：
     interp.js 的中文说明里会成段引用这些函数名，扫原文会把散文当成调用点，
     变成一道"改注释就红"的假门。 */
  const rawText = fs45.readFileSync(path45.join(__dirname, 'interp.js'), 'utf8');
  const srcText = rawText.replace(/\/\*[\s\S]*?\*\//g, function (block) {
    return block.replace(/[^\n]/g, ' ');
  });

  const defIdx = srcText.indexOf('function blockPrologue(');
  T.ok(defIdx >= 0, '4.5②(b): 存在共用的块前置 helper blockPrologue');

  /* helper 的函数体区间（从定义处第一个 { 开始花括号配平）。 */
  let bodyStart = srcText.indexOf('{', defIdx), depth45 = 0, bodyEnd = -1;
  for (let ch = bodyStart; ch >= 0 && ch < srcText.length; ch++) {
    if (srcText[ch] === '{') depth45++;
    else if (srcText[ch] === '}') { depth45--; if (depth45 === 0) { bodyEnd = ch; break; } }
  }
  T.ok(bodyEnd > bodyStart, '4.5②(b): 能定位到 blockPrologue 的函数体区间');

  /* 所有 hoistXxx(…) 的**调用**点（排除 `function hoistXxx(` 定义处）。 */
  const callRe = /(function\s+)?\bhoist[A-Za-z]*\s*\(/g;
  const outside = [];
  let m45;
  while ((m45 = callRe.exec(srcText)) !== null) {
    if (m45[1]) continue;                     // 定义处，不是调用
    const at = m45.index;
    if (at > bodyStart && at < bodyEnd) continue;   // 在 helper 内部，正是它该待的地方
    outside.push(srcText.slice(0, at).split('\n').length);  // 行号
  }
  T.eq(outside, [],
       '4.5②(b): 提升扫描的调用点只能出现在 blockPrologue 内部 —— ' +
       '往前置里加东西必须加进这一份共用实现，不能挂在两套语句循环中的某一套上');

  /* helper 恰好被两处语句循环各调用一次（多一处/少一处都要失败）。 */
  const useRe = /\bblockPrologue\s*\(/g;
  let uses = 0;
  while (useRe.exec(srcText) !== null) uses++;
  T.eq(uses, 3, '4.5②(b): blockPrologue 在源码里出现 3 次 —— 1 处定义 + 2 处调用');
}

T.report();
