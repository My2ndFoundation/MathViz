# CryptoViz 交接：五章全部完成之后

> 这份文件是给**新会话**用的。规划的五章已经全部落地，所以它不再是"接着建"的
> 路线图，而是**这套东西怎么长起来的、以及继续动它时要知道什么**。
> 初稿 2026-08-10（第 1–2 章后）；二稿同日（第 3 章）；
> **三稿 2026-08-10：第 4、5 章完成，规划范围收口。**

---

## 1. 现在的状态

`cryptography/` 是一个独立子项目（与 `chess/` 并列），全部已合并到 `main`：

| | |
|---|---|
| 第 1 章 古典密码 | **13/13** |
| 第 2 章 机械密码 | **2/2** |
| 第 3 章 密码分析 | **1/1** |
| 第 4 章 现代密码学 | **6/6**（OTP · DES · AES · DH · RSA · Hash） |
| 第 5 章 量子时代 | **5/5**（foundations · BB84 · E91 · attacks · post-quantum） |
| 工具总数 | **27** |
| 校验门 | **16 道**（12 + 四道量子门），`cryptography/scripts/check.py` |
| 引擎 | `crypto-1.2.0` |
| 根项目影响 | `tools.json` / `outputs/` / `chess/` **零改动**，只有 `index.html` 一张子项目卡片 |

**规划范围已经做完。** 后续工作是升级、修缺陷、或超出原规划的新工具——
不是"继续第 N 章"。当前已知未做的事记在 §11。

**先跑一遍确认起点是绿的**：

```bash
cd /Users/nickma/Develop/My2ndBrain/MathViz
git checkout main && git pull --ff-only
python3 cryptography/scripts/check.py        # 必须 exit 0
python3 scripts/sync_registry.py --check     # 必须 exit 0（证明根注册表没被波及）
python3 chess/scripts/check.py               # 必须 exit 0（证明没误伤 chess）
```

关键文档：`.claude/skills/crypto-viz-tool/SKILL.md`（作者流程）、`CLAUDE.md` 的
"Subprojects" 一节（硬边界与三条不变量）、`docs/superpowers/cryptography.md`（架构规范）。

---

## 2. 不可协商的边界

1. **绝不把 CryptoViz 工具注册进根 `tools.json`。** 三套注册表互不相交。
2. 不碰 `chess/`、`outputs/`、根 `app.html`、`scripts/sync_registry.py`。
3. 生成区间（`/* >>> GENERATED:X */ … */`）禁止手改——改 `core/`，然后跑 `inline_core.py`。
4. `cryptography/` 必须能被整体搬走后独立运行：`core/` `examples/` `tools/` 里
   **不许出现父目录相对路径**（门 8 执法）。
5. 章节是闭集 1–5；accent 是闭集 cyan/rose/violet/emerald/orange（可重复使用）。

---

## 3. 干活的循环

每一批：**起 agent → 收工 → 中心化注册 → 过门 → PR → 读 CI → 合并 → 同步**。

### 3.1 起 agent

每个工具一个 agent，**`isolation: "worktree"`**（CLAUDE.md 明令：并行构建者必须各自
隔离，冲突来自共享状态而不是共享文件）。brief 模板见 §5。

**agent 不许碰注册表、不许跑 git。** 中心化注册是编排者的事——这不是洁癖，是因为
两份 `FALLBACK` 与注册表必须同时改，交给并行 agent 必然打架。

### 3.2 收工

```bash
W=.claude/worktrees
cp "$W/agent-<id>/cryptography/core/algos/<name>.js"      cryptography/core/algos/
cp "$W/agent-<id>/cryptography/core/algos/<name>.test.js" cryptography/core/algos/
cp "$W/agent-<id>/cryptography/tools/crypto-<tool>.html"  cryptography/tools/
```

**只取这三类文件。** agent 的 worktree 里还有一份旧的 `crypto-caesar.html` 等副本——
那是它检出时的快照，不是真相。

收完立刻用**主树的** core 重跑它们的测试（agent 写作时用的可能是旧引擎）：

```bash
node cryptography/core/algos/<name>.test.js
```

### 3.3 注册（编排者亲手做）

注册表加条目，然后**程序化重生成**两份 FALLBACK——不要手抄，手抄是这两份镜像唯一的
漂移来源：

