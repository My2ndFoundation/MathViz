# Cryptography Subproject Architecture

## MathViz · Cryptography / 密码学子项目架构规范 v2.1

## 1. Architecture Decision

Cryptography 不属于 MathViz 根目录下现有数学工具集合。

它与 `chess/` 地位相同，是一个：

**Independent Subproject · 独立子项目**

因此禁止采用：

```text
MathViz/
├── outputs/
│   ├── ...
│   ├── crypto-caesar.html
│   ├── crypto-vigenere.html
│   └── crypto-rsa.html
│
├── app.html
└── tools.json
```

即：

> Cryptography tools 不进入根目录 `outputs/`，不进入根 `tools.json`，也不进入根 `app.html` 的数学 Sidebar。

正确架构：

```text
MathViz/
│
├── app.html
├── index.html
├── tools.json
├── outputs/
├── design-system/
│
├── chess/
│
└── cryptography/
```

其中：

```text
chess/
```

与：

```text
cryptography/
```

是两个并列的独立子项目。

---

# 2. Repository Structure

最终目录建议为：

```text
MathViz/
│
├── app.html
├── index.html
├── tools.json
├── outputs/
│
├── chess/
│   ├── app.html
│   ├── index.html
│   ├── chess-tools.json
│   ├── core/
│   ├── games/
│   ├── tools/
│   └── scripts/
│
├── cryptography/
│   │
│   ├── app.html
│   ├── index.html
│   ├── cryptography-tools.json
│   │
│   ├── core/
│   │   ├── viz-engine.js
│   │   ├── crypto-core.js
│   │   ├── interact.js
│   │   ├── animation.js
│   │   ├── cryptanalysis.js
│   │   ├── quantum-sim.js
│   │   │
│   │   └── algos/
│   │       ├── caesar.js
│   │       ├── substitution.js
│   │       ├── affine.js
│   │       ├── vigenere.js
│   │       ├── playfair.js
│   │       ├── hill.js
│   │       ├── enigma.js
│   │       ├── des.js
│   │       ├── aes.js
│   │       ├── rsa.js
│   │       ├── diffie-hellman.js
│   │       ├── md5.js
│   │       ├── sha1.js
│   │       └── sha256.js
│   │
│   ├── examples/
│   │   ├── examples-classical.js
│   │   ├── examples-analysis.js
│   │   ├── examples-modern.js
│   │   ├── examples-quantum.js
│   │   └── examples.js
│   │
│   ├── tools/
│   │   ├── _skeleton.html
│   │   ├── _viz-preview.html
│   │   │
│   │   ├── crypto-caesar.html
│   │   ├── crypto-substitution.html
│   │   ├── crypto-affine.html
│   │   ├── crypto-vigenere-family.html
│   │   ├── crypto-quagmire.html
│   │   ├── crypto-transposition.html
│   │   ├── crypto-polybius.html
│   │   ├── crypto-playfair-family.html
│   │   ├── crypto-fractionation.html
│   │   ├── crypto-hill.html
│   │   ├── crypto-stream-classical.html
│   │   ├── crypto-solitaire.html
│   │   ├── crypto-codes-morse.html
│   │   │
│   │   ├── crypto-cipher-machines.html
│   │   ├── crypto-enigma.html
│   │   │
│   │   ├── crypto-cryptanalysis.html
│   │   │
│   │   ├── crypto-one-time-pad.html
│   │   ├── crypto-des.html
│   │   ├── crypto-aes.html
│   │   ├── crypto-diffie-hellman.html
│   │   ├── crypto-rsa.html
│   │   ├── crypto-hash-functions.html
│   │   │
│   │   ├── crypto-quantum-foundations.html
│   │   ├── crypto-bb84.html
│   │   ├── crypto-e91.html
│   │   ├── crypto-quantum-attacks.html
│   │   └── crypto-post-quantum.html
│   │
│   └── scripts/
│       ├── inline_core.py
│       └── check.py
│
└── .claude/
    └── skills/
        ├── math-viz-tool/
        └── crypto-viz-tool/
            └── SKILL.md
```

---

# 3. Why this mirrors Chess

Chess 当前子项目使用：

```text
chess/
├── core/
├── games/
├── scripts/
├── tools/
├── app.html
├── chess-tools.json
└── index.html
```

