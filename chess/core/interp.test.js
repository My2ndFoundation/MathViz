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

// 数字里第二个小数点：原生 JS 报 SyntaxError，我们也必须报错，
// 而不是悄悄把 1.2.3 变成 1.2 —— 与参照实现（JS 自己）保持一致是
// 本阶段的整套正确性标准，而「静默给出一个错的数字」是规格 §9
// 点名要避免的那种「半懂不懂比明确拒绝更危险」的形态。
T.throws(() => I.tokenize('1.2.3'), '数字里出现第二个小数点要报错');
T.throws(() => I.tokenize('let x = 1.2.3'), '在语句里同样报错');

T.eq(I.tokenize('1.5').filter(t => t.type !== 'eof')[0].value, 1.5, '正常小数');
T.eq(I.tokenize('42').filter(t => t.type !== 'eof')[0].value, 42, '整数');
T.eq(I.tokenize('a.b').filter(t => t.type !== 'eof').map(t => t.value), ['a', '.', 'b'],
     '标识符后的点仍然是成员访问运算符，不是数字的一部分');
T.eq(I.tokenize('1 .5').filter(t => t.type !== 'eof').map(t => t.value), [1, '.', 5],
     '空格分开的话是三个 token');

// ---- 模板字符串 ----
const tpl = I.tokenize('`try ${r},${c}`').filter(t => t.type !== 'eof');
T.eq(tpl.length, 1, '模板串是一个 token');
T.eq(tpl[0].type, 'tpl', '类别是 tpl');
T.eq(tpl[0].value.quasis, ['try ', ',', ''], '静态段（比表达式多一个）');
T.eq(tpl[0].value.exprs.map(s => s.trim()), ['r', 'c'], '内嵌表达式以源码片段保留，留给解析器');

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

T.report();
