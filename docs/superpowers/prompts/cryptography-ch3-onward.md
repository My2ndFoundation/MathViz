# CryptoViz 续建交接：第 4–5 章

> 这份文件是给**新会话**用的。把它整份读完，然后照 §3 的循环干活。
> 初稿写于 2026-08-10（第 1–2 章之后）；**2026-08-10 第二次更新**：第 3 章完成，
> 并修正了初稿里两条无法复现的实测数字（见 §6）。

---

## 1. 现在的状态

`cryptography/` 是一个独立子项目（与 `chess/` 并列），已合并到 `main`：

| | |
|---|---|
| 第 1 章 古典密码 | **13/13 完成** |
| 第 2 章 机械密码 | **2/2 完成**（`crypto-cipher-machines`、`crypto-enigma`） |
| 第 3 章 密码分析 | **1/1 完成**（`crypto-cryptanalysis`，PR #133） |
| 第 4 章 现代密码学 | 0/6 —— **下一步，但要先扩 core**，见 §7 |
| 第 5 章 量子时代 | 0/5 —— **要先建 `core/quantum-sim.js` 与四道量子门**，见 §8 |
| 断言 | **7430 条**，19 个测试文件 |
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
- **Use `VizEngine.fitCells(availW, wanted, {gap})`** for any row/grid of cells — never floor the cell size and let content spill. That shape shipped five overflow bugs here. State truncation explicitly.
- `barChart` needs explicit `o.max` during animation. Feed the timeline `E.state.dt`. Use `VizEngine.mathFont()`.
  （**不要**再写「2D 页签不许调 bindOrbit」——`VizEngine.init()` 无条件调用它，
  在不改共享 core 的前提下做不到。屏幕空间 2D 页签上它无害：相机变化不可见，
  而 `CryptoInteract.bind` 能与它共存于同一个 canvas。）
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

## 7. 第 4 章：现代密码学（6 个）

`crypto-one-time-pad` · `crypto-des` · `crypto-aes` · `crypto-diffie-hellman` ·
`crypto-rsa` · `crypto-hash-functions`

**这一章需要先扩 core，而且扩 core 要自己单独合一次。**（照第 1 章的做法：共享能力
先落地并合进 main，再并行起工具。）`crypto-core.js` 要补 `toBytes` / `fromBytes` /
`toBits` / `xorBytes` 等字节与比特工具（建子项目时**刻意推迟**了它们，因为当时没有
消费者）。

为什么必须先合进 main 再起工具：第 3 章那次只有一个 agent 动共享 core，所以直接从
worktree 收回来就行；**六个并行 agent 各改一次 `crypto-core.js` 必然打架**。而且
共享 core 一改，`inline_core.py` 会重写**所有**工具页——十六个页面的 GENERATED 区间
同时变动，六份并行 diff 会互相覆盖。

收 core 那一轮的收工方式也不同：**只收 `core/` 与 `examples/` 的源文件，然后在主树
自己跑 `inline_core.py`**，不要从 worktree 拷 HTML。第 3 章验证过这条是确定性的
（重新生成的 15 个页面与 worktree 里的逐字节一致），而且能顺带独立复核
「所有改动都落在 GENERATED 区间内」。

起工具前先做一次**页签普查**，别再造第四份「Brute Force」：

```bash
grep -n "^  label: { en: '" cryptography/tools/*.html
```

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

---

## 10. 一句话交接

前十六个工具的价值，一半在工具本身，一半在**十二道门**和那句
「report, don't bend」——它们是这套东西能在无人逐行复查的情况下继续长大的原因。
新加工具时，**先想清楚这一页要让人看见哪个可被证伪的事实**，再去写代码；
brief 里写错的事实，实现者有责任报回来，而不是把测试改绿。

第 3 章给这句话补了一条对称的：**编排者的数字同样会错，而且错得更隐蔽**——
它披着「我亲自量过」的外衣。第 3 章里实现者顶回来三条、全部成立；编排者自己的
探针空转了一次；上一版交接文件里两条数字谁也复现不出来。
所以这套方法真正依赖的不是谁更可信，而是**每一条可证伪的话都必须带着复现它的协议**，
让下一个人能独立跑一遍、并且在结果不一致时有资格说「不一致」。
