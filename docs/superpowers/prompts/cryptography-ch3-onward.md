# CryptoViz 续建交接：第 3–5 章

> 这份文件是给**新会话**用的。把它整份读完，然后照 §3 的循环干活。
> 写于 2026-08-10，第 1–2 章完成之后。作者是上一个会话的编排者。

---

## 1. 现在的状态

`cryptography/` 是一个独立子项目（与 `chess/` 并列），已合并到 `main`：

| | |
|---|---|
| 第 1 章 古典密码 | **13/13 完成** |
| 第 2 章 机械密码 | 2 个（`crypto-cipher-machines`、`crypto-enigma`）—— 见 §6 确认状态 |
| 断言 | 约 5900 条，17+ 个测试文件 |
| 校验门 | **12 道**，`cryptography/scripts/check.py` |
| 引擎 | `crypto-1.2.0` |
| 根项目影响 | `tools.json` / `outputs/` / `chess/` **零改动**，只有 `index.html` 一张子项目卡片 |

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
    for f in ('kicker', 'title', 'tag'):
        L.append(f"    {f}: {{ en: {q(t[f]['en'])}, zh: {q(t[f]['zh'])} }}" + (',' if f != 'tag' else ''))
    L.append('  }' + (',' if i < len(d['tools']) - 1 else ''))
L.append('];')
blk = '\n'.join(L); pat = re.compile(r'var FALLBACK = \[.*?\n\];', re.DOTALL)
for n in ('cryptography/app.html', 'cryptography/index.html'):
    p = pathlib.Path(n); p.write_text(pat.sub(lambda _m: blk, p.read_text(), count=1))
```

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
- **Use `VizEngine.fitCells(availW, wanted, {gap})`** for any row/grid of cells — never floor the cell size and let content spill. That shape shipped five overflow bugs here. State truncation explicitly.
- `barChart` needs explicit `o.max` during animation. No `bindOrbit` on 2D tabs. Feed the timeline `E.state.dt`. Use `VizEngine.mathFont()`.
- **Check 375px** on every tab, both languages, before calling it done.

## Verification
- The preview pane serves stale `file://` snapshots for minutes — assert a source marker in your probe, or use a local HTTP server.
- Explicit `tabId` every call; assert `TOOL.id === 'crypto-<name>'` in every probe.

## Do NOT
touch the registry / `app.html` / `index.html` / other tools / other `core/` files / repo root; run git; write outside your worktree.

**Expected**: `check.py` exits 1 with exactly one error — the missing registry entry. That is correct; registration is the orchestrator's. Every other gate must be green.

**Report, don't bend**: if an instruction is factually wrong, STOP and report it with measurements. Briefs in this project have repeatedly contained false claims that implementers correctly refused.

REPORT: worktree path; files; `check.py` output; the measured numbers; per-tab browser observations; anything wrong in this brief.
````

**最后那条「report, don't bend」是整套方法里最值钱的一句。** 它挡下过：一句数学上假的
话（"更多方阵拉平双字母统计"——四方阵同样是双射，Δ 恒为 0）、一个不可能的扩散论断
（一个字母只有两个坐标，永远碰不到第三个密文字母）、一个不存在的历史密码
（"seriated bifid"）、一条会自我否定的演示（Solitaire 用相邻对调，53 次里 16 次密钥流
不变）、以及"摩尔斯是前缀码"（它不是，`E`=`.` 是 `I`=`..` 的前缀）。

---

## 6. 第 3 章：密码分析

规范只列了一个工具：`crypto-cryptanalysis`（密码分析工作台）。

**先确认第 2 章是否已合并**：`python3 -c "import json;print([t['id'] for t in json.load(open('cryptography/cryptography-tools.json'))['tools']])"`。
若 `crypto-cipher-machines` / `crypto-enigma` 不在其中，先按 §3 收工并合并它们
（worktree 在 `.claude/worktrees/` 下，agent id 见上一会话记录；若 worktree 已被清掉，
就重新起 agent）。

### `crypto-cryptanalysis` — 密码分析工作台（chapter 3，accent 建议 `violet`）

这一页**不新增算法**，它把 `cryptanalysis.js` 已有的全部武器摆到一起，让人对**未知**
密文动手。core 里已经有：`letterCounts` / `letterFrequency` / `chiSquare` /
`bruteForceBest` / `indexOfCoincidence` / `ngramCounts` / `repeatedSequences` /
`kasiskiPeriods` / `icByPeriod` / `columnsForPeriod`。

三个页签建议：

| tab | 画什么 | 顿悟 |
|---|---|---|
| `identify` | 给一段未知密文，自动算 IoC、频率轮廓、重合指数、双字母分布，并把它落到一张**判别树**上 | **先认出是哪一类，再谈破解。** IoC≈0.066 且频率有峰 → 换位；IoC≈0.066 且频率被置换 → 单表代换；IoC≈0.04 → 多表；频率近平但双字母有峰 → Playfair 类 |
| `workbench` | 选定类别后调用对应武器：χ² 穷举 / Kasiski+IoC 定周期 / 逐余类求解 / 爬山法解代换 | 前十三个工具各自教了一件武器，这里第一次让人自己选 |
| `pipeline` | **顿悟视角**：把第 1–2 章每个密码接上它的致命判据，连成一张表——谁被什么杀死 | 整章的收束。密码分析不是一堆技巧，是**一棵判别树** |