```python
import json, pathlib, re
r = pathlib.Path('cryptography/cryptography-tools.json'); d = json.loads(r.read_text())
d['tools'].append({...})                      # 见 §4 字段
d['tools'].sort(key=lambda t: (t['chapter'], t['id']))
r.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')

def q(s): return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"
L = ['var FALLBACK = [']
for i, t in enumerate(d['tools']):
    L.append('  {')
    L.append(f"    id: {q(t['id'])}, file: {q(t['file'])}, accent: {q(t['accent'])}, chapter: {t['chapter']},")
    L.append(f"    version: {q(t['version'])},")      # ← 必须有，见下
    for f in ('kicker', 'title', 'tag'):
        L.append(f"    {f}: {{ en: {q(t[f]['en'])}, zh: {q(t[f]['zh'])} }}" + (',' if f != 'tag' else ''))
    L.append('  }' + (',' if i < len(d['tools']) - 1 else ''))
L.append('];')
blk = '\n'.join(L); pat = re.compile(r'var FALLBACK = \[.*?\n\];', re.DOTALL)
for n in ('cryptography/app.html', 'cryptography/index.html'):
    p = pathlib.Path(n); p.write_text(pat.sub(lambda _m: blk, p.read_text(), count=1))
```

**`version` 那一行不能省。** 画廊卡片上的版本徽章与链接上的 `?v=` 缓存键都读它，而
`file://` 下 `fetch` 会失败、FALLBACK 是**唯一**的数据来源——漏掉它，离线打开的画廊
上每张卡都是 `vundefined`，而线上一切正常。`check.py` 的 `fallback_check()` 只比对
**id 集合**，不会替你发现这件事（主站 CLAUDE.md 记过同源的教训：一个没人校验的镜像
字段一定会漂移，48/62 条曾经静静对不上）。

然后 `python3 cryptography/scripts/inline_core.py && python3 cryptography/scripts/check.py`。

### 3.4 提交与合并

在 `main` 上先切分支。**只暂存显式路径**，钩子跑完后**重读 `git status --short`**——
钩子会在你 `git add` 之后再暂存文件（`inline_core.py --print-changed` 的产物）。

```bash
gh pr create --title "..." --body "..."
gh pr checks <PR#>     # 必须读到 pass 再合并；gh pr merge 不会因红而拒绝
gh pr merge <PR#> --merge
git checkout main && git pull --ff-only
git branch -d <branch> && git push origin --delete <branch>
python3 cryptography/scripts/check.py    # 合并后的 main 再验一次
```

**本机绿不是绿。** 本仓记录过 `registry-sync.yml` 连续四次把红色报进虚空
（macOS 无 `MAX_ARG_STRLEN`、Linux 有）。每次合并前读 CI 结论。

---

## 4. 注册表字段

```json
{
  "id": "crypto-<name>",
  "file": "tools/crypto-<name>.html",
  "accent": "cyan|rose|violet|emerald|orange",
  "chapter": 3,
  "kicker": { "en": "Cryptanalysis", "zh": "密码分析" },
  "title":  { "en": "...", "zh": "..." },
  "desc":   { "en": "...", "zh": "..." },
  "tag":    { "en": "...", "zh": "..." },
  "version": "1.0.0",
  "engine": "crypto-1.2.0",
  "changelog": []
}
```

`kicker` 按章节：1 古典密码 / 2 机械密码 / 3 密码分析 / 4 现代密码学 / 5 量子时代密码学。

`desc` 写**这个工具让人看见了什么**，不是它有什么功能。参考已合并的条目——每条都在讲
一个可被证伪的事实，而且多数带实测数字。

---

## 5. Agent brief 模板

照抄这个骨架，只换「## Build」一节。**每一条约束都是用代价换来的，不要精简掉。**

````
Build a cryptography visualisation tool in the MathViz repo. You work in **your own isolated git worktree**.

READ FIRST: `.claude/skills/crypto-viz-tool/SKILL.md` (**follow it — note the "Fitting things to the canvas" section**), `CLAUDE.md` "Subprojects", `cryptography/tools/_skeleton.html` (**copy it; never invent a tool shell**), <一个相近的已完成工具>, `cryptography/core/`.

## Build: `crypto-<name>` — <中文名> / <English name> (Chapter N)

Files (NOTHING else): `cryptography/core/algos/<mod>.js` + `.test.js`, `cryptography/tools/crypto-<name>.html`

<模块 API>
<三个页签的表格：tab / draws / the realisation>
<要求它数值验证的具体claim>

