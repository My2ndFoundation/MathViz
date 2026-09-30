# python/ · `boards` 考纲对照（2026-09-30）

**用户裁决（2026-09-30）**：程序的内容不在某个考试局的 A-level 计算机考纲里，就不写那个考试局——
学生按考纲过滤时看不到考纲外的程序；`boards: []` 合法。取代旧规则「拿不准就四家全写 / 确知不含才去掉」。

这份文件是这条裁决的依据：先逐家列出与本库相关的考纲条目（只认官方来源），再给出判定原则，
附录是全库 346 个程序逐条的判定表。改 `boards` 之前先查这里；新程序照「判定原则」写，依据写进构建报告。

## 来源（只认官方）

| 考试局 | 用的文件 | URL |
|---|---|---|
| AQA 7517 | A-level Computer Science 7517 规格的官方网页版（逐节 subject content 页面）；PDF 同版 | `https://www.aqa.org.uk/subjects/computer-science/a-level/computer-science-7517/specification/subject-content/<节名>`（节名见下）；PDF `https://filestore.aqa.org.uk/resources/computing/specifications/AQA-7516-7517-SP-2015.PDF` |
| OCR H446 | OCR 官方 *A Level Computer Science H446 Subject content clarification guide*（Version 2），逐条转录规格原文并加澄清；测试一条另用 AS 规格 H046（Version 2.0，2026-02） | `https://www.ocr.org.uk/Images/383613-subject-content-clarification-guide.pdf`；H046：`https://www.ocr.org.uk/Images/170845-specification-accredited-as-level-gce-computer-science-h046.pdf`；H446 规格本身 `https://www.ocr.org.uk/images/170844-specification-accredited-a-level-gce-computer-science-h446.pdf` |
| Edexcel / Pearson | Pearson Edexcel International Advanced Level in Computer Science（YCP01；IAS XCP01），Issue 1，2026-09 首教、2027-06 首考 | `https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/computer-science/2026/specification-and-sample-assessments/ial-computer-science-specification.pdf` |
| CIE 9618 | Cambridge International AS & A Level Computer Science 9618 syllabus，2027–2029 考试用，Version 2 | `https://www.cambridgeinternational.org/Images/721397-2027-2029-syllabus.pdf` |

AQA 的节名：`fundamentals-of-programming`、`fundamentals-of-data-structures`、`fundamentals-of-algorithms`、
`theory-of-computation`、`fundamentals-of-data-representation`、`fundamentals-of-computer-systems`、
`fundamentals-of-databases`、`big-data`、`fundamentals-of-functional-programming`、`systematic-approach-to-problem-solving`。

### 两处与简报不一致（上报项）

1. **Edexcel「9CP0」在 Pearson 官网上找不到。** Pearson 的 A level 学科页（`/en/subjects/ict.html`）今天没有英国本土 GCE A level
   Computer Science，只有 GCSE、BTEC、T Level；`/en/qualifications/edexcel-a-levels/computer-science-2015.html` 返回 404。
   Pearson 现行的 A-level 程度计算机资格是 **International A Level Computer Science（YCP01，2026 新规格，
   Unit 2 / Unit 4 用 Python 3 上机考）**——本表的「Edexcel」一律按它判。若用户说的是别的 Pearson 资格，Edexcel 一列要重判。
2. **OCR H446 的规格 PDF 超过抓取上限（10 MB），没能直接读原文。** 用的是 OCR 官方的 H446 *Subject content clarification guide*，
   它的「规格」一栏逐条转录 H446 的条目（1.1–2.3，编号与规格一致）。这份指南是 2020 年的 Version 2；
   H446 若在那之后改过条目，本表看不到。**软件测试（测试策略、测试数据）在指南的 H446 条目里没有**，
   只在 AS 规格 H046（Version 2.0，2026）2.2.2(d)(e) 里读到——见「拿不准」。

## 一、AQA 7517

| 主题 | 条目 | 原文短引 | 结论 |
|---|---|---|---|
| 数组 / 二维数组 / 矩阵 | 4.2.1.2 | "Use arrays (or equivalent) in the design of solutions to simple problems." 附注：二维数组可表示矩阵 | 点名（矩阵只作二维数组的解释，**矩阵乘法、变换矩阵未点名**） |
| 记录 / 文件 | 4.1.1.1、4.2.1.3 | "Be able to read/write from/to a text file." | 点名 |
| 队列、栈、图、树、哈希表、字典、向量 | 4.2.1.4 | "queue, stack, graph, tree, hash table, dictionary, vector" | 点名 |
| 线性 / 循环 / 优先队列 | 4.2.1.4、4.2.2.1 | "queues (linear, circular, priority)" | 点名 |
| 栈 | 4.2.3.1 | "push, pop, peek or top, test for empty stack" | 点名 |
| 静态与动态结构 | 4.2.1.4 | "distinguish between static and dynamic structures and compare their uses" | 点名 |
| 链表 | — | — | **未找到**（4.2 没有链表） |
| 双端队列 / 堆 | — | — | **未找到** |
| 图（邻接矩阵 / 邻接表） | 4.2.4.1 | "how an adjacency matrix and an adjacency list may be used" | 点名 |
| 树 / 二叉树 / BST | 4.2.5.1、4.3.4.3 | "a binary tree is a rooted tree"；附注举 BST | 点名（**BST 删除未点名**） |
| 哈希表与冲突 | 4.2.6.1 | "how collisions are handled using rehashing" | 点名 |
| 字典 | 4.2.7.1 | "experience of using a dictionary data structure" | 点名 |
| 向量、凸组合、点积 | 4.2.8.1 | 附注：convex combination、dot product、求两向量夹角 | 点名 |
| 集合与集合运算 | 4.4.2.2 | "Membership, Union, Intersection, Difference"（正则的数学基础一节） | 点名（作为集合运算） |
| 图遍历 BFS / DFS | 4.3.1.1 | "trace breadth-first and depth-first search algorithms" | 点名；附注：BFS 求无权图最短路 |
| 树遍历 | 4.3.2.1 | "pre-order, post-order, in-order"；附注：由表达式树得后缀式 | 点名 |
| 逆波兰 | 4.3.3.1 | "convert simple expressions in infix form to Reverse Polish notation" | 点名（中缀↔RPN） |
| 线性 / 二分 / 二叉树查找 | 4.3.4.1–4.3.4.3 | "the linear search algorithm"… | 点名 |
| 排序 | 4.3.5.1–4.3.5.2 | 只有 bubble sort、merge sort | 点名这两种；**选择 / 插入 / 快排 / 希尔 / 计数排序未点名** |
| Dijkstra | 4.3.6.1 | "Understand and be able to trace Dijkstra's shortest path algorithm." | 点名 |
| A* | — | — | **未找到** |
| 回溯 / 动态规划 / 贪心 | — | — | **未找到** |
| 递归 | 4.1.1.16 | "general and base cases" | 点名 |
| 复杂度 / 大 O | 4.4.4.1–4.4.4.3 | "Big-O notation"、常数 / 对数 / 线性 / 多项式 / 指数 | 点名 |
| 字符串处理 | 4.1.1.7 | "Length, Position, Substring, Concatenation" | 点名 |
| 随机数 | 4.1.1.8 | "familiar with, and be able to use, random number generation" | 点名 |
| 异常 | 4.1.1.9 | "know how to use exception handling" | 点名 |
| OOP | 4.1.2.3 | 附注 "abstract, virtual and static methods, inheritance, aggregation, polymorphism" | 点名（含**抽象、静态方法**） |
| 函数式：一等函数、map/filter/fold | 4.12.1.2、4.12.2.1 | "A function is a first-class object"；"map, filter, reduce or fold" | 点名 |
| 有限状态机 | 4.4.2.1 | "state transition diagrams and tables for FSMs" | 点名 |
| 正则表达式 | 4.4.2.3 | 元字符 `* + ? | ( )`，"a way of describing a set" | 点名 |
| 编译阶段 / 词法分析 | 4.6.3.1 | 只有 assembler、compiler、interpreter、bytecode | **未找到**词法分析 |
| 进制、浮点、舍入误差 | 4.5.2、4.5.4.5 | "why both fixed point and floating point … may be inaccurate" | 点名 |
| 凯撒 / Vernam | 4.5.6.10 | "Be familiar with Caesar cipher" | 点名 |
| 测试数据 | 4.13.1.4 | "normal (typical), boundary and erroneous data" | 点名 |
| JSON | — | — | **未找到** |
| 统计（均值、方差、回归、检验） | — | — | **未找到** |
| 数据可视化 | — | — | **未找到**（4.11 Big Data 不含画图） |
| 事件驱动 / 游戏循环 | — | — | **未找到** |
| 第三方库（NumPy / pandas / matplotlib / pygame） | — | — | **未找到** |

## 二、OCR H446（据官方 Subject content clarification guide）