**必须诚实的地方（实测过，不要让它overclaim）**：
- Kasiski 只能定到「周期或其倍数」，短文本上会输给 IoC。实测 9 字母密钥 / 348 字母
  密文时 Kasiski 把 p6 排第一而正确的 p9 排第三，同一份密文 IoC 正确峰在 p9。
- 「取最小的高点」这条启发式实测 39/56 正确，失手全落在真周期的**约数**上。
  **不要做成自动答案**，标出所有高点、让人取。
- 短样本（<100 字母）上多数统计判据都会失效——工具应当**明说样本不够**，而不是给一个
  自信的错答案。

---

## 7. 第 4 章：现代密码学（6 个）

`crypto-one-time-pad` · `crypto-des` · `crypto-aes` · `crypto-diffie-hellman` ·
`crypto-rsa` · `crypto-hash-functions`

**这一章需要先扩 core**（照第 1 章的做法：共享能力先落地，再并行起工具）：
`crypto-core.js` 要补 `toBytes` / `fromBytes` / `toBits` / `xorBytes` 等字节与比特工具
（建子项目时**刻意推迟**了它们，因为当时没有消费者）。

顿悟建议：

- **OTP**：接上第 1 章结尾。古典流密码倒下是因为密钥是**英语**；密钥真随机且不复用时，
  密文对任何明文都同样可能——完美保密不是「难」，是**信息论上无信息**。还要演示
  **复用即崩溃**（两条密文异或掉密钥，剩下两条明文异或）。
- **DES**：Feistel 结构——加密与解密是**同一套电路**，只是子密钥反序。以及 56 位密钥
  今天意味着什么。
- **AES**：SubBytes/ShiftRows/MixColumns/AddRoundKey 四步各自负责什么；雪崩效应可测。
- **Diffie–Hellman**：颜色混合的类比 + 真实的模幂；**离散对数难**是全部依据。
- **RSA**：把 p,q → n → φ(n) → e → d → 加解密变成可见过程（规范 §14 点名）。
- **Hash**：雪崩、抗碰撞、生日界；MD5 碰撞可以直接摆出来。

---

## 8. 第 5 章：量子时代（5 个）

`crypto-quantum-foundations` · `crypto-bb84` · `crypto-e91` ·
`crypto-quantum-attacks` · `crypto-post-quantum`

**这一章要先建 `core/quantum-sim.js`**（建子项目时刻意没建——当时没有消费者，
而一个空占位文件会逼 check.py 为它开豁免）。它负责：qubit 态、基、测量、概率、
偏振、Bloch 球坐标、BB84 光子态、Eve 拦截、QBER、纠缠关联。
**它是教学模拟器，不是假装实现真实量子硬件**——规范原话。

**同时要给 `check.py` 补量子专属的四道门**（规范 §19）：
概率 ∈ [0,1] · 态归一化 · 确定性种子测试 · BB84 的期望统计行为。

⚠ **随机性必须可种子化。** 测试里绝不能出现 `Math.random()`——本项目对 flaky gate
零容忍。用注入的 rng（第 1 章的 `randomKey(rngFn)` 是先例）。

3D 引擎在这里终于用得上：Bloch 球是保留 3D 子系统的原因之一
（另一个是 Caesar 的模 26 螺旋）。

---

## 9. 已知坑（每一条都真实发生过）

1. **预览面板会连续几分钟送旧的 `file://` 快照。** 两个 agent 加编排者各撞一次，
   都出现过「修复看起来验过了」其实根本没加载。在探针里断言源码标记，或起本地 HTTP。
2. **浏览器标签页会被别的会话抢走。** 每个探针里断言 `TOOL.id`——这条真的抓到过。
3. **标签页上限**会被并行 agent 占满；agent 会关掉死掉的孤儿页，属正常。
4. **`gh pr merge` 不会因 CI 红而拒绝**（本仓无分支保护）。合并前必须自己读。
5. **CI 跑的是被测分支自己的 workflow 文件**——比某道门更早切出的分支不会跑到它。
6. **钩子会在你 `git add` 之后再暂存文件**。合并前重读 `git status --short`。
7. `rm` 在上一个会话被权限拦下过；`git worktree remove --force` 可用。

---

## 10. 一句话交接

前十四个工具的价值，一半在工具本身，一半在**十二道门**和那句
「report, don't bend」——它们是这套东西能在无人逐行复查的情况下继续长大的原因。
新加工具时，**先想清楚这一页要让人看见哪个可被证伪的事实**，再去写代码；
brief 里写错的事实，实现者有责任报回来，而不是把测试改绿。