## Non-negotiables
- `fmt` in `PARAMS` must be a **FUNCTION**; a number throws inside `init()` → blank canvas.
- ALGOS list must name **every** algo the page calls, **in dependency order** (a module capturing `root.CryptoAlgos.X` at load needs X listed first — gate 12 enforces this).
- Never write a literal `<`+`script`+`>` anywhere including comments (gate 10). **No C0 control bytes** (gate 11).
- **Use `VizEngine.fitCells(availW, wanted, {gap})`** for any row/grid of cells — never floor the cell size and let content spill. That shape shipped five overflow bugs here. State truncation explicitly. **`fitCells` is necessary but not sufficient**: it reserves no room for a truncation marker and does not cover *text* chips.
- **`E.chip` neither measures nor clips, and it centres its text** — any full-width label needs its own width check. **There is no monospace font in the engine** (`mono:true` is the sans stack), so two rows cannot be column-aligned; use one chip per character.
- **Do not write an em-width estimator.** `canvas.getContext('2d')` returns the *same* ctx `viz-engine.js` draws on, DPR transform already applied, so **real `measureText` is available** — `crypto-e91` and `crypto-quantum-foundations` use it. The inherited `0.55em` constant is wrong for CJK (~2× Latin) and for ALL-CAPS (~0.58em).
- `barChart` needs explicit `o.max` during animation, **but it clamps to [0,1] and grows from a baseline — it is unusable for signed quantities**; draw your own bars from a zero line. Feed the timeline `E.state.dt`. Use `VizEngine.mathFont()`.
  （**不要**再写「2D 页签不许调 bindOrbit」——`VizEngine.init()` 无条件调用它，
  在不改共享 core 的前提下做不到。屏幕空间 2D 页签上它无害：相机变化不可见，
  而 `CryptoInteract.bind` 能与它共存于同一个 canvas。）
- **Never use a minimum-size floor** (`Math.max(120, …)`) for a block that must fit — it turns "doesn't fit" into "draws over something else". Shrink honestly, then drop and say what was dropped.
- **Reserve the honesty caveats' height first.** On short viewports the limitations are the first thing a layout drops, leaving pretty charts and no caveats.
- **Check 375px** on every tab, both languages, before calling it done. **Read the console too** — the engine's per-frame error guard swallows exceptions into a single `console.warn`, so a real bug can look like "a couple of blocks didn't draw".

## Verification
- The preview pane serves stale `file://` snapshots for minutes — assert a source marker in your probe, or use a local HTTP server.
- Explicit `tabId` every call; assert `TOOL.id === 'crypto-<name>'` in every probe.

## Do NOT
touch the registry / `app.html` / `index.html` / other tools / other `core/` files / repo root; run git; write outside your worktree.

**Expected**: `check.py` exits 1 with exactly one error — the missing registry entry. That is correct; registration is the orchestrator's. Every other gate must be green.

**Report, don't bend**: if an instruction is factually wrong, STOP and report it with measurements. Briefs in this project have repeatedly contained false claims that implementers correctly refused — **7 of the last 11 agents returned an error in their brief, and every one of them was right.** **A result of "zero" or "all passed" needs a negative control before it counts**: the orchestrator has shipped three vacuous probes here (comparing `String(object)` to itself; a loop whose body never ran; an enumeration range too small), each caught only by a control.

REPORT: worktree path; files; `check.py` output; the measured numbers; per-tab browser observations; anything wrong in this brief.
````

**给 brief 里的每一条可证伪主张配一个"如果它是假的会怎样"。** 第 5 章最好用的两句是
「100% 的成功率本身就是危险信号」（周期查找实测 75.87%）和「claim 2 与 claim 3 互为
负对照，若两边同向请报回来而不是调参数直到它们分开」。

**最后那条「report, don't bend」是整套方法里最值钱的一句。** 它挡下过：一句数学上假的
话（"更多方阵拉平双字母统计"——四方阵同样是双射，Δ 恒为 0）、一个不可能的扩散论断
（一个字母只有两个坐标，永远碰不到第三个密文字母）、一个不存在的历史密码
（"seriated bifid"）、一条会自我否定的演示（Solitaire 用相邻对调，53 次里 16 次密钥流
不变）、以及"摩尔斯是前缀码"（它不是，`E`=`.` 是 `I`=`..` 的前缀）。

---

## 6. 第 3 章：密码分析 —— **已完成**（PR #133）

`crypto-cryptanalysis`（密码分析工作台，chapter 3，accent `violet`，v1.0.0）。

实际做成的三个页签**与初稿的建议不同**，原因值得留给后来人：初稿建议的 `workbench`
（χ² 穷举 / Kasiski+IoC 定周期 / 逐余类求解）**是已有五个页签的第四份拷贝**——
`crypto-caesar`「Brute Force」、`crypto-affine`「Brute Force」、`crypto-vigenere-family`
「Find the Period」+「Break」、`crypto-quagmire`「Find the Period」+「Solve」、
`crypto-hill`「Break」、`crypto-fractionation`「Period」都已经在教同一批武器。
**加工具前先普查已有页签**：`grep -n "^  label: { en: '" cryptography/tools/*.html`。