| 主题 | 条目 | 原文短引 | 结论 |
|---|---|---|---|
| 数组、记录、列表、元组 | 1.4.2(a) | "Arrays (of up to 3 dimensions), records, lists, tuples." | 点名 |
| 链表、图、栈、队列、树、BST、哈希表 | 1.4.2(b) | "linked-list, graph (directed and undirected), stack, queue, tree, binary search tree, hash table" | 点名 |
| 建立 / 遍历 / 增删（可用数组或 OOP） | 1.4.2(c) | "create, traverse, add data to and remove data from" | 点名（**BST 删除、图遍历**由此覆盖） |
| 字典、集合、双端队列、优先队列、堆、向量 | — | — | **未找到**（字典按 Python 实现即哈希表，见判定原则 R2） |
| 数据结构上的算法 | 2.3.1(e) | "Stacks, queues, trees, linked lists, depth-first (post-order) and breadth-first traversal of trees" | 点名 |
| 标准算法 | 2.3.1(f) | "Bubble sort, insertion sort, merge sort, quick sort, Dijkstra's shortest path algorithm, A* algorithm"（另有 binary / linear search） | 点名；**选择 / 希尔 / 计数排序未点名** |
| 复杂度 | 2.3.1(c)(d) | "Big O notation. (Constant, linear, polynomial, exponential and logarithmic complexity)" | 点名 |
| 递归 | 2.2.1(b) | "Recursion, how it can be used and compares to an iterative approach." | 点名 |
| 回溯、启发式、分治 | 2.2.2(d)(f) | "backtracking … heuristics … visualisation to solve problems" | 点名（visualisation 指设计时的心智模型，**不是数据图表**） |
| 缓存 | 2.1.2(c) | "The nature, benefits and drawbacks of caching." | 点名（本表把记忆化算作缓存） |
| 程序设计技巧 | 1.2.4(b) 澄清、2.2.1 | "string handling, file handling, Boolean and arithmetic operators" | 点名 |
| OOP | 1.2.4(e)、2.2.1(f) | "classes, objects, methods, attributes, inheritance, encapsulation and polymorphism" | 点名（**抽象类、静态方法未点名**） |
| 编译阶段 / 词法分析 | 1.2.2(e) | "Stages of compilation (Lexical analysis, Syntax analysis…)" | 点名 |
| 交换数据（CSV / JSON） | 1.3.2(b) 澄清 | "exchanging data (with commons formats such as CSV and JSON)" | 点名 |
| 事务 / 原子性 | 1.3.2(f) | "Transaction processing, ACID" | 点名 |
| 压缩 | 1.3.1(b) | "Run length encoding and dictionary coding" | 点名（**Huffman 未点名**） |
| 有限状态机、正则、逆波兰 | — | — | **未找到** |
| 集合运算 | — | — | **未找到** |
| 异常处理 | — | — | **未找到**明文条目（1.2.4(b) 澄清只列字符串 / 文件处理等，没有 exception） |
| 测试数据 | H046 2.2.2(e)（AS） | "Test programs that solve problems using suitable test data" | H446 指南里**未找到**，AS 规格有——见「拿不准」 |
| 统计、矩阵运算、向量、数据可视化、事件驱动、第三方库 | — | — | **未找到**（1.2.2(f) 只泛称 "use of libraries"） |

## 三、Edexcel / Pearson — International A Level Computer Science（YCP01）

| 主题 | 条目 | 原文短引 | 结论 |
|---|---|---|---|
| 数组、列表、字典、记录、元组、集合 | 4.2.1、8.1.2 | "Array, List, Dictionary, Record, Tuple, Set" | 点名 |
| 集合运算 | 8.2.7 | "Membership, Union, Intersection, Difference" | 点名 |
| 定长列表实现的栈 / 队列 | 4.3、8.2.5–8.2.6 | "a stack implemented as a fixed-length list" | 点名 |
| 链表、哈希表（冲突、线性探测）、图、树 / BST、循环队列 | 14.1.1–14.1.5、18.2.1–18.2.8 | "Linked list"；"Linear probing"；"Traverse [breath, depth]"；"Binary search tree" | 点名（树的 Delete 在 14.1.4(c)） |
| 优先队列、堆、双端队列 | — | — | **未找到** |
| 线性 / 二分查找 | 5.2.1–5.2.2、10.3.1–10.3.2 | "Early exit when found on sorted list" | 点名 |
| 排序 | 5.2.3–5.2.4、10.3.3–10.3.4、15.2.1–15.2.2、21.1 | 冒泡、插入、归并、快排 | 点名；**选择 / 希尔 / 计数排序未点名** |
| 最短路 | 15.2.3、21.2.1 | "Dijkstra's algorithm"、"A* algorithm" | 点名 |
| 解题技巧 | 15.1.1 | "Brute force/exhaustive, Divide and conquer, Greedy algorithms, Heuristic, Backtracking, Recursion" | 点名（**动态规划未点名**） |
| 复杂度 | 15.3.1 | "Big O notation"：常数 / 对数 / 线性 / 线性对数 / 多项式 / 指数 | 点名 |
| 递归 | 5.1.3、10.4 | "Recursive algorithms" | 点名 |
| 控制结构、异常 | 7.1.1 | "Exception handling for built-in exceptions" | 点名 |
| 字符串、文本文件 | 8.2.2–8.2.3 | "Length, Indexing, Formatting, Examining, Manipulating" | 点名 |
| 随机 | 8.2.1(c) | "Randomisation" | 点名 |
| Decimal | 18.1.1 | "Decimal module"、"Decimal class" | 点名 |
| 正则（re） | 18.1.2 | "Methods to handle regular expressions (re): Finding, Validating" | 点名 |
| NumPy | 18.1.3 | "Methods to handle numerical arrays (NumPy): Array, Arithmetic, Rounding, Shape" | 点名（**solve / inv / det / eig 等线性代数未点名**） |
| pandas | 18.1.4 | "Methods to handle data analysis (Pandas): Load CSV, Measures of central tendency" | 点名 |
| 数据可视化 | 6.1.2(f) | "Tools and techniques of data science: … Visualisation" | 点名（理论卷；未点名 matplotlib） |
| OOP | 13.1.1、20.1.1 | "Classes, Attributes, Methods, … Inheritance, Polymorphism" | 点名（**抽象类、静态方法未明文点名**；13.1.1 的 "Abstraction" 拿不准） |
| 函数式 | 13.1.2、20.1.2 | "Lambda functions, Map, Filter, Reduce, List comprehension, Dictionary comprehension, Zip"（另有 first-class / higher-order functions） | 点名 |
| 测试 / 边界值 | 9.2.3(a)、9.3.1 | "Boundary value analysis"、"Testing and debugging" | 点名 |
| 单表代换 / Vernam | 3.2.3–3.2.4 | "Monoalphabetic substitution cipher" | 点名 |
| RLE | 21.2.2 | "Run-length encoding compression algorithm" | 点名 |
| SQLite | 8.3 | "Methods to retrieve data from an SQLite database" | 点名 |
| 有限状态机、逆波兰、词法分析、JSON、向量点积、统计（除集中趋势）、事件驱动、pygame | — | — | **未找到** |
| 规格没附的东西 | — | Unit 2 / 4 的 *Programming Language Subset (PLS)* 文档 | IAL 版 PLS **未找到**（只找到 GCSE 1CP2 的） |

## 四、CIE 9618（2027–2029）

| 主题 | 条目 | 原文短引 | 结论 |
|---|---|---|---|
| 一维 / 二维数组 | 10.2 | "Select a suitable data structure (1D or 2D array)" | 点名；附注 "Sort using a bubble sort"、"Search using a linear search" |
| 记录、文本文件 | 10.1、10.3 | "Write pseudocode to handle text files" | 点名 |
| 栈、队列、链表（含用数组实现） | 10.4 | "Describe how a queue, stack and linked list can be implemented using arrays" | 点名 |
| 查找 / 排序 | 19.1 | "linear and binary searching methods"；"insertion sort and bubble sort methods" | 点名这四个；**归并 / 快排 / 选择 / 希尔 / 计数排序未点名** |
| ADT 操作 | 19.1 | 查找：链表、二叉树；插入：栈、队列、链表、二叉树；删除：栈、队列、链表 | 点名（**二叉树删除、树遍历未点名**） |
| 由别的 ADT 实现 ADT | 19.1 | "stack, queue, linked list, dictionary, binary tree" | 点名（含**字典**） |
| 图 | 19.1、18.1 | "Candidates will not be required to write code for a graph structure"；"Use A* and Dijkstra's algorithms" | 图只要求描述；**Dijkstra、A* 点名**；**BFS / DFS、邻接表示未找到** |
| 复杂度 | 19.1 | "use of Big O notation to specify time and space complexity" | 点名 |
| 递归 | 19.2 | "Write and trace recursive algorithms" | 点名 |
| 集合 | 13.1 | "Define and use composite data types … set, record and class/object" | 点名（集合类型） |
| 哈希 | 13.2 | "Describe and use different hashing algorithms" | 点名 |
| 舍入误差 | 13.3 | "binary representations can give rise to rounding errors" | 点名 |
| 状态转移图 | 12.2 | "state-transition diagrams to document an algorithm" | 点名（算作有限状态机） |
| 测试数据 | 12.3 | "normal, abnormal and extreme/boundary" | 点名 |
| OOP | 20.1 | "objects, properties/attributes, methods, classes, inheritance, polymorphism, containment (aggregation), encapsulation, getters, setters" | 点名（**抽象类、静态方法未点名**） |
| 文件与异常 | 20.2 | "Write program code to use exception handling" | 点名 |
| 编译阶段 / 逆波兰 | 16.2 | "lexical analysis, syntax analysis"；"how Reverse Polish Notation (RPN) can be used to carry out the evaluation of expressions" | 点名（RPN **只点名求值**，中缀转换未点名） |
| 压缩 | 1.3 | "run-length encoding (RLE)" | 点名 |
| 优先队列、堆、双端队列、向量、矩阵运算、正则、JSON、统计、数据可视化、事件驱动、第三方库 | — | — | **未找到**（11.1 "library routines" 只是泛称） |

