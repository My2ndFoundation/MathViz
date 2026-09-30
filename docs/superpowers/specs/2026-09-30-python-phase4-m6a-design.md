# Python 子项目 · 第 4 期 · 波 m6a（M6「科学计算与数理统计」上半）程序清单

> 状态：**已批准**（2026-09-30，Python编程 审，受用户委托；批准时的清单提交 4939cf9）。裁决见 §8。
> 日期：2026-09-30
>
> 上游：
> - 主规格 `docs/superpowers/specs/2026-09-16-python-subproject-design.md` §2.2（M6：`py-numpy-basics` ndarray、形状、索引切片、广播、向量化 vs 循环；
>   `py-numpy-linalg` 矩阵运算、点积、解线性方程组、特征值、随机数生成器；`py-statistics` 均值中位数方差、标准差、相关系数、线性回归、分布抽样、假设检验入门）、
>   **§5.4 scipy-stack 层**（PR #191）、§9
> - 第 4 期派发简报（主工作区 `.superpowers/python-phase4/phase4-brief.md`，Python编程 定）：钉版本 numpy 2.3.1 / pandas 2.3.0 / matplotlib 3.10.3；
>   **不用 scipy**；numpy 随机数只许 `np.random.default_rng(<种子>)`；property 入口返回内置类型、参照纯 Python；程序长度取向 40–60 行、不用 `chunks`
> - 作者须知 `.claude/skills/python-drill-tool/SKILL.md`；控制方作业 `.claude/skills/python-content-wave/SKILL.md`
> - 格式范本：第 3 期 `2026-09-30-python-phase3-m5a-design.md`
>
> 同期并行：波 m6b（`py-pandas` ch26、`py-matplotlib` ch27）由另一会话起草与构建。本文只管 ch24、ch25、ch28。

---

## 0. 本波做什么

| 页 | 页名（zh / en） | 章目录 | 模块 | accent | 程序 | 变体组 | 带 P |
|---|---|---|---|---|---|---|---|
| `py-numpy-basics` | 「NumPy 基础」/ NumPy Basics | `ch24-numpy-basics` | 6 | cyan | 9 | 1 | 6 |
| `py-numpy-linalg` | 「线性代数与随机数」/ Linear Algebra & Random Numbers | `ch25-numpy-linalg` | 6 | cyan | 9 | 1 | 8 |
| `py-statistics` | 「统计入门」/ Statistics | `ch28-statistics` | 6 | cyan | 10 | 2 | 8 |
| **合计** | | | | | **28** | **4** | **22** |

refs 文件：`python/scripts/gates/refs/ch24_numpy_basics.py`、`ch25_numpy_linalg.py`、`ch28_statistics.py`。
集成分支 `claude/python-wave-m6a`，构建者分支 `claude/python-wave-m6a-py-<页>`，一波一个 PR。

**起草期原型（简报 §3 的要求）**：22 个 P 程序每个都写了「正确实现 / 错误实现 / 纯 Python 参照 / cases」四件套，在钉版本的 numpy 2.3.1 上跑 200 组：
正确 == 参照（同值同类型）22/22 全部 200/200；错误实现 22/22 被抓到（最少的是 `above-threshold` 36/200、`median` 61/200）。
原型在集成 worktree 台账目录 `.superpowers/python-waves/m6a/draft-proto.py`——它只证明「这个 P 能写、这个参照机制不同、这类 cases 触得到错」，
**不是给构建者抄的实现**；构建者自写并各自做全分支变异。

---

## 1. 约定

1. **`problem` 命名。** 变体组 4 个：`mean-variance`（ch24）、`linear-system`（ch25）、`pearson-r`、`line-of-best-fit`（ch28）；已对全库 205 个 problem 名查过无重名
   （ch10 的 `matrix-multiply` 组**不**跨页并入，见 §3.3）。请 Python编程 与 m6b 的组名交叉核一遍。单个程序的 `problem` 一律等于 `id`。
2. **`requires`**：按 import 顺序写本程序用到的第三方库（本波只有 `numpy`）；只用标准库（`statistics`、`math`）的程序写 `[]`。**不用 `scipy`。**
3. **P 入口**：收 Python 内置值（列表、整数），内部转 `np.array`，返回**内置类型**（`.tolist()` / `int()` / `float()`）；不改实参。
   参照写**纯 Python**（不 import numpy），机制与被测不同。浮点结果**入口与参照两边都 `round(v, 9)`**（`normal-between`、`z-test` 用 6 位，因为参照是数值积分），
   舍入写法写进 refs 文件头。`cases` 优先用小整数（`np.sum` 成对求和与逐项相加的末位差异在整数上不出现）。