Cryptography 使用完全相同的层次：

```text
cryptography/
├── core/
├── examples/
├── scripts/
├── tools/
├── app.html
├── cryptography-tools.json
└── index.html
```

其中两者的领域数据目录对应关系为：

```text
Chess
games/
    ↓
真实棋谱、教学棋局、预设数据


Cryptography
examples/
    ↓
教学明文、密文、keys、攻击案例、
统计数据和量子实验 presets
```

`examples/` 只保存 CryptoViz 自己的教学数据。

不要把 Cipher Challenge 网站的比赛文章或题目正文整体复制进项目；项目目标是覆盖相关 cipher / cryptanalysis 方法，而不是镜像它的内容库。

---

# 4. cryptography/app.html

`cryptography/app.html` 是 Cryptography 自己的 Application Shell。

它与：

```text
/chess/app.html
```

承担相同角色。

结构：

```text
cryptography/app.html
│
├── Sidebar
│
│   ├── Home
│   ├── Classical Cryptography
│   ├── Mechanical Cryptography
│   ├── Cryptanalysis
│   ├── Modern Cryptography
│   └── Quantum-Era Cryptography
│
├── Toolbar
│   ├── language
│   ├── collapse sidebar
│   ├── standalone
│   └── back to MathViz
│
└── iframe
    │
    ├── index.html
    └── tools/*.html
```

`app.html` 本身不是 Tool，因此：

```text
cryptography-tools.json
```

中不得注册 `app.html`。

---

# 5. Home Behaviour

当：

```text
tool == null
```

时：

```text
cryptography/app.html
        ↓
iframe
        ↓
cryptography/index.html
```

也就是说：

```text
cryptography/index.html
```

既是：

**Standalone Cryptography Gallery**

也是：

**Cryptography App Shell Home Page**

与 Chess 保持一致。

---

# 6. Subproject Navigation

URL 标准：

```text
cryptography/app.html
```

主页。

指定 Tool：

```text
cryptography/app.html?tool=crypto-caesar
```

指定语言：

```text
cryptography/app.html?tool=crypto-caesar&lang=zh
```

Tool iframe：

```text
tools/crypto-caesar.html?lang=zh
```

工具升级后推荐继续携带版本：

```text
tools/crypto-caesar.html?lang=zh&v=1.2.0
```

App Shell 必须拥有：

```text
Browser History
Deep Link
Back / Forward
Sidebar State
Tool Selection
Standalone Open
Language Synchronisation
```

Tool 不负责父窗口导航。

---

# 7. Root MathViz Integration

Cryptography 与 Chess 一样只通过：

```text
MathViz/index.html
```

中的：

```text
Subprojects · 子项目
```

区域进入。

根页面最终类似：

```text
Subprojects · 子项目

┌─────────────────────────┐
│ Chess                   │
│ 国际象棋教学工具         │
└─────────────────────────┘

┌─────────────────────────┐
│ Cryptography            │
│ 密码学可视化实验室       │
└─────────────────────────┘
```

Cryptography Card：

```text
Top-level MathViz index
        ↓
cryptography/app.html
```

但如果 `index.html` 本身已经运行于主 MathViz `app.html` 的 iframe 内：

```text
MathViz app.html
       ↓ iframe
   index.html
       ↓
Cryptography card
       ↓
cryptography/index.html
```

而不是：

```text
MathViz app.html
       ↓
Cryptography app.html
       ↓
another sidebar
       ↓
tool
```

必须继续遵守：

> No shell inside shell.

因此采用和 Chess 一样的判断：

```javascript
const href = IN_SHELL
  ? 'cryptography/index.html?lang=' + LANG
  : 'cryptography/app.html?lang=' + LANG;
```

---

# 8. Root Registry Isolation

这是硬性边界。

根：

```text
/tools.json
```

只管理：

```text
/outputs/*.html
```

数学可视化 Tool。

Chess：

```text
/chess/chess-tools.json
```

只管理：

```text
/chess/tools/*.html
```

Cryptography：

```text
/cryptography/cryptography-tools.json
```

只管理：

```text
/cryptography/tools/*.html
```

禁止：

```text
root tools.json
    ↓
cryptography/tools/*
```

也禁止：

```text
cryptography-tools.json
    ↓
../outputs/*
```

三个 registry 必须相互独立。