最终形态：

| tab | 画什么 | 顿悟 |
|---|---|---|
| `identify` | 四个只用密文算得出的量（IoC / χ²·n⁻¹ / 重复二元组 obs vs pairs×IoC / 结构指纹），落到判别树上，给出家族 + 武器 + 教那件武器的工具 | 一把钥匙都没试，四个数字就叫出了家族的名字 |
| `evidence` | 同一条 0.055 阈值扫过 8 个样本长度，每档 40 段单表 + 40 段多表（固定种子） | **阈值一步没动，动的是证据。** 两条 IoC 区间在 100 字母处仍重叠、到 150 才分开 |
| `tree`（顿悟视角） | 整棵判别树：每条边是一个可实测的判据，每片叶子是第 1–2 章的一个密码 + 它的武器 + 那一页 | 密码分析不是一堆技巧，是**一棵树**，前十五个工具都是它的叶子 |

core 扩展：`classify` / `digraphDoubles` / `absentLetters` / `icSweep` / `rng32` /
`cyclicSlice` / `distinctKey`，加 `MIN_SAMPLE=200`、`IC_SINGLE=0.055`、
`CHI2_PER_LETTER=1.0`、`ALPHABET_MIN_DISTINCT=10` 四个阈值常数。

### ⚠ 初稿这一节有两条数字复现不出来——已订正

**不要再传播它们。** 两条都不是造假，是**协议依赖**：换语料、换密钥长度、换文本长度
就会得到不同的数字。教训写在 §9.8。

| 初稿的说法 | 复现结果 |
|---|---|
| 「9 字母密钥 / 348 字母时 Kasiski 把 p6 排第一、正确的 p9 排第三，IoC 正确峰在 p9」 | 编排者 4 次试验里 Kasiski **每次都排第一**；实现者 24 次试验里 **23/24** 第一。IoC 反而在 9 字母密钥上把 2p 排到了前面。**谁也不占优，都随样本抖** |
| 「『取最小的高点』实测 39/56，失手**全落在约数**上」 | 三方三个数：编排者 52%(n=80)→100%(n≥300)、失手**多数不是约数**；实现者按同协议 87%/64%/95%…、n≥200 时失手**全是**约数。协议本身噪声极大 |

**能稳住的说法**（三方一致，且写进了测试）：
- 换位逐位保持字母计数 → χ² 与明文**完全相同**（`===` 成立）。
- 单表代换逐位保持 IoC（`===` 成立），而 χ² 暴涨（656 字母语料上 28.39 → 2078.57）。
- **Playfair 不可能吐出一对相同字母**——结构性，不是统计性。穷举 6 把密钥 × 600 对
  = 3600 次，行/列/矩形分别命中 600/600/2400，重复输出 0 次。
- 重复二元组的偶然期望是 **`pairs × IoC`**，不是 `pairs / 26`；且二元组必须**不重叠**
  （`pairs = floor(n/2)`），滑动窗口版本下 Playfair 那条保证不成立。
- 短样本上判据失效——**工具要明说样本不够**，而不是给一个自信的错答案。

### 实现者顶回来的三条（都已独立复核，全部采纳）

1. **`ALPHABET_MIN_DISTINCT = 10` 是必须的。** ADFGX 密文只有 5 个互异字母、
   IoC **0.2083**（比英文还高），没有这道下限会被「IoC ≥ 0.055 ⇒ 单表」直接判成单表代换。
2. **「n ≥ 200 误判为 0」不稳。** 编排者 4 个种子全是 0/0，实现者换种子与密钥模型后量到
   0–3/40。页面因此改为断言那条稳的性质（区间重叠→不重叠的翻转点），不宣称误判归零。
3. **实验协议里「随机密钥可以有重复字母」是个未受控的混杂因素。** `XBX` 名义周期 3、
   实际只有 2 张表，n=300 时 IoC 0.0576 越过阈值被判成单表，而 `XBY` 是 0.0475。
   扫描图改为抽互异字母密钥。

---

## 7. 第 4 章：现代密码学 —— **已完成**

`crypto-one-time-pad`(cyan) · `crypto-des`(emerald) · `crypto-aes`(violet) ·
`crypto-diffie-hellman`(orange) · `crypto-rsa`(rose) · `crypto-hash-functions`(cyan)

