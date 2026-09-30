# Python 子项目 · 第 4 期 · 波 m6b：py-pandas、py-matplotlib 程序清单

> 状态：**草稿，待审**（Python编程 审完之前不派构建者）。
> 日期：2026-09-30
>
> 上游：主规格 `2026-09-16-python-subproject-design.md` §2.2（`py-pandas` — Series/DataFrame、读 CSV、筛选、分组聚合、缺失值、合并、排序；
> `py-matplotlib` — 折线/散点/柱/直方、子图、标注、样式、保存）、§5.4（scipy-stack 层，PR #191）；
> 第 4 期派发简报 `.superpowers/python-phase4/phase4-brief.md` §2 的裁决；格式照第 3 期 m5b 清单，另加 `requires` 列。
> 同期并行：m6a（`py-numpy-basics` ch24、`py-numpy-linalg` ch25、`py-statistics` ch28）。

---

## 0. 固定取值

| 页 | 章目录 | refs 文件 | 页名（title，提请审定） | 程序数 |
|---|---|---|---|---|
| `py-pandas` | `ch26-pandas` | `gates/refs/ch26_pandas.py` | 「pandas 数据表」/ "pandas DataFrames" | 9 |
| `py-matplotlib` | `ch27-matplotlib` | `gates/refs/ch27_matplotlib.py` | 「matplotlib 画图」/ "Plotting with matplotlib" | 9 |

`module` = 6，`accent` = `cyan`。合计 **18 个程序、3 个变体组、8 个带 P、0 个用递归**（见 §8）。

**命名**：单个程序 `problem` = 程序 id。变体组名（本波新起，已对全库 ch01–ch23 的 `problem` 名查过无重名）：
`filter-rows`、`group-average`、`line-plot`——请与 m6a 的组名交叉核。

**库版本**：本机 `python3` = 3.12.9，`numpy 2.3.1 pandas 2.3.0 matplotlib 3.10.3`（与 CI 钉的版本相同）；基线 `PYTHON_GATES_REQUIRE_SCIPY=1` 下 41 道门全绿、「0 段因缺库跳过」。

---

## 1. 查重（起草时核过的）

| 已有 | 在哪 | 本波怎么避开 |
|---|---|---|
| `read-csv-split` / `read-csv-module`（手工 split 与 `csv` 模块读 `scores.csv`） | ch05 | `read-csv-inspect` 讲 `pd.read_csv` 读进来之后能问什么（shape / dtypes / head / describe），讲解一句点出「与 csv 模块比，列有了类型」，不重讲 csv |
| `group-by-setdefault` / `group-by-defaultdict`（手工分组） | ch11 | pandas 的 `groupby` / `pivot_table` 讲「一行做完分组 + 聚合」；参照正好就是手工分组（机制不同） |
| `grade-boundaries-*`（`elif` 链 / 链式比较分等级） | ch06 | `grade-bands-cut` 讲 `pd.cut` 的**左闭右开**区间与标签；不重讲条件判断 |
| `sorted-min-max-with-key`、`sort-stability` | ch08、ch16 | `sort-two-keys` 讲 `sort_values` 的多列 + 各自升降序 + `kind="stable"`，讲解指回「排序」一页 |
| `inventory-csv-restock`（csv + 数据类） | ch23 | 不做「读 CSV 改库存」一类综合题 |
| m6a：均值 / 方差的向量化写法（numpy-basics）、中位数 / 标准差 / 相关 / 回归（statistics） | ch24、ch28 | pandas 页只做「按组求均值」这种**表格操作**，不讲统计量本身；matplotlib 的直方图只讲「分箱计数怎么画」，不讲分布 |

---

## 2. 程序清单

「组」空 = 单个程序（`problem` = id）。「P」= property 参照（空 = 只受 `program_run_check` 约束）。`requires` 按 import 顺序。
「🎲」= 用 `np.random.default_rng(<种子>)`。「📄」= 读 `_fixtures/`。

### 2.1 py-pandas · `ch26-pandas` · M6 · 9

**入口约定**：带 P 的程序，入口收**纯 Python** 实参（字典列表 / 元组列表 / 数字列表），在函数里建 DataFrame / Series，
返回**纯 Python** 值（`.tolist()`、`int()`、`float()`、`str()`）；参照写纯 Python（不 import pandas / numpy），`cases` 造的也是纯 Python 实参。