---

# 9. Cryptography Registry

文件：

```text
cryptography/cryptography-tools.json
```

结构参考 Chess，但将：

```text
phase
```

改成更符合密码学教学结构的：

```text
chapter
```

因为这里的分组不是“开发阶段”，而是真正的知识章节。

Example：

```json
{
  "schemaVersion": 1,
  "tools": [
    {
      "id": "crypto-caesar",
      "file": "tools/crypto-caesar.html",
      "accent": "cyan",
      "chapter": 1,

      "kicker": {
        "en": "Classical Cryptography",
        "zh": "古典密码"
      },

      "title": {
        "en": "Caesar Cipher",
        "zh": "凯撒密码"
      },

      "desc": {
        "en": "See a Caesar cipher turn into addition modulo 26.",
        "zh": "把凯撒密码直接看成模 26 加法。"
      },

      "tag": {
        "en": "alphabet wheel · modulo · brute force",
        "zh": "字母轮 · 模运算 · 穷举"
      },

      "version": "1.0.0",
      "engine": "crypto-1.0.0",

      "changelog": []
    }
  ]
}
```

---

# 10. Chapter Structure

固定：

```text
Chapter 1
Classical Cryptography
古典密码

Chapter 2
Mechanical Cryptography
机械密码

Chapter 3
Cryptanalysis
密码分析

Chapter 4
Modern Cryptography
现代密码学

Chapter 5
Quantum-Era Cryptography
量子时代密码学
```

`app.html` 与 `index.html` 各自拥有同源：

```javascript
CHAPTER_LABELS
```

Sidebar 根据：

```text
tool.chapter
```

自动分组。

Gallery 同样根据：

```text
tool.chapter
```

自动分组。

不要分别维护两个不同的 Tool 排序系统。

---

# 11. cryptography/index.html

`cryptography/index.html` 是独立 Gallery。

页面职责：

```text
Cryptography
密码学

Interactive visualisations
↓
Chapter 1
Classical Cryptography
[Caesar]
[Substitution]
[Affine]
[Vigenère]

Chapter 2
Mechanical Cryptography
[Cipher Machines]
[Enigma]

...

Chapter 5
Quantum-Era Cryptography
[Quantum Foundations]
[BB84]
[E91]
[Quantum Attacks]
[Post-Quantum]
```

Tool 卡片读取：

```text
cryptography-tools.json
```

字段：

```text
chapter
accent
title
kicker
desc
tag
version
```

并保持 `file://` 可用。

因此和 Chess 一样：

```text
runtime registry
        ↓ fetch succeeds
cryptography-tools.json

runtime registry
        ↓ fetch fails
embedded FALLBACK
```

---

# 12. i18n Isolation

Cryptography 不再使用：

```text
mathviz-lang
```

也不使用：

```text
chess-lang
```

而是使用自己的：

```javascript
LANG_KEY = 'cryptography-lang';
NAV_KEY  = 'cryptography-nav';
```

与 Chess 的独立 `chess-lang` / `chess-nav` 设计保持相同边界。

语言优先级：

```text
?lang=
   ↓
localStorage['cryptography-lang']
   ↓
default English
```

允许：

```text
en
zh
```

Shell、Gallery、Tool 三层共享：

```text
cryptography-lang
```

因此：

```text
app.html
      ↕
index.html
      ↕
tools/*.html
```

可以通过同源 `storage` event 同步语言。

---

# 13. core/ Architecture

与 Chess 一样：

> `core/*.js` 是可维护的唯一编辑源；
> `tools/*.html` 是最终可独立运行的产物。

不要在二十几个 HTML 中复制修改相同算法。

建议初始 Core：

```text
core/
├── viz-engine.js
├── crypto-core.js
├── interact.js
├── animation.js
├── cryptanalysis.js
├── quantum-sim.js
└── algos/
```

职责：

```text
viz-engine.js
```

负责：

```text
canvas
responsive layout
tabs
i18n
animation clock
play / pause
step
reset
shared UI primitives
```

---

```text
crypto-core.js
```

负责：

```text
alphabet mapping
text normalisation
mod arithmetic
GCD
modular inverse
bytes
bits
XOR
matrix utilities
encoding helpers
```

---

```text
interact.js
```

负责：

```text
pointer
drag
keyboard
slider interactions
selection
hover / inspection
```

