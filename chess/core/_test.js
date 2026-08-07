'use strict';
let passed = 0;
const failures = [];

function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failures.push(label + '\n    expected: ' + e + '\n    actual:   ' + a);
}

function ok(cond, label) {
  if (cond) { passed++; return; }
  failures.push(label + '\n    expected truthy, got: ' + cond);
}

function throws(fn, label, pattern) {
  try {
    fn();
  } catch (e) {
    if (pattern === undefined) { passed++; return; }
    const msg = String(e && e.message);
    const matched = (pattern instanceof RegExp) ? pattern.test(msg) : msg.indexOf(pattern) >= 0;
    if (matched) { passed++; return; }
    failures.push(label +
      '\n    expected message matching: ' + pattern +
      '\n    actual message:            ' + msg);
    return;
  }
  failures.push(label + '\n    expected a throw, none happened');
}

/* 读失败计数，供测试自省用（目前只有 exercise.test.js 里验证 T.throws 的
   pattern 参数用得着它：要证明「匹配不上」确实记了一次失败，而不是抛出去
   或者悄悄放过）。只读，不改变任何既有调用点的行为。 */
function failedCount() {
  return failures.length;
}

function report() {
  for (const f of failures) console.error('FAIL  ' + f);
  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  process.exit(failures.length ? 1 : 0);
}

module.exports = { eq, ok, throws, failedCount, report };