**分两阶段做的，这个顺序是这一章最值钱的经验**：先把 `crypto-core.js` 的字节/比特
工具（`toBytes`/`fromBytes`/`toHex`/`fromHex`/`xorBytes`/`randomBytes`/`toBits`/
`fromBits`/`rotl32`/`rotr32`/`modPow`）单独做成一个 PR **合进 main**，再并行起六个工具。

理由：六个 agent 各改一次 `crypto-core.js` 必然打架；而且共享 core 一改，
`inline_core.py` 会重写**所有**工具页，六份并行 diff 会互相覆盖。收 core 那一轮
**只收 `core/` 源文件、在主树自己跑 `inline_core.py`**——已验证是确定性的
（重新生成的页面与 worktree 逐字节一致），还能顺带独立复核"所有改动都落在
GENERATED 区间内"。

各页顿悟（都是实测支撑的，可以直接引用）：

| 工具 | 顿悟 | 关键实测 |
|---|---|---|
| OTP | 完美保密不是"难"，是**没有信息** | 固定密文，任取候选明文都存在唯一密钥解回它；重用密钥时 C1⊕C2 精确抵消，114/114 字节 |
| DES | 加解密是**同一套电路**，F **不必可逆** | 常数 F 把 60 个输入映到 1 个输出，密码仍 60/60 往返成功；奇偶位翻遍 256 种组合密文不变 |
| AES | 关掉 ShiftRows，它塌成**四个独立的 32 位密码** | 列 0 的 32 比特 × 10 轮：关掉时跨列 0/320，开着 312/320（差的 8 次正是第 0 行那个字节） |
| DH | 全部依据是一条能数出来的不对称 | p=101 正向 5 次运算、反推最多 100 次；g=10 只走到 4/100 个值 |
| RSA | 全部压在"分解 n 很难"上 | 16 位数浏览器约 100ms 分解完，d 逐比特还原；穷举往返 22981 条消息 0 失败 |
| Hash | 生日界把指数**折半** | k=16 时中位数 282 次（2^k 是 65536，捷径 232 倍）；MD5 真实碰撞已用 node crypto 独立复核 |

**验证方法上的一条通用做法**（第 4 章反复用到）：标准算法要拿**独立实现**对，不是拿
用它的那个 agent 对。node 内建 `crypto` 就是免费的 OpenSSL：AES 对 500 组随机
(密钥,分组)、SHA-256 与 MD5 对 0–200 全部长度（覆盖 55/56 与 63/64 分块边界）。
**OpenSSL 3 停用了单重 DES**，但 `3DES(k,k,k) === DES`，用 `des-ede3-ecb` 配三倍密钥
就有独立参考。

---

## 8. 第 5 章：量子时代 —— **已完成**

`crypto-quantum-foundations`(cyan) · `crypto-bb84`(rose) · `crypto-e91`(violet) ·
`crypto-quantum-attacks`(orange) · `crypto-post-quantum`(emerald)

同样是**先 core 后工具**：`core/quantum-sim.js`（733 行 / 793 条断言）与四道量子门
先合进 main，再并行起五个工具。

### `core/quantum-sim.js` 的约定

复数、量子态与归一化、三组基（`rect`/`diag`/`circ`）、测量与概率、偏振与马吕斯、
Bloch 球坐标、单比特门（I X Y Z H S T + rx ry rz）与酉性判定、BB84 光子与协议、
QBER、Bell 态与联合概率、关联函数与 CHSH。

**它是教学模拟器，不是假装实现真实量子硬件**（规范原话，写在模块头）。
**只建模单量子比特与 Bell 对**——没有多比特寄存器、没有电路模拟器，
所以 **Grover / Shor 不在这里**，模块头第 41 行就写着"那是 crypto-quantum-attacks
的事"。

几处会绊人的签名（每一条都让编排者的探针失败过一次）：

```
measure(state, basisId, rng)     // 收**基的 id 字符串**，不是基对象；返回 .outcome，不是 .bit
probabilities(state, basisId)    // 返回 [p0, p1]
applyGate(state, matrix)         // **state 在前**
keyExpansion(key)                // （AES）返回**每轮 16 字节的数组**，不是扁平流
encryptBlock(...)                // （DES）返回**字节**，不是比特数组
bb84Run(...).qber                // 是**对象** {errors, compared, rate}，不是数字
chsh(pair, angles)               // pair 是 4 个复振幅 [c00,c01,c10,c11]
```

### `QUANTUM-SIM` 标记的约定