---

```text
animation.js
```

负责统一：

```text
timeline
transition
state interpolation
step forward
step back
slow motion
auto-run
```

尤其服务：

```text
Enigma
DES
AES
Hash
BB84
Quantum simulations
```

---

```text
cryptanalysis.js
```

负责复用：

```text
letter frequency
n-gram frequency
chi-square
IoC
Kasiski
English fitness
crib matching
brute-force ranking
hill climbing
```

---

```text
quantum-sim.js
```

负责教育性模拟：

```text
qubit state
basis
measurement
probability
polarisation
Bloch sphere coordinates
BB84 photon state
Eve interception
QBER
entanglement correlation
```

它是教学 simulation engine，不是假装实现真实 quantum hardware。

---

# 14. core/algos

算法本身与 Visualization 分离。

例如：

```text
core/algos/caesar.js
```

只定义：

```text
encrypt()
decrypt()
bruteForce()
```

而：

```text
tools/crypto-caesar.html
```

决定：

```text
如何画 alphabet wheel
如何 animate
如何解释 mod 26
如何展示破解结果
```

同样：

```text
rsa.js
```

负责数学过程，

```text
crypto-rsa.html
```

负责把：

```text
prime
↓
n
↓
φ(n)
↓
e
↓
d
↓
encrypt
↓
decrypt
```

变成可见过程。

---

# 15. examples/

Chess 有独立的 `games/` 数据层。

Cryptography 对应建立：

```text
examples/
```

目的不是把 sample data 塞进每个 HTML。

建议：

```text
examples-classical.js
```

保存：

```text
sample plaintexts
sample keys
known cipher demonstrations
```

```text
examples-analysis.js
```

保存：

```text
frequency examples
Kasiski examples
crib demonstrations
attack fixtures
```

```text
examples-modern.js
```

保存：

```text
small educational RSA parameters
DES examples
AES examples
hash avalanche examples
```

```text
examples-quantum.js
```

保存：

```text
deterministic random seeds
BB84 demonstrations
Eve/no-Eve experiments
QBER presets
measurement examples
```

最后：

```text
examples.js
```

作为统一 aggregator。

---

# 16. tools/

所有最终用户 Tool：

```text
cryptography/tools/*.html
```

每个仍满足：

```text
single HTML
zero runtime build
standalone
file:// compatible
iframe compatible
offline capable
bilingual
```

例如直接双击：

```text
cryptography/tools/crypto-enigma.html
```

仍然必须运行。

不能要求：

```text
cryptography/app.html
```

存在才能工作。

App Shell 只是导航环境，不是运行依赖。

---

# 17. Generated Core Pattern

CryptoViz 直接继承 Chess 已经验证过的：

```text
Editable Core
      ↓
inline_core.py
      ↓
Standalone HTML
```

HTML 内使用：

```javascript
/* >>> GENERATED:VIZ-ENGINE */
/* <<< GENERATED:VIZ-ENGINE */

/* >>> GENERATED:CRYPTO-CORE */
/* <<< GENERATED:CRYPTO-CORE */

/* >>> GENERATED:CRYPTANALYSIS */
/* <<< GENERATED:CRYPTANALYSIS */
```

需要算法的 Tool：

```javascript
/* >>> GENERATED:ALGOS caesar.js */
/* <<< GENERATED:ALGOS */
```

需要多个：

```javascript
/* >>> GENERATED:ALGOS vigenere.js,beaufort.js,porta.js */
/* <<< GENERATED:ALGOS */
```

这样：

```text
core/
```

是 source of truth，

但最终：

```text
tools/*.html
```

依然完全自包含。

---

# 18. scripts/inline_core.py

文件：

```text
cryptography/scripts/inline_core.py
```

职责：

```text
core/*.js
examples/*.js
core/algos/*.js
        ↓
GENERATED blocks
        ↓
tools/*.html
```

必须支持：

```text
--check
--print-changed
```

正常运行：

```text
python3 cryptography/scripts/inline_core.py
```

检查漂移：

```text
python3 cryptography/scripts/inline_core.py --check
```

原则：

> Generated regions are never manually edited.

---

# 19. scripts/check.py

Cryptography 必须有自己的：

```text
cryptography/scripts/check.py
```

而不是把检查继续堆进根：

