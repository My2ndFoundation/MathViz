'use strict';
/* _test.js 自己的测试。归一化器是阶段 8 三道双语门里第一道的地基 ——
   它判错了，七份源码的「代码没分岔」就是一句空话，所以它自己得有门。

   ⚠ 这里**不能**用 T.throws 去测 T 自己的失败计数（exercise.test.js 那次
   教训：throws() 不重抛，拿它测自己永远是真）。要测「归一化器抛了」就
   自己写 try/catch。 */
const T = require('./_test.js');
const N = T.normalizeSource;

// ---- 注释被抽掉 ----
T.eq(N('let a = 1; // 这是注释'), 'let a = 1;', '行注释被抽掉，行尾空白也抽掉');
T.eq(N('let a = 1; // a comment'), N('let a = 1; // 这是注释'),
     '同一行代码、两种语言的行注释，归一化之后相同');
T.eq(N('/* 块注释 */\nlet a = 1;'), '\nlet a = 1;', '块注释被抽掉，行数不变');
T.eq(N('/* 跨\n行 */\nlet a = 1;'), '\n\nlet a = 1;', '跨行块注释：每一行都留一个空行');

// ---- 字符串字面量被替换 ----
T.eq(N('log("第 1 个解");'), 'log(§);', '双引号字符串换成占位符');
T.eq(N("log('第 1 个解');"), 'log(§);', '单引号字符串换成占位符');
T.eq(N('log("第 " + n + " 个解");'), 'log(§ + n + §);', '拼接里每个字面量各换一次');
T.eq(N('log("A solution");'), N('log("一个解");'), '两种语言的日志，归一化之后相同');

// ---- 注释符号出现在字符串里，不许当注释 ----
T.eq(N('log("http://x");'), 'log(§);', '字符串里的 // 不是注释');
T.eq(N('log("/* 不是注释 */");'), 'log(§);', '字符串里的 /* 不是注释');
// ---- 引号出现在注释里，不许当字符串开头 ----
T.eq(N('let a = 1; // 她说"这样"\nlet b = 2;'), 'let a = 1;\nlet b = 2;',
     '注释里的引号不会把后面的代码吃掉');
// ---- 字符串里的转义引号 ----
T.eq(N('log("a\\"b");'), 'log(§);', '转义引号不结束字符串');

// ---- 真的能分出「代码分岔了」 ----
T.ok(N('for (let i = 0; i < n; i++) {} // 注释') !==
     N('for (let i = 0; i <= n - 1; i++) {} // comment'),
     'i < n 与 i <= n - 1 归一化之后不同 —— 这正是这道门要抓的');

// ---- 行数永远不变 ----
const multi = '/* 一\n二\n三 */\nlet a = 1;\nlog("x");';
T.eq(N(multi).split('\n').length, multi.split('\n').length, '归一化不改变行数');

// ---- 非字符串输入必须响 ----
let threw = null;
try { N(undefined); } catch (e) { threw = e; }
T.ok(threw !== null, 'normalizeSource(undefined) 抛了');
T.ok(threw !== null && /normalizeSource/.test(threw.message),
     '错误消息点名了 normalizeSource，不是一句裸 TypeError');

/* ---- 模板字面量必须响，注释里的反引号不许响 ----
   这个扫描器只认 ' " // /* 四种状态，模板字面量的内容会被当成代码扫 ——
   那样判出来的「代码同一」不作数，所以宁可抛。
   而反引号在中文注释里当引号用是**真实存在**的（king-greedy.js 里 6 个：
   「这里写的是 `>` 不是 `>=`」），那些必须照常通过。 */
T.eq(N('let a = 1; // 这里写的是 `>` 不是 `>=`'), 'let a = 1;',
     '注释里的反引号跟注释一起被抽掉，不触发守卫');
let tmpl = null;
try { N('log(`x`);'); } catch (e) { tmpl = e; }
T.ok(tmpl !== null, '代码里的模板字面量让 normalizeSource 抛');
T.ok(tmpl !== null && /模板字面量/.test(tmpl.message),
     '错误消息说清楚了为什么这份源码判不了');

T.report();
