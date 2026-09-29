# Python 子项目 · 第 2 期 · M3「数据结构」程序清单

> 状态：**草稿，待审**（清单、§3 边界、§4 递归三处需要裁决）。
> 日期：2026-09-30
>
> 上游：
> - 主规格 `docs/superpowers/specs/2026-09-16-python-subproject-design.md` §2.1、§2.2（M3 五页的覆盖面）、§9
> - 第 1 期设计 `docs/superpowers/specs/2026-09-16-python-phase1-design.md` §6（内容标准、§6.5 页面边界）、§7（清单格式）
> - 作者须知 `.claude/skills/python-drill-tool/SKILL.md`；控制方作业 `.claude/skills/python-content-wave/SKILL.md`
>
> 同期并行：M4「算法分析」（ch15–ch19）由另一会话起草与构建。本文只管 ch10–ch14。

---

## 0. 本波做什么

| 页 | 章目录 | 模块 | accent | 程序 | 变体组 | 带 P |
|---|---|---|---|---|---|---|
| `py-lists` | `ch10-lists` | 3 | emerald | 12 | 3 | 6 |
| `py-dicts-sets` | `ch11-dicts-sets` | 3 | emerald | 12 | 3 | 9 |
| `py-stack-queue` | `ch12-stack-queue` | 3 | emerald | 11 | 1 | 8 |
| `py-linked-list` | `ch13-linked-list` | 3 | emerald | 10 | 1 | 6 |
| `py-trees-heaps` | `ch14-trees-heaps` | 3 | emerald | 12 | 3 | 10 |
| **合计** | | | | **57** | **11** | **39** |

refs 文件：`python/scripts/gates/refs/ch10_lists.py` … `ch14_trees_heaps.py`。
集成分支 `claude/python-wave-m3`，构建者分支 `claude/python-wave-m3-py-<页>`，一波一个 PR。

---

## 1. 本清单的几条约定

1. **`problem` 命名。** 变体组用下表「组」列的名字；**单个程序的 `problem` 一律等于它的 `id`**。
   id 全库唯一有门守，所以与 M4 并行起草也不会静默撞成一个跨页变体组。组名已对全库现有 problem 查过重
   （ch01–ch09，无冲突）；M4 起草方请同样避开本文的 11 个组名。
2. **property 的入口必须是纯函数，且不许改动实参。** `algorithm_property_check` 先 `fn(*args)` 再
   `ref(*args)`，**两者拿到的是同一批对象**——被测函数若就地改了传进来的列表，参照看到的就是改过的列表，
   门比较的是两个错东西。本模块天然到处是「就地修改」，所以带 P 的程序一律：入口函数收简单值
   （整数、字符串、列表、操作序列），**内部**建自己的结构（栈、链表、树、堆），做完操作，
   **返回一个 Python 内置值**（list / tuple / bool / int / dict）。需要就地改的，先在入口里复制一份。
3. **操作序列式的参照。** 栈 / 队列 / 链表 / 堆这类结构的 P 程序，入口一般是 `run_ops(ops)`：
   `ops` 是 `[("push", 3), ("pop",), …]` 这样的元组列表，返回每次「有输出的」操作的结果列表。
   参照用 Python 内置 list / 朴素扫描实现同一套语义。`cases` 必须真的构造出**空结构上的 pop**、
   **满结构上的 push**（有容量时）、**绕回**（循环队列）等边界，并按作者须知「每个返回分支各变异一次」验证。
4. **不讲算法。** 本模块可以用 `sorted()`、`in`、`min()`，但不讲查找、排序算法本身（归 M4）。
   见 §3。
5. **boards 缺省四个全写。** 只有确知某考纲不含才去掉；§5 列出拿不准的，构建者照缺省写全、在报告里标出。

「组」= `problem` 变体组（空 = 单个程序，problem 就是 id）；「P」列写参照实现的**机制**（空 = 无 property，
只受 `program_run_check` 约束）。「教什么」是这个程序存在的理由，构建者不得偏离；觉得有更经典的替换，**上报，不擅自换**。

---

## 2. 程序清单