`inline_core.py` 的 `SOURCES` 与 `OPTIONAL_TAGS` 里都有它，但
**`_skeleton.html` 有意不带这对标记**——骨架是以后每个工具的起点，把量子模拟器内联进
一张凯撒页是死重量。需要它的页面**自己加**，且必须放在 `GENERATED:CRYPTO-CORE`
**之后**（模块在浏览器分支捕获 `root.CryptoCore`）。

**gate 9（`inline_order_check`）已经扩到覆盖 `QUANTUM-SIM`**，顺序错了它会红。
这不是形式主义：顺序错时页面**照常加载**，第一次调用才炸——CLAUDE.md 记着这个形态，
当时内联门、语法门、算法门全绿，只有顺序门红。

`crypto-quantum-attacks` **不带**这对标记，因为它一处都不引用量子模块——
把 35KB 用不上的模拟器内联进一张主张"这里没有量子计算"的页面是自相矛盾。

### 四道量子门（规范 §19，已实现）

| 门 | 判据 | 要点 |
|---|---|---|
| 概率 | 全部落在 [0,1]，成组求和为 1 | |
| 归一化 | 容差 **1e-9** | 下界是浮点本身（写死的 \|+⟩ 已差 2.2e-16），上界是真实 bug 的量级（H 写成 0.707 一步就到 0.99970） |
| 确定性 | **把量子测试跑两遍，要求输出逐字节相同** | 纯文本扫 `Math.random` 会漏掉 `Date.now`、Set 迭代顺序、未种子化洗牌 |
| BB84 统计 | 无 Eve QBER 恰为 0、拦截—重发 ≈0.25、筛选率 ≈0.5 | 容差是 **6σ 按实际样本量算**，不是魔法常数（200 个种子的普查里最坏 4.05σ） |

⚠ **随机性必须可种子化。** 测试与页面都不许出现 `Math.random()`——本项目对 flaky gate
零容忍。用注入的 rng（`randomKey(rngFn)` / `randomBytes(rngFn,n)` / `rng32` 是先例）。

3D 引擎在这里兑现：Bloch 球是当初保留 3D 子系统的两个理由之一
（另一个是 Caesar 的模 26 螺旋）。**但不是所有量子页都该用 3D**——
`crypto-post-quantum` 的格是二维的，透视相机会加一层读者必须在脑内撤销的投影，
所以它有意画在屏幕空间，与 `crypto-hill` 的 Geometry 页同一选择。

### 两条本章确立的诚实性边界

- **不模拟 Shor。** core 只有单比特，Shor 需要多比特寄存器与 QFT。
  `crypto-quantum-attacks` 展示的是**经典的**周期查找归约（真实、跑得动、而且确实是
  Shor 的大部分），并写明量子计算机替换掉的是**恰好哪一个**子程序。
  不要画一个其实是经典代码的"量子电路"。
- **不印标准表。** 哪些方案被标准化、叫什么名字、什么日期，是**仓库内无法验证**的外部
  事实，而本项目其余每一条主张都对过独立来源。`crypto-post-quantum` 因此
  **一个方案名、一处 NIST、一个日期都没有**，把分量全放在数学上。

---

## 9. 已知坑（每一条都真实发生过）

0. **brief 里写错的事实会被实现者挡下——这是设计，不是意外。** 第 1–2 章里被挡下
   的有：一句数学上假的话、一个不可能的扩散论断、一个不存在的历史密码、一个会自我
   否定的演示、「摩尔斯是前缀码」、「crib 能排除大多数位置」（只对长 crib 成立，
   比例恰好 1−(25/26)^L），以及「2D 页签不许调 bindOrbit」（做不到）。
   **写 brief 时把可证伪的数字写进去并要求实现者复核**，比写得含糊安全得多。

1. **预览面板会连续几分钟送旧的 `file://` 快照。** 两个 agent 加编排者各撞一次，
   都出现过「修复看起来验过了」其实根本没加载。在探针里断言源码标记，或起本地 HTTP。
2. **浏览器标签页会被别的会话抢走。** 每个探针里断言 `TOOL.id`——这条真的抓到过。
3. **标签页上限**会被并行 agent 占满；agent 会关掉死掉的孤儿页，属正常。
4. **`gh pr merge` 不会因 CI 红而拒绝**（本仓无分支保护）。合并前必须自己读。
5. **CI 跑的是被测分支自己的 workflow 文件**——比某道门更早切出的分支不会跑到它。
6. **钩子会在你 `git add` 之后再暂存文件**。合并前重读 `git status --short`。
7. `rm` 在上一个会话被权限拦下过；`git worktree remove --force` 可用。

