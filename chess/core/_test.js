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

/* 运行期审计（阶段 9a，规格 §7.6）。THROWS_AUDIT 指向一个路径时，把每一条
   真的抛出来的 T.throws 记下来：它的 label、它的 pattern（没传就是 null）、
   以及**实际抛出的消息**。report() 收尾时写进那个文件。

   为什么是运行期而不是静态解析：实测 rook-cover.test.js 的
   `grep -c 'T\.throws('` 是 15、运行期捕获是 14 —— 注释里也会出现
   `T.throws(`。grep 才是不可靠的那个。运行期审计顺带还能抓出「一条从没被
   执行到的 T.throws」，那种断言今天完全隐形。

   ⚠ **没设 THROWS_AUDIT 时行为必须一个字节不变** —— 这是给全仓每一条
   T.throws 加的旁路，它自己不能改变任何既有判定。

   这里**故意不写「全仓共多少条」**。那是个会腐坏的可数事实，而且这一处
   已经腐坏过一次：阶段 9a Task 1 实测写下 170，**同一阶段之内**就变成了
   173（后面几轮补断言带跑的）。要当下的数就跑 check.py 的第九道门，它每
   次都把「共多少条 / 缺第三参多少条 / 无判别力多少条」原地印出来。同一
   条理由的完整版见 check.py 的 _throws_pattern_matcher() 文档字符串。 */
const AUDIT = (typeof process !== 'undefined' && process.env && process.env.THROWS_AUDIT)
  ? [] : null;

function auditEntry() { return AUDIT; }

function throws(fn, label, pattern) {
  try {
    fn();
  } catch (e) {
    if (AUDIT) {
      // patternType 如实记录 pattern 是 RegExp 还是字符串——check.py 那边
      // 靠这个字段决定用哪种匹配语义（正则 test / 字符串 indexOf），不能靠
      // 猜 pattern 字符串的形状（一个字符串 pattern 也可能长得像 /xxx/）。
      AUDIT.push({ label: String(label),
                   pattern: pattern === undefined ? null : String(pattern),
                   patternType: pattern === undefined ? null :
                     (pattern instanceof RegExp ? 'regex' : 'string'),
                   msg: String(e && e.message) });
    }
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

/* 把一份源码归一化成「只剩代码」：抽掉注释、每个字符串字面量整体换成 §。
   阶段 8 三道双语门里第一道的地基（规格 §7.5）—— 两种语言变体归一化之后
   必须逐字节相同，否则就是可执行代码偷偷分岔了。

   **行结构保留**：第 n 行归一化之后还是第 n 行（跨行块注释每行留一个空行）。
   因为两种语言变体是逐行对齐的（规格 §1.6），行号对不上本身就是缺陷，
   而把行号搅乱的归一化器会把这种缺陷伪装成「某一行内容不同」。

   只认四种状态：普通代码 / 单引号串 / 双引号串 / 注释。**这对 algos/*.js
   是完备的**：那些源码是 interp.js 的 ES 子集，没有模板字面量、也没有正则
   字面量（queens.js 文件头写明了「用普通字符串拼，不用模板字面量」）。
   哪天真要归一化一份带正则字面量的源码，`/` 的歧义得单独想清楚——别拿
   这个函数硬套。 */
function normalizeSource(src) {
  if (typeof src !== 'string') {
    throw new Error('normalizeSource(src) 要一个字符串，收到：' + typeof src);
  }
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { out += '\n'; i++; continue; }
    /* 字符串字面量：整体换成一个 §。转义符跳两格 —— 否则 "a\"b" 会在
       中间那个引号提前收尾，后半截代码被当成字符串外的东西，全乱。 */
    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;                       // 吃掉收尾引号
      out += '§';
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;                  // 换行留给上面那一支
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';   // 跨行块注释：行数不变
        i++;
      }
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  /* 行尾空白抽掉：注释被抽走之后 `let a = 1; ` 会留一个尾空格，
     而另一种语言那一行可能不留 —— 那是归一化器自己制造的假差异。 */
  const flat = out.split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).join('\n');
  /* 守卫：归一化前后行数必须相等——「行结构保留」是这个函数对调用方许下的
     承诺（见函数头注释），破了这个承诺却不响，就是把缺陷伪装成「某一行
     内容不同」。字符串字面量里如果写了「反斜杠 + 真实换行」的续行语法
     （反斜杠后面直接跟一个真的换行符，不是 `\n` 转义），上面的引号扫描
     循环会把那个反斜杠和它后面那一个字符一起跳过
     （`if (src[i] === '\\') i++; i++;`）——真实换行符本身因此从未被
     `out += ...` 写进去，一行就这样被静默吞掉，从这里往后所有行号一起
     错位，两种语言变体逐行对齐的假设（规格 §1.6）也随之落空，而这个函数
     还在若无其事地返回一个看起来正常的字符串。今天八份源码一个都没有
     这种写法（`grep -n '\\$'` 为空，都用 `+` 拼接字符串），但守卫防的是
     以后有人写，不是防今天已经有。 */
  if (flat.split('\n').length !== src.split('\n').length) {
    throw new Error('normalizeSource 归一化前后行数不一致（源码 ' +
                    src.split('\n').length + ' 行，归一化后 ' +
                    flat.split('\n').length + ' 行）—— 字符串字面量里可能有' +
                    '「反斜杠 + 真实换行」的续行语法，把一行悄悄吞掉，破坏了' +
                    '「行结构保留」的承诺');
  }
  /* 守卫：注释与字符串都抽干净之后还剩反引号，说明代码里有模板字面量 ——
     而上面那个四状态扫描器会把模板内容当代码扫。那种情况下判出来的
     「两种语言代码同一」**不作数**，宁可抛，不许静默给一个不作数的答案。
     （注释里的反引号不会走到这里：它们跟注释一起被抽掉了。以
     king-greedy.js 为例，**source() 生成出来的源码**里就有 6 个反引号
     ——那才是这个函数实际归一化的输入，实测照常通过；这份 .js 文件
     全文另有多少个反引号是完全不同的另一件事，跟这里无关，别把两个
     数字混成一件事。） */
  if (flat.indexOf('`') >= 0) {
    throw new Error('normalizeSource 在归一化之后还看到反引号 —— 这份源码里' +
                    '有模板字面量，而这个扫描器只认 \' " // 和 /* 四种状态，' +
                    '模板字面量的内容会被当成代码扫，判出来的「代码同一」不作数');
  }
  return flat;
}

/* 读失败计数，供测试自省用（目前只有 exercise.test.js 里验证 T.throws 的
   pattern 参数用得着它：要证明「匹配不上」确实记了一次失败，而不是抛出去
   或者悄悄放过）。只读，不改变任何既有调用点的行为。 */
function failedCount() {
  return failures.length;
}

function report() {
  if (AUDIT) {
    require('fs').writeFileSync(process.env.THROWS_AUDIT, JSON.stringify(AUDIT));
  }
  for (const f of failures) console.error('FAIL  ' + f);
  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  process.exit(failures.length ? 1 : 0);
}

module.exports = { eq, ok, throws, failedCount, normalizeSource, auditEntry, report };