### 2.1 py-lists · `ch10-lists` · M3 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `list-crud-methods` | | `append` / `insert` / `extend`（与 `append` 一个列表之别）/ `pop()` 与 `pop(i)` 的返回值 / `remove(x)` 只删第一个 / `del` / `index` / `in`；越界 `pop` 抛 IndexError（打印 `type(e).__name__`） | |
| `slice-assignment` | | 切片赋值可以改变长度（`a[1:3] = [7, 8, 9]`）、`a[1:1] = …` 插入、`del a[::2]`；`a[:] = …` 就地替换 vs `a = …` 重新绑定（另一个名字看得出区别） | |
| `copy-alias` | list-copy | `b = a` 只多一个名字：`is` 为真、改 `b` 在 `a` 上看得见 | |
| `copy-shallow` | list-copy | `a[:]` / `list(a)` / `a.copy()` 造出新外层列表；但**嵌套的内层列表仍共享**，改 `b[0][0]` 波及 `a` | |
| `copy-deep` | list-copy | `copy.deepcopy`：内外层都是新的；与浅拷贝同一组操作，结果不同 | |
| `grid-rows-shared` | | `[[0] * 3] * 3` 三行是同一个列表对象（改一格三行都变）vs `[[0] * 3 for _ in range(3)]` | |
| `grid-row-col-totals` | | 二维表 `grid[r][c]`：两重下标循环求每行和、每列和，返回 `(row_totals, col_totals)` | `sum` 每行 + `zip(*grid)` 取列再 `sum` |
| `matrix-multiply-loops` | matrix-multiply | 三重下标循环，`result[i][j] += a[i][k] * b[k][j]`；形状 m×n · n×p | 取 `b` 的列（`zip(*b)`），逐对 `sum(x * y for …)` 点积 |
| `matrix-multiply-zip` | matrix-multiply | 同一问题：`zip(*b)` 取列 + 点积推导式 | refs 里另写的三重下标循环 |
| `rotate-list-slice` | rotate-list | 左旋 k 位：`items[k:] + items[:k]`，`k %= len(items)`，空列表守卫 | `collections.deque.rotate(-k)` |
| `rotate-list-pop-append` | rotate-list | 同一问题：先复制，再 k 次 `append(pop(0))`（就地改的是副本，不是实参——§1.2） | `collections.deque.rotate(-k)` |
| `remove-while-iterating` | | 边 `for` 边 `remove` 会跳过元素（演示块打印错误结果）；修法是遍历副本或建新列表；入口是修好的那个 | `list(filter(lambda x: x >= 0, xs))` |

`grid-row-col-totals` 的 `cases` 要有 1×1、1×n、n×1 的表（列和 / 行和写反在方阵上可能碰巧相等）。
`matrix-multiply-*` 的 `cases` 要生成**非方阵**（`i` / `j` / `k` 下标写混在方阵上可能不露馅）。

### 2.2 py-dicts-sets · `ch11-dicts-sets` · M3 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `dict-crud` | | 建、`d[k]` 与 KeyError、`get(k, 缺省)`、`in` 查的是键、赋值即新增或更新、`del` / `pop`、`keys` / `values` / `items` 遍历、插入顺序 | |
| `word-count-if-in` | word-count | `if w in counts: … else: …` 两支 | `dict(collections.Counter(words))` |
| `word-count-get` | word-count | `counts[w] = counts.get(w, 0) + 1` 一行 | `dict(collections.Counter(words))` |
| `word-count-counter` | word-count | `collections.Counter` 与 `most_common(n)`；入口返回 `dict(...)` 以便与另两个同型 | refs 里另写的 `if in` 循环 |
| `group-by-setdefault` | group-by-key | 按首字母分组：`groups.setdefault(k, []).append(w)` | `itertools.groupby` 作用于按首字母**稳定**排序后的序列，再 `dict` |
| `group-by-defaultdict` | group-by-key | 同一问题：`defaultdict(list)`；返回 `dict(groups)` 使类型与参照一致 | 同上 |
| `roman-to-int-lookup` | | 查找表 `{'I': 1, 'V': 5, …}` + 「比右边小就减」规则 | 先把 `IV` `IX` `XL` `XC` `CD` `CM` 用 `str.replace` 展开成加法串再逐字求和 |
| `set-operations` | | `\|` `&` `-` `^`、`<=` 子集、`add` / `discard` 与 `remove` 之别；两个社团名单的交并差 | |
| `dedupe-seen-set` | dedupe-keep-order | 保序去重：`seen` 集合 + 结果列表 | `list(dict.fromkeys(xs))` |
| `dedupe-dict-fromkeys` | dedupe-keep-order | 同一问题一行写完；讲解说明 `list(set(xs))` 为何不保序 | refs 里另写的 `seen` 循环 |
| `tuple-keys-sparse-grid` | | 可哈希才能当键：元组 `(r, c)` 作键存稀疏网格；列表作键抛 TypeError（打印 `type(e).__name__`）；集合里放元组 | |
| `anagram-check-counts` | | 两个词各数一遍字母，比较两个字典 | `sorted(a) == sorted(b)` |