## 判定原则

- **R1 核心教学点**：一个考试局只在这个程序的**核心教学点**被它的考纲点名时才写。「用到」某个概念不算（Monte Carlo 程序用了循环，
  循环是四家都点名的，但它教的是模拟）。
- **R2 Python 写法实现的是点名概念**：程序教的是四家点名的概念的 Python 写法（f-string 之于格式化输出、`@dataclass` 之于记录、
  `for…else` 之于带提前退出的查找循环、`dict` 之于字典 / 哈希表），按概念判。**反过来**：写法本身就是课的内容、而它对应的概念
  不在某家考纲里（`*args` / `**kwargs`、lambda、`filter`、静态 / 抽象方法），按写法所属的概念判，那家就不写。
- **R3 库只是工具**：只是用了 NumPy / pandas / matplotlib / pygame 不算。考纲点名概念、程序用库实现它时按概念判
  （`dot-product-angle`：AQA 4.2.8.1 点名点积 → 写 AQA）。**库本身被点名时**（Edexcel 18.1.2 re、18.1.3 NumPy、18.1.4 pandas、
  18.1.1 Decimal），程序的核心是那个库在所点名用途上的用法就写那家；核心是数学（解线性方程组、特征值、马尔可夫链、统计检验）的，
  库被点名也不写。
- **R4 ADT 为主**：程序实现一个点名的 ADT（队列、栈、链表、二叉树）时，按 ADT 判，不因实现手法（两个栈拼队列、数组里放链表）
  另扣一家；但被点名的只是 ADT 的一部分操作时照操作判（CIE 不点名二叉树删除 / 遍历 → `bst-delete`、两个遍历不写 CIE）。
- **R5 拿不准不写**：条目找不到、或读不出它是否覆盖这个程序，就不写，并列进下面的「拿不准」。

## 拿不准 / 未找到（交用户看）

1. **Edexcel = IAL YCP01**（见上）。若用户指的是别的资格，Edexcel 一列整列要重判；按 IAL，M6 的 NumPy / pandas 程序大多保留 Edexcel。
2. **OCR 测试数据**：H446 指南里没有测试条目，AS 规格 H046 2.2.2(e) 有。`test-data-normal-boundary-erroneous` 仍写 OCR（AS 内容通常是
   A level 的子集），但 H446 原文没读到。
3. **Python `dict` 算不算 OCR 的「hash table」**：本表按 R2 算（ch11 的字典程序保留 OCR）。若认为字典是另一个概念，ch11 与
   ch20 部分程序要去掉 OCR。
4. **matplotlib 页写 Edexcel**：依据是 6.1.2(f) 数据科学的 Visualisation（Unit 1 理论卷，只要求知道），不是 matplotlib 被点名。
5. **pygame 页**：四家都不点名 pygame、游戏循环、事件驱动。只有核心是点名概念的几个程序留了考试局：`colour-lerp`（AQA 凸组合，
   但混合是 `Color.lerp` 代劳的）、`screen-states`（状态转移表：AQA FSM、CIE 状态转移图）、ch31 四个向量程序（AQA 向量）。
   `sprite-subclass-group` 用到了继承，但核心是 pygame 的 Sprite / Group 机制，判 `[]`。
6. **`grid-paths-memo` 写 OCR**：把记忆化算作 OCR 2.1.2(c) 的 caching；动态规划本身四家都不点名。
7. **`ttt-minimax` 写 Edexcel**：按 15.1.1(a) brute force / exhaustive；它没有「落子—撤销」，不算回溯。
8. **`abstract-base-class`**：Edexcel 13.1.1 的 "Abstraction" 是否指抽象类，读不出来，没写。
9. **`infix-to-rpn`**：CIE 16.2 只点名 RPN 求值，没写 CIE；CIE 的考卷实际是否考中缀转换，未核。
10. **OCR 没有异常处理条目**：指南全文检索不到 exception。ch05 五个以异常为核心的程序（`try-except-else-finally`、
    `multiple-except-clauses`、`raise-for-invalid-input`、`custom-exception-class`、`missing-file-eafp`）去掉了 OCR；
    异常只是顺带用到的程序（`input-validation-loop`、ch23 各程序）按核心概念保留。若 H446 现行版补了异常条目，这五个要加回。
11. **`money-decimal`**：AQA / CIE 点名的是「二进制浮点有舍入误差」，Decimal 是解决办法；按概念写了 AQA、CIE。
12. **ch01–ch11 抽查里、按 R2 保留四家但写法本身考纲外的**（没改，列出供复核）：`generator-sum-any-all`（生成器表达式；
    Edexcel 的 lazy evaluation 最接近）、`fibonacci-lru-cache`（装饰器）、`docstrings-and-type-hints`（Edexcel 9.2.2(b) 注释最接近）、
    `mutable-default-trap` / `mutable-default-none`（默认参数陷阱）、`match-case-commands`（CASE：CIE 11.2、OCR 澄清 select case）、
    `copy-deep`、`imports-and-main-guard`、`word-count-counter` / `group-by-defaultdict`（`collections`）、`pair-sum-two-pointers`（双指针）。

## 计数

| | AQA | OCR | Edexcel | CIE | `[]` |
|---|---|---|---|---|---|
| 改前（346 个程序） | 346 | 346 | 346 | 346 | 0 |
| 改后 | 233 | 211 | 266 | 207 | 62 |

162 个程序的 `boards` 变了，分布在 24 页（每页 patch 升版并写 changelog）。

## 附录 · 逐程序判定表

「**改**」标出与原值不同的行。依据一栏：四家都写的行给出四家的条目；少写的行说明哪家为什么不写。