8. **「零次违规」在补上负对照之前不算证据。**（第 3 章，编排者亲身）
   写 brief 时我要「证明」Playfair 永不产出叠字二元组，穷举了 3600 对，得到 0 次违规，
   差点把它当成实测事实写进 brief。实际上 `mapPair()` 返回的是**对象**，而我写的是
   `String(out)[0] === String(out)[1]`——即 `'[object Object]'` 的第 0 位与第 1 位，
   `'['` 与 `'o'`，**永远不等**。那个探针一次都没真正比较过，却给出了一个看起来
   极有说服力的数字。
   **规则**：凡是以「计数为 0」为结论的探针，必须同时断言 ①取出来的值形状对
   （这里：`.out` 是 2 字符字符串）、②故意写错的同一个比较**会**触发。
   现在这条负对照本身就是 `cryptanalysis.test.js` 里的一条断言。
   这与 CLAUDE.md 里记的三次测量方法自身即 bug 是同一族：**一个结构上就观察不到
   目标的方法，被用来排除那个目标**。

9. **brief 里写数值，不如写测量协议。** 第 3 章一共出现四组互相对不上的数字，
   没有一组是造假——全是语料、文本长度、密钥长度、密钥是否允许重复字母的差异。
   **把协议写进 brief 并要求实现者报自己的数**，比钉一个让人去凑的值安全得多。
   当两边的数不一致时，**取在两个实验台上都成立的那条说法**，而不是只在你这边
   更漂亮的那条。

10. **`fitCells` 必要但不充分，而画布的排版陷阱有一整族。** 第 4、5 章里
    **每一个** agent 都在窄屏排版上栽过，加起来二十多个真实缺陷。清单：
    - `fitCells` **不为省略号预留位置**，也管不到*文本* chip。
    - `E.chip` **既不测量也不裁剪**，而且居中——任何满宽标签都要自己算宽度。
    - **引擎里没有等宽字体**（`mono:true` 是 sans 栈）。两行文本无法按列对齐，
      要一字符一 chip。爱丽丝那行与鲍勃那行就是这么排的。
    - 中文约为拉丁的 2 倍宽/字符。一个按英文调好的 `0.55em` 估算器在中文上会溢出；
      而 `0.55` 对**全大写**也偏小（实测大写约 0.58em）。
    - **但估算器根本不必要**：`canvas.getContext('2d')` 返回的就是 `viz-engine.js`
      正在画的**同一个** ctx（DPR 变换已应用），所以**真实的 `measureText` 拿得到**。
      `crypto-e91` 与 `crypto-quantum-foundations` 用它把"375px 下不溢出"从肉眼
      判断变成了断言。**新工具直接用这条，别再抄估算器。**
    - `barChart` 夹到 [0,1] 并从基线生长，**有符号的量用不了它**（E91 的 E ∈ [−1,1]、
      S ∈ [−2√2, 2√2]）。自己画从零线出发的柱。
    - **`Math.max(120, …)` 这类"最小高度"把"放不下"变成"画到别的东西上"**——
      与五个溢出 bug 同一形状，只是换了个轴。
    - **短视口下最先被丢掉的，往往正是诚实性说明。** BB84 一度只剩两张漂亮的图
      而没有任何限制条件。诚实性文案的高度要**优先预留**，要丢先丢图表并写明丢了什么。

11. **引擎的逐帧错误守卫会把异常吞成一条 `console.warn`。**
    `crypto-quantum-foundations` 的偏振片标签有个 off-by-one（读到 `undefined`），
    屏幕上只表现为"底部两块没画出来"。**它是读控制台发现的，不是看出来的。**
    验证时务必读 console，别只看画面。

12. **骨架的 `.tabs{top:66px}` 假定 h1 只有一行。** `.brand` 在 375px 下限宽
    70vw = 262.5px，标题超过它就折行、第二行落在 78px，**与页签条重叠 12px**。
    **已修**（见 §11.1）。

    ⚠ 顺带记一条**编排者量错了对象**的教训：第一次普查我量的是**注册表 title**，
    得出"27 个里 12 个超标"。但页面上显示的是 `TOOL.h1`，是**另一个、通常更短的**
    字符串（`crypto-cipher-machines` 的 title 是 "Cipher Machines — Wheels & Pin-and-Lug"，
    而 h1 只是 "Cipher Machines"）。按 h1 重量，真正超标的是 **5 个，且只在英文下**。
    量之前先确认量的是不是屏幕上那一个东西。

