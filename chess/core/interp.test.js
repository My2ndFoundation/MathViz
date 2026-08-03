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

T.report();