| id | 组 | 教什么 | requires | P |
|---|---|---|---|---|
| `series-and-dataframe` | | Series 带标签的索引（`s["b"]` / `.loc` / `.iloc` 之别、按标签对齐的加法缺一边得 NaN）；字典建 DataFrame、`shape` / `columns` / `dtypes`、`df["col"]` 是 Series 而 `df[["col"]]` 是 DataFrame、加一列派生列；`.mean()` 返回 numpy 标量，打印前 `float()` | pandas | |
| `read-csv-inspect` 📄 | | `pd.read_csv("_fixtures/pupils.csv")`、`head()` / `shape` / `dtypes` / `describe()`；讲解末段逐行抄出 fixture（`fixture_notes_check`） | pandas | |
| `filter-mask` | filter-rows | 布尔掩码 `df[df["score"] >= t]`、两个条件用 `&` 且各自加括号（`and` 会报错——讲解说原因） | pandas | 纯 Python 列表推导式 |
| `filter-query` | filter-rows | 同一筛选写成 `df.query("score >= @t")`：字符串里的列名、`@` 引用外部变量 | pandas | 同上 |
| `group-mean-groupby` | group-average | `df.groupby("form")["score"].mean()`、`.agg(["mean", "count"])`；结果的索引是组名 | pandas | 手工 `setdefault` 分组再平均，`round(…, 9)` |
| `group-mean-pivot-table` | group-average | 同一结果写成 `pivot_table(index=…, values=…, aggfunc="mean")`；与 groupby 的形状之别 | pandas | 同上 |
| `missing-fill-mean` | | `NaN`：`isna().sum()`、`dropna()` 与 `fillna(均值)`；`mean()` **跳过** NaN（与「当 0 算」的区别） | pandas | 纯 Python：先求在场值的均值再补，`round(…, 9)` |
| `merge-left-join` | | `merge(on="id", how="left")`：左表每行都留、右表没有的补 NaN；与 `how="inner"` 对照 | pandas | 纯 Python 字典查找 |
| `sort-two-keys` | | `sort_values(["form", "score"], ascending=[True, False], kind="stable")`、`nlargest` | pandas | `sorted(key=lambda r: (r["form"], -r["score"]))` |

（起草时原有 11 行：`series-index-basics` 与 `dataframe-from-dict` 已合并成 `series-and-dataframe`；`grade-bands-cut` 移到 §3 B4 交裁决，推荐不做。）

### 2.2 py-matplotlib · `ch27-matplotlib` · M6 · 9

**输出约定**（派发简报 §2.2）：建图 → `fig.savefig("<名>.png")`（落在门的临时 cwd）→ **打印可核对的事实**（线条数、轴标签、标题、柱高、
tick 标签、保存的文件名是否存在）→ `plt.close(fig)`。讲解按「页面不显示输出」写：图长什么样，用文字说清楚。

| id | 组 | 教什么 | requires | P |
|---|---|---|---|---|
| `line-plot-pyplot` | line-plot | pyplot 状态机写法：`plt.plot` / `plt.xlabel` / `plt.title` / `plt.legend`；「当前图」是隐含的 | matplotlib | |
| `line-plot-axes` | line-plot | 同一张图写成 `fig, ax = plt.subplots()` + `ax.plot` / `ax.set_xlabel`：对象写法，多图时不会画错地方 | matplotlib | |
| `scatter-sizes-colours` | | `ax.scatter` 的 `s=` / `c=`、颜色条；打印点数与坐标范围 | matplotlib | |
| `bar-chart-labels` | | `ax.bar(names, heights)`、`bar_label`、横向 `barh`；打印 `[p.get_height() for p in ax.patches]` 与 tick 标签 | matplotlib | |
| `histogram-bins` 🎲 | | `ax.hist(data, bins=…, range=…)` 返回计数与边界；**最后一格含右端点**，其余左闭右开 | numpy, matplotlib | 入口 `histogram_counts(values, bins, lo, hi)` 返回 `list[int]`：纯 Python 按宽度分箱、右端点并入末格 |
| `subplots-grid` | | `plt.subplots(2, 2, sharex=True)`、`axes[r][c]`、`fig.suptitle`、`tight_layout`；打印子图数与各自标题 | matplotlib | |
| `annotate-and-style` | | `ax.annotate` 带箭头标出最大值、`linestyle` / `marker` / `color`、`ax.grid`；打印注释文字与坐标 | matplotlib | |
| `savefig-size-dpi` | | `figsize` × `dpi` = 像素；`savefig` 的文件名与格式；打印算出的像素尺寸与 `os.path.exists`（**不打印字节数**——随版本变） | matplotlib | |
| `plot-from-dataframe` | | `df.plot(kind="bar", ax=ax)`：pandas 直接画到给定的 ax 上；讲解点出这里**用**的是「pandas 数据表」一页的 DataFrame | pandas, matplotlib | |

---

## 3. 边界（交裁决）