13. **一个自称"不可能"的性质，要分清它是结构性的还是统计性的。**
    Playfair 不产叠字是**结构性**的（三条规则各自保证），可以穷举证明；
    而"关掉 ShiftRows 后跨列计数为 0"**在第 0 轮对完整 AES 也成立**——
    所以那一页的判定挂在**开关**上，不挂在计数上。
    同理：固定基的 Eve 与随机基的 Eve **都**给出 25% QBER，任何容差都分不开它们。
    **能说的是"有人听过"，不能说"是怎么听的"。**

---

## 10. 一句话交接

二十七个工具的价值，一半在工具本身，一半在**十六道门**和那句
「report, don't bend」——它们是这套东西能在无人逐行复查的情况下长到二十七个的原因。
新加工具时，**先想清楚这一页要让人看见哪个可被证伪的事实**，再去写代码；
brief 里写错的事实，实现者有责任报回来，而不是把测试改绿。

第 3 章给这句话补了一条对称的：**编排者的数字同样会错，而且错得更隐蔽**——
它披着「我亲自量过」的外衣。

**第 4、5 章把这条钉死了。** 十一个 agent 里有七个报回了 brief 的错误，全部成立：

| 被顶回来的 | 实际 |
|---|---|
| 「两片正交偏振片透过 0」 | `malus(90)` = 3.749e-33。`cos(π/2)` = 6.123e-17，物理上是零、字面上不是 |
| 「格问题没有周期」 | **假的。** 格**就是**周期格；区别在 RSA **藏**周期而格**公开**周期 |
| BB84 三个种子的具体数值 | 编排者用了三条 rng 流、`bb84Run` 用一条——同一分布的不同实现 |
| 「用 `barChart` 并给 `o.max`」 | E91 每个量都有符号，`barChart` 夹到 [0,1]，根本不适用 |
| `modInverse` 的取值范围 | 挖出 `mod()` 在 n > 2⁵² 时静默差 1 —— 一个真的 core bug |
| 「MITM 总是让双方得到不同密钥」 | `g^(am) ≡ g^(bm) ⟺ ord(g) \\| (a−b)·m`，不要求 a=b |
| 「39/56，失手全落在约数上」 | 三方三个数，且"是否落在约数上"三方结论相反 |

而编排者自己的探针**空转过三次**（`String(对象)` 比较、循环体一次没跑、
枚举范围不够），每一次都是靠**负对照**才发现的。

所以这套方法真正依赖的不是谁更可信，而是三条：

1. **每一条可证伪的话都必须带着复现它的协议**，让下一个人能独立跑一遍、
   并且在结果不一致时有资格说「不一致」。
2. **凡是以"零"或"全部通过"为结论的判据，先做负对照**——故意弄坏它守的东西，
   确认它会红。一个在功能缺失时仍然报绿的判据不是判据。
3. **标准算法拿独立实现对**，不是拿用它的那个 agent 对。node 内建 `crypto`
   就是免费的 OpenSSL。

---

## 11. 已知未做的事

1. ~~375px 下标题与页签条重叠~~ **已修**，而且是**结构性**地修的，不是又改一个常数：
   窄屏媒体查询里给 `.brand h1` 加 `white-space:nowrap;overflow:hidden;text-overflow:ellipsis`。
   于是 `.tabs{top:66px}` / `.transport{top:110px}` 这对**按单行算出来的常数永远成立**，
   也**不必动任何一页的 `layout()` 内容上边距**——那是 27 份各不相同的页面级常数，
   动它们才是真正的大工程。
   同时把 5 个会溢出的英文 h1 缩短到 320px 下也放得进（实测上限 224px），
   并撤掉了 `crypto-cryptanalysis` 的页面级绕行——那段媒体查询现在 **28 份逐字节相同**。
   负对照：塞一个病态长标题，有网时裁成一行、余量 −11px；把网关掉它折成 3 行、
   压上去 **+35px**。
2. **`examples/examples-modern.js` 与 `examples-quantum.js` 没有建。**
   规范里有它们，但至今**没有消费者**——第 4、5 章的工具要么用现成的
   `examples-classical.js`，要么参数就该是滑杆而不是冻结的数据。
   本项目已经两次记下同一条：空占位文件只会逼 `check.py` 为它开豁免。
   **等到真有工具需要共享数据时再建**，并记得 `EXAMPLES_PARTS` 的顺序是写死的
   （汇总器必须排最后）。
3. `crypto-rsa` 的 `MAX_N = 2⁵²` 现在只由 `factor` 页的试除代价支撑
   （core 的 `mod()` 已修）。要抬高它得先把试除换成更快的分解算法。