`word-count-*` 与 `dedupe-*` 的 `cases` 要有空列表与大量重复（窄字母表的短词）。
`roman-to-int-lookup` 的 `cases` 由 refs 里的 `int → roman` 生成器造出 1..3999 的合法罗马数字（不喂非法串）。

### 2.3 py-stack-queue · `ch12-stack-queue` · M3 · 11

| id | 组 | 教什么 | P |
|---|---|---|---|
| `stack-list-methods` | | 列表当栈：`append` 压栈、`pop()` 出栈、`[-1]` 看栈顶、`not stack` 判空；空栈 `pop` 的 IndexError 用判空守住；LIFO | |
| `stack-array-top-pointer` | | 考卷风格：定长数组 + `top` 指针 + 容量，上溢 / 下溢各报一句自己的话（AQA / OCR / CIE 伪代码的直译） | |
| `bracket-matching` | | 遇开括号压栈、遇闭括号比对 `pairs` 字典；三种失败：不配对、栈空时来闭括号、结束时栈不空 | 反复 `str.replace` 删掉相邻的 `()` `[]` `{}` 直到不变，剩空串即平衡（`cases` 只产括号字符） |
| `rpn-evaluate` | | 逆波兰求值：数压栈、遇运算符弹两个（**先弹出的是右操作数**） | 从末尾往前递归下降：最后一个记号是根运算符，先解析右子式再解析左子式（`cases` 由随机表达式树的后序输出造，只用 `+ - *`） |
| `infix-to-rpn` | | 调度场算法：运算符栈、优先级表、左结合、括号 | refs 里的递归下降解析器建树再后序输出（`cases` 由随机表达式树的中序带括号输出造） |
| `hot-potato-list` | hot-potato | 列表当队列：`append` 入队、`pop(0)` 出队，每数 k 下淘汰一人，返回淘汰顺序；讲解点出 `pop(0)` 要挪动后面每一个元素 | 下标算术：`i = (i + k - 1) % len(people)`，`pop(i)` |
| `hot-potato-deque` | hot-potato | 同一问题：`collections.deque` 的 `popleft` / `append`（或 `rotate`） | 同上 |
| `circular-queue-array` | | 定长数组 + `front` / `rear` / `count`，取模绕回；满与空的判定；入口 `run_ops(capacity, ops)` | 朴素 Python 列表 + 长度判满 |
| `deque-both-ends` | | `deque` 两端进出：`appendleft` / `append` / `popleft` / `pop`；`deque(maxlen=3)` 只留最近三条（最近浏览记录） | |
| `undo-redo-two-stacks` | | 编辑器撤销 / 重做：两个栈，新操作清空 redo 栈；入口 `run_ops(ops)` 返回每步后的文本 | 一个历史列表 + 当前位置下标（新操作截断下标之后的历史） |
| `queue-from-two-stacks` | | 两个栈拼一个队列：入栈只压 `inbox`，出队时 `outbox` 空才整体倒过去；入口 `run_ops(ops)` | `collections.deque` |