| # | 知识点 | 本清单的做法 | 需要裁决的 |
|---|---|---|---|
| B1 | 均值 / 分组聚合 | pandas 只做按组求均值这种**表格操作**，统计量的概念与向量化写法归 m6a | 确认 |
| B2 | 直方图 vs 分布 | `histogram-bins` 只讲分箱计数与边界规则，数据用 `default_rng(种子).normal` 生成但**不讲**正态分布 | 与 m6a `py-statistics` 的「分布抽样」确认不重 |
| B3 | CSV | `read-csv-inspect` 讲读进来后能问什么；csv 模块读法已在 ch05 | 确认 |
| B4 | 分等级 | 候选程序 `grade-bands-cut`（`pd.cut(bins=…, labels=…, right=False)` 左闭右开，参照 `bisect_right` 查表；原型见 §9）与 ch06 grade-boundaries 是同一个「分等级」问题的第三种写法——**推荐不做**，免得同一题几页各写一遍；若要做，替换 `merge-left-join` 之外的某一个以保持 9 个，讲解指回 ch06 | 做不做 |
| B5 | numpy 标量 repr | `series-and-dataframe` 里一句讲清 `.mean()` 返回 `np.float64`、放进列表打印会出 `np.float64(71.5)`；专讲它的程序留给 m6a（numpy-basics） | 确认由 m6a 讲 |
| B6 | pandas 绘图 | `plot-from-dataframe` 放 matplotlib 页（讲「画到给定 ax」），不在 pandas 页讲绘图 | 确认 |

## 4. 随机（交裁决）

只有 `histogram-bins` 用随机数：演示块 `rng = np.random.default_rng(<固定种子>)` 生成数据；**property 挂在纯核心上**（第 3 期 R2 同一做法）：
`histogram_counts` 收纯 Python 数字列表，`cases` 自己造（整数值，含恰好等于右端点的值——原型里错误实现「丢掉右端点」在 200 组中 154 组不同）。
其余程序全用写死的小数据。**不用** `np.random.seed` / 模块级 `np.random.*` / `RandomState`。

## 5. 浮点 / 打印格式（交裁决）

- 入口与参照都 `round(v, 9)`（`group-mean-*`、`missing-fill-mean`）；打印用 `f"{v:.1f}"` 之类固定位数，或直接打印 Series / DataFrame（版本钉死，格式稳定）。
- DataFrame 保持 ≤ 6 列、列名短；需要时 `to_string()`；不设 `pd.set_option`。
- 打印含 numpy 标量的列表 / 元组前一律 `.tolist()` / `float()` / `int()`（B5 那一句讲解除外）。
- matplotlib：只打印结构性事实（数量、标签、高度、文件是否存在），**不打印**文件字节数、颜色的 RGBA 浮点、字体度量。

## 6. 递归

两页都不用递归（逐个程序问过）。

## 7. 门的盲区（上报 Python编程，门逻辑不归本波）

**`algorithm_property_check` 只比顶层类型。** `library.py:379` 是 `got != want or type(got) is not type(want)`：
`[np.int64(3), np.int64(4)]` 与 `[3, 4]` 值相等、顶层都是 `list`，**门判相同**（实测）。这正是 M6 最常见的错：入口忘了 `.tolist()`，
列表里装着 numpy 标量——而页面上的讲解说「返回纯 Python 值」。建议门改成逐层比类型（原型里的 `same()`：list / tuple / dict 递归比，
叶子比 `type` 与值；负控制 `same([np.float64(1.5)], [1.5])` 为假）。门修好之前，构建者在报告里自己跑一遍逐层类型比对。

## 8. 合计

| 页 | 程序 | 变体组 | 带 P | 🎲 | 📄 | ⟳ |
|---|---|---|---|---|---|---|
| py-pandas | 9 | 2（filter-rows、group-average） | 7 | 0 | 1 | 0 |
| py-matplotlib | 9 | 1（line-plot） | 1 | 1 | 0 | 0 |
| **m6b** | **18** | **3** | **8** | **1** | **1** | **0** |

## 9. 起草时的原型（`.superpowers/python-waves/m6b/draft-proto.py`）

对拟带 P 的 8 个核心，外加候选 `grade-bands-cut`，各写了正确实现、纯 Python 参照、一个错误实现与 cases，种子 20260916、200 组、**逐层**比值与类型：

| 核心 | 正确 vs 参照 不同 | 错误实现 | 错误 vs 参照 不同 |
|---|---|---|---|
| filter-mask | 0 | `>` 代替 `>=` | 95 |
| filter-query | 0 | 同上 | 95 |
| group-groupby | 0 | 全列均值代替组均值 | 180 |
| group-pivot | 0 | 同上 | 180 |
| missing-fill-mean | 0 | 均值里把 NaN 当 0 | 136 |
| merge-left | 0 | `how="inner"` | 159 |
| sort-two-keys | 0 | 只按第一列排 | 112 |
| cut-bands | 0 | `right=True` | 160 |
| hist-counts | 0 | 丢掉右端点 | 154 |

`pandas` 的 FutureWarning 在原型里当错误处理，一条都没触发。库版本 2.3.1 / 2.3.0 / 3.10.3。
