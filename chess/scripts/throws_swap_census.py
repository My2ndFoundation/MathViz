#!/usr/bin/env python3
"""「换守卫」普查 —— 手动工具，**不是门**（阶段 9a 收尾）。

────────────────────────────────────────────────────────────────────────
① 它抓的是什么：一条 T.throws 的 pattern 到底锚在**守卫自己身上**，还是
   只锚在**回显值**上
────────────────────────────────────────────────────────────────────────
`T.throws(fn, label, pattern)` 的第三参有两种写法，长得很像、强度差一个
量级：

  · **锚在守卫身上** —— pattern 里含一段守卫自己写的固定文案（那句描述
    「这是哪道检查」的话）。把守卫的措辞换掉，这条断言当场红。
  · **锚在回显值上** —— pattern 里全是**测试自己喂进去、又被错误消息原样
    回显出来的 token**（输入片段、行号、`收到：25` 里的 25……）。这种
    pattern 只证明了「抛了、而且消息里回显了我给的东西」，**没有证明是
    哪道守卫响的**：把守卫的措辞整句换成一句全新的话、回显值保留，测试
    照样全绿。

第二种在本仓真实发生过不止一次（Wave 2 的 M4 是一类，阶段 9a 自己新加的
两条又是一类，两次都过了任务级审查）。这个脚本就是普查这一类。

**判据（模拟，不改源码）**：对每条断言 (pattern P, 真实消息 m)，取同文件里
**别的**守卫的消息 m2，把 m2 的固定文案配上 **m 自己的回显值**，合成一条
杂交消息 m'。若 P 仍然匹中 m'，就把这条标出来 —— 「换了守卫、留着回显值，
P 还是匹中」正是上面第二种的定义。

匹配语义与 `check.py` 第九道门共用一套规则（`_test.js` 对 RegExp 走
`.test()`、对字符串走 `indexOf()`，靠审计条目自带的 `patternType` 分流，
不靠猜 pattern 字符串的形状）。

**为什么 check.py 第九道门看不见这一维**：那道门问的是「P 匹中的消息横跨
几种结构形状」——它看的是 **pattern 与消息集合**的关系。而这里问的是
**pattern 与守卫文案**的关系。一条 pattern 完全可以只匹中一种形状（第九道
门满意）却一个字守卫文案都不含（这里报警）。两道检查是正交的，谁也替不了谁。

────────────────────────────────────────────────────────────────────────
② 为什么它是手动工具、不是常驻门
────────────────────────────────────────────────────────────────────────
**它报的是嫌疑，不是缺陷；而且两个方向都会错。** 下面两条都是实测出来的，
不是理论担忧：

**假阳（会报不该报的）**：合成出来的 m' 是人造消息，而且这个脚本**一条一条
看断言**，看不见同文件里的兄弟断言。实测 2026-08-08 收尾轮它标出 3 条
`/收到：25/`（king.test.js 两条、rook-cover.test.js 一条）。手工真突变复核
——把 king-greedy.js 那道 `blocked 里的格子必须是 0 到 24 之间的整数，收到：`
换成一句全新的话、`收到：25` 原样保留——测试**当场红了 2 条**：红的不是被
标出来的那条，是同文件里 `blocked 有负数` / `blocked 有小数` 那两条，它们的
pattern 是 `/blocked 里的格子/`，实打实锚在守卫文案上。**那道守卫是有测试
覆盖的**，只是覆盖它的不是被标出来的这条。三条全是假阳。

**假阴（会漏该报的）**：`tip="乙"` 那条真缺陷它**没标出来**。因为回显值本身
含双引号，上面 `TOK` 那条「ASCII 双引号包一段」的正则切不出完整的值，合成
出来的杂交消息里那个 token 是断的，于是没匹中。**回显值里带引号的断言，
这个脚本天生看不见。**

一个既误报又漏报的检查当不了门。当门只有两种活法：要么误报把人挡在外面，
要么配一份「已知假阳」的豁免清单——而一份会不断长长的豁免清单，正是这个
阶段一直在拔的那种烂账。当**线索生成器**它是称职的：它把 173 条收敛到 3–4
条候选，人一条条复核只要几分钟。

（另一条常被提起的不留理由——「它得程序化地改被测源码，对常驻门太侵入」
——对这个脚本**不成立**，写在这里是因为这个误解真的出现过：它一个字节的
源码都不改，只在消息层面做合成。不当门的真实理由是上面那两条。）

────────────────────────────────────────────────────────────────────────
③ 怎么跑、怎么读结果
────────────────────────────────────────────────────────────────────────
    python3 chess/scripts/throws_swap_census.py

不需要参数。它自己把 `chess/core/` 与 `chess/games/` 下每个 `*.test.js`
用 `THROWS_AUDIT=…` 跑一遍（与 check.py 第九道门扫的是同一个集合），拿到
运行期审计数据后做上面那套合成。审计文件写在临时目录里，跑完即删。

退出码**恒为 0**——它不是门，别把它接进 CI 的判定里。

输出每条形如：

    ❌ exercise.test.js
       pattern : tip="乙"
       label   : 指令行上出现认不出来的属性名 —— 抛
       真消息  : 第 1 行：BLANK 指令里有一段认不出来的内容 "tip="乙""…
       仍匹中  : 第 1 行：BLANK 指令缺 id=…tip="乙"…      ← 合成的杂交消息

读法：**`仍匹中` 那行是人造的**。看到它只说明「这条 pattern 有嫌疑」。
定案要自己动手——把 `真消息` 那条守卫的措辞换成一句全新的话、**回显值原样
保留**，然后跑那个测试文件：

  · 测试**变红** → 假阳，那道守卫是有覆盖的（⚠ 红的可能是同文件里**别的**
    断言——那也算覆盖，这个脚本看不见兄弟断言，见 ②）。放过。
  · 测试**仍然全绿** → 坐实。改法是往 pattern 里加一段守卫自己的文案
    （回显值可以留着当额外区分，但不能是全部）。⚠ 反过来改错误消息去迁就
    pattern 是倒因为果，不许。

⚠ 做真突变时**别只看退出码**。check.py 第一道门（内联副本一致性）会被你
改动源码这件事本身触发，先响的是它，不是你想验的那道。每次都要在输出里
找到你要验的那一行。
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent

# 一条消息里「回显值」的形状：ASCII 双引号包起来的一段，或一个裸数字。
# 与 check.py 的 _throws_msg_shape() 认的是同一组 token（那边替换成 "S"/N
# 求结构形状，这边挖出来做移植），两处要一起改。
TOK = re.compile(r'"[^"]*"|-?\d+(?:\.\d+)?')


def shape_and_vals(msg: str):
    """把一条消息拆成 (固定文案骨架, 回显值列表)。骨架里每个值留一个 \\x00 洞。"""
    vals = [m.group(0) for m in TOK.finditer(msg)]
    return TOK.sub('\x00', msg), vals


def hybrid(other_msg: str, my_vals: list) -> str:
    """把 other_msg 的固定文案配上 my_vals 的回显值 —— 「换守卫、留回显值」。

    洞比值多的时候用 other_msg 自己的原值补齐（合成的目的是换掉文案，不是
    造一条洞数对不上的畸形串）。"""
    skeleton, other_vals = shape_and_vals(other_msg)
    parts = skeleton.split('\x00')
    out, i = [], 0
    for k, p in enumerate(parts):
        out.append(p)
        if k < len(parts) - 1:
            if i < len(my_vals):
                out.append(my_vals[i])
            elif k < len(other_vals):
                out.append(other_vals[k])
            else:
                out.append('0')
            i += 1
    return ''.join(out)


def matcher(entry: dict):
    """按 `_test.js` 的真实语义构造 msg -> bool；编译不了就返回 None（跳过）。

    与 check.py 的 _throws_pattern_matcher() 保持同一套规则：patternType 分流、
    JS 具名组 `(?<n>` → `(?P<n>`（避开 `(?<=` / `(?<!`）、i/m/s flags 转换。"""
    pattern = entry['pattern']
    if entry.get('patternType') == 'string':
        return lambda msg, p=pattern: p in msg
    m = re.match(r'^/(.*)/([a-z]*)$', pattern, re.DOTALL)
    body, flags = (m.group(1), m.group(2)) if m else (pattern, '')
    body = re.sub(r'\(\?<(?![=!])', '(?P<', body)
    re_flags = 0
    for ch, fl in (('i', re.IGNORECASE), ('m', re.MULTILINE), ('s', re.DOTALL)):
        if ch in flags:
            re_flags |= fl
    try:
        compiled = re.compile(body, re_flags)
    except re.error:
        return None
    return lambda msg, c=compiled: bool(c.search(msg))


def collect(tmp: pathlib.Path):
    """跑一遍所有测试文件，收运行期审计数据。返回 [(文件名, entries)]。"""
    tests = (sorted((ROOT / 'core').rglob('*.test.js'))
             + sorted((ROOT / 'games').rglob('*.test.js')))
    got = []
    for test in tests:
        out = tmp / f'{test.name}.json'
        env = dict(os.environ, THROWS_AUDIT=str(out))
        subprocess.run(['node', str(test)], capture_output=True, text=True, env=env)
        if not out.exists():
            print(f'WARN: {test.name} 没写出审计文件，跳过', file=sys.stderr)
            continue
        got.append((test.name, json.loads(out.read_text(encoding='utf-8'))))
    return got


def main() -> int:
    flagged = []
    total = 0
    with tempfile.TemporaryDirectory() as td:
        files = collect(pathlib.Path(td))
    for name, entries in files:
        if not entries:
            continue
        # 同文件里出现过的每一种「固定文案」各留一条样本消息
        shapes = {}
        for e in entries:
            sk, _ = shape_and_vals(e['msg'])
            shapes.setdefault(sk, e['msg'])
        for e in entries:
            if e['pattern'] is None:
                continue
            total += 1
            mt = matcher(e)
            if mt is None:
                continue
            my_sk, my_vals = shape_and_vals(e['msg'])
            still = [hybrid(sample, my_vals)
                     for sk, sample in shapes.items()
                     if sk != my_sk and mt(hybrid(sample, my_vals))]
            if still:
                flagged.append((name, e['pattern'], e['label'], e['msg'], still))

    print(f'== 换守卫普查：{total} 条带 pattern 的断言，'
          f'{len(flagged)} 条在「守卫措辞被换掉、回显值保留」时仍然匹中 ==')
    print('（这是嫌疑不是定案 —— 每条都要手工做一次真突变复核，见文件头 ③）\n')
    for name, pattern, label, msg, still in flagged:
        print(f'❌ {name}')
        print(f'   pattern : {pattern}')
        print(f'   label   : {label[:70]}')
        print(f'   真消息  : {msg[:90]}')
        for h in still[:3]:
            print(f'   仍匹中  : {h[:90]}')
        print()
    return 0        # 恒为 0：这是手动工具，不是门


if __name__ == '__main__':
    sys.exit(main())