`circular-queue-array` 的 `cases` 必须常出现「满后入队」「空时出队」和**绕回至少一圈**（容量取 1..4、操作序列长于容量数倍）。
`bracket-matching` 的 `cases` 要约一半是平衡串（纯随机括号串几乎全不平衡，「平衡」那条返回分支会没人测）。

### 2.4 py-linked-list · `ch13-linked-list` · M3 · 10

| id | 组 | 教什么 | P |
|---|---|---|---|
| `node-and-traverse` | | `Node` 类（`value` / `next`）；手工把三个节点连起来；`while current is not None` 走一遍、数长度 | |
| `insert-at-index` | | 在第 i 个位置插入：`i == 0` 改 `head` 的特例、走到前一个节点再改两根指针（**先接后面、再接前面**）；入口 `apply_inserts(ops)` 返回最后的值列表 | Python 列表的 `list.insert`（越界下标的约定与被测程序一致，由构建者写明） |
| `delete-by-value` | | 删第一个等于 x 的节点：头节点特例、`prev` 跟随指针、找不到时不动；入口返回值列表 | 在 Python 列表上 `if x in xs: xs.remove(x)` |
| `reverse-iterative` | reverse-linked-list | `prev` / `current` / `next` 三指针原地反转 | `values[::-1]` |
| `reverse-recursive` | reverse-linked-list | 递归反转（见 §4） | `values[::-1]` |
| `doubly-linked-list` | | `prev` / `next` 双向指针；中间插入与删除时**四根**指针的改法；正反各走一遍；入口 `run_ops(ops)` 返回 `(正向值, 反向值)` | Python 列表 + 反转 |
| `stack-as-linked-list` | | 用链表头当栈顶：`push` / `pop` 都是 O(1)；入口 `run_ops(ops)` | Python 列表 `append` / `pop` |
| `linked-list-in-arrays` | | 考卷风格：`data[]` / `next_ptr[]` 两个平行数组 + `start` 指针 + `free` 空闲链；插入从空闲链取格子（CIE 9618 / AQA 伪代码的直译） | |
| `linked-list-iter-len` | | 让链表像内置容器：`__iter__`（`yield` 逐个交出值）、`__len__`、`__repr__`；于是 `for` / `list()` / `len()` 都能用 | |
| `linked-list-vs-list` | | 与内置列表对比：按下标取第 i 个要从头走 i 步 vs 列表 O(1)；在头部插入链表 O(1) vs `list.insert(0, …)` 挪动全部元素；演示块数一数走了几步（见 §3.3） | |

`delete-by-value` 的 `cases` 要常出现「目标在头」「目标重复出现」「目标不在」三种。
`insert-at-index` 的 `cases` 要常出现 `i == 0`、`i == 长度`（尾插）与空表插入。

### 2.5 py-trees-heaps · `ch14-trees-heaps` · M3 · 12