```text
scripts/
```

至少检查：

```text
core inline consistency

tool HTML script syntax

registry ↔ tool file consistency

app FALLBACK ↔ registry consistency

index FALLBACK ↔ registry consistency

duplicate tool ids

duplicate files

valid chapter

valid accent

version metadata

bilingual title / desc / tag

tool i18n compatibility

generated algorithm roundtrip
```

Quantum tools还应额外检查：

```text
probabilities ∈ [0,1]

state normalisation

deterministic seeded tests

BB84 expected statistical behaviour
```

---

# 20. Tool Skeleton

建立：

```text
cryptography/tools/_skeleton.html
```

以后所有新密码 Tool 必须从这里创建。

它应内置：

```text
CryptoViz visual tokens

i18n

canvas

tab system

animation clock

Play
Pause
Step
Back
Reset

responsive layout

standalone language toggle

generated core markers
```

避免 Claude Code 每次重新发明 tool shell。

---

# 21. Claude Skill

CryptoViz 的 Claude Code skill 仍放在 repository-level：

```text
.claude/
└── skills/
    ├── math-viz-tool/
    │   └── SKILL.md
    │
    └── crypto-viz-tool/
        └── SKILL.md
```

而不是：

```text
cryptography/.claude/
```

原因是它仍然属于整个 MathViz repository 的 authoring infrastructure。

但 `crypto-viz-tool/SKILL.md` 必须明确作用域：

```text
Target root:
cryptography/

Tool output:
cryptography/tools/

Registry:
cryptography/cryptography-tools.json

Core:
cryptography/core/

Examples:
cryptography/examples/

Validation:
cryptography/scripts/check.py
```

并明确：

> Never register a CryptoViz tool in `/tools.json`.

---

# 22. Subproject Boundary

最终边界：

```text
MathViz
│
├── Mathematics
│   ├── app.html
│   ├── tools.json
│   └── outputs/
│
├── Chess
│   └── chess/
│       ├── app.html
│       ├── chess-tools.json
│       ├── core/
│       └── tools/
│
└── Cryptography
    └── cryptography/
        ├── app.html
        ├── cryptography-tools.json
        ├── core/
        └── tools/
```

三套系统共享的是：

```text
MathViz identity
design philosophy
repository
GitHub Pages deployment
bilingual philosophy
single-file philosophy
```

但不共享：

```text
tool registry
tool namespace
app sidebar
domain core
navigation state
tool output directory
```

---

# 23. Navigation Hierarchy

用户视角最终是：

```text
MathViz
│
├── Mathematics
│   └── 数学可视化工具
│
├── Chess
│   └── Chess Teaching Tools
│
└── Cryptography
    └── Cryptography Lab
```

进入 Cryptography：

```text
MathViz
  ↓
Cryptography
  ↓
cryptography/app.html
  ↓
┌ Sidebar ──────────────────────┐
│                              │
│ All Tools                    │
│                              │
│ Classical Cryptography       │
│   Caesar                     │
│   Substitution               │
│   Affine                     │
│   Vigenère                   │
│   ...                        │
│                              │
│ Mechanical Cryptography      │
│   Cipher Machines            │
│   Enigma                     │
│                              │
│ Cryptanalysis                │
│   Cryptanalysis Workbench    │
│                              │
│ Modern Cryptography          │
│   OTP                        │
│   DES                        │
│   AES                        │
│   Diffie–Hellman             │
│   RSA                        │
│   Hash                       │
│                              │
│ Quantum-Era Cryptography     │
│   Quantum Foundations        │
│   BB84                       │
│   E91                        │
│   Quantum Attacks            │
│   Post-Quantum               │
│                              │
└──────────────────────────────┘
             │
             ▼
           iframe
             │
             ▼
       selected tool
```

这才是 Cryptography 子项目的正式信息架构。

---

# 24. Architectural Rule

整个 Cryptography 项目以后遵守一句硬规则：

> **MathViz owns the ecosystem; Cryptography owns itself.**

即：

```text
MathViz
```

负责提供子项目入口，

但是进入：

```text
cryptography/
```

以后：

```text
navigation
registry
core
examples
tools
validation
i18n state
```

全部由 Cryptography 子项目自己管理。

不要让根 Mathematics tool collection 逐渐变成一个装所有知识领域的巨大 registry。