| 章 | id | 原 boards | 新 boards | 依据（考纲条目编号） |
|---|---|---|---|---|
| ch01 | `hello-name` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.1–4.1.1.7 · OCR 1.2.4(b)、2.2.1(a) · Edexcel 7.1、8.1.1、8.2.1–8.2.2 · CIE 10.1、11.1–11.2 |
| ch01 | `celsius-to-fahrenheit` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.1–4.1.1.7 · OCR 1.2.4(b)、2.2.1(a) · Edexcel 7.1、8.1.1、8.2.1–8.2.2 · CIE 10.1、11.1–11.2 |
| ch01 | `max-of-three-if` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.1–4.1.1.7 · OCR 1.2.4(b)、2.2.1(a) · Edexcel 7.1、8.1.1、8.2.1–8.2.2 · CIE 10.1、11.1–11.2 |
| ch01 | `max-of-three-builtin` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.1–4.1.1.7 · OCR 1.2.4(b)、2.2.1(a) · Edexcel 7.1、8.1.1、8.2.1–8.2.2 · CIE 10.1、11.1–11.2 |
| ch01 | `swap-two-temp` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.1–4.1.1.7 · OCR 1.2.4(b)、2.2.1(a) · Edexcel 7.1、8.1.1、8.2.1–8.2.2 · CIE 10.1、11.1–11.2 |
| ch01 | `swap-two-tuple` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.1–4.1.1.7 · OCR 1.2.4(b)、2.2.1(a) · Edexcel 7.1、8.1.1、8.2.1–8.2.2 · CIE 10.1、11.1–11.2 |
| ch01 | `count-vowels-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.1–4.1.1.7 · OCR 1.2.4(b)、2.2.1(a) · Edexcel 7.1、8.1.1、8.2.1–8.2.2 · CIE 10.1、11.1–11.2 |
| ch01 | `int-float-str` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.1–4.1.1.7 · OCR 1.2.4(b)、2.2.1(a) · Edexcel 7.1、8.1.1、8.2.1–8.2.2 · CIE 10.1、11.1–11.2 |
| ch01 | `divmod-and-floor` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.1–4.1.1.7 · OCR 1.2.4(b)、2.2.1(a) · Edexcel 7.1、8.1.1、8.2.1–8.2.2 · CIE 10.1、11.1–11.2 |
| ch01 | `number-formatting` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.1–4.1.1.7 · OCR 1.2.4(b)、2.2.1(a) · Edexcel 7.1、8.1.1、8.2.1–8.2.2 · CIE 10.1、11.1–11.2 |
| ch02 | `index-and-slice` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `strings-are-immutable` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `string-method-tour` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `split-and-join` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `escapes-and-raw-strings` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `reverse-string-slice` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `reverse-string-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `palindrome-cleaned` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `caesar-shift` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `binary-to-denary-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `binary-to-denary-builtin` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch02 | `password-rules` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7（进制 4.5.2、凯撒 4.5.6.10）· OCR 1.2.4(b) 字符串处理、1.4.1 · Edexcel 8.2.2（进制 2.1、单表代换 3.2.3）· CIE 11.1、1.1 |
| ch03 | `define-call-return` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.10–4.1.1.14 · OCR 2.2.1(c)(d) · Edexcel 7.1.4、9.1.3 · CIE 11.3 |
| ch03 | `positional-keyword-default` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.10–4.1.1.14 · OCR 2.2.1(c)(d) · Edexcel 7.1.4、9.1.3 · CIE 11.3 |
| ch03 | `mutable-default-trap` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.10–4.1.1.14 · OCR 2.2.1(c)(d) · Edexcel 7.1.4、9.1.3 · CIE 11.3 |
| ch03 | `mutable-default-none` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.10–4.1.1.14 · OCR 2.2.1(c)(d) · Edexcel 7.1.4、9.1.3 · CIE 11.3 |
| ch03 | `args-and-kwargs` | AQA OCR Edexcel CIE | `[]` **改** | 可变个数参数 *args / **kwargs 四家都未点名；点名的只是参数 / 实参本身（AQA 4.1.1.11、OCR 2.2.1(d)、Edexcel 7.1.4、CIE 11.3） |
| ch03 | `return-several-values` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.10–4.1.1.14 · OCR 2.2.1(c)(d) · Edexcel 7.1.4、9.1.3 · CIE 11.3 |
| ch03 | `local-and-global-scope` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.10–4.1.1.14 · OCR 2.2.1(c)(d) · Edexcel 7.1.4、9.1.3 · CIE 11.3 |
| ch03 | `functions-as-values` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.12.1.2 first-class object · Edexcel 20.1.2(b)(g) first-class / lambda；OCR、CIE 未点名 |
| ch03 | `docstrings-and-type-hints` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.10–4.1.1.14 · OCR 2.2.1(c)(d) · Edexcel 7.1.4、9.1.3 · CIE 11.3 |
| ch03 | `is-prime-trial-division` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.10–4.1.1.14 · OCR 2.2.1(c)(d) · Edexcel 7.1.4、9.1.3 · CIE 11.3 |
| ch03 | `readings-report` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.10–4.1.1.14 · OCR 2.2.1(c)(d) · Edexcel 7.1.4、9.1.3 · CIE 11.3 |
| ch03 | `mutate-vs-return` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.10–4.1.1.14 · OCR 2.2.1(c)(d) · Edexcel 7.1.4、9.1.3 · CIE 11.3 |
| ch04 | `class-and-instance` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3 · OCR 1.2.4(e)、2.2.1(f) · Edexcel 13.1.1、20.1.1 · CIE 20.1 OOP |
| ch04 | `str-and-repr` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3 · OCR 1.2.4(e)、2.2.1(f) · Edexcel 13.1.1、20.1.1 · CIE 20.1 OOP |
| ch04 | `class-vs-instance-attributes` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3 · OCR 1.2.4(e)、2.2.1(f) · Edexcel 13.1.1、20.1.1 · CIE 20.1 OOP |
| ch04 | `bank-account-encapsulation` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3 · OCR 1.2.4(e)、2.2.1(f) · Edexcel 13.1.1、20.1.1 · CIE 20.1 OOP |
| ch04 | `inheritance-and-super` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3 · OCR 1.2.4(e)、2.2.1(f) · Edexcel 13.1.1、20.1.1 · CIE 20.1 OOP |
| ch04 | `polymorphism-and-duck-typing` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3 · OCR 1.2.4(e)、2.2.1(f) · Edexcel 13.1.1、20.1.1 · CIE 20.1 OOP |
| ch04 | `composition-has-a` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3 · OCR 1.2.4(e)、2.2.1(f) · Edexcel 13.1.1、20.1.1 · CIE 20.1 OOP |
| ch04 | `point-plain-class` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3 · OCR 1.2.4(e)、2.2.1(f) · Edexcel 13.1.1、20.1.1 · CIE 20.1 OOP |
| ch04 | `point-dataclass` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | 记录类型：AQA 4.1.1.1 Records · OCR 1.4.2(a) records · Edexcel 8.1.2(d) Record · CIE 10.1 record；@dataclass 是 Python 写记录的写法 |
| ch04 | `operator-overloading-vector` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3 · OCR 1.2.4(e)、2.2.1(f) · Edexcel 13.1.1、20.1.1 · CIE 20.1 OOP |
| ch04 | `staticmethod-classmethod` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.1.2.3 附注 abstract, virtual and static methods；其余三家未点名静态 / 类方法 |
| ch04 | `abstract-base-class` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.1.2.3 附注 abstract, virtual and static methods；其余三家未点名抽象类（Edexcel 13.1.1 的 Abstraction 未必指抽象类，拿不准不写） |
| ch05 | `write-and-read-text` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.3、4.1.1.9 · OCR 1.2.4(b) 文件处理 · Edexcel 8.2.3、7.1.1(e) · CIE 10.3、20.2 |
| ch05 | `read-csv-split` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.3、4.1.1.9 · OCR 1.2.4(b) 文件处理 · Edexcel 8.2.3、7.1.1(e) · CIE 10.3、20.2 |
| ch05 | `read-csv-module` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.3、4.1.1.9 · OCR 1.2.4(b) 文件处理 · Edexcel 8.2.3、7.1.1(e) · CIE 10.3、20.2 |
| ch05 | `write-csv-dictwriter` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.3、4.1.1.9 · OCR 1.2.4(b) 文件处理 · Edexcel 8.2.3、7.1.1(e) · CIE 10.3、20.2 |
| ch05 | `try-except-else-finally` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | AQA 4.1.1.9 · Edexcel 7.1.1(e) · CIE 20.2；OCR 未点名异常处理 |
| ch05 | `multiple-except-clauses` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | AQA 4.1.1.9 · Edexcel 7.1.1(e) · CIE 20.2；OCR 未点名异常处理 |
| ch05 | `raise-for-invalid-input` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | AQA 4.1.1.9 · Edexcel 7.1.1(e)、19.2.3(b) · CIE 20.2；OCR 未点名异常处理 |
| ch05 | `custom-exception-class` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | AQA 4.1.1.9 · Edexcel 7.1.1(e) · CIE 20.2；OCR 未点名异常处理 |
| ch05 | `missing-file-eafp` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | 用异常处理缺失文件：AQA 4.1.1.9 · Edexcel 7.1.1(e) · CIE 20.2；OCR 未点名异常处理 |
| ch05 | `missing-file-lbyl` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.3、4.1.1.9 · OCR 1.2.4(b) 文件处理 · Edexcel 8.2.3、7.1.1(e) · CIE 10.3、20.2 |
| ch05 | `input-validation-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.3、4.1.1.9 · OCR 1.2.4(b) 文件处理 · Edexcel 8.2.3、7.1.1(e) · CIE 10.3、20.2 |
| ch05 | `imports-and-main-guard` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.3、4.1.1.9 · OCR 1.2.4(b) 文件处理 · Edexcel 8.2.3、7.1.1(e) · CIE 10.3、20.2 |
| ch06 | `truthiness` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `short-circuit-and-ternary` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `grade-boundaries-descending` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `grade-boundaries-ranges` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `leap-year-nested` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `leap-year-one-expression` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `ticket-price-nested` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `ticket-price-guard-clauses` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `rps-winner` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `triangle-classifier` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `de-morgan-truth-table` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch06 | `match-case-commands` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.1.1.5 · OCR 2.2.1(a)、2.1.4 · Edexcel 7.1.1(b)、7.1.3、5.3 · CIE 11.2 |
| ch07 | `range-forms` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(c)(d) · CIE 11.2 |
| ch07 | `sentinel-running-total` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(c)(d) · CIE 11.2 |
| ch07 | `break-and-continue` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(c)(d) · CIE 11.2 |
| ch07 | `find-max-and-index` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(c)(d) · CIE 11.2 |
| ch07 | `has-negative-flag` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(c)(d) · CIE 11.2 |
| ch07 | `has-negative-for-else` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | 带提前退出的查找循环：AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1、10.3.1(b) · CIE 11.2；for…else 是 Python 写法 |
| ch07 | `digit-sum-modulo` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(c)(d) · CIE 11.2 |
| ch07 | `digit-sum-string` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(c)(d) · CIE 11.2 |
| ch07 | `pair-sum-nested-loops` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(c)(d) · CIE 11.2 |
| ch07 | `pair-sum-two-pointers` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(c)(d) · CIE 11.2 |
| ch07 | `guess-number-attempts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | 条件循环 + 输入：AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(d) · CIE 11.2 |
| ch07 | `fizzbuzz` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 7.1.1(c)(d) · CIE 11.2 |
| ch08 | `squares-append-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 20.1.2(l)(m)、7.1.1(c) · CIE 11.2 |
| ch08 | `squares-comprehension` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 20.1.2(l)(m)、7.1.1(c) · CIE 11.2 |
| ch08 | `evens-comprehension` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 20.1.2(l)(m)、7.1.1(c) · CIE 11.2 |
| ch08 | `evens-filter` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.12.2.1 filter · Edexcel 20.1.2(g)(j) lambda / filter；OCR、CIE 未点名 |
| ch08 | `enumerate-and-zip` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 20.1.2(l)(m)、7.1.1(c) · CIE 11.2 |
| ch08 | `dict-and-set-comprehensions` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 20.1.2(l)(m)、7.1.1(c) · CIE 11.2 |
| ch08 | `flatten-and-transpose` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 20.1.2(l)(m)、7.1.1(c) · CIE 11.2 |
| ch08 | `generator-sum-any-all` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 20.1.2(l)(m)、7.1.1(c) · CIE 11.2 |
| ch08 | `map-split-input` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 20.1.2(l)(m)、7.1.1(c) · CIE 11.2 |
| ch08 | `sorted-min-max-with-key` | AQA OCR Edexcel CIE | AQA Edexcel **改** | 以函数作实参（高阶函数）：AQA 4.12.1.2 · Edexcel 20.1.2(c)(g)；OCR、CIE 未点名 |
| ch08 | `if-placement-in-comprehension` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 20.1.2(l)(m)、7.1.1(c) · CIE 11.2 |
| ch08 | `comprehension-or-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2 · OCR 2.2.1(a) · Edexcel 20.1.2(l)(m)、7.1.1(c) · CIE 11.2 |
| ch09 | `factorial-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `factorial-iterative` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `fibonacci-naive` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `fibonacci-memo-dict` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `fibonacci-lru-cache` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `fibonacci-iterative` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `call-stack-unwinding` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `power-linear` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `power-by-squaring` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `towers-of-hanoi` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `permutations-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch09 | `flatten-nested` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.16 · OCR 2.2.1(b) · Edexcel 5.1.3、10.4 · CIE 19.2 |
| ch10 | `list-crud-methods` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `slice-assignment` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `copy-alias` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `copy-shallow` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `copy-deep` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `grid-rows-shared` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `grid-row-col-totals` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `matrix-multiply-loops` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `matrix-multiply-zip` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `rotate-list-slice` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `rotate-list-pop-append` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch10 | `remove-while-iterating` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 8.1.2(a)(b)、8.2.4、17.1.3 · CIE 10.2 |
| ch11 | `dict-crud` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.7 · OCR 1.4.2(b) 哈希表（dict 即哈希表）· Edexcel 8.1.2(c)、8.2.4 · CIE 19.1 dictionary |
| ch11 | `word-count-if-in` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.7 · OCR 1.4.2(b) 哈希表（dict 即哈希表）· Edexcel 8.1.2(c)、8.2.4 · CIE 19.1 dictionary |
| ch11 | `word-count-get` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.7 · OCR 1.4.2(b) 哈希表（dict 即哈希表）· Edexcel 8.1.2(c)、8.2.4 · CIE 19.1 dictionary |
| ch11 | `word-count-counter` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.7 · OCR 1.4.2(b) 哈希表（dict 即哈希表）· Edexcel 8.1.2(c)、8.2.4 · CIE 19.1 dictionary |
| ch11 | `group-by-setdefault` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.7 · OCR 1.4.2(b) 哈希表（dict 即哈希表）· Edexcel 8.1.2(c)、8.2.4 · CIE 19.1 dictionary |
| ch11 | `group-by-defaultdict` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.7 · OCR 1.4.2(b) 哈希表（dict 即哈希表）· Edexcel 8.1.2(c)、8.2.4 · CIE 19.1 dictionary |
| ch11 | `roman-to-int-lookup` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.7 · OCR 1.4.2(b) 哈希表（dict 即哈希表）· Edexcel 8.1.2(c)、8.2.4 · CIE 19.1 dictionary |
| ch11 | `set-operations` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | AQA 4.4.2.2 集合运算 · Edexcel 8.2.7 集合运算 · CIE 13.1 set 复合类型；OCR 未点名集合 |
| ch11 | `dedupe-seen-set` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | 集合成员判断：AQA 4.4.2.2 membership · Edexcel 8.2.7(a) · CIE 13.1 set；OCR 未点名集合 |
| ch11 | `dedupe-dict-fromkeys` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.7 · OCR 1.4.2(b) 哈希表（dict 即哈希表）· Edexcel 8.1.2(c)、8.2.4 · CIE 19.1 dictionary |
| ch11 | `tuple-keys-sparse-grid` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.7 · OCR 1.4.2(b) 哈希表（dict 即哈希表）· Edexcel 8.1.2(c)、8.2.4 · CIE 19.1 dictionary |
| ch11 | `anagram-check-counts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.7 · OCR 1.4.2(b) 哈希表（dict 即哈希表）· Edexcel 8.1.2(c)、8.2.4 · CIE 19.1 dictionary |
| ch12 | `stack-list-methods` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.2、4.2.3 · OCR 1.4.2(b)、2.3.1(e) · Edexcel 4.3、8.2.5–8.2.6 · CIE 10.4、19.1 |
| ch12 | `stack-array-top-pointer` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.2、4.2.3 · OCR 1.4.2(b)、2.3.1(e) · Edexcel 4.3、8.2.5–8.2.6 · CIE 10.4、19.1 |
| ch12 | `bracket-matching` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.2、4.2.3 · OCR 1.4.2(b)、2.3.1(e) · Edexcel 4.3、8.2.5–8.2.6 · CIE 10.4、19.1 |
| ch12 | `rpn-evaluate` | AQA OCR Edexcel CIE | AQA CIE **改** | AQA 4.3.3.1 RPN · CIE 16.2 RPN 求值；OCR、Edexcel 未点名 |
| ch12 | `infix-to-rpn` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.3.3.1 中缀↔RPN 转换；CIE 16.2 只点名 RPN 求值；OCR、Edexcel 未点名 |
| ch12 | `hot-potato-list` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.2、4.2.3 · OCR 1.4.2(b)、2.3.1(e) · Edexcel 4.3、8.2.5–8.2.6 · CIE 10.4、19.1 |
| ch12 | `hot-potato-deque` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.2、4.2.3 · OCR 1.4.2(b)、2.3.1(e) · Edexcel 4.3、8.2.5–8.2.6 · CIE 10.4、19.1 |
| ch12 | `circular-queue-array` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.2、4.2.3 · OCR 1.4.2(b)、2.3.1(e) · Edexcel 4.3、8.2.5–8.2.6 · CIE 10.4、19.1 |
| ch12 | `deque-both-ends` | AQA OCR Edexcel CIE | `[]` **改** | 双端队列四家都未点名（点名的是栈、线性 / 循环 / 优先队列） |
| ch12 | `undo-redo-two-stacks` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.2、4.2.3 · OCR 1.4.2(b)、2.3.1(e) · Edexcel 4.3、8.2.5–8.2.6 · CIE 10.4、19.1 |
| ch12 | `queue-from-two-stacks` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | 队列 / 栈 ADT：AQA 4.2.1.4 · OCR 1.4.2(b)（澄清：用别的结构实现队列）· Edexcel 4.3 · CIE 19.1 由别的 ADT 实现 ADT |
| ch13 | `node-and-traverse` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | OCR 1.4.2(b)、2.3.1(e) · Edexcel 14.1.1、18.2.2 · CIE 10.4、19.1；AQA 4.2 未点名链表 |
| ch13 | `insert-at-index` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | OCR 1.4.2(b)、2.3.1(e) · Edexcel 14.1.1、18.2.2 · CIE 10.4、19.1；AQA 4.2 未点名链表 |
| ch13 | `delete-by-value` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | OCR 1.4.2(b)、2.3.1(e) · Edexcel 14.1.1、18.2.2 · CIE 10.4、19.1；AQA 4.2 未点名链表 |
| ch13 | `reverse-iterative` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | OCR 1.4.2(b)、2.3.1(e) · Edexcel 14.1.1、18.2.2 · CIE 10.4、19.1；AQA 4.2 未点名链表 |
| ch13 | `reverse-recursive` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | OCR 1.4.2(b)、2.3.1(e) · Edexcel 14.1.1、18.2.2 · CIE 10.4、19.1；AQA 4.2 未点名链表 |
| ch13 | `doubly-linked-list` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | OCR 1.4.2(b)、2.3.1(e) · Edexcel 14.1.1、18.2.2 · CIE 10.4、19.1；AQA 4.2 未点名链表 |
| ch13 | `stack-as-linked-list` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | 栈 ADT：AQA 4.2.3 · OCR 1.4.2(b) · Edexcel 4.3.1 · CIE 19.1（链表实现栈） |
| ch13 | `linked-list-in-arrays` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | OCR 1.4.2(b)、2.3.1(e) · Edexcel 14.1.1、18.2.2 · CIE 10.4、19.1；AQA 4.2 未点名链表 |
| ch13 | `linked-list-iter-len` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | OCR 1.4.2(b)、2.3.1(e) · Edexcel 14.1.1、18.2.2 · CIE 10.4、19.1；AQA 4.2 未点名链表 |
| ch13 | `linked-list-vs-list` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.4 静态与动态结构比较 · OCR 1.4.2(b) · Edexcel 14.1.1 · CIE 10.4 |
| ch14 | `binary-tree-nodes` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.5.1 · OCR 1.4.2(b) · Edexcel 14.1.4 · CIE 19.1 binary tree |
| ch14 | `traversals-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | AQA 4.3.2.1 · OCR 2.3.1(e) · Edexcel 14.1.4(c)、18.2.8；CIE 19.1 只点名二叉树的查找 / 插入 |
| ch14 | `traversals-iterative` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | AQA 4.3.2.1 · OCR 2.3.1(e) · Edexcel 14.1.4(c)、18.2.8；CIE 19.1 只点名二叉树的查找 / 插入 |
| ch14 | `bst-insert-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.5、4.3.4.3 · OCR 1.4.2(b) · Edexcel 14.1.4、18.2.7 · CIE 19.1 binary tree |
| ch14 | `bst-insert-iterative` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.5、4.3.4.3 · OCR 1.4.2(b) · Edexcel 14.1.4、18.2.7 · CIE 19.1 binary tree |
| ch14 | `bst-search` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.5、4.3.4.3 · OCR 1.4.2(b) · Edexcel 14.1.4、18.2.7 · CIE 19.1 binary tree |
| ch14 | `bst-delete` | AQA OCR Edexcel CIE | OCR Edexcel **改** | OCR 1.4.2(c) 从 BST 删除 · Edexcel 14.1.4(c) Delete；CIE 19.1 删除只点名栈 / 队列 / 链表；AQA 未点名 |
| ch14 | `tree-in-arrays` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.5、4.3.4.3 · OCR 1.4.2(b) · Edexcel 14.1.4、18.2.7 · CIE 19.1 binary tree |
| ch14 | `heap-sift-up-down` | AQA OCR Edexcel CIE | `[]` **改** | 堆四家都未点名（AQA 点名的是优先队列这个 ADT，不是堆） |
| ch14 | `priority-queue-heapq` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.2.1.4、4.2.2.1 priority queue；其余三家未点名优先队列 |
| ch14 | `priority-queue-scan-min` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.2.1.4、4.2.2.1 priority queue；其余三家未点名优先队列 |
| ch14 | `expression-tree` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.3.2.1 附注 expression tree → postfix；其余三家未点名表达式树 |
| ch15 | `linear-search-for` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.4 · OCR 2.3.1(f) · Edexcel 5.2.1–5.2.2、10.3.1–10.3.2 · CIE 19.1（AS 10.2） |
| ch15 | `linear-search-sentinel` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.4 · OCR 2.3.1(f) · Edexcel 5.2.1–5.2.2、10.3.1–10.3.2 · CIE 19.1（AS 10.2） |
| ch15 | `linear-search-sorted-early-exit` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.4 · OCR 2.3.1(f) · Edexcel 5.2.1–5.2.2、10.3.1–10.3.2 · CIE 19.1（AS 10.2） |
| ch15 | `binary-search-iterative` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.4 · OCR 2.3.1(f) · Edexcel 5.2.1–5.2.2、10.3.1–10.3.2 · CIE 19.1（AS 10.2） |
| ch15 | `binary-search-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.4 · OCR 2.3.1(f) · Edexcel 5.2.1–5.2.2、10.3.1–10.3.2 · CIE 19.1（AS 10.2） |
| ch15 | `binary-search-bisect` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.4 · OCR 2.3.1(f) · Edexcel 5.2.1–5.2.2、10.3.1–10.3.2 · CIE 19.1（AS 10.2） |
| ch15 | `binary-search-leftmost` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.4 · OCR 2.3.1(f) · Edexcel 5.2.1–5.2.2、10.3.1–10.3.2 · CIE 19.1（AS 10.2） |
| ch15 | `count-occurrences-sorted` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.4 · OCR 2.3.1(f) · Edexcel 5.2.1–5.2.2、10.3.1–10.3.2 · CIE 19.1（AS 10.2） |
| ch15 | `binary-search-trace-table` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.4 · OCR 2.3.1(f) · Edexcel 5.2.1–5.2.2、10.3.1–10.3.2 · CIE 19.1（AS 10.2） |
| ch15 | `hash-search-linear-probing` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.4 · OCR 2.3.1(f) · Edexcel 5.2.1–5.2.2、10.3.1–10.3.2 · CIE 19.1（AS 10.2） |
| ch16 | `bubble-sort-basic` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.5.1 · OCR 2.3.1(f) · Edexcel 5.2.3、10.3.3 · CIE 10.2、19.1 |
| ch16 | `bubble-sort-early-exit` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.5.1 · OCR 2.3.1(f) · Edexcel 10.3.3(b) Exit with no swap · CIE 19.1 |
| ch16 | `selection-sort` | AQA OCR Edexcel CIE | `[]` **改** | 选择排序四家都未点名（AQA 冒泡 / 归并；OCR 冒泡 / 插入 / 归并 / 快排；Edexcel 冒泡 / 插入 / 归并 / 快排；CIE 冒泡 / 插入） |
| ch16 | `insertion-sort` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | OCR 2.3.1(f) · Edexcel 5.2.4、10.3.4 · CIE 19.1；AQA 4.3.5 只有冒泡与归并 |
| ch16 | `shell-sort` | AQA OCR Edexcel CIE | `[]` **改** | 希尔排序四家都未点名 |
| ch16 | `merge-sort-top-down` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | AQA 4.3.5.2 · OCR 2.3.1(f) · Edexcel 15.2.1、21.1.1；CIE 19.1 只有冒泡与插入 |
| ch16 | `merge-sort-bottom-up` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | AQA 4.3.5.2 · OCR 2.3.1(f) · Edexcel 15.2.1；CIE 19.1 只有冒泡与插入 |
| ch16 | `quicksort-lomuto` | AQA OCR Edexcel CIE | OCR Edexcel **改** | OCR 2.3.1(f) · Edexcel 15.2.2、21.1.2；AQA、CIE 未点名快排 |
| ch16 | `quicksort-comprehension` | AQA OCR Edexcel CIE | OCR Edexcel **改** | OCR 2.3.1(f) · Edexcel 15.2.2、21.1.2；AQA、CIE 未点名快排 |
| ch16 | `counting-sort` | AQA OCR Edexcel CIE | `[]` **改** | 计数排序四家都未点名 |
| ch16 | `sort-stability` | AQA OCR Edexcel CIE | `[]` **改** | 排序稳定性四家都未点名 |
| ch17 | `adjacency-list-and-matrix` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | AQA 4.2.4.1 · OCR 1.4.2(b)(c) · Edexcel 14.1.3(b)、18.2.6；CIE 19.1 不要求图的代码、未点名表示法 |
| ch17 | `bfs-order` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | AQA 4.3.1.1 · OCR 1.4.2(c) traverse · Edexcel 14.1.3(d)；CIE 19.1 不要求写图的搜索 |
| ch17 | `bfs-shortest-path` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | AQA 4.3.1.1 附注 BFS 求无权图最短路 · OCR 1.4.2(c) · Edexcel 14.1.3(d)；CIE 未点名 |
| ch17 | `dfs-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | AQA 4.3.1.1 · OCR 1.4.2(c) · Edexcel 14.1.3(d)；CIE 19.1 不要求写图的搜索 |
| ch17 | `dfs-iterative-stack` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | AQA 4.3.1.1 · OCR 1.4.2(c) · Edexcel 14.1.3(d)；CIE 19.1 不要求写图的搜索 |
| ch17 | `dijkstra-array-scan` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.6.1 · OCR 2.3.1(f) · Edexcel 15.2.3(a)、21.2.1 · CIE 18.1 |
| ch17 | `dijkstra-heapq` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.3.6.1 · OCR 2.3.1(f) · Edexcel 15.2.3(a)、21.2.1 · CIE 18.1 |
| ch17 | `topological-sort-kahn` | AQA OCR Edexcel CIE | `[]` **改** | 拓扑排序四家都未点名 |
| ch17 | `mst-prim` | AQA OCR Edexcel CIE | `[]` **改** | 最小生成树四家都未点名 |
| ch17 | `mst-kruskal` | AQA OCR Edexcel CIE | `[]` **改** | 最小生成树四家都未点名 |
| ch17 | `a-star-grid` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | OCR 2.3.1(f) A* · Edexcel 15.2.3(b) · CIE 18.1；AQA 未点名 A* |
| ch18 | `grid-paths-memo` | AQA OCR Edexcel CIE | OCR **改** | OCR 2.1.2(c) caching（记忆化即缓存）；动态规划四家都未点名 |
| ch18 | `grid-paths-table` | AQA OCR Edexcel CIE | `[]` **改** | 动态规划四家都未点名 |
| ch18 | `knapsack-01-table` | AQA OCR Edexcel CIE | `[]` **改** | 动态规划四家都未点名 |
| ch18 | `knapsack-01-1d` | AQA OCR Edexcel CIE | `[]` **改** | 动态规划四家都未点名 |
| ch18 | `lcs-length` | AQA OCR Edexcel CIE | `[]` **改** | 动态规划四家都未点名 |
| ch18 | `edit-distance` | AQA OCR Edexcel CIE | `[]` **改** | 动态规划四家都未点名 |
| ch18 | `coin-change-greedy` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 15.1.1(c) greedy algorithms；其余三家未点名贪心 |
| ch18 | `coin-change-dp` | AQA OCR Edexcel CIE | `[]` **改** | 动态规划四家都未点名 |
| ch18 | `activity-selection` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 15.1.1(c) greedy algorithms；其余三家未点名贪心 |
| ch18 | `huffman-code-lengths` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 15.1.1(c) greedy；Huffman 四家都未点名（压缩只点名 RLE / 字典编码） |
| ch19 | `loop-shape-counts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `growth-rate-table` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `search-comparison-counts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `insertion-shift-counts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `merge-vs-insertion-counts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `doubling-experiment` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `has-duplicates-nested` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `has-duplicates-sorted` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `has-duplicates-set` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `max-subarray-quadratic` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `max-subarray-divide-conquer` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch19 | `max-subarray-kadane` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.4 · OCR 2.3.1(b)(c)(d) · Edexcel 15.3.1、5.1.1 · CIE 19.1 Big O |
| ch20 | `clean-text-normalise` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7、4.2.1.3、4.2.7 · OCR 1.2.4(b) · Edexcel 8.2.2–8.2.3 · CIE 10.3、11.1 |
| ch20 | `word-frequency-file` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7、4.2.1.3、4.2.7 · OCR 1.2.4(b) · Edexcel 8.2.2–8.2.3 · CIE 10.3、11.1 |
| ch20 | `regex-find-numbers` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.4.2.3 正则 · Edexcel 18.1.2(a) re finding；OCR、CIE 未点名正则 |
| ch20 | `date-format-regex` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.4.2.3 · Edexcel 18.1.2(b) re validating；OCR、CIE 未点名正则 |
| ch20 | `date-format-manual` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7、4.2.1.3、4.2.7 · OCR 1.2.4(b) · Edexcel 8.2.2–8.2.3 · CIE 10.3、11.1 |
| ch20 | `name-swap-regex-sub` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.4.2.3 · Edexcel 18.1.2；OCR、CIE 未点名正则 |
| ch20 | `json-round-trip` | AQA OCR Edexcel CIE | OCR **改** | OCR 1.3.2(b) 交换数据（澄清：CSV、JSON 等常见格式）；其余三家未点名 JSON |
| ch20 | `json-load-fixture` | AQA OCR Edexcel CIE | OCR **改** | OCR 1.3.2(b) 交换数据（澄清：CSV、JSON）；其余三家未点名 JSON |
| ch20 | `config-parser` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.7、4.2.1.3、4.2.7 · OCR 1.2.4(b) · Edexcel 8.2.2–8.2.3 · CIE 10.3、11.1 |
| ch20 | `tokenise-loop` | AQA OCR Edexcel CIE | OCR CIE **改** | OCR 1.2.2(e) 词法分析 · CIE 16.2 词法分析；AQA 4.6.3、Edexcel 13.1 未点名编译阶段 |
| ch20 | `tokenise-regex` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.4.2.3 正则 · OCR 1.2.2(e) 词法分析 · Edexcel 18.1.2 re · CIE 16.2 词法分析 |
| ch20 | `log-line-parser` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.4.2.3 · Edexcel 18.1.2(a)；OCR、CIE 未点名正则 |
| ch21 | `monte-carlo-pi-random` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.1.1.8 随机数生成 · Edexcel 8.2.1(c) Randomisation；模拟 / 蒙特卡洛本身四家都未点名 |
| ch21 | `monte-carlo-pi-grid` | AQA OCR Edexcel CIE | `[]` **改** | 网格数点估 π：数值近似四家都未点名，也不用随机 |
| ch21 | `dice-sum-frequencies` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.1.1.8 随机数生成 · Edexcel 8.2.1(c) Randomisation；模拟 / 蒙特卡洛本身四家都未点名 |
| ch21 | `random-walk-1d` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.1.1.8 随机数生成 · Edexcel 8.2.1(c) Randomisation；模拟 / 蒙特卡洛本身四家都未点名 |
| ch21 | `gamblers-ruin` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.1.1.8 随机数生成 · Edexcel 8.2.1(c) Randomisation；模拟 / 蒙特卡洛本身四家都未点名 |
| ch21 | `queue-single-server` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | 队列的应用：AQA 4.2.2 · OCR 1.4.2(b) · Edexcel 4.3.2 · CIE 10.4 |
| ch21 | `game-of-life-grid` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.2.1.2 · OCR 1.4.2(a) · Edexcel 17.1.3 · CIE 10.2 |
| ch21 | `game-of-life-set` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | 集合表示：AQA 4.4.2.2 · Edexcel 8.1.2(f)、8.2.7 · CIE 13.1 set；OCR 未点名集合 |
| ch21 | `sir-epidemic-steps` | AQA OCR Edexcel CIE | `[]` **改** | 传染病模型四家都未点名 |
| ch21 | `traffic-light-fsm` | AQA OCR Edexcel CIE | AQA CIE **改** | AQA 4.4.2.1 FSM · CIE 12.2 state-transition diagrams；OCR、Edexcel 未点名 |
| ch21 | `shuffle-fisher-yates` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.1.1.8 随机数生成 · Edexcel 8.2.1(c) Randomisation；模拟 / 蒙特卡洛本身四家都未点名 |
| ch21 | `shuffle-naive-biased` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.1.1.8 随机数生成 · Edexcel 8.2.1(c) Randomisation；模拟 / 蒙特卡洛本身四家都未点名 |
| ch22 | `ttt-winner-lines` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.2.1.2 · OCR 2.2.1(a)、1.4.2(a) · Edexcel 7.1.1、17.1.3 · CIE 10.2、11.2 |
| ch22 | `ttt-winner-loops` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.2.1.2 · OCR 2.2.1(a)、1.4.2(a) · Edexcel 7.1.1、17.1.3 · CIE 10.2、11.2 |
| ch22 | `ttt-game-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.2.1.2 · OCR 2.2.1(a)、1.4.2(a) · Edexcel 7.1.1、17.1.3 · CIE 10.2、11.2 |
| ch22 | `ttt-minimax` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 15.1.1(a) brute force / exhaustive；minimax / 博弈树四家都未点名 |
| ch22 | `guess-computer-halving` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | 二分查找：AQA 4.3.4.2 · OCR 2.3.1(f) · Edexcel 5.2.2 · CIE 19.1 |
| ch22 | `hangman-state` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | 字符串处理与选择：AQA 4.1.1.7 · OCR 1.2.4(b) · Edexcel 8.2.2 · CIE 11.1 |
| ch22 | `merge-row-2048-compress` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.2.1.2 · OCR 2.2.1(a)、1.4.2(a) · Edexcel 7.1.1、17.1.3 · CIE 10.2、11.2 |
| ch22 | `merge-row-2048-stack` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | 栈的应用：AQA 4.2.3 · OCR 1.4.2(b) · Edexcel 4.3.1 · CIE 10.4 |
| ch22 | `board-move-2048` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.2.1.2 · OCR 2.2.1(a)、1.4.2(a) · Edexcel 7.1.1、17.1.3 · CIE 10.2、11.2 |
| ch22 | `minesweeper-place-count` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.1.2、4.2.1.2 · OCR 2.2.1(a)、1.4.2(a) · Edexcel 7.1.1、17.1.3 · CIE 10.2、11.2 |
| ch22 | `minesweeper-flood-reveal` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | BFS：AQA 4.3.1.1 · OCR 1.4.2(c) · Edexcel 14.1.3(d)；CIE 未点名 |
| ch22 | `pig-dice-two-players` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.1.1.8 随机数、4.12.1.2 函数作值 · Edexcel 8.2.1(c)、20.1.2(b)；OCR、CIE 未点名 |
| ch23 | `gradebook-classes` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3、4.1.1.9 · OCR 2.2.1(f)、1.2.4(b) · Edexcel 20.1.1、7.1.1(e) · CIE 20.1、20.2 |
| ch23 | `gradebook-json-persist` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3、4.1.1.9 · OCR 2.2.1(f)、1.2.4(b) · Edexcel 20.1.1、7.1.1(e) · CIE 20.1、20.2 |
| ch23 | `competition-ranking` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3、4.1.1.9 · OCR 2.2.1(f)、1.2.4(b) · Edexcel 20.1.1、7.1.1(e) · CIE 20.1、20.2 |
| ch23 | `inventory-stock` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | 记录 / 类：AQA 4.1.1.1、4.1.2.3 · OCR 1.4.2(a)、2.2.1(f) · Edexcel 8.1.2(d)、20.1.1 · CIE 10.1、20.1 |
| ch23 | `inventory-csv-restock` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3、4.1.1.9 · OCR 2.2.1(f)、1.2.4(b) · Edexcel 20.1.1、7.1.1(e) · CIE 20.1、20.2 |
| ch23 | `bank-transfer-atomic` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3、4.1.1.9 · OCR 2.2.1(f)、1.2.4(b) · Edexcel 20.1.1、7.1.1(e) · CIE 20.1、20.2 |
| ch23 | `money-in-pence` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3、4.1.1.9 · OCR 2.2.1(f)、1.2.4(b) · Edexcel 20.1.1、7.1.1(e) · CIE 20.1、20.2 |
| ch23 | `money-decimal` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | AQA 4.5.4.5 rounding errors · Edexcel 18.1.1(a)(c) Decimal module / class · CIE 13.3 rounding errors；OCR 1.4.1 未点名舍入误差 |
| ch23 | `library-loans` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3、4.1.1.9 · OCR 2.2.1(f)、1.2.4(b) · Edexcel 20.1.1、7.1.1(e) · CIE 20.1、20.2 |
| ch23 | `menu-driven-cli` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.1.2.3、4.1.1.9 · OCR 2.2.1(f)、1.2.4(b) · Edexcel 20.1.1、7.1.1(e) · CIE 20.1、20.2 |
| ch23 | `test-data-normal-boundary-erroneous` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | AQA 4.13.1.4 · Edexcel 9.2.3(a)、9.3.1 · CIE 12.3 · OCR H046 2.2.2(e)（A-level H446 原文未能直接读到，见正文） |
| ch24 | `ndarray-create` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.3 NumPy（Array / Arithmetic / Shape）；AQA/OCR/CIE 未点名 NumPy，数组概念在各家，但本程序教的是 NumPy 的机制 |
| ch24 | `reshape-and-axes` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.3 NumPy（Array / Arithmetic / Shape）；AQA/OCR/CIE 未点名 NumPy，数组概念在各家，但本程序教的是 NumPy 的机制 |
| ch24 | `slice-is-a-view` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.3 NumPy（Array / Arithmetic / Shape）；AQA/OCR/CIE 未点名 NumPy，数组概念在各家，但本程序教的是 NumPy 的机制 |
| ch24 | `boolean-mask-filter` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.3 NumPy（Array / Arithmetic / Shape）；AQA/OCR/CIE 未点名 NumPy，数组概念在各家，但本程序教的是 NumPy 的机制 |
| ch24 | `broadcasting-table` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.3 NumPy（Array / Arithmetic / Shape）；AQA/OCR/CIE 未点名 NumPy，数组概念在各家，但本程序教的是 NumPy 的机制 |
| ch24 | `mean-variance-loop` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4(b) measures of central tendency（均值）；方差四家都未点名 |
| ch24 | `mean-variance-vectorised` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.3 NumPy（Array / Arithmetic / Shape）；AQA/OCR/CIE 未点名 NumPy，数组概念在各家，但本程序教的是 NumPy 的机制 |
| ch24 | `numpy-scalar-repr` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.3 NumPy（Array / Arithmetic / Shape）；AQA/OCR/CIE 未点名 NumPy，数组概念在各家，但本程序教的是 NumPy 的机制 |
| ch24 | `aggregate-by-axis` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.3 NumPy（Array / Arithmetic / Shape）；AQA/OCR/CIE 未点名 NumPy，数组概念在各家，但本程序教的是 NumPy 的机制 |
| ch25 | `matrix-product-matmul` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.3 NumPy（Array / Arithmetic / Shape）；AQA/OCR/CIE 未点名 NumPy，数组概念在各家，但本程序教的是 NumPy 的机制；矩阵乘法 AQA 4.2.1.2 只说二维数组可表示矩阵 |
| ch25 | `dot-product-angle` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.2.8.1 附注 dot product、求夹角 · Edexcel 18.1.3(b) NumPy arithmetic |
| ch25 | `linear-system-solve` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch25 | `linear-system-inverse` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch25 | `determinant-and-identity` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch25 | `transform-2d-points` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.3 NumPy（Array / Arithmetic / Shape）；AQA/OCR/CIE 未点名 NumPy，数组概念在各家，但本程序教的是 NumPy 的机制；变换矩阵 AQA 4.2.8.1 只点名向量加法（平移）与数乘（缩放） |
| ch25 | `eigen-2x2` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch25 | `rng-generator-basics` | AQA OCR Edexcel CIE | AQA Edexcel **改** | AQA 4.1.1.8 随机数生成 · Edexcel 8.2.1(c)、18.1.3 |
| ch25 | `markov-weather` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch26 | `series-and-dataframe` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4 Pandas 数据分析；其余三家未点名 Pandas |
| ch26 | `read-csv-inspect` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4 Pandas 数据分析；其余三家未点名 Pandas |
| ch26 | `filter-mask` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4 Pandas 数据分析；其余三家未点名 Pandas |
| ch26 | `filter-query` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4 Pandas 数据分析；其余三家未点名 Pandas |
| ch26 | `group-mean-groupby` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4 Pandas 数据分析；其余三家未点名 Pandas |
| ch26 | `group-mean-pivot-table` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4 Pandas 数据分析；其余三家未点名 Pandas |
| ch26 | `missing-fill-mean` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4 Pandas 数据分析；其余三家未点名 Pandas |
| ch26 | `merge-left-join` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4 Pandas 数据分析；其余三家未点名 Pandas |
| ch26 | `sort-two-keys` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4 Pandas 数据分析；其余三家未点名 Pandas |
| ch27 | `line-plot-pyplot` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 6.1.2(f) 数据科学的可视化；matplotlib 四家都未点名（OCR 2.2.2(f) 的 visualisation 指设计程序时的心智模型，不是画数据） |
| ch27 | `line-plot-axes` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 6.1.2(f) 数据科学的可视化；matplotlib 四家都未点名（OCR 2.2.2(f) 的 visualisation 指设计程序时的心智模型，不是画数据） |
| ch27 | `scatter-sizes-colours` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 6.1.2(f) 数据科学的可视化；matplotlib 四家都未点名（OCR 2.2.2(f) 的 visualisation 指设计程序时的心智模型，不是画数据） |
| ch27 | `bar-chart-labels` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 6.1.2(f) 数据科学的可视化；matplotlib 四家都未点名（OCR 2.2.2(f) 的 visualisation 指设计程序时的心智模型，不是画数据） |
| ch27 | `histogram-bins` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 6.1.2(f) 数据科学的可视化；matplotlib 四家都未点名（OCR 2.2.2(f) 的 visualisation 指设计程序时的心智模型，不是画数据） |
| ch27 | `subplots-grid` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 6.1.2(f) 数据科学的可视化；matplotlib 四家都未点名（OCR 2.2.2(f) 的 visualisation 指设计程序时的心智模型，不是画数据） |
| ch27 | `annotate-and-style` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 6.1.2(f) 数据科学的可视化；matplotlib 四家都未点名（OCR 2.2.2(f) 的 visualisation 指设计程序时的心智模型，不是画数据） |
| ch27 | `savefig-size-dpi` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 6.1.2(f) 数据科学的可视化；matplotlib 四家都未点名（OCR 2.2.2(f) 的 visualisation 指设计程序时的心智模型，不是画数据） |
| ch27 | `plot-from-dataframe` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 6.1.2(f) 数据科学的可视化；matplotlib 四家都未点名（OCR 2.2.2(f) 的 visualisation 指设计程序时的心智模型，不是画数据） |
| ch28 | `mean-median-mode` | AQA OCR Edexcel CIE | Edexcel **改** | Edexcel 18.1.4(b) measures of central tendency；其余三家未点名 |
| ch28 | `population-vs-sample-sd` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch28 | `pearson-by-formula` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch28 | `pearson-corrcoef` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch28 | `regression-by-formula` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch28 | `regression-polyfit` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch28 | `sampling-distribution-of-mean` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch28 | `normal-probabilities` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch28 | `z-test-one-sample` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch28 | `t-statistic-by-hand` | AQA OCR Edexcel CIE | `[]` **改** | 属数学（线性代数 / 统计 / 马尔可夫链），四家 CS 考纲都未点名；NumPy 只是工具 |
| ch29 | `window-and-game-loop` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `move-per-frame` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `move-with-dt` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `draw-primitives-grid` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `colour-lerp` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.2.8.1 附注 convex combination（按比例混合两个向量）；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `keyboard-move-clamped` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `mouse-click-buttons` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `text-centred` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `screen-states` | AQA OCR Edexcel CIE | AQA CIE **改** | AQA 4.4.2.1 FSM 状态转移表 · CIE 12.2 state-transition diagrams；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `sprite-subclass-group` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `image-save-and-load` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `animation-frames` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `sprite-sheet-frames` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `rect-collision-colliderect` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `rect-collision-manual` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `circle-collision` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `group-collide-kill` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `mask-pixel-collision` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `diagonal-unnormalised` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.2.8.1 向量与数乘（缩放）；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `diagonal-normalised` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.2.8.1 向量与数乘（缩放）；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `mouse-steer-toward` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.2.8.1 向量；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `thrust-max-speed` | AQA OCR Edexcel CIE | AQA **改** | AQA 4.2.8.1 向量加法与数乘；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `gravity-jump` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `bounce-walls` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `friction-per-frame` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `friction-dt` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `screen-wrap` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `pong-full` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `pong-ai-paddle` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `snake-full` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `snake-move-list` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `snake-move-deque` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `breakout-full` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `invaders-full` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `bullet-cooldown` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `lives-and-invulnerability` | AQA OCR Edexcel CIE | `[]` **改** | pygame / 游戏循环 / 事件驱动四家都未点名 |