4. **程序长度**取向 40–60 行；超过 60 写进报告。仍**不用 `chunks`**。
5. **不讲已讲过的**：列表、推导式、函数、类、`sorted`、`statistics` 以外的一切标准库只是「用」，讲解点一句「这里用的是 X，见「页名」」。
6. **tags** 先 grep 全库已有写法再起新的（已有：`array`、`arrays`、`matrix`、`vector`、`random`、`float`；统一用单数 `array`）。
7. **boards** 缺省四家全写；拿不准的见 §7。

「组」空 = 单个程序；「P」写参照实现的**机制**（空 = 无 property）。「教什么」是这个程序存在的理由，构建者不得偏离；有更好的替换，**上报，不擅自换**。

---

## 2. 程序清单

### 2.1 py-numpy-basics · `ch24-numpy-basics` · M6 · 9

| id | 组 | 教什么 | requires | P |
|---|---|---|---|---|
| `ndarray-create` | | `np.array` 从列表建数组；`dtype` / `shape` / `ndim` / `size`；混入一个小数整组升成 float；`arange`（半开）、`linspace`（含终点）、`zeros` / `ones` | numpy | |
| `reshape-and-axes` | | `reshape`（含 `-1`）、`.T`；`axis=0` 是「沿行往下、每列一个结果」、`axis=1` 是「每行一个结果」——入口 `column_sums(rows)` | numpy | `zip(*rows)` 逐列 `sum` |
| `slice-is-a-view` | | 二维下标 `a[r, c]`、切行切列；**切片是视图**：改切片原数组跟着变，`.copy()` 才是新数组——与列表切片是拷贝（「列表」页）正相反 | numpy | |
| `boolean-mask-filter` | | 比较得布尔数组、`a[a > t]` 取子集、`np.count_nonzero`、`np.where(cond, x, y)`——入口 `above_threshold(xs, t)` | numpy | 列表推导式 |
| `broadcasting-table` | | 广播：标量与数组、`(n,1)` 与 `(1,n)` 拼出一张乘法表；形状不兼容时 `ValueError`（只打印 `type(e).__name__`）——入口 `times_table(n)` | numpy | 两重循环 |
| `mean-variance-loop` | mean-variance | 均值与总体方差的**循环写法**（两遍：先均值、再平方差和） | [] | `statistics.fmean` + `statistics.pvariance`（分数精确算法） |
| `mean-variance-vectorised` | mean-variance | 同一问题的**向量化写法**：`a.mean()`、`a.var()`（`ddof=0`）、`((a - m) ** 2).mean()`；为什么快（一次交给 C 循环，不讲复杂度推导） | numpy | 同上 |
| `numpy-scalar-repr` | | numpy 2 的坑：列表里的 `np.float64(1.5)` / `np.int64(3)` 打印出类型名；`.item()`、`float()`、`.tolist()` 转回内置类型；`dtype` 与 Python 类型的对照 | numpy | |
| `aggregate-by-axis` | | 成绩表（行 = 学生、列 = 科目）：每人平均、每科最高、`argmax` 找每科第一名（并列取第一个）——入口 `top_per_column(marks)` | numpy | 逐列 `max(range(n), key=…)`，并列按行号小者 |

- `boolean-mask-filter` 的 `cases`：阈值常与元素相等（原型里 `>` 写成 `>=` 只在 36/200 组露馅，构建者要把相等的概率调高）。
- `aggregate-by-axis` 的 `cases`：值域窄（0..3）让并列常见。
- `float` 比较（`0.1 + 0.2`、`np.isclose`）**不单列**：它在 `numpy-scalar-repr` 与 `slice-is-a-view` 之外没有独立的「教什么」，并入 `ndarray-create` 的 dtype 一段（构建者可在报告里提议单列）。

### 2.2 py-numpy-linalg · `ch25-numpy-linalg` · M6 · 9

