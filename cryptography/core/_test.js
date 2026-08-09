'use strict';
/* 15 行级别的断言 harness——本子项目不引入任何测试框架（Global Constraint 1）。
   语义与 chess/core/_test.js 同源，但去掉了那边为解释器 BigInt 与 THROWS_AUDIT
   加的两处特化：这里没有解释器，也没有普查脚本，照抄等于带进两段永远不执行的代码。 */
let passed = 0;
const failures = [];

/* JSON.stringify 把 Infinity、-Infinity、NaN、null 一律写成 "null"，于是一条
   裸的 `eq(x, Infinity)` **分不出这四者**——实测 eq(NaN, Infinity) 是绿的。
   这不是理论风险：cryptanalysis 的 chiSquare('') 必须返回 Infinity（空候选
   要排在最后），而漏掉那个 n===0 的守卫时它返回的是 NaN（0/0）。NaN 参与
   比较全为 false，排序会把那个候选留在原地，穷举页高亮出错的一行——正是
   那条断言唯一要防的事，而它看不见。建这个子项目时当场复现过：删掉守卫，
   断言照样通过。

   用 replacer 而不是只判顶层值：顶层写法漏掉嵌套，eq([Infinity],[NaN]) 会
   继续误判。替换成一个带前缀的字符串，三者互不相同、也不与 null 相同；
   有限数一个字节不变。

   代价与 chess 的 __bigint__ 同款：真有人拿字面字符串 "__nonfinite__NaN"
   去跟 NaN 比较时会误判。要撞上得刻意构造，换来的是整个仓库的 eq 不再对
   非有限数失明。 */
function serialize(v) {
  return JSON.stringify(v, function (k, val) {
    return (typeof val === 'number' && !isFinite(val)) ? '__nonfinite__' + String(val) : val;
  });
}

function eq(actual, expected, label) {
  const a = serialize(actual), e = serialize(expected);
  if (a === e) { passed++; return; }
  failures.push(label + '\n    expected: ' + e + '\n    actual:   ' + a);
}

/* 只回答"这两个值在 eq 眼里相不相等"，不记账、不产生失败。
   用来验证 eq 自己的判定——直接调 eq 去验"eq 判不等"会把一条真失败推进
   failures 里，整个文件当场变红。chess 的 harness 里有同名同职的一个。 */
function wouldPass(actual, expected) {
  return serialize(actual) === serialize(expected);
}

function ok(cond, label) {
  if (cond) { passed++; return; }
  failures.push(label + '\n    expected truthy, got: ' + cond);
}

/* pattern 必传且必须是 RegExp。chess 那边允许省略第三参，结果是一批
   "抛了就算过"的断言——它自己的第九道门后来专门去数这种退化，
   ALLOW_MISSING 一路收到 0。这里从第一天起就不给这个退化留入口。 */
function throws(fn, label, pattern) {
  if (!(pattern instanceof RegExp)) {
    failures.push(label + '\n    T.throws 第三参 pattern 必须是 RegExp');
    return;
  }
  try {
    fn();
  } catch (err) {
    const msg = String(err && err.message != null ? err.message : err);
    if (pattern.test(msg)) { passed++; return; }
    failures.push(label + '\n    threw, but message did not match ' + pattern +
                  '\n    actual:   ' + msg);
    return;
  }
  failures.push(label + '\n    expected throw, but returned normally');
}

function report(name) {
  if (failures.length === 0) {
    console.log(name + ': ' + passed + ' 条断言全部通过');
    return;
  }
  console.error(name + ': ' + failures.length + ' 条失败 / ' +
                (passed + failures.length) + ' 条断言');
  failures.forEach(function (f) { console.error('  ✗ ' + f); });
  process.exit(1);
}

module.exports = { eq, ok, throws, report, wouldPass };
