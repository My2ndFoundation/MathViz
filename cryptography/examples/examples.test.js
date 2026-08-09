'use strict';
const T = require('../core/_test.js');
const E = require('./examples.js');
const C = require('../core/crypto-core.js');

const P = E.classical.plaintexts;
T.ok(P.length >= 3, '至少 3 条教学明文');

const ids = {};
P.forEach(function (p) {
  T.ok(!ids[p.id], '明文 id 不重复：' + p.id);
  ids[p.id] = 1;
  T.ok(p.text && p.text.en && p.text.zh, p.id + ' 有双语 text');
  T.ok(p.note && p.note.en && p.note.zh, p.id + ' 有双语 note');
  /* text 的两个语种归一化后必须是同一串字母。这不是形式主义：被加密的
     是 text，语言开关切的是解说。若哪天有人把 zh 真的译成中文，normalize
     会把它整段吃掉变成空串——使用者切一次语言，密文就在手底下变了，
     而页面上没有任何东西会说明为什么。 */
  T.eq(C.normalize(p.text.zh), C.normalize(p.text.en),
       p.id + ' 的中英 text 归一化后是同一串字母');
  T.ok(C.letters(p.text.en).length > 0, p.id + ' 的 text 至少有一个字母可加密');
});

/* pangram 必须真的是全字母句——它的用途就是"字母轮上没有空位"，
   这条性质如果不成立，那一页会缺几个字母而没人发现。 */
const pan = E.plaintext('pangram');
T.eq(new Set(C.letters(pan.text.en)).size, 26, 'pangram 覆盖全部 26 个字母');
T.ok(C.letters(pan.text.en).length >= 60, 'pangram 长度够做频率统计');

/* caesar 预置项引用的 id 必须存在，k 必须在 [0,26)。
   先钉住列表非空：空数组会让下面整个 forEach 一条断言都不跑，
   而报告里照样是绿的——一道扫空的门比没有门更糟。 */
T.ok(E.classical.caesar.length >= 1, 'caesar 预置项列表非空');
E.classical.caesar.forEach(function (c) {
  T.ok(!!E.plaintext(c.id), 'caesar 预置项引用了存在的明文：' + c.id);
  T.ok(c.k >= 0 && c.k < 26, 'k 落在 [0,26)：' + c.id);
  T.ok(c.label && c.label.en && c.label.zh, c.id + ' 有双语 label');
  T.ok(c.cipher === undefined, c.id + ' 不把密文抄死在数据里');
});

T.throws(function () { E.plaintext('no-such-id'); },
         '取不存在的明文 id 要抛', /找不到明文/);

/* ---- 浏览器加载路径 ----
   上面每一条走的都是 node 分支（module.exports + require）。页面里跑的是
   **另一条**分支：没有 module、没有 require，分组文件把自己挂到
   root.CryptoExamplesParts，汇总器再去读那份对象。两条分支只有一条被覆盖
   过，而出事的一直是没被覆盖的那条——viz-engine 的 ALGOS 块在 Task 8 专门
   为同一个理由立了一道门。

   用 node 自带的 vm 建一个只有 self、没有 module/require 的上下文，
   按 inline_core.py 的 EXAMPLES_PARTS 顺序求值这两个文件。零依赖：
   vm 是标准库。 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const SRC = {
  classical: fs.readFileSync(path.join(__dirname, 'examples-classical.js'), 'utf8'),
  aggregate: fs.readFileSync(path.join(__dirname, 'examples.js'), 'utf8')
};

function browserContext() {
  const sandbox = {};
  sandbox.self = sandbox;          // 页面里 self === window
  return vm.createContext(sandbox);
}

const ctx = browserContext();
vm.runInContext(SRC.classical, ctx);
T.ok(!!ctx.CryptoExamplesParts, '分组文件把自己挂到了 root.CryptoExamplesParts');
T.ok(!!ctx.CryptoExamplesParts.classical, 'classical 分组挂上了');
T.ok(ctx.CryptoExamples === undefined, '分组文件不越权去建 CryptoExamples');
vm.runInContext(SRC.aggregate, ctx);
T.ok(!!ctx.CryptoExamples, '汇总器在浏览器分支下建起了 root.CryptoExamples');
T.eq(ctx.CryptoExamples.plaintext('pangram').id, 'pangram',
     '浏览器分支下 plaintext() 能取到 pangram');
T.eq(C.normalize(ctx.CryptoExamples.plaintext('pangram').text.en),
     C.normalize(pan.text.en),
     '浏览器分支与 node 分支拿到的是同一份数据');
T.eq(ctx.CryptoExamples.classical.caesar.length, E.classical.caesar.length,
     '两条分支的 caesar 预置项数量一致');

/* 顺序反过来必须当场炸。这正是 inline_core.py 的 EXAMPLES_PARTS 要写死顺序
   的原因——若汇总器在缺分组时静静返回一个空壳，工具页会画出一片空白，
   而排查会从画布一路查到这里。 */
T.throws(function () { vm.runInContext(SRC.aggregate, browserContext()); },
         '汇总器先于分组文件加载时要抛', /未加载/);

T.report('examples');