| id | 组 | 教什么 | requires | P |
|---|---|---|---|---|
| `matrix-product-matmul` | | `@` 是矩阵乘、`*` 是逐元素乘；形状规则 (m,n)@(n,p)；向量 `@` 向量是点积——入口 `matmul(a, b)`；讲解点一句「循环写法见「列表」页」 | numpy | 三重下标循环 |
| `dot-product-angle` | | 点积、`np.linalg.norm`、余弦相似度与夹角（`np.degrees(np.arccos(…))`）；垂直即点积为 0——入口 `cosine(u, v)` | numpy | `sum(x*y)` / `math.hypot` |
| `linear-system-solve` | linear-system | 联立方程写成 `A x = b`，`np.linalg.solve`；`np.allclose(A @ x, b)` 回代检验；奇异矩阵抛 `LinAlgError`（只打印类名） | numpy | 克拉默法则（余子式展开求行列式） |
| `linear-system-inverse` | linear-system | 同一问题先求逆再乘：`np.linalg.inv(A) @ b`；为什么通常用 `solve`（多一步、误差更大——只点到，不做数值分析） | numpy | 同上 |
| `determinant-and-identity` | | `np.linalg.det` 给出浮点（整数矩阵也会出 `-2.0000000000000004`），`round` 回整数；`A @ inv(A)` 近似单位矩阵、`np.eye`；det 为 0 ⇔ 不可逆——入口 `det_int(m)` | numpy | 余子式递归展开（整数精确） |
| `transform-2d-points` | | 2×2 变换矩阵作用在一组点上：旋转 90°、放缩、关于 x 轴反射；点存成 (n,2) 数组、右乘转置 `pts @ R.T`——入口 `rotate90(points)` | numpy | `(x, y) → (-y, x)` 逐点 |
| `eigen-2x2` | | 对称 2×2 矩阵的特征值与特征向量：`np.linalg.eigh`；验证 `A v = λ v`；特征向量正负号不唯一（打印前统一符号）——入口 `eigenvalues(a, b, d)` 返回升序两值 | numpy | 迹与行列式代入二次方程求根 |
| `rng-generator-basics` | | `rng = np.random.default_rng(seed)`：`integers`（半开）、`random`、`normal`、`choice`、`permutation`；同种子同序列、两个生成器互不影响；为什么不用模块级 `np.random.seed` | numpy | |
| `markov-weather` | | 转移矩阵（晴 / 雨）：状态行向量 `@ P` 一步步走、`np.linalg.matrix_power` 一步到 n；长期趋于稳态——入口 `after_n_days(start, n)` | numpy | 纯 Python 逐步行向量乘 |

- `linear-system-*` 的 `cases`：2×2 与 3×3 整数矩阵，**先保证行列式非 0**（参照里的余子式展开判断）。
- `determinant-and-identity` 的 `cases`：1×1 到 4×4，含行列式为 0 的矩阵（原型里「列顺序反了」只在 97/200 组露馅——奇数次交换改符号，构建者可以再构造一些偶数阶的）。
- `markov-weather` 的 `cases`：`n = 0` 必须出现（返回起始向量本身）。

### 2.3 py-statistics · `ch28-statistics` · M6 · 10

| id | 组 | 教什么 | requires | P |
|---|---|---|---|---|
| `mean-median-mode` | | 三种「平均」：`statistics.mean` / `median` / `mode` / `multimode`；偶数个时中位数取中间两数的平均；手写中位数（排序取中）——入口 `median(xs)` 返回 float | [] | 不排序：对每个候选数数「比它小 / 不大于它」的个数找第 k 小 |
| `population-vs-sample-sd` | | 总体标准差 vs 样本标准差：`ddof=0` / `ddof=1`、`statistics.pstdev` / `stdev`；为什么除以 n−1（只讲直觉：样本均值离样本更近）；z 分数与绝对值大于 2 的离群值——入口 `sample_sd(xs)` | numpy | 纯 Python 两遍公式 |
| `pearson-by-formula` | pearson-r | 相关系数照定义算：离差、离差乘积和、除以两个平方和之积的平方根（numpy 向量写法）；r 的范围与含义 | numpy | 纯 Python 同一公式的逐项求和 |
| `pearson-corrcoef` | pearson-r | 同一问题 `np.corrcoef(x, y)[0, 1]`；返回的是 2×2 矩阵、为什么取 `[0, 1]`；相关不等于因果 | numpy | 同上 |
| `regression-by-formula` | line-of-best-fit | 最小二乘回归线：斜率 = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)²，截距 = ȳ − b x̄；用它预测 | numpy | 纯 Python 逐项求和 |
| `regression-polyfit` | line-of-best-fit | 同一问题 `np.polyfit(x, y, 1)`（返回 [斜率, 截距] 的顺序）；残差 | numpy | 同上 |
| `sampling-distribution-of-mean` | | `rng.normal` 抽很多组样本、每组求均值；样本量从 4 到 64，均值的散布按 1/√n 缩小（中心极限定理的直觉，不证明） | numpy | |
| `normal-probabilities` | | `statistics.NormalDist`：`cdf`、区间概率、`inv_cdf`；68–95–99.7；与 `rng.normal` 抽样的经验比例对照——入口 `prob_between(mu, sigma, a, b)`（6 位） | [] 或 numpy（经验对照部分用 numpy 时） | 概率密度的辛普森数值积分 |
| `z-test-one-sample` | | 假设检验入门：H0 / H1、检验统计量 z、双侧 p 值（`NormalDist().cdf`）、与 α = 0.05 比较后怎么措辞结论——入口 `z_test(sample, mu0, sigma)` 返回 `(z, p, reject)`（z、p 6 位） | [] | z 用纯 Python；p 用辛普森积分求尾部面积（**不用** `math.erfc`：`NormalDist.cdf` 内部就是 erfc，同源） |
| `t-statistic-by-hand` | | 总体方差未知时的一样本 t 统计量 `(x̄ − μ0) / (s / √n)`；与题目给出的临界值比较（不算 t 分布的 p 值——那要 scipy，本期不用） | numpy | |