| id | 组 | 教什么 | P |
|---|---|---|---|
| `binary-tree-nodes` | | `TreeNode`（`value` / `left` / `right`）；手工建一棵树；递归求节点数与高度（见 §4） | |
| `traversals-recursive` | tree-traversals | 前序 / 中序 / 后序三种递归遍历，差别只在「访问自己」那一行的位置；入口 `traversals(values)` 按插入序建 BST 后返回三个列表 | refs 里的显式栈迭代遍历 |
| `traversals-iterative` | tree-traversals | 同一问题：显式栈（前序直接写；中序「一路向左压栈」；后序用两个栈） | refs 里的递归遍历 |
| `bst-insert-recursive` | bst-insert | BST 插入的递归写法：`node.left = insert(node.left, v)`；重复值不插；入口返回前序列表（能看出**形状**） | 不建节点：首元素为根，把其余值按「比根小 / 比根大」保序分成两组，递归拼出前序 |
| `bst-insert-iterative` | bst-insert | 同一问题：`while` 往下走、记住父节点、挂在左或右 | 同上 |
| `bst-search` | | 在 BST 里查找：每一步丢掉一棵子树（**迭代**写，见 §3.1）；入口 `bst_contains(values, queries)` 返回布尔列表 | `set(values)` 成员判定 |
| `bst-delete` | | 删除的三种情形：叶子、单孩子、双孩子（用中序后继替换）；入口返回删除后的中序与前序 | 中序 = `sorted(set(values) - set(deletes))`；前序由构建者写出与被测**同一约定**（中序后继）的非节点实现，写不出就只比中序并上报 |
| `tree-in-arrays` | | 考卷风格：`value[]` / `left[]` / `right[]` 三个平行数组存 BST，`-1` 表示空指针；插入与中序打印 | |
| `heap-sift-up-down` | | 手写最小堆：列表下标 `2i+1` / `2i+2` / `(i-1)//2`，`push` 上浮、`pop` 下沉；入口 `run_ops(ops)` 返回每次 pop 的值 | 朴素 Python 列表：`min()` 取最小再 `remove`（**不用 `heapq`**——它与被测同为二叉堆上浮下沉，不算机制不同） |
| `priority-queue-heapq` | priority-queue | `heapq` 存 `(priority, seq, task)` 元组；`seq` 计数器让同优先级先来先服务、也让任务本身永远不被比较 | refs 里的「扫描取最小」朴素实现 |
| `priority-queue-scan-min` | priority-queue | 同一问题：普通列表，每次出队扫描一遍找优先级最小（且最早）的；与堆版本并排看出 O(n) vs O(log n) | refs 里的 `heapq` 实现 |
| `expression-tree` | | 由逆波兰记号用栈建表达式树；递归求值、中序加括号打印（见 §4） | refs 里的栈式逆波兰求值（机制：不建树） |

`bst-*` 的 `cases` 要有重复值、单调递增序列（退化成链表的树）、空列表。
`heap-sift-up-down` 与 `priority-queue-*` 的 `cases` 要有重复优先级、空堆上的 pop（约定由构建者写明）。

---

## 3. 边界（与 M4 的分界，**待裁决**）

原则照第 1 期设计 §6.5：一个知识点只在一页**讲**，别的页可以**用**，讲解与行注不展开。

### 3.1 BST 查找 vs 二分查找（py-searching）

- **草案**：`bst-search` 留在 py-trees-heaps。它讲的是「这个结构支持什么操作」；讲解里只说「每一步丢掉一棵子树」，
  **不提**二分查找、不写复杂度推导。二分查找的讲解与 O(log n) 的论证归 py-searching。
- 拿不准：如果 M4 希望在 py-searching 里拿 BST 作「二分思想」的第二个例子，本页的 `bst-search` 可以删掉，
  把「查找」并进 `bst-insert-*` 的演示块。

### 3.2 堆 vs 堆排序

- **草案**：本模块只讲堆这个结构（上浮 / 下沉、优先队列）。`heap-sift-up-down` 的入口是操作序列、**不是**
  「全压进去再全弹出来」（那就是堆排序）。主规格 §2.2 的 py-sorting 清单里没有堆排序；若 M4 要加，归它。

### 3.3 「与列表的对比」里的计步 vs py-complexity 的插桩计数

- 主规格 §2.2 的 py-linked-list 要求「与列表的对比」，py-complexity 要求「插桩计数版、大 O 实证」。
- **草案**：`linked-list-vs-list` 只数**这一次**走了几个节点（一个局部计数器、打印一个数），讲解说「链表按下标取值要从头走」，
  **不**画增长曲线、**不**比较多个 n、不写大 O 记号推导。插桩与实证归 py-complexity。
- 同理 `hot-potato-list` 与 `priority-queue-scan-min` 的讲解只**点出**「`pop(0)` 要挪动后面每个元素」「每次都扫一遍」，不展开复杂度。

### 3.4 字典当查找表 vs 哈希查找（py-searching「哈希查找」）

- **草案**：本页讲**怎么用** `dict` / `set`（`roman-to-int-lookup`、`in` 判成员）；哈希表**怎么实现**
  （哈希函数、冲突、开放寻址 / 链地址）归 py-searching。讲解里可以说一句「`in` 在字典上很快」，不解释为什么。

### 3.5 已经用过 `sorted()` 的地方

