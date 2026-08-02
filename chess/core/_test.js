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

function throws(fn, label) {
  try { fn(); } catch (e) { passed++; return; }
  failures.push(label + '\n    expected a throw, none happened');
}

function report() {
  for (const f of failures) console.error('FAIL  ' + f);
  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  process.exit(failures.length ? 1 : 0);
}

module.exports = { eq, ok, throws, report };