- `mean-median-mode` 的 `cases`：长度奇偶各半、值域窄（重复多）；原型里「偶数个也取中间一个」只在 61/200 组露馅（偶数长且中间两数相等时两种写法同值），构建者调高「中间两数不等」的概率。
- `z-test-one-sample` 的 `cases`：样本均值偏移 0 / 小 / 大三档都要有，保证 `reject` 真、假两支都走到。
- `normal-probabilities` 的 `cases`：区间在均值两侧、一侧、宽度为 0 都要有。

---

## 3. 边界（待裁决）

- **3.1 统计概念 vs 向量化写法（简报 §2.3）。** 均值 / 方差的**向量化写法**放 `py-numpy-basics`（变体组 `mean-variance`：循环 vs 向量化，两者同在 ch24）；
  `py-statistics` 讲**概念**（中位数、标准差的 ddof、相关、回归、抽样、检验），均值方差本身不再写一遍。简报说「同一概念两页各写一个时要成变体组」——
  本清单**没有**跨页同概念的程序，所以没有跨页变体组。若你希望 statistics 页也有一个均值方差程序，它应并入 `mean-variance` 组（跨页组）——请裁决跨页组能否在页面上正确显示后再定。
- **3.2 随机数生成器只在 linalg 讲一次**（主规格 §2.2 把它放在 `py-numpy-linalg`）：`rng-generator-basics` 讲 `default_rng` 的用法；`py-statistics` 的抽样程序只「用」。
  m5b 的 `py-simulation` 讲过标准库 `random.Random`——`rng-generator-basics` 讲解里点一句对照，不重讲种子的概念。
- **3.3 矩阵乘法与 ch10。** ch10 有变体组 `matrix-multiply`（三重循环 / zip 列）。`matrix-product-matmul` **不**并入那个组（problem = id）：
  它讲的是 `@` 与 `*` 的区别和形状规则，不是「同一问题的另一种写法」；讲解点一句「循环写法见「列表」页」。拿不准——若你认为该并入（三种写法并排很有教学价值），改 problem 即可，但会成为全库第一个跨页变体组。
- **3.4 复杂度。** 「向量化为什么快」只说「一次交给 C 写的循环」，不写大 O、不计时（计时不确定，也属 M4 `py-complexity`）。
- **3.5 统计检验只到 z 检验与 t 统计量。** p 值只用标准库 `NormalDist`（z）；t 分布、卡方等要 scipy 的**不做**（简报 §2.1）。
- **3.6 与 m6b 的边界。** 本波不用 pandas / matplotlib；统计页不画图（图归 `py-matplotlib`），分布的形状用文字与数字描述。

## 4. 随机

用到随机的程序：`rng-generator-basics`、`sampling-distribution-of-mean`、`normal-probabilities`（经验对照部分）。
一律 `rng = np.random.default_rng(<固定种子>)`，或 `rng` 当实参传入；不用 `np.random.seed` / 模块级函数 / `RandomState`；标准库 `random` 若用，只许 `random.Random(<种子>)`。
钉版本（numpy 2.3.1）保证流不变。**带 P 的程序都不含随机**（P 的 cases 由门的种子生成，被测函数本身确定）。第 3 期的「两解释器比对」对本波不适用（3.9.6 没有 numpy）——报告里贴钉版本那一行代替。