- `grid-row-col-totals`、`anagram-check-counts`（参照）、`group-by-*`（参照）用 `sorted` 只当工具；被测程序里不出现排序算法。
- 列表的 `.sort()` 与 `sorted()` 之别（就地 vs 新建、`.sort()` 返回 `None`）**本清单没有列**：ch03 `mutate-vs-return`
  讲过「就地改 vs 返回新列表」、ch08 `sorted-min-max-with-key` 讲过 `sorted`。若 M4 py-sorting 需要，归它。

---

## 4. 递归（**待裁决**）

第 1 期 §6.5 规定「递归只在 py-recursion **讲**」。下列程序**用**递归：

| 程序 | 递归用在哪 | 能否改成不用 |
|---|---|---|
| `reverse-recursive` | 反转链表 | 否——它就是「迭代 vs 递归」变体组的递归那一支 |
| `binary-tree-nodes` | 节点数、高度 | 能，但显式栈写法远比递归难读，树的高度几乎总是递归写 |
| `traversals-recursive` | 三种遍历 | 否——变体组的递归那一支 |
| `bst-insert-recursive` | 插入 | 否——变体组的递归那一支 |
| `bst-delete` | 删除 | 能写迭代，但双孩子情形的迭代版行数翻倍，超出 40 行取向 |
| `expression-tree` | 求值、打印 | 能用显式栈，但表达式树的意义就在于递归求值 |

（`bst-search` 有意写成迭代，见 §3.1。refs 里的参照用递归不算——学生看不到。）

**建议：用，不重讲递归本身。** 这些程序的讲解与行注只说**这个结构上**递归做了什么
（「左子树的节点数 + 右子树的节点数 + 1」），**不**讲基例 / 递归步 / 调用栈这些概念本身；
讲解第一段用一句话指向 py-recursion 页（写页名，不写「上一页」），例如「递归本身见 *递归* 一页」。
kind 取 `algorithm` 或 `pattern`，tags 里写 `recursion`，让选择器能筛。

---

## 5. boards：拿不准的（构建者照缺省写全四个，报告里标出）

草拟时凭记忆有疑问、**没有逐条核对考纲原文**的几处；在核对之前一律不去掉：

| 内容 | 程序 | 疑问 |
|---|---|---|
| 链表 | py-linked-list 全页 | AQA 7517 的数据结构清单是否点名链表 |
| 堆 / 二叉堆 | `heap-sift-up-down` | 四个考纲是否点名「堆」（优先队列多数点名，堆本身不确定） |
| 调度场算法（中缀转后缀） | `infix-to-rpn` | 各考纲要求的是手工转换还是算法；OCR / Edexcel 是否含逆波兰 |
| 双端队列、`deque(maxlen=)` | `deque-both-ends` | 四个考纲是否含双端队列 |
| BST 删除 | `bst-delete` | 各考纲是否要求删除（多数只要求插入、查找、遍历） |
| 矩阵乘法 | `matrix-multiply-*` | 这是数学内容，考纲的「二维数组」是否覆盖到乘法 |

---

## 6. 与已有页的查重

对全库 ch01–ch09 的程序 id、problem 名与已讲问题逐条查过：

- `copy-*` 不重复 ch03 `mutate-vs-return`：那一题讲**函数实参**传的是引用；这里讲**赋值与拷贝**。
- `grid-*` / `matrix-*` 不重复 ch08 `flatten-and-transpose`：那一题讲嵌套推导式展平与转置；这里不做转置，`zip(*b)` 只当取列的工具（`matrix-multiply-zip`）。
- `word-count-*`、`group-by-*` 不重复 ch08 `dict-and-set-comprehensions`（反转字典、词长表、集合推导去重）：这里是逐个累加 / 分组，不用推导式。
  `dedupe-*` 与那一题的「集合推导去重」相邻：那一题不保序，这里的问题恰恰是**保序**。
- `bracket-matching` 的参照、`flatten-nested`（ch09）的参照都用显式栈——参照学生看不到，不算重复。
- 回文（ch02 `palindrome-cleaned`）、配对和（ch07 `pair-sum-*`）没有再用作双端队列 / 字典的例题。
- M5 `py-text-data` 的「词频」将来要换一个角度（读文件、清洗），不重复 `word-count-*`；problem 名 `word-count` 已占用。