## 5. 浮点 / 打印格式

- 打印数组直接 `print(a)`（numpy 自己的格式，版本已钉）；打印**含 numpy 标量的列表 / 元组**前先 `.tolist()` / `float()`，否则出 `np.float64(…)`——**除了** `numpy-scalar-repr`，它就是讲这个。
- 浮点打印一律 `round(…, k)` 或 f-string 格式说明符（`:.3f`），不让 `0.30000000000000004` 这类末位进 `run.expect`；需要展示它的（`ndarray-create` 的 dtype 一段、`determinant-and-identity`）明确说这是故意的。
- 不设 `np.set_printoptions`（全局显示项）；宽数组避免——每行 ≤ 8 个元素，免得换行宽度进 `run.expect`。
- property 入口两边 `round(v, 9)`（`normal-between`、`z-test` 6 位）；原型里 22 个 P 在 200 组上两边舍入后全部相等。仍有「舍入边界上两边差一位」的理论可能——构建者若在门的 200 组里撞上，改 cases（整数优先）而不是放宽位数，并写进报告。

## 6. 递归

被测程序预计**没有**用递归的（⟳ 无）。`determinant-and-identity` 与 `linear-system-*` 的**参照**用余子式递归展开——参照学生看不到，不算「讲递归」；构建者若在被测程序里写递归（例如手写行列式），照「用，不重讲」标 tags 并上报。

## 7. boards（拿不准的，构建者照缺省写全四个，报告里标出）

| 内容 | 程序 | 疑问 |
|---|---|---|
| NumPy 本身 | 全波 | 四家考纲都不点名第三方库；计算机科学考纲里的「数组」「矩阵」是概念，NumPy 是工具——按现行规则不去掉，但这是全库第一次整页依赖第三方库，值得一起裁决 |
| 线性代数（特征值、逆矩阵、变换矩阵） | `eigen-2x2`、`linear-system-*`、`determinant-and-identity`、`transform-2d-points` | 属 A-level Further Maths，不在 CS 考纲；OCR / AQA 的图形学或向量部分可能碰到变换 |
| 统计与假设检验 | `py-statistics` 全页 | 属 A-level Maths 统计，不在 CS 考纲 |
| 马尔可夫链 | `markov-weather` | 不在四家 CS 考纲 |

---

## 8. 裁决记录

| # | 问题 | 决定 |
|---|---|---|
| M6A-D1 | §3.1 统计概念 vs 向量化 | 同意：均值方差只在 ch24 成组（`mean-variance`），statistics 不再写。**本期不开跨页变体组**——全库还没有，页面只列本页程序，跨页组的显示没人验过，不在内容波里首用 |
| M6A-D2 | §3.2 / §3.4 / §3.5 / §3.6 | 同意 |
| M6A-D3 | §3.3 matrix-product-matmul | 单独成题（problem = id），讲解点一句「循环写法见「列表」页」 |
| M6A-D4 | §4 随机 | 同意。`normal-probabilities` 的 `requires` 按实际 import 写：经验对照用 `rng.normal` 就是 `["numpy"]`，property 入口本身保持纯标准库；构建者二选一写进报告 |
| M6A-D5 | §5 浮点 / 打印 | 同意，另加两条 cases 约束：(a) `pearson-*` / `regression-*` 的 cases 保证 x、y 都不是常数列（否则出 nan，`nan != nan` 门红得与程序无关）；`cosine` 的 cases 排除零向量——入口若要处理这些退化情形，行为写进清单、参照同样处理、cases 覆盖到。(b) 6 位舍入的 `normal-between`、`z-test`：辛普森积分步数取到误差远小于 1e-7，报告写出步数与在 200 组上的最大绝对误差；撞上舍入边界就改 cases，不放宽位数 |
| M6A-D6 | §6 递归 | 同意 |
| M6A-D7 | §7 boards | 照现行规则四家全写，拿不准的在报告里列出；boards 语义仍待用户裁决，本期不改规则；§7 的表原样进台账，收尾时并入第 4 期 deferred |
| M6A-D8 | tags | 新内容统一 `array` 单数；存量里的 `arrays` 不动（记账本） |
| M6A-D9 | 组名 | 与 m6b 的交叉核由 Python编程 做，m6b 清单到了再告知是否撞名 |
