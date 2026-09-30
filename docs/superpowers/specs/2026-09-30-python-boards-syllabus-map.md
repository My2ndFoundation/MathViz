# python/ · `boards` 考纲对照（2026-09-30）

**用户裁决（2026-09-30）**：程序的内容不在某个考试局的 A-level 计算机考纲里，就不写那个考试局——
学生按考纲过滤时看不到考纲外的程序；`boards: []` 合法。取代旧规则「拿不准就四家全写 / 确知不含才去掉」。

这份文件是这条裁决的依据：先逐家列出与本库相关的考纲条目（只认官方来源），再给出判定原则，
附录是全库 346 个程序**逐个**的判定表（每行写这个程序自己的依据与所属概念组），以及按概念组的一致性自查。
改 `boards` 之前先查这里；新程序照「判定原则」写，依据写进构建报告。

## 来源（只认官方）

| 考试局 | 用的文件 | URL |
|---|---|---|
| AQA 7517 | AS and A-level Computer Science 规格 v1.6（2023-07-31）全文；官网逐节 subject content 页面同版 | `https://filestore.aqa.org.uk/resources/computing/specifications/AQA-7516-7517-SP-2015.PDF`；`https://www.aqa.org.uk/subjects/computer-science/a-level/computer-science-7517/specification/subject-content/<节名>` |
| OCR H446 | **A Level Computer Science H446 规格 Version 3.0（2026 年 4 月）全文**；2020 年的 *Subject content clarification guide* v2 只作辅证（其「规格」栏与 v3.0 在 1.2.2、1.2.4、1.3.1、1.3.2、1.4.2、2.1.2、2.2.1、2.2.2、2.3.1 逐条一致） | `https://www.ocr.org.uk/images/170844-specification-accredited-a-level-gce-computer-science-h446.pdf`；指南 `https://www.ocr.org.uk/Images/383613-subject-content-clarification-guide.pdf` |
| Edexcel / Pearson | Pearson Edexcel International Advanced Level in Computer Science（YCP01；IAS XCP01），Issue 1 | `https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/computer-science/2026/specification-and-sample-assessments/ial-computer-science-specification.pdf` |
| CIE 9618 | Cambridge International AS & A Level Computer Science 9618 syllabus，2027–2029 考试用，Version 2 | `https://www.cambridgeinternational.org/Images/721397-2027-2029-syllabus.pdf` |

AQA 的节名：`fundamentals-of-programming`、`fundamentals-of-data-structures`、`fundamentals-of-algorithms`、
`theory-of-computation`、`fundamentals-of-data-representation`、`fundamentals-of-computer-systems`、
`fundamentals-of-databases`、`fundamentals-of-communication-and-networking`、`big-data`、
`fundamentals-of-functional-programming`、`systematic-approach-to-problem-solving`。

下文「A / O / E / C」是四家的缩写；OCR 的编号一律是 H446 v3.0 的，「5d」指它的附录 5d 伪代码指南（佐证，不单独作依据）。

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
| 推导式 | 4.4.2.2 附注 | "In Python, {2 ∗ x for x in {1, 2, 3 }} constructs {2, 4, 6 }" | 点名（Python 的 set comprehension） |
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
| JSON | 4.9.4.10 | "Compare JSON (Java script object notation) with XML." | 点名 |
| 统计（均值、方差、回归、检验） | — | — | **未找到** |
| 库 | 4.6.1.3 | "Understand the need for, and functions of … libraries" | 点名（系统软件意义上的库） |
| NEA 技术示例 | 4.14.3.4.1 Table 1 | 自称 "indicative … not to be treated as just a list" | 示例表，按 R6 **不算**点名（链表、矩阵运算、JSON/XML 解析都只在这里出现） |
| 数据可视化 | — | — | **未找到**（4.11 Big Data 不含画图） |
| 事件驱动 / 游戏循环 | — | — | **未找到** |
| 第三方库（NumPy / pandas / matplotlib / pygame） | — | — | **未找到** |
| 位运算 / 掩码（第 6 期 m8a 补） | 4.7.3.5 | "logical bitwise operators (AND, OR, NOT, XOR), logical shift right, shift left"（机器码操作；R2：Python 的 `& \| ^ ~ << >>` 实现的是同一概念） | 点名 |
| 补码（第 6 期 m8a 补） | 4.5.4.3 | "signed binary can be used to represent negative integers and … one possible coding scheme is two's complement" | 点名 |
| 中断（第 6 期 m8a 补） | 4.7.3.6 | "Describe the role of interrupts and interrupt service routines (ISRs)" | 点名 |

## 二、OCR H446（Version 3.0，2026-04）

| 主题 | 条目 | 原文短引 | 结论 |
|---|---|---|---|
| 数组、记录、列表、元组 | 1.4.2(a) | "Arrays (of up to 3 dimensions), records, lists, tuples." | 点名 |
| 链表、图、栈、队列、树、BST、哈希表 | 1.4.2(b) | "linked-list, graph (directed and undirected), stack, queue, tree, binary search tree, hash table" | 点名 |
| 建立 / 遍历 / 增删（可用数组或 OOP） | 1.4.2(c) | "create, traverse, add data to and remove data from" | 点名（**BST 删除、图遍历、用数组实现**由此覆盖） |
| 字典、集合、双端队列、优先队列、堆、向量 | — | — | **未找到**（字典按 Python 实现即哈希表，见 R2） |
| 数据结构上的算法 | 2.3.1(e) | "depth-first (post-order) and breadth-first traversal of trees" | 点名 |
| 标准算法 | 2.3.1(f) | "bubble sort, insertion sort, merge sort, quick sort, Dijkstra's shortest path algorithm, A* algorithm"（另有 binary / linear search） | 点名；**选择 / 希尔 / 计数排序未点名** |
| 复杂度 | 2.3.1(c)(d) | "Big O notation (constant, linear, polynomial, exponential and logarithmic complexity)" | 点名 |
| 递归 | 2.2.1(b) | "Recursion, how it can be used and compares to an iterative approach." | 点名 |
| 局部 / 全局变量 | 2.2.1(c) | "Global and local variables." | 点名 |
| 函数、按值 / 按引用传参 | 2.2.1(d) | "parameter passing by value and by reference" | 点名 |
| 分治、回溯、启发式 | 2.2.2(d)(f) | "backtracking … heuristics … visualisation to solve problems" | 点名（visualisation 指设计时的心智模型，**不是数据图表**） |
| 缓存 | 2.1.2(c) | "The nature, benefits and drawbacks of caching." | 点名（本表把记忆化算作缓存） |
| 程序设计：变量、类型转换、输入输出、循环、选择（含 switch/case）、MOD / DIV、字符串（length、subString）、子程序、数组、文件读写、注释 | 1.2.4(b)、附录 5d | 5d "Selection will be carried out with if/else and switch/case" | 点名（1.2.4(b) 只写 "Procedural languages"；具体构件以 5d 与指南澄清 "string handling, file handling" 佐证） |
| OOP | 1.2.4(e)、2.2.1(f)、5d | "classes, objects, methods, attributes, inheritance, encapsulation and polymorphism" | 点名；**组合 / 聚合未列**；5d "learners aren't expected to be aware of static methods" |
| 编译阶段 / 词法分析 | 1.2.2(e) | "Stages of compilation (lexical analysis, syntax analysis, code generation and optimisation)." | 点名 |
| 库 | 1.2.2(f) | "Linkers and loaders and use of libraries." | 点名 |
| 字符集 / 进制 / 浮点 | 1.4.1(f)(g)(h)(j) | "How character sets (ASCII and UNICODE) are used to represent text." | 点名（**舍入误差未点名**） |
| 布尔代数 | 1.4.3(c) | "De Morgan's Laws, distribution, association, commutation, double negation" | 点名 |
| 交换数据（CSV / JSON） | 1.3.2(b) + 指南澄清 | 规格 "Methods of capturing, selecting, managing and exchanging data."；指南举例 CSV、JSON，接着说 "Candidates won't be specifically asked about any one of these methods" | JSON 只是指南里的例子、且注明不专门考——按 R5 / R6 **不算**点名 JSON |
| 事务 / 原子性 | 1.3.2(f) | "Transaction processing, ACID (Atomicity, Consistency, Isolation, Durability)" | 点名 |
| 压缩 | 1.3.1(b) | "Run length encoding and dictionary coding for lossless compression." | 点名（**Huffman 未点名**） |
| 测试数据 | 3.2.3(a)（NEA） | "Identify the test data to be used during the iterative development and post development phases" | NEA 的要求条目，按 R6 算点名（normal / boundary / erroneous 的分类名 H446 没列） |
| 异常处理 | — | — | **未找到**（v3.0 全文检索，只有附录里一处 "with the exception of"） |
| 有限状态机、正则、逆波兰、集合运算 | — | — | **未找到** |
| 统计、矩阵运算、向量、数据可视化、事件驱动、第三方库 | — | — | **未找到** |
| 中断（第 6 期 m8a 补） | 1.2.1(c) | "Interrupts, the role of interrupts and Interrupt Service Routines (ISR), role within the Fetch-Decode-Execute Cycle." | 点名（v3.0 全文核实） |
| 补码（第 6 期 m8a 补） | 1.4.1(c) | "Use of sign and magnitude and two's complement to represent negative numbers in binary." | 点名（v3.0 全文核实） |
| 位运算 / 掩码（第 6 期 m8a 补） | 1.4.1(i) | "Bitwise manipulation and masks: shifts, combining with AND, OR, and XOR." | 点名（v3.0 全文核实） |

## 三、Edexcel / Pearson — International A Level Computer Science（YCP01）

**Pearson 已不提供英国本土 GCE A level Computer Science**（官网 A level 学科页只有 GCSE、BTEC、T Level；`/en/qualifications/edexcel-a-levels/computer-science-2015.html` 返回 404；简报里的「9CP0」在官网上找不到）。所以本列按 Pearson 现行的 A-level 程度资格 **International A Level Computer Science（YCP01；IAS XCP01），Issue 1，2026-09 首教、2027-06 首考，Unit 2 / Unit 4 用 Python 3 上机考**判。**若用户指的是别的 Pearson 资格，Edexcel 这一列整列重判。**

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
| 补码（第 6 期 m8a 补） | 2.1.3 | "Two's complement representation of signed numbers" | 点名 |
| 位运算 / 掩码（第 6 期 m8a 补） | 2.2.2、7.1.3(d) | "Bitwise manipulation: Logical shift, Arithmetic shift, Bit masks: AND, OR, XOR"；Operators "(d) Bitwise" | 点名 |
| 中断（第 6 期 m8a 补） | 11.2.1(e)、1.2.2(c) | "Interrupt handling in device management"；"Interrupt handling in multitasking" | 点名 |

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
| 回归 | 18.1 | "back propagation of errors and regression methods in machine learning" | 点名（**AI / 机器学习语境**下；最小二乘直线按此写 CIE） |
| 优先队列、堆、双端队列、向量、矩阵运算、正则、JSON、其余统计、数据可视化、事件驱动、第三方库 | — | — | **未找到**（11.1 "library routines" 只是泛称） |
| 作用域（局部 / 全局） | — | — | **未找到**（11.3 只有 procedure / function / parameter / by value / by reference） |
| 补码（第 6 期 m8a 补） | 1.1 | "one's and two's complement representation for binary numbers" | 点名 |
| 中断（第 6 期 m8a 补） | 4.1 | "Show understanding of the purpose of interrupts … use of an Interrupt Service handling Routine (ISR)" | 点名 |
| 位运算 / 掩码（第 6 期 m8a 补） | 4.3 | "Show understanding of how bit manipulation can be used to monitor/control a device … Test and set a bit (using bit masking)" | 点名 |

## 判定原则

- **R1 核心教学点**：一个考试局只在这个程序的**核心教学点**被它的考纲点名时才写。「用到」某个概念不算（Monte Carlo 程序用了循环，
  循环是四家都点名的，但它教的是模拟）。
- **R2 Python 写法实现的是点名概念**：程序教的是四家点名的概念的 Python 写法（`@dataclass` 之于记录、`for…else` 之于带提前退出的查找、
  `dict` 之于字典 / 哈希表、`break` / `continue` 之于循环终止），按概念判。**反过来**：写法本身就是课的内容、而它对应的概念不在某家
  考纲里（默认实参、`*args`、真值性、切片赋值、`__str__` / `__repr__`、推导式、lambda、`filter`），按那个写法所属的概念判，没点名就不写。
  特殊方法协议作用在一个点名概念上时按那个概念判（`operator-overloading-vector` → 向量 → A；`linked-list-iter-len` → 链表 → OEC）。
- **R3 库只是工具**：只是用了 NumPy / pandas / matplotlib / pygame / `collections` / `bisect` / `csv` 不算，按概念判
  （`dot-product-angle`：A 4.2.8.1 点名点积 → 写 A）。**库本身被点名时**（E 18.1.1 Decimal、18.1.2 re、18.1.3 NumPy、18.1.4 Pandas），
  程序的核心是那个库在所点名用途上的用法就写那家；核心是数学（解线性方程组、特征值、马尔可夫链、统计检验）的，库被点名也不写。
- **R4 ADT 为主**：程序实现一个点名的 ADT（队列、栈、链表、二叉树）时，按 ADT 判，不因实现手法（两个栈拼队列、数组里放链表）另扣一家；
  但被点名的只是 ADT 的一部分操作时照操作判（CIE 不点名二叉树删除 / 遍历 → `bst-delete`、两个遍历不写 CIE）。
- **R5 拿不准不写**：条目找不到、或读不出它是否覆盖这个程序，就不写，并列进「拿不准」。
- **R6 NEA**：NEA（课程设计）部分的**要求条目**算点名（OCR 3.2.3(a) 测试数据）；**标明是示例的表不算**（AQA 4.14.3.4.1 Table 1 自称
  "indicative … not to be treated as just a list"——链表维护、矩阵运算、JSON/XML 解析、生命游戏模拟都只在那里出现）。
- **附录表怎么来的**：由一个判定脚本从逐程序的判定数据生成，脚本要求全库每个程序都有自己的一行依据与概念组，缺一行就报错退出——「没判」是红，不是默认四家；
  同组 boards 不同而没写理由也报错。脚本不入库（附录表本身就是那份数据）；新程序照 R1–R6 判，把一行加进附录表。

## 拿不准 / 已结项（交用户看）

1. **Edexcel = IAL YCP01**（见第三节开头）。若用户指的是别的资格，Edexcel 一列整列重判。
2. **OCR 测试数据**：已结项——依据是 H446 v3.0 3.2.3(a)（NEA 要求条目，R6），`test-data-normal-boundary-erroneous` 写 OCR。
3. **Python `dict` 算 OCR 的「hash table」**：按 R2 算（只用于核心是键→值查找的程序；集合类不写 O）。若认为字典是另一个概念，ch11 与 ch20 部分程序要去掉 OCR。
4. **matplotlib 页写 Edexcel**：依据是 6.1.2(f) 数据科学的 Visualisation（Unit 1 理论卷），不是 matplotlib 被点名。
5. **pygame 页**：四家都不点名 pygame、游戏循环、事件驱动、碰撞检测。只有核心是点名概念的程序留了考试局：`colour-lerp`（A 凸组合）、
   `screen-states`（状态转移表：A FSM、C 状态转移图）、ch31 四个向量程序（A 向量）。
6. **记忆化写 OCR**：`grid-paths-memo`、`fibonacci-memo-dict`、`fibonacci-lru-cache` 三个同判 O（2.1.2(c) caching）。
7. **`ttt-minimax` 写 Edexcel**：15.1.1(a) brute force / exhaustive；没有「落子—撤销」，不算回溯。
8. **`abstract-base-class` / `class-vs-instance-attributes`**：Edexcel 13.1.1 的 "Abstraction" 是泛称、附录 2 UML 无抽象类，不写 E；
   类属性只能类比 AQA 的 static methods，拿不准，判 `[]`。
9. **`infix-to-rpn`**：CIE 16.2 只点名 RPN 求值，没写 CIE。
10. **OCR 异常处理**：已结项——v3.0 全文确认没有异常条目，ch05 五个以异常为核心的程序不写 OCR。
11. **CIE 的 regression**：18.1 在 AI / 机器学习语境下点名 "regression methods"；`regression-by-formula`、`regression-polyfit` 按此写 C。
    若用户认为最小二乘直线不属于 ML 语境的回归，这两个改回 `[]`。
12. **JSON 不写 OCR**：OCR 的依据只是指南澄清里的例子，原话 "won't be specifically asked"，比 AQA 4.9.4.10 弱，按 R5 / R6 不写。
13. **`money-in-pence` 与 `money-decimal`** 核心相同（二进制浮点不精确），同判 AEC。
14. **`strings-are-immutable` 判 `[]`**：Edexcel 20.1.2(d) "Immutable variable" 与 AQA 4.11 的 immutable data structures 都在函数式编程语境下，说的不是字符串不可变，按 R5 不写（控制方裁决）。
15. **`return-several-values` 写 AOE**：AQA 4.1.1.12 标题 "Returning a value/values from a subroutine" 明写多个返回值；`swap-two-tuple` 教的是元组本身，只写 OE。

## 计数

| | AQA | OCR | Edexcel | CIE | `[]` |
|---|---|---|---|---|---|
| 改前（main，346 个程序） | 346 | 346 | 346 | 346 | 0 |
| 改后 | 216 | 183 | 252 | 179 | 70 |

第 6 期 m8a 新增 18 个程序（ch33、ch34）：AQA +3 · OCR +3 · Edexcel +3 · CIE +3 · `[]` +15。

相对 main，194 个程序的 `boards` 变了，分布在 29 页（每页 patch 升版一次并写 changelog）。

## 一致性自查（按概念组）

每个程序在附录表里标了概念组。同组 boards 不同的，右栏写理由；判定脚本在「组内不同且没写理由」时报错。

| 概念组 | 程序数 | boards 分布 | 组内不同的理由 |
|---|---|---|---|
| arithmetic | 4 | AQA OCR Edexcel CIE：`celsius-to-fahrenheit`、`divmod-and-floor`、`rps-winner`、`digit-sum-modulo` | （组内一致） |
| arrays-2d | 6 | AQA OCR Edexcel CIE：`grid-row-col-totals`、`game-of-life-grid`、`ttt-winner-lines`、`ttt-winner-loops`、`board-move-2048`、`minesweeper-place-count` | （组内一致） |
| assignment | 1 | AQA OCR Edexcel CIE：`swap-two-temp` | （组内一致） |
| astar | 1 | OCR Edexcel CIE：`a-star-grid` | （组内一致） |
| atomicity | 1 | OCR：`bank-transfer-atomic` | （组内一致） |
| binary-search | 7 | AQA OCR Edexcel CIE：`binary-search-iterative`、`binary-search-recursive`、`binary-search-bisect`、`binary-search-leftmost`、`count-occurrences-sorted`、`binary-search-trace-table`、`guess-computer-halving` | （组内一致） |
| boolean | 2 | AQA OCR Edexcel CIE：`leap-year-one-expression`、`de-morgan-truth-table` | （组内一致） |
| bst | 4 | AQA OCR Edexcel CIE：`bst-insert-recursive`、`bst-insert-iterative`、`bst-search`、`tree-in-arrays` | （组内一致） |
| bst-delete | 1 | OCR Edexcel：`bst-delete` | （组内一致） |
| builtin | 1 | AQA OCR Edexcel CIE：`max-of-three-builtin` | （组内一致） |
| central-tendency | 2 | Edexcel：`mean-variance-loop`、`mean-median-mode` | （组内一致） |
| cipher | 1 | AQA OCR Edexcel CIE：`caesar-shift` | （组内一致） |
| collision | 5 | []：`rect-collision-colliderect`、`rect-collision-manual`、`circle-collision`、`group-collide-kill`、`mask-pixel-collision` | （组内一致） |
| complexity | 14 | AQA OCR Edexcel CIE：`pair-sum-nested-loops`、`pair-sum-two-pointers`、`loop-shape-counts`、`growth-rate-table`、`search-comparison-counts`、`insertion-shift-counts`、`merge-vs-insertion-counts`、`doubling-experiment`、`has-duplicates-nested`、`has-duplicates-sorted`、`has-duplicates-set`、`max-subarray-quadratic`、`max-subarray-divide-conquer`、`max-subarray-kadane` | （组内一致） |
| comprehension | 6 | AQA Edexcel：`squares-comprehension`、`evens-comprehension`、`dict-and-set-comprehensions`、`flatten-and-transpose`、`if-placement-in-comprehension`、`comprehension-or-loop` | （组内一致） |
| dataviz | 9 | Edexcel：`line-plot-pyplot`、`line-plot-axes`、`scatter-sizes-colours`、`bar-chart-labels`、`histogram-bins`、`subplots-grid`、`annotate-and-style`、`savefig-size-dpi`、`plot-from-dataframe` | （组内一致） |
| decomposition | 1 | AQA OCR Edexcel CIE：`readings-report` | （组内一致） |
| deque | 1 | []：`deque-both-ends` | （组内一致） |
| dictionary | 10 | AQA OCR Edexcel CIE：`dict-crud`、`word-count-if-in`、`word-count-get`、`word-count-counter`、`group-by-setdefault`、`group-by-defaultdict`、`roman-to-int-lookup`、`dedupe-dict-fromkeys`、`tuple-keys-sparse-grid`、`anagram-check-counts` | （组内一致） |
| dijkstra | 2 | AQA OCR Edexcel CIE：`dijkstra-array-scan`、`dijkstra-heapq` | （组内一致） |
| docs | 1 | Edexcel：`docstrings-and-type-hints` | （组内一致） |
| dp | 6 | []：`grid-paths-table`、`knapsack-01-table`、`knapsack-01-1d`、`lcs-length`、`edit-distance`、`coin-change-dp` | （组内一致） |
| efficiency | 1 | AQA OCR Edexcel CIE：`is-prime-trial-division` | （组内一致） |
| exceptions | 5 | AQA Edexcel CIE：`try-except-else-finally`、`multiple-except-clauses`、`raise-for-invalid-input`、`custom-exception-class`、`missing-file-eafp` | （组内一致） |
| expression | 3 | AQA CIE：`rpn-evaluate`；AQA：`infix-to-rpn`；AQA OCR Edexcel CIE：`expression-tree` | RPN 求值：A、C；中缀→RPN 转换：只有 A；表达式树（由 RPN 建树、后序求值）：A 4.3.2.1、O 后序遍历、E 遍历、C RPN 求值 → 四家 |
| files | 6 | AQA OCR Edexcel CIE：`write-and-read-text`、`read-csv-split`、`read-csv-module`、`write-csv-dictwriter`、`missing-file-lbyl`、`inventory-csv-restock` | （组内一致） |
| float-precision | 2 | AQA Edexcel CIE：`money-in-pence`、`money-decimal` | （组内一致） |
| fsm | 2 | AQA CIE：`traffic-light-fsm`、`screen-states` | （组内一致） |
| functional-hof | 5 | AQA Edexcel：`functions-as-values`、`evens-filter`、`map-split-input`、`sorted-min-max-with-key`；Edexcel：`enumerate-and-zip` | map / filter / lambda / 一等函数：A 4.12、E 20.1.2；enumerate-and-zip 只有 E 点名 zip |
| functions | 1 | AQA OCR Edexcel CIE：`define-call-return` | （组内一致） |
| game-tree | 1 | Edexcel：`ttt-minimax` | （组内一致） |
| graph | 1 | AQA OCR Edexcel：`adjacency-list-and-matrix` | （组内一致） |
| graph-other | 3 | []：`topological-sort-kahn`、`mst-prim`、`mst-kruskal` | （组内一致） |
| graph-traversal | 5 | AQA OCR Edexcel：`bfs-order`、`bfs-shortest-path`、`dfs-recursive`、`dfs-iterative-stack`、`minesweeper-flood-reveal` | （组内一致） |
| greedy | 3 | Edexcel：`coin-change-greedy`、`activity-selection`、`huffman-code-lengths` | （组内一致） |
| guard-clause | 1 | Edexcel：`ticket-price-guard-clauses` | （组内一致） |
| hashing | 1 | AQA OCR Edexcel CIE：`hash-search-linear-probing` | （组内一致） |
| heap | 1 | []：`heap-sift-up-down` | （组内一致） |
| io | 1 | AQA OCR Edexcel CIE：`hello-name` | （组内一致） |
| iteration | 7 | AQA OCR Edexcel CIE：`count-vowels-loop`、`range-forms`、`sentinel-running-total`、`break-and-continue`、`find-max-and-index`、`guess-number-attempts`、`competition-ranking` | （组内一致） |
| json | 3 | AQA：`json-round-trip`、`json-load-fixture`、`gradebook-json-persist` | （组内一致） |
| lazy | 1 | Edexcel：`generator-sum-any-all` | （组内一致） |
| lexing | 2 | OCR CIE：`tokenise-loop`；AQA OCR Edexcel CIE：`tokenise-regex` | 手写词法分析：O、C 点名编译阶段的词法分析；正则版另因 A 4.4.2.3、E 18.1.2 点名正则而四家 |
| linalg | 5 | []：`linear-system-solve`、`linear-system-inverse`、`determinant-and-identity`、`eigen-2x2`、`markov-weather` | （组内一致） |
| linear-search | 5 | AQA OCR Edexcel CIE：`has-negative-flag`、`has-negative-for-else`、`linear-search-for`、`linear-search-sentinel`、`linear-search-sorted-early-exit` | （组内一致） |
| linked-list | 9 | OCR Edexcel CIE：`node-and-traverse`、`insert-at-index`、`delete-by-value`、`reverse-iterative`、`reverse-recursive`、`doubly-linked-list`、`linked-list-in-arrays`、`linked-list-iter-len`；AQA OCR Edexcel CIE：`linked-list-vs-list` | linked-list-vs-list 的核心是静态 / 动态结构比较，AQA 4.2.1.4 点名，所以比其余链表程序多 A |
| list-ops | 6 | AQA OCR Edexcel CIE：`squares-append-loop`、`list-crud-methods`、`rotate-list-slice`、`rotate-list-pop-append`、`remove-while-iterating`、`merge-row-2048-compress` | （组内一致） |
| matrix-multiply | 3 | AQA OCR Edexcel CIE：`matrix-multiply-loops`；AQA Edexcel：`matrix-multiply-zip`；Edexcel：`matrix-product-matmul` | 矩阵乘法本身四家都未点名，三个程序按各自教的点名概念判：三层下标循环 = 二维数组（四家）；zip 版 = 行·列点积 + zip / 推导式（AE）；NumPy 版 = @ 与 * 的数组运算（E） |
| memoization | 3 | OCR：`fibonacci-memo-dict`、`fibonacci-lru-cache`、`grid-paths-memo` | （组内一致） |
| modules | 1 | AQA OCR Edexcel CIE：`imports-and-main-guard` | （组内一致） |
| number-bases | 2 | AQA OCR Edexcel CIE：`binary-to-denary-loop`、`binary-to-denary-builtin` | （组内一致） |
| numeric-approx | 2 | []：`monte-carlo-pi-grid`、`sir-epidemic-steps` | （组内一致） |
| numpy | 9 | Edexcel：`ndarray-create`、`reshape-and-axes`、`slice-is-a-view`、`boolean-mask-filter`、`broadcasting-table`、`mean-variance-vectorised`、`numpy-scalar-repr`、`aggregate-by-axis`、`transform-2d-points` | （组内一致） |
| oop-composition | 1 | AQA Edexcel CIE：`composition-has-a` | （组内一致） |
| oop-core | 6 | AQA OCR Edexcel CIE：`class-and-instance`、`bank-account-encapsulation`、`inheritance-and-super`、`polymorphism-and-duck-typing`、`gradebook-classes`、`library-loans` | （组内一致） |
| oop-static | 3 | []：`class-vs-instance-attributes`；AQA：`staticmethod-classmethod`、`abstract-base-class` | 静态方法、抽象方法只有 AQA 点名；类属性连 AQA 也只点名 static methods，拿不准不写 |
| pandas | 9 | Edexcel：`series-and-dataframe`、`read-csv-inspect`、`filter-mask`、`filter-query`、`group-mean-groupby`、`group-mean-pivot-table`、`missing-fill-mean`、`merge-left-join`、`sort-two-keys` | （组内一致） |
| physics | 5 | []：`gravity-jump`、`bounce-walls`、`friction-per-frame`、`friction-dt`、`screen-wrap` | （组内一致） |
| priority-queue | 2 | AQA：`priority-queue-heapq`、`priority-queue-scan-min` | （组内一致） |
| pygame | 11 | []：`window-and-game-loop`、`move-per-frame`、`move-with-dt`、`draw-primitives-grid`、`keyboard-move-clamped`、`mouse-click-buttons`、`text-centred`、`sprite-subclass-group`、`image-save-and-load`、`animation-frames`、`sprite-sheet-frames` | （组内一致） |
| pygame-game | 9 | []：`pong-full`、`pong-ai-paddle`、`snake-full`、`snake-move-list`、`snake-move-deque`、`breakout-full`、`invaders-full`、`bullet-cooldown`、`lives-and-invulnerability` | （组内一致） |
| python-bool | 2 | []：`truthiness`、`short-circuit-and-ternary` | （组内一致） |
| python-list | 1 | []：`slice-assignment` | （组内一致） |
| python-params | 4 | []：`positional-keyword-default`、`mutable-default-trap`、`mutable-default-none`、`args-and-kwargs` | （组内一致） |
| python-protocol | 2 | []：`str-and-repr`；AQA：`operator-overloading-vector` | 协议本身未点名；协议作用在点名概念上时按那个概念判（向量 → A），作用在普通类上就是 [] |
| queue | 5 | AQA OCR Edexcel CIE：`hot-potato-list`、`hot-potato-deque`、`circular-queue-array`、`queue-from-two-stacks`、`queue-single-server` | （组内一致） |
| random | 8 | AQA Edexcel：`monte-carlo-pi-random`、`dice-sum-frequencies`、`random-walk-1d`、`gamblers-ruin`、`shuffle-fisher-yates`、`shuffle-naive-biased`、`pig-dice-two-players`、`rng-generator-basics` | （组内一致） |
| records | 3 | AQA OCR Edexcel CIE：`point-plain-class`、`point-dataclass`、`inventory-stock` | （组内一致） |
| recursion | 10 | AQA OCR Edexcel CIE：`factorial-recursive`、`factorial-iterative`、`fibonacci-naive`、`fibonacci-iterative`、`call-stack-unwinding`、`power-linear`、`power-by-squaring`、`towers-of-hanoi`、`permutations-recursive`、`flatten-nested` | （组内一致） |
| references | 5 | AQA OCR Edexcel CIE：`mutate-vs-return`、`copy-alias`、`copy-shallow`、`copy-deep`、`grid-rows-shared` | （组内一致） |
| regex | 4 | AQA Edexcel：`regex-find-numbers`、`date-format-regex`、`name-swap-regex-sub`、`log-line-parser` | （组内一致） |
| regression | 2 | CIE：`regression-by-formula`、`regression-polyfit` | （组内一致） |
| scope | 1 | AQA OCR Edexcel：`local-and-global-scope` | （组内一致） |
| selection | 8 | AQA OCR Edexcel CIE：`max-of-three-if`、`grade-boundaries-descending`、`grade-boundaries-ranges`、`leap-year-nested`、`ticket-price-nested`、`triangle-classifier`、`match-case-commands`、`fizzbuzz` | （组内一致） |
| sets | 3 | AQA Edexcel CIE：`set-operations`、`dedupe-seen-set`、`game-of-life-set` | （组内一致） |
| sort-bubble | 2 | AQA OCR Edexcel CIE：`bubble-sort-basic`、`bubble-sort-early-exit` | （组内一致） |
| sort-insertion | 1 | OCR Edexcel CIE：`insertion-sort` | （组内一致） |
| sort-merge | 2 | AQA OCR Edexcel：`merge-sort-top-down`、`merge-sort-bottom-up` | （组内一致） |
| sort-other | 4 | []：`selection-sort`、`shell-sort`、`counting-sort`、`sort-stability` | （组内一致） |
| sort-quick | 2 | OCR Edexcel：`quicksort-lomuto`、`quicksort-comprehension` | （组内一致） |
| stack | 6 | AQA OCR Edexcel CIE：`stack-list-methods`、`stack-array-top-pointer`、`bracket-matching`、`undo-redo-two-stacks`、`stack-as-linked-list`、`merge-row-2048-stack` | （组内一致） |
| stats | 7 | []：`population-vs-sample-sd`、`pearson-by-formula`、`pearson-corrcoef`、`sampling-distribution-of-mean`、`normal-probabilities`、`z-test-one-sample`、`t-statistic-by-hand` | （组内一致） |
| string-format | 1 | Edexcel：`number-formatting` | （组内一致） |
| strings | 10 | AQA OCR Edexcel CIE：`index-and-slice`、`string-method-tour`、`split-and-join`、`reverse-string-slice`、`reverse-string-loop`、`palindrome-cleaned`、`password-rules`、`clean-text-normalise`、`date-format-manual`、`hangman-state` | （组内一致） |
| strings-python | 2 | []：`strings-are-immutable`、`escapes-and-raw-strings` | （组内一致） |
| testing | 1 | AQA OCR Edexcel CIE：`test-data-normal-boundary-erroneous` | （组内一致） |
| text-files | 2 | AQA OCR Edexcel CIE：`word-frequency-file`、`config-parser` | （组内一致） |
| tree | 1 | AQA OCR Edexcel CIE：`binary-tree-nodes` | （组内一致） |
| tree-traversal | 2 | AQA OCR Edexcel：`traversals-recursive`、`traversals-iterative` | （组内一致） |
| tuple-pack | 2 | OCR Edexcel：`swap-two-tuple`；AQA OCR Edexcel：`return-several-values` | swap-two-tuple 教的是元组打包 / 解包本身，只有 O、E 点名元组；return-several-values 教的是从子程序返回多个值，AQA 4.1.1.12 明写 "value/values"，所以多一个 A |
| types | 2 | AQA OCR Edexcel CIE：`int-float-str`、`digit-sum-string` | （组内一致） |
| validation | 3 | AQA OCR Edexcel CIE：`input-validation-loop`、`ttt-game-loop`、`menu-driven-cli` | （组内一致） |
| vectors | 6 | AQA Edexcel：`dot-product-angle`；AQA：`colour-lerp`、`diagonal-unnormalised`、`diagonal-normalised`、`mouse-steer-toward`、`thrust-max-speed` | 向量运算只有 AQA 4.2.8.1 点名；dot-product-angle 另因 NumPy 写 E |

第 6 期 m8a 新增的概念组（组内一致）：

| 概念组 | 程序数 | boards：程序 | 理由 |
|---|---|---|---|
| bitwise | 1 | AQA OCR Edexcel CIE：`gpio-bitmask` | （组内一致） |
| twos-complement | 1 | AQA OCR Edexcel CIE：`radio-packet-bytes` | （组内一致） |
| interrupts | 1 | AQA OCR Edexcel CIE：`pin-irq-counter` | （组内一致） |
| radio-text | 1 | []：`radio-packet-csv` | 与 `radio-packet-bytes` 同一问题的文本版，核心是字符串解析报文、不涉及补码——同题不同组 |
| ticks-wrap | 2 | []：`elapsed-naive-subtract`、`elapsed-ticks-diff` | （组内一致） |
| microbit-io | 7 | []：`led-image-string`、`scroll-and-show`、`button-press-edges`、`accelerometer-tilt`、`spirit-level-column`、`compass-point`、`music-note-frequency` | （组内一致） |
| pico-io | 5 | []：`blink-gpio-pin`、`pwm-duty-percent`、`pwm-servo-angle`、`adc-temperature`、`timer-periodic-callback` | （组内一致） |

## 附录 · 逐程序判定表

「**改**」标出与 main 上原值不同的行。每行的依据是这个程序自己的：写了哪家、依据哪条；没写哪家、为什么。

| 章 | id | 原 boards | 新 boards | 概念组 | 依据（考纲条目编号） |
|---|---|---|---|---|---|
| ch01 | `hello-name` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | io | 输入、变量、输出：A 4.1.1.2 assignment · O 5d Taking Input / Outputting to Screen · E 7.1.2、8.2.2(c) · C 11.1 input/output |
| ch01 | `celsius-to-fahrenheit` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | arithmetic | 实数运算与舍入：A 4.1.1.3 real division、rounding · O 1.4.1(a)、5d Arithmetic Operators · E 7.1.3(a)、8.2.1(a) · C 10.1 REAL、11.1 |
| ch01 | `max-of-three-if` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | selection | 分支链：A 4.1.1.2 selection · O 2.2.1(a) branching、5d if/else · E 7.1.1(b) · C 11.2 IF |
| ch01 | `max-of-three-builtin` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | builtin | 内置函数：E 9.1.3(c) built-in subprograms · C 11.1 built-in functions · A 4.1.1.10 subroutines · O 2.2.1(d) functions |
| ch01 | `swap-two-temp` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | assignment | 赋值与临时变量：A 4.1.1.2 assignment · O 5d Variables · E 7.1.2(b) · C 11.1 assignment |
| ch01 | `swap-two-tuple` | AQA OCR Edexcel CIE | OCR Edexcel **改** | tuple-pack | 元组打包 / 解包：O 1.4.2(a) tuples · E 8.1.2(e) Tuple；AQA、CIE 未点名元组 |
| ch01 | `count-vowels-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | iteration | 计数循环 + 成员判断：A 4.1.1.2 iteration · O 2.2.1(a) iteration、5d · E 7.1.1(c)(d) · C 11.2 loops |
| ch01 | `int-float-str` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | types | 数据类型与转换：A 4.1.1.1、4.1.1.7 string conversion · O 1.4.1(a)、5d Casting · E 8.1.1、8.2.1(d) · C 10.1 |
| ch01 | `divmod-and-floor` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | arithmetic | 整除与余数：A 4.1.1.3 integer division (including remainders) · O 5d MOD / DIV · E 7.1.3(a) · C 11.1 arithmetic operators |
| ch01 | `number-formatting` | AQA OCR Edexcel CIE | Edexcel **改** | string-format | 格式说明符：E 8.2.2(c) Formatting；AQA、OCR、CIE 未点名输出格式化 |
| ch02 | `index-and-slice` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | strings | 下标与子串：A 4.1.1.7 · O 1.2.4(b)、5d String Handling（指南澄清：string handling）· E 8.2.2 · C 11.1 string manipulation functions |
| ch02 | `strings-are-immutable` | AQA OCR Edexcel CIE | `[]` **改** | strings-python | 字符串不可变四家都未点名：E 20.1.2(d) 与 AQA 4.11 的 immutable 都在函数式编程语境下，不是字符串不可变，按 R5 不写 |
| ch02 | `string-method-tour` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | strings | 字符串方法：A 4.1.1.7 · O 1.2.4(b)、5d String Handling（指南澄清：string handling）· E 8.2.2 · C 11.1 string manipulation functions |
| ch02 | `split-and-join` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | strings | 切分与拼接：A 4.1.1.7 · O 1.2.4(b)、5d String Handling（指南澄清：string handling）· E 8.2.2 · C 11.1 string manipulation functions |
| ch02 | `escapes-and-raw-strings` | AQA OCR Edexcel CIE | `[]` **改** | strings-python | 转义序列 / 原始字符串 / repr 四家都未点名 |
| ch02 | `reverse-string-slice` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | strings | 子串操作反转：A 4.1.1.7 · O 1.2.4(b)、5d String Handling（指南澄清：string handling）· E 8.2.2 · C 11.1 string manipulation functions |
| ch02 | `reverse-string-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | strings | 循环 + 拼接：A 4.1.1.7 · O 1.2.4(b)、5d String Handling（指南澄清：string handling）· E 8.2.2 · C 11.1 string manipulation functions |
| ch02 | `palindrome-cleaned` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | strings | 清洗后比较：A 4.1.1.7 · O 1.2.4(b)、5d String Handling（指南澄清：string handling）· E 8.2.2 · C 11.1 string manipulation functions |
| ch02 | `caesar-shift` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | cipher | 字符编码与凯撒：A 4.5.6.10 Caesar、4.1.1.7 character code · O 1.4.1(j) character sets、1.3.1(c) symmetric · E 3.2.3 monoalphabetic substitution、2.3.1 · C 1.1 character data、17.1 symmetric |
| ch02 | `binary-to-denary-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | number-bases | 进制转换：A 4.5.2.1 · O 1.4.1(f) · E 2.1.1 · C 1.1 number bases |
| ch02 | `binary-to-denary-builtin` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | number-bases | 进制转换（内置函数）：A 4.5.2.1 · O 1.4.1(f) · E 2.1.1 · C 1.1 |
| ch02 | `password-rules` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | strings | 逐字符检查的校验：A 4.1.1.7 · O 1.2.4(b)、5d String Handling（指南澄清：string handling）· E 8.2.2 · C 11.1 string manipulation functions；Boolean 标志 A 4.1.1.5 |
| ch03 | `define-call-return` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | functions | 函数与过程、返回值：A 4.1.1.10–4.1.1.12 · O 2.2.1(d) · E 7.1.4 · C 11.3 |
| ch03 | `positional-keyword-default` | AQA OCR Edexcel CIE | `[]` **改** | python-params | 位置 / 关键字 / 默认实参是 Python 的参数机制，四家只点名参数本身 |
| ch03 | `mutable-default-trap` | AQA OCR Edexcel CIE | `[]` **改** | python-params | 默认值在 def 时只求值一次，Python 特性，四家都未点名 |
| ch03 | `mutable-default-none` | AQA OCR Edexcel CIE | `[]` **改** | python-params | None 哨兵修默认值，Python 惯用写法，四家都未点名 |
| ch03 | `args-and-kwargs` | AQA OCR Edexcel CIE | `[]` **改** | python-params | 可变个数参数 *args / **kwargs 四家都未点名；点名的只是参数 / 实参本身 |
| ch03 | `return-several-values` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | tuple-pack | 从子程序返回多个值：A 4.1.1.12 "Returning a value/values from a subroutine" · O 1.4.2(a) tuples、2.2.1(d) · E 8.1.2(e)、7.1.4；CIE 11.3 只点名单个返回值 |
| ch03 | `local-and-global-scope` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | scope | A 4.1.1.13–4.1.1.14 · O 2.2.1(c)、5d global · E 9.1.2(d) scope isolation；CIE 11.3 未点名作用域 |
| ch03 | `functions-as-values` | AQA OCR Edexcel CIE | AQA Edexcel **改** | functional-hof | A 4.12.1.2 first-class object · E 20.1.2(b)(g)；OCR、CIE 未点名 |
| ch03 | `docstrings-and-type-hints` | AQA OCR Edexcel CIE | Edexcel **改** | docs | E 9.2.2(b)、19.2.2(b) informative comment；AQA 只在 NEA 编码风格表（示例，R6 不算）；OCR、CIE 未点名 |
| ch03 | `is-prime-trial-division` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | efficiency | 提前返回、试除到平方根（算法效率）：A 4.4.4.1 · O 2.3.1(b) · E 9.1.2(f)、5.1.1 · C 19.1 |
| ch03 | `readings-report` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | decomposition | 自顶向下分解：A 4.4.1.9 · O 2.1.3、2.2.2(c) · E 10.1.2、9.1.1(a) · C 9.1 decomposition |
| ch03 | `mutate-vs-return` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | references | 函数收到的是同一个列表：A 4.1.1.1 pointer/reference · O 2.2.1(d) by reference · E 14.1.1(b) references · C 13.1 pointer、11.3 by reference |
| ch04 | `class-and-instance` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | oop-core | 类、对象、实例化：A 4.1.2.3 · O 1.2.4(e)、2.2.1(f)、5d Object-Oriented · E 13.1.1、20.1.1 · C 20.1 |
| ch04 | `str-and-repr` | AQA OCR Edexcel CIE | `[]` **改** | python-protocol | 对象的字符串表示协议 __str__ / __repr__ 四家都未点名（协议作用在一个没有被点名的概念上） |
| ch04 | `class-vs-instance-attributes` | AQA OCR Edexcel CIE | `[]` **改** | oop-static | 类属性 = 类级共享成员：OCR 5d 明言不要求 static；AQA 4.1.2.3 只点名 static methods；Edexcel、CIE 只点名 attributes。拿不准不写（R5） |
| ch04 | `bank-account-encapsulation` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | oop-core | 封装、getter：A 4.1.2.3 · O 1.2.4(e)、2.2.1(f)、5d Object-Oriented · E 13.1.1、20.1.1 · C 20.1（O 5d private / getAttempts；E 20.1.1(e)(f)(g)；C getters, setters） |
| ch04 | `inheritance-and-super` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | oop-core | 继承与 super：A 4.1.2.3 · O 1.2.4(e)、2.2.1(f)、5d Object-Oriented · E 13.1.1、20.1.1 · C 20.1（O 5d inherits / super） |
| ch04 | `polymorphism-and-duck-typing` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | oop-core | 多态与覆盖：A 4.1.2.3 · O 1.2.4(e)、2.2.1(f)、5d Object-Oriented · E 13.1.1、20.1.1 · C 20.1 |
| ch04 | `composition-has-a` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | oop-composition | A 4.1.2.3 composition、aggregation · E 13.1.1 Composition、20.1.1(h)(i) · C 20.1 containment (aggregation)；OCR 1.2.4(e) 未列组合 / 聚合 |
| ch04 | `point-plain-class` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | records | 手写一个值类（记录）：A 4.1.1.1 records、4.1.2.3 class · O 1.4.2(a) records、1.2.4(e) · E 8.1.2(d)、20.1.1 · C 10.1 record、20.1 |
| ch04 | `point-dataclass` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | records | 记录类型：A 4.1.1.1 Records · O 1.4.2(a) records · E 8.1.2(d) Record · C 10.1 record；@dataclass 是 Python 写记录的写法（R2） |
| ch04 | `operator-overloading-vector` | AQA OCR Edexcel CIE | AQA **改** | python-protocol | 运算符重载四家都未点名；协议作用在向量上：A 4.2.8.1 vector addition、scalar-vector multiplication |
| ch04 | `staticmethod-classmethod` | AQA OCR Edexcel CIE | AQA **改** | oop-static | A 4.1.2.3 附注 static methods；OCR 5d "learners aren't expected to be aware of static methods"；Edexcel、CIE 未点名 |
| ch04 | `abstract-base-class` | AQA OCR Edexcel CIE | AQA **改** | oop-static | A 4.1.2.3 附注 abstract methods；OCR、CIE 未点名；Edexcel 13.1.1 的 Abstraction 是泛称、附录 2 UML 无抽象类（R5） |
| ch05 | `write-and-read-text` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | files | 写读追加文本文件：A 4.2.1.3 · O 1.2.4(b)、5d Reading to and Writing from Files · E 8.2.3 · C 10.3、20.2 |
| ch05 | `read-csv-split` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | files | 逐行读文件并切分字段：A 4.2.1.3 · O 1.2.4(b)、5d Reading to and Writing from Files · E 8.2.3 · C 10.3、20.2 |
| ch05 | `read-csv-module` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | files | 同一份读文件，解析交给 csv 模块（库是工具，R3）：A 4.2.1.3 · O 1.2.4(b)、5d Reading to and Writing from Files · E 8.2.3 · C 10.3、20.2 |
| ch05 | `write-csv-dictwriter` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | files | 把记录写进文件再读回：A 4.2.1.3 · O 1.2.4(b)、5d Reading to and Writing from Files · E 8.2.3 · C 10.3、20.2 |
| ch05 | `try-except-else-finally` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | exceptions | A 4.1.1.9 · E 7.1.1(e) · C 20.2；OCR H446 v3.0 无异常处理条目 |
| ch05 | `multiple-except-clauses` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | exceptions | A 4.1.1.9 · E 7.1.1(e) · C 20.2；OCR 无异常处理条目 |
| ch05 | `raise-for-invalid-input` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | exceptions | A 4.1.1.9 · E 7.1.1(e)、19.2.3(b) · C 20.2；OCR 无异常处理条目 |
| ch05 | `custom-exception-class` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | exceptions | A 4.1.1.9 · E 7.1.1(e) · C 20.2；OCR 无异常处理条目 |
| ch05 | `missing-file-eafp` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | exceptions | 用异常处理缺失文件：A 4.1.1.9 · E 7.1.1(e) · C 20.2；OCR 无异常处理条目 |
| ch05 | `missing-file-lbyl` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | files | 打开前先查文件在不在（核心是文件处理，不用异常）：A 4.2.1.3 · O 1.2.4(b)、5d Reading to and Writing from Files · E 8.2.3 · C 10.3、20.2 |
| ch05 | `input-validation-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | validation | 条件循环反复读到合法输入为止：A 4.1.1.2 indefinite iteration · O 2.2.1(a)、5d do…until · E 7.1.1(d)、9.2.3(f) managed conversion · C 11.2 post-condition loop |
| ch05 | `imports-and-main-guard` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | modules | 模块 / 库：A 4.6.1.3 libraries · O 1.2.2(f) use of libraries · E 9.1.3(d)、17.2.3 · C 11.1 library routines |
| ch06 | `truthiness` | AQA OCR Edexcel CIE | `[]` **改** | python-bool | 非布尔值的真假（truthy / falsy）是 Python 规则，四家只点名 Boolean 类型与运算 |
| ch06 | `short-circuit-and-ternary` | AQA OCR Edexcel CIE | `[]` **改** | python-bool | and / or 交回操作数、短路求值、条件表达式，四家都未点名 |
| ch06 | `grade-boundaries-descending` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | selection | elif 链：A 4.1.1.2 selection · O 2.2.1(a) branching、5d if/else · E 7.1.1(b) · C 11.2 IF |
| ch06 | `grade-boundaries-ranges` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | selection | 链式比较写全区间：A 4.1.1.2 selection · O 2.2.1(a) branching、5d if/else · E 7.1.1(b) · C 11.2 IF；A 4.1.1.4 relational |
| ch06 | `leap-year-nested` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | selection | 嵌套选择：A 4.1.1.2 selection · O 2.2.1(a) branching、5d if/else · E 7.1.1(b) · C 11.2 IF（A 4.1.1.2 明写 nested selection） |
| ch06 | `leap-year-one-expression` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | boolean | 布尔表达式：A 4.1.1.5 · O 1.4.3(a) · E 5.3.1、7.1.3(c) · C 11.1 logical operators |
| ch06 | `ticket-price-nested` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | selection | 嵌套选择：A 4.1.1.2 selection · O 2.2.1(a) branching、5d if/else · E 7.1.1(b) · C 11.2 IF |
| ch06 | `ticket-price-guard-clauses` | AQA OCR Edexcel CIE | Edexcel **改** | guard-clause | E 9.2.3(e) Using guard clause、9.2.3(c) minimising nested conditionals；其余三家未点名卫语句 |
| ch06 | `rps-winner` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | arithmetic | 用余数代替九个分支：A 4.1.1.3 remainders · O 5d MOD · E 7.1.3(a) · C 11.1 MOD |
| ch06 | `triangle-classifier` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | selection | 先排除非法输入再分类：A 4.1.1.2 selection · O 2.2.1(a) branching、5d if/else · E 7.1.1(b) · C 11.2 IF；A 4.1.1.5 OR |
| ch06 | `de-morgan-truth-table` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | boolean | A 4.6.5.1 De Morgan · O 1.4.3(c) · E 15.4.1(e)、5.3.2 truth table · C 15.2 Boolean algebra |
| ch06 | `match-case-commands` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | selection | CASE 结构：C 11.2 CASE · O 5d switch/case（指南澄清 select case）· A 4.1.1.2 selection · E 7.1.1(b) |
| ch07 | `range-forms` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | iteration | 计数循环：A 4.1.1.2 definite iteration · O 5d for…next · E 7.1.1(c) · C 11.2 count-controlled |
| ch07 | `sentinel-running-total` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | iteration | 哨兵条件循环：A 4.1.1.2 indefinite iteration · O 5d while · E 7.1.1(d) · C 11.2 pre-condition |
| ch07 | `break-and-continue` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | iteration | 带终止条件的循环（break / continue 是 Python 写法，R2）：A 4.1.1.2 iteration · O 2.2.1(a) iteration、5d · E 7.1.1(c)(d) · C 11.2 loops |
| ch07 | `find-max-and-index` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | iteration | 一趟遍历找最大值及位置：A 4.1.1.2 iteration · O 2.2.1(a) iteration、5d · E 7.1.1(c)(d) · C 11.2 loops；数组 A 4.2.1.2 |
| ch07 | `has-negative-flag` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | linear-search | 带标志的线性查找：A 4.3.4.1 · O 2.3.1(f) · E 5.2.1、10.3.1 · C 19.1（AS 10.2 附注）；E 10.3.1(b) early exit |
| ch07 | `has-negative-for-else` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | linear-search | 带提前退出的线性查找（for…else 是 Python 写法，R2）：A 4.3.4.1 · O 2.3.1(f) · E 5.2.1、10.3.1 · C 19.1（AS 10.2 附注）；E 10.3.1(b) |
| ch07 | `digit-sum-modulo` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | arithmetic | % 10 与 // 10 剥数位：A 4.1.1.3 · O 5d MOD / DIV · E 7.1.3(a) · C 11.1 |
| ch07 | `digit-sum-string` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | types | 经字符串转换逐位累加：A 4.1.1.7 string conversion · O 5d Casting · E 8.2.1(d) · C 11.1 |
| ch07 | `pair-sum-nested-loops` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 嵌套循环试每一对（与双指针版对照 Big-O）：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch07 | `pair-sum-two-pointers` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 双指针把 O(n²) 降到 O(n)：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch07 | `guess-number-attempts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | iteration | 条件循环 + 输入：A 4.1.1.2 · O 2.2.1(a) · E 7.1.1(d) · C 11.2 |
| ch07 | `fizzbuzz` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | selection | 选择的顺序 + MOD：A 4.1.1.2 selection · O 2.2.1(a) branching、5d if/else · E 7.1.1(b) · C 11.2 IF；MOD：A 4.1.1.3、O 5d |
| ch08 | `squares-append-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | list-ops | 循环 + append 建列表：A 4.1.1.2 iteration · O 2.2.1(a) iteration、5d · E 7.1.1(c)(d) · C 11.2 loops；E 8.2.4(b) insert |
| ch08 | `squares-comprehension` | AQA OCR Edexcel CIE | AQA Edexcel **改** | comprehension | 列表推导：E 20.1.2(l) List comprehension · A 4.4.2.2 附注 Python set comprehension；OCR、CIE 未点名推导式 |
| ch08 | `evens-comprehension` | AQA OCR Edexcel CIE | AQA Edexcel **改** | comprehension | 带 if 的推导：E 20.1.2(l) · A 4.4.2.2 set comprehension；OCR、CIE 未点名 |
| ch08 | `evens-filter` | AQA OCR Edexcel CIE | AQA Edexcel **改** | functional-hof | A 4.12.2.1 filter · E 20.1.2(g)(j) lambda / filter；OCR、CIE 未点名 |
| ch08 | `enumerate-and-zip` | AQA OCR Edexcel CIE | Edexcel **改** | functional-hof | E 20.1.2(n) Zip；enumerate / zip 其余三家未点名 |
| ch08 | `dict-and-set-comprehensions` | AQA OCR Edexcel CIE | AQA Edexcel **改** | comprehension | E 20.1.2(m) Dictionary comprehension · A 4.4.2.2 set comprehension；OCR、CIE 未点名 |
| ch08 | `flatten-and-transpose` | AQA OCR Edexcel CIE | AQA Edexcel **改** | comprehension | 嵌套推导：E 20.1.2(l) · A 4.4.2.2 comprehension；OCR、CIE 未点名 |
| ch08 | `generator-sum-any-all` | AQA OCR Edexcel CIE | Edexcel **改** | lazy | 生成器表达式 = 惰性求值：E 20.1.2(f) Lazy evaluation；其余三家未点名 |
| ch08 | `map-split-input` | AQA OCR Edexcel CIE | AQA Edexcel **改** | functional-hof | map 把每段转成 int：A 4.12.2.1 map · E 20.1.2(i) Map；OCR、CIE 未点名 map |
| ch08 | `sorted-min-max-with-key` | AQA OCR Edexcel CIE | AQA Edexcel **改** | functional-hof | 以函数作实参（高阶函数）：A 4.12.1.2 · E 20.1.2(c)(g)；OCR、CIE 未点名 |
| ch08 | `if-placement-in-comprehension` | AQA OCR Edexcel CIE | AQA Edexcel **改** | comprehension | 推导式里 if 的两种位置：E 20.1.2(l) · A 4.4.2.2 comprehension；OCR、CIE 未点名 |
| ch08 | `comprehension-or-loop` | AQA OCR Edexcel CIE | AQA Edexcel **改** | comprehension | 推导式与循环的取舍：E 20.1.2(l)(e) · A 4.4.2.2 comprehension；OCR、CIE 未点名 |
| ch09 | `factorial-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | recursion | 基例与递归步：A 4.1.1.16 · O 2.2.1(b) · E 5.1.3、10.4 · C 19.2 |
| ch09 | `factorial-iterative` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | recursion | 同一问题的迭代写法（递归与迭代对照）：O 2.2.1(b) compares to an iterative approach · C 19.2 when recursion is beneficial · A 4.1.1.16 · E 10.4 |
| ch09 | `fibonacci-naive` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | recursion | 按定义递归并数调用次数：A 4.1.1.16 · O 2.2.1(b) · E 5.1.3、10.4 · C 19.2 |
| ch09 | `fibonacci-memo-dict` | AQA OCR Edexcel CIE | OCR **改** | memoization | 记忆化 = 缓存：O 2.1.2(c) caching；记忆化其余三家未点名（递归只是载体） |
| ch09 | `fibonacci-lru-cache` | AQA OCR Edexcel CIE | OCR **改** | memoization | 用装饰器做记忆化 = 缓存：O 2.1.2(c)；其余三家未点名 |
| ch09 | `fibonacci-iterative` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | recursion | 无递归的迭代写法（与递归对照）：O 2.2.1(b) · A 4.1.1.2 · E 7.1.1(c) · C 19.2 |
| ch09 | `call-stack-unwinding` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | recursion | 调用栈的压入与展开：A 4.1.1.15 stack frames · O 2.2.1(b) · E 5.1.3 · C 19.2 use of stacks and unwinding |
| ch09 | `power-linear` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | recursion | 线性递归：A 4.1.1.16 · O 2.2.1(b) · E 5.1.3、10.4 · C 19.2 |
| ch09 | `power-by-squaring` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | recursion | 折半递归（分治、对数）：A 4.1.1.16 · O 2.2.1(b) · E 5.1.3、10.4 · C 19.2；O 2.2.2(d)、E 15.1.1(b) divide and conquer |
| ch09 | `towers-of-hanoi` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | recursion | 汉诺塔：A 4.1.1.16 · O 2.2.1(b) · E 5.1.3、10.4 · C 19.2 |
| ch09 | `permutations-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | recursion | 递归生成排列：A 4.1.1.16 · O 2.2.1(b) · E 5.1.3、10.4 · C 19.2；A 4.4.4.2 permutations |
| ch09 | `flatten-nested` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | recursion | 任意深度的递归展开：A 4.1.1.16 · O 2.2.1(b) · E 5.1.3、10.4 · C 19.2 |
| ch10 | `list-crud-methods` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | list-ops | 列表增删查：A 4.2.1.2 arrays (or equivalent) · O 1.4.2(a) lists · E 8.1.2(b)、8.2.4 · C 10.2 |
| ch10 | `slice-assignment` | AQA OCR Edexcel CIE | `[]` **改** | python-list | 切片赋值（替换一段、长度可变）是 Python 写法，四家都未点名 |
| ch10 | `copy-alias` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | references | 别名：A 4.1.1.1 pointer/reference · O 2.2.1(d) by reference · E 14.1.1(b) references · C 13.1 pointer、11.3 by reference |
| ch10 | `copy-shallow` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | references | 浅拷贝仍共享内层：A 4.1.1.1 pointer/reference · O 2.2.1(d) by reference · E 14.1.1(b) references · C 13.1 pointer、11.3 by reference |
| ch10 | `copy-deep` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | references | 深拷贝不共享：A 4.1.1.1 pointer/reference · O 2.2.1(d) by reference · E 14.1.1(b) references · C 13.1 pointer、11.3 by reference |
| ch10 | `grid-rows-shared` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | references | [row] * n 的每一行是同一个引用：A 4.1.1.1 pointer/reference · O 2.2.1(d) by reference · E 14.1.1(b) references · C 13.1 pointer、11.3 by reference |
| ch10 | `grid-row-col-totals` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | arrays-2d | 二维数组行列累加：A 4.2.1.2 · O 1.4.2(a) arrays up to 3 dimensions、5d 2D array · E 17.1.3 · C 10.2 2D array |
| ch10 | `matrix-multiply-loops` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | matrix-multiply | 矩阵乘法本身四家都未点名；本程序教的是三层下标循环遍历二维数组：A 4.2.1.2 · O 1.4.2(a) arrays up to 3 dimensions、5d 2D array · E 17.1.3 · C 10.2 2D array |
| ch10 | `matrix-multiply-zip` | AQA OCR Edexcel CIE | AQA Edexcel **改** | matrix-multiply | 矩阵乘法本身四家都未点名；本程序教的是「行·列 = 点积」与 zip / 推导式：A 4.2.8.1 dot product · E 20.1.2(l)(n)；OCR、CIE 未点名 |
| ch10 | `rotate-list-slice` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | list-ops | 两段拼接完成旋转（下标取模）：A 4.2.1.2 arrays (or equivalent) · O 1.4.2(a) lists · E 8.1.2(b)、8.2.4 · C 10.2；MOD A 4.1.1.3 |
| ch10 | `rotate-list-pop-append` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | list-ops | 取首放尾 k 次：A 4.2.1.2 arrays (or equivalent) · O 1.4.2(a) lists · E 8.1.2(b)、8.2.4 · C 10.2 |
| ch10 | `remove-while-iterating` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | list-ops | 边遍历边删除的错误与改法：A 4.2.1.2 arrays (or equivalent) · O 1.4.2(a) lists · E 8.1.2(b)、8.2.4 · C 10.2；E 8.2.4(e)(f) |
| ch11 | `dict-crud` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dictionary | 字典增删查改：A 4.2.7.1 · O 1.4.2(b) hash table（Python dict 即哈希表，R2）· E 8.1.2(c)、8.2.4 · C 19.1 dictionary |
| ch11 | `word-count-if-in` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dictionary | 字典计数（A 4.2.7.1 附注：数单词出现次数）：A 4.2.7.1 · O 1.4.2(b) hash table（Python dict 即哈希表，R2）· E 8.1.2(c)、8.2.4 · C 19.1 dictionary |
| ch11 | `word-count-get` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dictionary | 字典计数：A 4.2.7.1 · O 1.4.2(b) hash table（Python dict 即哈希表，R2）· E 8.1.2(c)、8.2.4 · C 19.1 dictionary |
| ch11 | `word-count-counter` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dictionary | 字典计数，Counter 只是工具（R3）：A 4.2.7.1 · O 1.4.2(b) hash table（Python dict 即哈希表，R2）· E 8.1.2(c)、8.2.4 · C 19.1 dictionary |
| ch11 | `group-by-setdefault` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dictionary | 字典分组：A 4.2.7.1 · O 1.4.2(b) hash table（Python dict 即哈希表，R2）· E 8.1.2(c)、8.2.4 · C 19.1 dictionary |
| ch11 | `group-by-defaultdict` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dictionary | 字典分组，defaultdict 只是工具（R3）：A 4.2.7.1 · O 1.4.2(b) hash table（Python dict 即哈希表，R2）· E 8.1.2(c)、8.2.4 · C 19.1 dictionary |
| ch11 | `roman-to-int-lookup` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dictionary | 查表：A 4.2.7.1 · O 1.4.2(b) hash table（Python dict 即哈希表，R2）· E 8.1.2(c)、8.2.4 · C 19.1 dictionary |
| ch11 | `set-operations` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | sets | A 4.4.2.2 集合运算 · E 8.2.7 · C 13.1 set；OCR 未点名集合 |
| ch11 | `dedupe-seen-set` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | sets | 集合成员判断：A 4.4.2.2 membership · E 8.2.7(a) · C 13.1 set；OCR 未点名集合 |
| ch11 | `dedupe-dict-fromkeys` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dictionary | 字典键唯一且保序：A 4.2.7.1 · O 1.4.2(b) hash table（Python dict 即哈希表，R2）· E 8.1.2(c)、8.2.4 · C 19.1 dictionary |
| ch11 | `tuple-keys-sparse-grid` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dictionary | 以 (行, 列) 为键的字典：A 4.2.7.1 · O 1.4.2(b) hash table（Python dict 即哈希表，R2）· E 8.1.2(c)、8.2.4 · C 19.1 dictionary |
| ch11 | `anagram-check-counts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dictionary | 字母计数再比较：A 4.2.7.1 · O 1.4.2(b) hash table（Python dict 即哈希表，R2）· E 8.1.2(c)、8.2.4 · C 19.1 dictionary |
| ch12 | `stack-list-methods` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | stack | 列表当栈：A 4.2.3.1 · O 1.4.2(b)、2.3.1(e) · E 4.3.1、8.2.5 · C 10.4、19.1 |
| ch12 | `stack-array-top-pointer` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | stack | 定长数组 + 栈顶指针（上溢 / 下溢）：A 4.2.3.1 · O 1.4.2(b)、2.3.1(e) · E 4.3.1、8.2.5 · C 10.4、19.1；A 4.2.3.1 test for stack full |
| ch12 | `bracket-matching` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | stack | 栈的应用：A 4.2.3.1 · O 1.4.2(b)、2.3.1(e) · E 4.3.1、8.2.5 · C 10.4、19.1 |
| ch12 | `rpn-evaluate` | AQA OCR Edexcel CIE | AQA CIE **改** | expression | A 4.3.3.1 RPN · C 16.2 RPN 求值；OCR、Edexcel 未点名 |
| ch12 | `infix-to-rpn` | AQA OCR Edexcel CIE | AQA **改** | expression | A 4.3.3.1 中缀↔RPN 转换；C 16.2 只点名 RPN 求值；OCR、Edexcel 未点名 |
| ch12 | `hot-potato-list` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | queue | 列表当队列：A 4.2.2.1 · O 1.4.2(b)、2.3.1(e) · E 4.3.2、8.2.6 · C 10.4、19.1 |
| ch12 | `hot-potato-deque` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | queue | 队列（deque 只是工具，R3）：A 4.2.2.1 · O 1.4.2(b)、2.3.1(e) · E 4.3.2、8.2.6 · C 10.4、19.1 |
| ch12 | `circular-queue-array` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | queue | 循环队列：A 4.2.2.1 circular · O 1.4.2(c) using arrays · E 14.1.5、18.2.1 · C 10.4 queue implemented using arrays |
| ch12 | `deque-both-ends` | AQA OCR Edexcel CIE | `[]` **改** | deque | 双端队列四家都未点名 |
| ch12 | `undo-redo-two-stacks` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | stack | 两个栈的应用：A 4.2.3.1 · O 1.4.2(b)、2.3.1(e) · E 4.3.1、8.2.5 · C 10.4、19.1 |
| ch12 | `queue-from-two-stacks` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | queue | 由别的结构实现队列：C 19.1 ADT from another ADT · O 1.4.2(c) · A 4.2.1.4 · E 4.3 |
| ch13 | `node-and-traverse` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | linked-list | 节点与遍历：O 1.4.2(b)(c)、2.3.1(e) · E 14.1.1、18.2.2 · C 10.4、19.1；AQA 学科内容没有链表（NEA Table 1 的 "Linked list maintenance" 是示例表，按 R6 不算） |
| ch13 | `insert-at-index` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | linked-list | 插入：O 1.4.2(b)(c)、2.3.1(e) · E 14.1.1、18.2.2 · C 10.4、19.1；AQA 学科内容没有链表（NEA Table 1 的 "Linked list maintenance" 是示例表，按 R6 不算） |
| ch13 | `delete-by-value` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | linked-list | 删除：O 1.4.2(b)(c)、2.3.1(e) · E 14.1.1、18.2.2 · C 10.4、19.1；AQA 学科内容没有链表（NEA Table 1 的 "Linked list maintenance" 是示例表，按 R6 不算） |
| ch13 | `reverse-iterative` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | linked-list | 指针反转（遍历中改指针）：O 1.4.2(b)(c)、2.3.1(e) · E 14.1.1、18.2.2 · C 10.4、19.1；AQA 学科内容没有链表（NEA Table 1 的 "Linked list maintenance" 是示例表，按 R6 不算） |
| ch13 | `reverse-recursive` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | linked-list | 递归反转：O 1.4.2(b)(c)、2.3.1(e) · E 14.1.1、18.2.2 · C 10.4、19.1；AQA 学科内容没有链表（NEA Table 1 的 "Linked list maintenance" 是示例表，按 R6 不算） |
| ch13 | `doubly-linked-list` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | linked-list | 双向链表仍是链表：O 1.4.2(b)(c)、2.3.1(e) · E 14.1.1、18.2.2 · C 10.4、19.1；AQA 学科内容没有链表（NEA Table 1 的 "Linked list maintenance" 是示例表，按 R6 不算） |
| ch13 | `stack-as-linked-list` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | stack | 栈 ADT（链表实现）：A 4.2.3.1 · O 1.4.2(b)、2.3.1(e) · E 4.3.1、8.2.5 · C 10.4、19.1 |
| ch13 | `linked-list-in-arrays` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | linked-list | 用数组实现链表：O 1.4.2(c) using arrays · C 10.4 linked list implemented using arrays · E 14.1.1；AQA 无链表 |
| ch13 | `linked-list-iter-len` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | linked-list | 特殊方法协议作用在链表上（协议本身未点名）：O 1.4.2(b)(c)、2.3.1(e) · E 14.1.1、18.2.2 · C 10.4、19.1；AQA 学科内容没有链表（NEA Table 1 的 "Linked list maintenance" 是示例表，按 R6 不算） |
| ch13 | `linked-list-vs-list` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | linked-list | A 4.2.1.4 static vs dynamic structures · O 1.4.2(b) · E 14.1.1 · C 10.4 |
| ch14 | `binary-tree-nodes` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | tree | A 4.2.5.1 binary tree · O 1.4.2(b) · E 14.1.4 · C 19.1 binary tree |
| ch14 | `traversals-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | tree-traversal | A 4.3.2.1 · O 2.3.1(e) · E 14.1.4(c)、18.2.8；CIE 19.1 只点名二叉树的查找 / 插入 |
| ch14 | `traversals-iterative` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | tree-traversal | A 4.3.2.1 · O 2.3.1(e) · E 14.1.4(c)、18.2.8；CIE 19.1 只点名二叉树的查找 / 插入 |
| ch14 | `bst-insert-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | bst | BST 插入：A 4.2.5.1 附注 binary search tree · O 1.4.2(b)(c) · E 18.2.7(b) Insert · C 19.1 insert into binary tree |
| ch14 | `bst-insert-iterative` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | bst | BST 插入：A 4.2.5.1 · O 1.4.2(c) · E 18.2.7(b) · C 19.1 |
| ch14 | `bst-search` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | bst | BST 查找：A 4.3.4.3 binary tree search · O 1.4.2(b) · E 18.2.7(b) Find · C 19.1 find an item in a binary tree |
| ch14 | `bst-delete` | AQA OCR Edexcel CIE | OCR Edexcel **改** | bst-delete | O 1.4.2(c) remove data · E 14.1.4(c) Delete；CIE 19.1 删除只点名栈 / 队列 / 链表；AQA 未点名 |
| ch14 | `tree-in-arrays` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | bst | 用数组表示 BST：O 1.4.2(c) using arrays · C 19.1 binary tree from built-in types · A 4.2.5.1 · E 14.1.4 |
| ch14 | `heap-sift-up-down` | AQA OCR Edexcel CIE | `[]` **改** | heap | 堆四家都未点名（AQA 点名的是优先队列 ADT） |
| ch14 | `priority-queue-heapq` | AQA OCR Edexcel CIE | AQA **改** | priority-queue | A 4.2.1.4、4.2.2.1 priority queue；其余三家未点名 |
| ch14 | `priority-queue-scan-min` | AQA OCR Edexcel CIE | AQA **改** | priority-queue | A 4.2.1.4、4.2.2.1 priority queue；其余三家未点名 |
| ch14 | `expression-tree` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | expression | 由 RPN 建表达式树、后序求值、中序打印：A 4.3.2.1 附注 expression tree、4.3.3.1 · O 2.3.1(e) post-order、1.4.2(b) stack/tree · E 14.1.4(c) traverse · C 16.2 RPN evaluation |
| ch15 | `linear-search-for` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | linear-search | 线性查找：A 4.3.4.1 · O 2.3.1(f) · E 5.2.1、10.3.1 · C 19.1（AS 10.2 附注） |
| ch15 | `linear-search-sentinel` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | linear-search | 带哨兵的线性查找：A 4.3.4.1 · O 2.3.1(f) · E 5.2.1、10.3.1 · C 19.1（AS 10.2 附注） |
| ch15 | `linear-search-sorted-early-exit` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | linear-search | 有序表提前退出：A 4.3.4.1 · O 2.3.1(f) · E 5.2.1、10.3.1 · C 19.1（AS 10.2 附注）；E 10.3.1(c)(d) 明写 |
| ch15 | `binary-search-iterative` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | binary-search | 迭代二分：A 4.3.4.2 · O 2.3.1(f) · E 5.2.2、10.3.2 · C 19.1；E 5.2.2(a) |
| ch15 | `binary-search-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | binary-search | 递归二分：A 4.3.4.2 · O 2.3.1(f) · E 5.2.2、10.3.2 · C 19.1；E 5.2.2(b) |
| ch15 | `binary-search-bisect` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | binary-search | 二分查找（bisect 只是工具，R3）：A 4.3.4.2 · O 2.3.1(f) · E 5.2.2、10.3.2 · C 19.1 |
| ch15 | `binary-search-leftmost` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | binary-search | 找第一个匹配的二分变体：A 4.3.4.2 · O 2.3.1(f) · E 5.2.2、10.3.2 · C 19.1 |
| ch15 | `count-occurrences-sorted` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | binary-search | 两次二分定边界：A 4.3.4.2 · O 2.3.1(f) · E 5.2.2、10.3.2 · C 19.1 |
| ch15 | `binary-search-trace-table` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | binary-search | 二分查找的跟踪表：A 4.3.4.2 · O 2.3.1(f) · E 5.2.2、10.3.2 · C 19.1；E 5.1.2 trace table |
| ch15 | `hash-search-linear-probing` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | hashing | A 4.2.6.1 collisions / rehashing · O 1.4.2(b) hash table · E 18.2.5(b) Linear probing · C 13.2 hashing algorithms |
| ch16 | `bubble-sort-basic` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | sort-bubble | A 4.3.5.1 · O 2.3.1(f) · E 5.2.3、10.3.3 · C 10.2、19.1 |
| ch16 | `bubble-sort-early-exit` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | sort-bubble | A 4.3.5.1 · O 2.3.1(f) · E 10.3.3(b) Exit with no swap · C 19.1 |
| ch16 | `selection-sort` | AQA OCR Edexcel CIE | `[]` **改** | sort-other | 选择排序四家都未点名 |
| ch16 | `insertion-sort` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | sort-insertion | O 2.3.1(f) · E 5.2.4、10.3.4 · C 19.1；AQA 4.3.5 只有冒泡与归并 |
| ch16 | `shell-sort` | AQA OCR Edexcel CIE | `[]` **改** | sort-other | 希尔排序四家都未点名 |
| ch16 | `merge-sort-top-down` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | sort-merge | A 4.3.5.2 · O 2.3.1(f) · E 15.2.1、21.1.1；CIE 19.1 只有冒泡与插入 |
| ch16 | `merge-sort-bottom-up` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | sort-merge | A 4.3.5.2 · O 2.3.1(f) · E 15.2.1；CIE 19.1 只有冒泡与插入 |
| ch16 | `quicksort-lomuto` | AQA OCR Edexcel CIE | OCR Edexcel **改** | sort-quick | O 2.3.1(f) · E 15.2.2、21.1.2；AQA、CIE 未点名快排 |
| ch16 | `quicksort-comprehension` | AQA OCR Edexcel CIE | OCR Edexcel **改** | sort-quick | O 2.3.1(f) · E 15.2.2、21.1.2；AQA、CIE 未点名快排 |
| ch16 | `counting-sort` | AQA OCR Edexcel CIE | `[]` **改** | sort-other | 计数排序四家都未点名 |
| ch16 | `sort-stability` | AQA OCR Edexcel CIE | `[]` **改** | sort-other | 排序稳定性四家都未点名 |
| ch17 | `adjacency-list-and-matrix` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | graph | A 4.2.4.1 · O 1.4.2(b)(c) · E 14.1.3(b)、18.2.6；CIE 19.1 不要求图的代码、未点名表示法 |
| ch17 | `bfs-order` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | graph-traversal | A 4.3.1.1 · O 1.4.2(c) traverse · E 14.1.3(d)；CIE 19.1 / 18.1 不要求写图的搜索 |
| ch17 | `bfs-shortest-path` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | graph-traversal | A 4.3.1.1 附注 BFS 求无权图最短路 · O 1.4.2(c) · E 14.1.3(d)；CIE 未点名 |
| ch17 | `dfs-recursive` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | graph-traversal | A 4.3.1.1 · O 1.4.2(c) · E 14.1.3(d)；CIE 未点名 |
| ch17 | `dfs-iterative-stack` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | graph-traversal | A 4.3.1.1 · O 1.4.2(c) · E 14.1.3(d)；CIE 未点名 |
| ch17 | `dijkstra-array-scan` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dijkstra | A 4.3.6.1 · O 2.3.1(f) · E 15.2.3(a)、21.2.1 · C 18.1 |
| ch17 | `dijkstra-heapq` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | dijkstra | A 4.3.6.1 · O 2.3.1(f) · E 15.2.3(a)、21.2.1 · C 18.1 |
| ch17 | `topological-sort-kahn` | AQA OCR Edexcel CIE | `[]` **改** | graph-other | 拓扑排序四家都未点名 |
| ch17 | `mst-prim` | AQA OCR Edexcel CIE | `[]` **改** | graph-other | 最小生成树四家都未点名 |
| ch17 | `mst-kruskal` | AQA OCR Edexcel CIE | `[]` **改** | graph-other | 最小生成树四家都未点名 |
| ch17 | `a-star-grid` | AQA OCR Edexcel CIE | OCR Edexcel CIE **改** | astar | O 2.3.1(f) A* · E 15.2.3(b) · C 18.1；AQA 未点名 A* |
| ch18 | `grid-paths-memo` | AQA OCR Edexcel CIE | OCR **改** | memoization | O 2.1.2(c) caching（记忆化即缓存）；动态规划四家都未点名 |
| ch18 | `grid-paths-table` | AQA OCR Edexcel CIE | `[]` **改** | dp | 动态规划四家都未点名 |
| ch18 | `knapsack-01-table` | AQA OCR Edexcel CIE | `[]` **改** | dp | 动态规划四家都未点名 |
| ch18 | `knapsack-01-1d` | AQA OCR Edexcel CIE | `[]` **改** | dp | 动态规划四家都未点名 |
| ch18 | `lcs-length` | AQA OCR Edexcel CIE | `[]` **改** | dp | 动态规划四家都未点名 |
| ch18 | `edit-distance` | AQA OCR Edexcel CIE | `[]` **改** | dp | 动态规划四家都未点名 |
| ch18 | `coin-change-greedy` | AQA OCR Edexcel CIE | Edexcel **改** | greedy | E 15.1.1(c) greedy algorithms；其余三家未点名 |
| ch18 | `coin-change-dp` | AQA OCR Edexcel CIE | `[]` **改** | dp | 动态规划四家都未点名 |
| ch18 | `activity-selection` | AQA OCR Edexcel CIE | Edexcel **改** | greedy | E 15.1.1(c) greedy algorithms；其余三家未点名 |
| ch18 | `huffman-code-lengths` | AQA OCR Edexcel CIE | Edexcel **改** | greedy | E 15.1.1(c) greedy；Huffman 四家都未点名（压缩只点名 RLE / 字典编码） |
| ch19 | `loop-shape-counts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 由循环形状数步数：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch19 | `growth-rate-table` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 增长率对照：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O；A 4.4.4.2 linear / polynomial / exponential / logarithmic |
| ch19 | `search-comparison-counts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 线性与二分的比较次数：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O；O 2.3.1(c) 澄清 best / worst case |
| ch19 | `insertion-shift-counts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 插入排序的移动次数（核心是复杂度分析）：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch19 | `merge-vs-insertion-counts` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 两种排序的比较次数对照：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch19 | `doubling-experiment` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 倍增实验看增长率：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch19 | `has-duplicates-nested` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | O(n²) 两两比较：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch19 | `has-duplicates-sorted` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 先排序 O(n log n)：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch19 | `has-duplicates-set` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 集合 O(n)（核心是复杂度对照，集合只是工具）：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch19 | `max-subarray-quadratic` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | O(n²)：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch19 | `max-subarray-divide-conquer` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 分治 O(n log n)：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O；O 2.2.2(d)、E 15.1.1(b) |
| ch19 | `max-subarray-kadane` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | complexity | 一趟 O(n)：A 4.4.4.1–4.4.4.3 · O 2.3.1(b)(c)(d) · E 15.3.1、5.1.1 · C 19.1 Big O |
| ch20 | `clean-text-normalise` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | strings | 文本清洗：A 4.1.1.7 · O 1.2.4(b)、5d String Handling（指南澄清：string handling）· E 8.2.2 · C 11.1 string manipulation functions |
| ch20 | `word-frequency-file` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | text-files | 读文件 + 字典计数：A 4.2.1.3 · O 1.2.4(b)、5d Reading to and Writing from Files · E 8.2.3 · C 10.3、20.2；字典 A 4.2.7.1 附注 word count |
| ch20 | `regex-find-numbers` | AQA OCR Edexcel CIE | AQA Edexcel **改** | regex | A 4.4.2.3 · E 18.1.2(a) re finding；OCR、CIE 未点名正则 |
| ch20 | `date-format-regex` | AQA OCR Edexcel CIE | AQA Edexcel **改** | regex | A 4.4.2.3 · E 18.1.2(b) re validating；OCR、CIE 未点名正则 |
| ch20 | `date-format-manual` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | strings | 不用正则的格式校验（切分、长度、全是数字）：A 4.1.1.7 · O 1.2.4(b)、5d String Handling（指南澄清：string handling）· E 8.2.2 · C 11.1 string manipulation functions |
| ch20 | `name-swap-regex-sub` | AQA OCR Edexcel CIE | AQA Edexcel **改** | regex | A 4.4.2.3 · E 18.1.2；OCR、CIE 未点名正则 |
| ch20 | `json-round-trip` | AQA OCR Edexcel CIE | AQA **改** | json | A 4.9.4.10 "Compare JSON (Java script object notation) with XML"；OCR 只在 1.3.2(b) 的指南澄清里举例，原话 "won't be specifically asked"，按 R5 / R6 不写；Edexcel、CIE 未点名 |
| ch20 | `json-load-fixture` | AQA OCR Edexcel CIE | AQA **改** | json | A 4.9.4.10 JSON；OCR 同上不写；Edexcel、CIE 未点名 |
| ch20 | `config-parser` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | text-files | 逐行解析设置文件进字典：A 4.2.1.3 · O 1.2.4(b)、5d Reading to and Writing from Files · E 8.2.3 · C 10.3、20.2；字符串 A 4.1.1.7 |
| ch20 | `tokenise-loop` | AQA OCR Edexcel CIE | OCR CIE **改** | lexing | O 1.2.2(e) lexical analysis · C 16.2 lexical analysis；AQA 4.6.3、Edexcel 13.1 未点名编译阶段 |
| ch20 | `tokenise-regex` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | lexing | A 4.4.2.3 regex · O 1.2.2(e) lexical analysis · E 18.1.2 re · C 16.2 lexical analysis |
| ch20 | `log-line-parser` | AQA OCR Edexcel CIE | AQA Edexcel **改** | regex | A 4.4.2.3 · E 18.1.2(a)；OCR、CIE 未点名正则 |
| ch21 | `monte-carlo-pi-random` | AQA OCR Edexcel CIE | AQA Edexcel **改** | random | AQA 4.1.1.8 random number generation · Edexcel 8.2.1(c) Randomisation；OCR、CIE 未点名随机数 |
| ch21 | `monte-carlo-pi-grid` | AQA OCR Edexcel CIE | `[]` **改** | numeric-approx | 网格数点估 π：数值近似四家都未点名，也不用随机 |
| ch21 | `dice-sum-frequencies` | AQA OCR Edexcel CIE | AQA Edexcel **改** | random | AQA 4.1.1.8 random number generation · Edexcel 8.2.1(c) Randomisation；OCR、CIE 未点名随机数 |
| ch21 | `random-walk-1d` | AQA OCR Edexcel CIE | AQA Edexcel **改** | random | AQA 4.1.1.8 random number generation · Edexcel 8.2.1(c) Randomisation；OCR、CIE 未点名随机数 |
| ch21 | `gamblers-ruin` | AQA OCR Edexcel CIE | AQA Edexcel **改** | random | AQA 4.1.1.8 random number generation · Edexcel 8.2.1(c) Randomisation；OCR、CIE 未点名随机数 |
| ch21 | `queue-single-server` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | queue | 队列的应用：A 4.2.2.1 · O 1.4.2(b)、2.3.1(e) · E 4.3.2、8.2.6 · C 10.4、19.1 |
| ch21 | `game-of-life-grid` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | arrays-2d | 二维数组上数邻居（生命游戏在 AQA 只是 NEA 示例，R6 不算）：A 4.2.1.2 · O 1.4.2(a) arrays up to 3 dimensions、5d 2D array · E 17.1.3 · C 10.2 2D array |
| ch21 | `game-of-life-set` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | sets | 集合表示活细胞：A 4.4.2.2 · E 8.1.2(f)、8.2.7 · C 13.1 set；OCR 未点名集合 |
| ch21 | `sir-epidemic-steps` | AQA OCR Edexcel CIE | `[]` **改** | numeric-approx | 传染病模型四家都未点名 |
| ch21 | `traffic-light-fsm` | AQA OCR Edexcel CIE | AQA CIE **改** | fsm | A 4.4.2.1 FSM · C 12.2 state-transition diagrams；OCR、Edexcel 未点名 |
| ch21 | `shuffle-fisher-yates` | AQA OCR Edexcel CIE | AQA Edexcel **改** | random | AQA 4.1.1.8 random number generation · Edexcel 8.2.1(c) Randomisation；OCR、CIE 未点名随机数 |
| ch21 | `shuffle-naive-biased` | AQA OCR Edexcel CIE | AQA Edexcel **改** | random | AQA 4.1.1.8 random number generation · Edexcel 8.2.1(c) Randomisation；OCR、CIE 未点名随机数 |
| ch22 | `ttt-winner-lines` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | arrays-2d | 赢线表（元组的列表）+ 循环：A 4.2.1.2 · O 1.4.2(a) arrays up to 3 dimensions、5d 2D array · E 17.1.3 · C 10.2 2D array |
| ch22 | `ttt-winner-loops` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | arrays-2d | 下标算术遍历行 / 列 / 对角线：A 4.2.1.2 · O 1.4.2(a) arrays up to 3 dimensions、5d 2D array · E 17.1.3 · C 10.2 2D array |
| ch22 | `ttt-game-loop` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | validation | 读入、校验、换人的主循环：A 4.1.1.2 · O 2.2.1(a) · E 7.1.1(d) · C 11.2 |
| ch22 | `ttt-minimax` | AQA OCR Edexcel CIE | Edexcel **改** | game-tree | E 15.1.1(a) brute force / exhaustive；minimax / 博弈树四家都未点名 |
| ch22 | `guess-computer-halving` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | binary-search | 二分猜数：A 4.3.4.2 · O 2.3.1(f) · E 5.2.2、10.3.2 · C 19.1 |
| ch22 | `hangman-state` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | strings | 字符串处理与选择：A 4.1.1.7 · O 1.2.4(b)、5d String Handling（指南澄清：string handling）· E 8.2.2 · C 11.1 string manipulation functions |
| ch22 | `merge-row-2048-compress` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | list-ops | 三趟列表处理：A 4.2.1.2 arrays (or equivalent) · O 1.4.2(a) lists · E 8.1.2(b)、8.2.4 · C 10.2 |
| ch22 | `merge-row-2048-stack` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | stack | 栈的应用：A 4.2.3.1 · O 1.4.2(b)、2.3.1(e) · E 4.3.1、8.2.5 · C 10.4、19.1 |
| ch22 | `board-move-2048` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | arrays-2d | 翻转 / 转置二维数组把四个方向归成一个：A 4.2.1.2 · O 1.4.2(a) arrays up to 3 dimensions、5d 2D array · E 17.1.3 · C 10.2 2D array |
| ch22 | `minesweeper-place-count` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | arrays-2d | 二维数组数邻居（随机布雷只是驱动）：A 4.2.1.2 · O 1.4.2(a) arrays up to 3 dimensions、5d 2D array · E 17.1.3 · C 10.2 2D array |
| ch22 | `minesweeper-flood-reveal` | AQA OCR Edexcel CIE | AQA OCR Edexcel **改** | graph-traversal | BFS：A 4.3.1.1 · O 1.4.2(c) · E 14.1.3(d)；CIE 未点名 |
| ch22 | `pig-dice-two-players` | AQA OCR Edexcel CIE | AQA Edexcel **改** | random | A 4.1.1.8 随机数、4.12.1.2 函数作值 · E 8.2.1(c)、20.1.2(b)；OCR、CIE 未点名 |
| ch23 | `gradebook-classes` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | oop-core | 两个类分工 + 字典查找：A 4.1.2.3 · O 1.2.4(e)、2.2.1(f)、5d Object-Oriented · E 13.1.1、20.1.1 · C 20.1 |
| ch23 | `gradebook-json-persist` | AQA OCR Edexcel CIE | AQA **改** | json | 对象 ↔ dict ↔ JSON 持久化：A 4.9.4.10 JSON；OCR 同 json-round-trip 不写；Edexcel、CIE 未点名 JSON |
| ch23 | `competition-ranking` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | iteration | 对排序结果一趟遍历定名次：A 4.1.1.2 iteration · O 2.2.1(a) iteration、5d · E 7.1.1(c)(d) · C 11.2 loops；E 8.2.4(f) traverse |
| ch23 | `inventory-stock` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | records | 记录 / 类：A 4.1.1.1、4.1.2.3 · O 1.4.2(a)、2.2.1(f) · E 8.1.2(d)、20.1.1 · C 10.1、20.1 |
| ch23 | `inventory-csv-restock` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | files | 读 CSV、逐行校验、写回：A 4.2.1.3 · O 1.2.4(b)、5d Reading to and Writing from Files · E 8.2.3 · C 10.3、20.2 |
| ch23 | `bank-transfer-atomic` | AQA OCR Edexcel CIE | OCR **改** | atomicity | O 1.3.2(f) Transaction processing, ACID (Atomicity…)；AQA 4.10.5 讲的是并发控制，其余两家未点名原子性 |
| ch23 | `money-in-pence` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | float-precision | 二进制浮点表示不了 0.1：A 4.5.4.5 rounding errors · E 11.3.1 floating-point、8.2.1(a) rounding · C 13.3 rounding errors；OCR 1.4.1(g)(h) 未点名舍入误差 |
| ch23 | `money-decimal` | AQA OCR Edexcel CIE | AQA Edexcel CIE **改** | float-precision | A 4.5.4.5 rounding errors · E 18.1.1(a)(c) Decimal module / class · C 13.3 rounding errors；OCR 未点名舍入误差 |
| ch23 | `library-loans` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | oop-core | 实体类与规则类分工：A 4.1.2.3 · O 1.2.4(e)、2.2.1(f)、5d Object-Oriented · E 13.1.1、20.1.1 · C 20.1 |
| ch23 | `menu-driven-cli` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | validation | while True 菜单 + 选择 + 校验：A 4.1.1.2 · O 2.2.1(a)、5d switch/case · E 7.1.1(b)(d) · C 11.2 |
| ch23 | `test-data-normal-boundary-erroneous` | AQA OCR Edexcel CIE | AQA OCR Edexcel CIE | testing | A 4.13.1.4 · E 9.2.3(a)、9.3.1 · C 12.3 · O H446 3.2.3(a) NEA 测试数据（R6：NEA 要求条目算点名；H446 未列 normal/boundary/erroneous 的分类名） |
| ch24 | `ndarray-create` | AQA OCR Edexcel CIE | Edexcel **改** | numpy | Edexcel 18.1.3 NumPy(a) Array：建数组、dtype、shape |
| ch24 | `reshape-and-axes` | AQA OCR Edexcel CIE | Edexcel **改** | numpy | Edexcel 18.1.3 NumPy(d) Shape：reshape 与 axis |
| ch24 | `slice-is-a-view` | AQA OCR Edexcel CIE | Edexcel **改** | numpy | Edexcel 18.1.3 NumPy(a) Array：切片是视图 |
| ch24 | `boolean-mask-filter` | AQA OCR Edexcel CIE | Edexcel **改** | numpy | Edexcel 18.1.3 NumPy(a)(b) Array / Arithmetic：比较得布尔数组再取值 |
| ch24 | `broadcasting-table` | AQA OCR Edexcel CIE | Edexcel **改** | numpy | Edexcel 18.1.3 NumPy(b)(d) Arithmetic / Shape：广播 |
| ch24 | `mean-variance-loop` | AQA OCR Edexcel CIE | Edexcel **改** | central-tendency | E 18.1.4(b) measures of central tendency（均值）；方差四家都未点名 |
| ch24 | `mean-variance-vectorised` | AQA OCR Edexcel CIE | Edexcel **改** | numpy | Edexcel 18.1.3 NumPy(b) Arithmetic：向量化求均值 / 方差 |
| ch24 | `numpy-scalar-repr` | AQA OCR Edexcel CIE | Edexcel **改** | numpy | Edexcel 18.1.3 NumPy(a)(c) Array / Rounding：NumPy 标量的类型与打印 |
| ch24 | `aggregate-by-axis` | AQA OCR Edexcel CIE | Edexcel **改** | numpy | Edexcel 18.1.3 NumPy(b)(d)：按 axis 聚合 |
| ch25 | `matrix-product-matmul` | AQA OCR Edexcel CIE | Edexcel **改** | matrix-multiply | 矩阵乘法本身四家都未点名；本程序教的是 NumPy 的 @ 与 * 之别：E 18.1.3(b) Arithmetic |
| ch25 | `dot-product-angle` | AQA OCR Edexcel CIE | AQA Edexcel **改** | vectors | A 4.2.8.1 附注 dot product、求夹角 · E 18.1.3(b) |
| ch25 | `linear-system-solve` | AQA OCR Edexcel CIE | `[]` **改** | linalg | 解线性方程组：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch25 | `linear-system-inverse` | AQA OCR Edexcel CIE | `[]` **改** | linalg | 逆矩阵解方程组：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch25 | `determinant-and-identity` | AQA OCR Edexcel CIE | `[]` **改** | linalg | 行列式与单位矩阵：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch25 | `transform-2d-points` | AQA OCR Edexcel CIE | Edexcel **改** | numpy | Edexcel 18.1.3 NumPy(b) Arithmetic：点阵乘变换矩阵；AQA 4.2.8.1 只点名向量加法（平移）与数乘（缩放） |
| ch25 | `eigen-2x2` | AQA OCR Edexcel CIE | `[]` **改** | linalg | 特征值：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch25 | `rng-generator-basics` | AQA OCR Edexcel CIE | AQA Edexcel **改** | random | A 4.1.1.8 random number generation · E 8.2.1(c)、18.1.3 |
| ch25 | `markov-weather` | AQA OCR Edexcel CIE | `[]` **改** | linalg | 马尔可夫链：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch26 | `series-and-dataframe` | AQA OCR Edexcel CIE | Edexcel **改** | pandas | Edexcel 18.1.4 Pandas(c) Information about data |
| ch26 | `read-csv-inspect` | AQA OCR Edexcel CIE | Edexcel **改** | pandas | Edexcel 18.1.4 Pandas(a)(c) Load CSV、Information about data |
| ch26 | `filter-mask` | AQA OCR Edexcel CIE | Edexcel **改** | pandas | Edexcel 18.1.4 Pandas：按条件筛行（数据分析） |
| ch26 | `filter-query` | AQA OCR Edexcel CIE | Edexcel **改** | pandas | Edexcel 18.1.4 Pandas：query 筛行（数据分析） |
| ch26 | `group-mean-groupby` | AQA OCR Edexcel CIE | Edexcel **改** | pandas | Edexcel 18.1.4 Pandas(b) Measures of central tendency（分组均值） |
| ch26 | `group-mean-pivot-table` | AQA OCR Edexcel CIE | Edexcel **改** | pandas | Edexcel 18.1.4 Pandas(b)（透视表求均值） |
| ch26 | `missing-fill-mean` | AQA OCR Edexcel CIE | Edexcel **改** | pandas | Edexcel 18.1.4 Pandas(b)(d) Clean data、均值填补 |
| ch26 | `merge-left-join` | AQA OCR Edexcel CIE | Edexcel **改** | pandas | Edexcel 18.1.4 Pandas：左连接两张表（数据分析） |
| ch26 | `sort-two-keys` | AQA OCR Edexcel CIE | Edexcel **改** | pandas | Edexcel 18.1.4 Pandas：按两列排序（数据分析） |
| ch27 | `line-plot-pyplot` | AQA OCR Edexcel CIE | Edexcel **改** | dataviz | 折线图（pyplot 接口）：Edexcel 6.1.2(f) Visualisation（数据科学的工具与技术）；matplotlib 四家都未点名 |
| ch27 | `line-plot-axes` | AQA OCR Edexcel CIE | Edexcel **改** | dataviz | 折线图（Figure / Axes 接口）：Edexcel 6.1.2(f) Visualisation（数据科学的工具与技术）；matplotlib 四家都未点名 |
| ch27 | `scatter-sizes-colours` | AQA OCR Edexcel CIE | Edexcel **改** | dataviz | 散点图：Edexcel 6.1.2(f) Visualisation（数据科学的工具与技术）；matplotlib 四家都未点名 |
| ch27 | `bar-chart-labels` | AQA OCR Edexcel CIE | Edexcel **改** | dataviz | 条形图：Edexcel 6.1.2(f) Visualisation（数据科学的工具与技术）；matplotlib 四家都未点名 |
| ch27 | `histogram-bins` | AQA OCR Edexcel CIE | Edexcel **改** | dataviz | 直方图：Edexcel 6.1.2(f) Visualisation（数据科学的工具与技术）；matplotlib 四家都未点名 |
| ch27 | `subplots-grid` | AQA OCR Edexcel CIE | Edexcel **改** | dataviz | 子图网格：Edexcel 6.1.2(f) Visualisation（数据科学的工具与技术）；matplotlib 四家都未点名 |
| ch27 | `annotate-and-style` | AQA OCR Edexcel CIE | Edexcel **改** | dataviz | 样式与标注：Edexcel 6.1.2(f) Visualisation（数据科学的工具与技术）；matplotlib 四家都未点名 |
| ch27 | `savefig-size-dpi` | AQA OCR Edexcel CIE | Edexcel **改** | dataviz | 保存图像：Edexcel 6.1.2(f) Visualisation（数据科学的工具与技术）；matplotlib 四家都未点名 |
| ch27 | `plot-from-dataframe` | AQA OCR Edexcel CIE | Edexcel **改** | dataviz | DataFrame 画到 Axes：Edexcel 6.1.2(f) Visualisation（数据科学的工具与技术）；matplotlib 四家都未点名 |
| ch28 | `mean-median-mode` | AQA OCR Edexcel CIE | Edexcel **改** | central-tendency | E 18.1.4(b) measures of central tendency；其余三家未点名 |
| ch28 | `population-vs-sample-sd` | AQA OCR Edexcel CIE | `[]` **改** | stats | 标准差：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch28 | `pearson-by-formula` | AQA OCR Edexcel CIE | `[]` **改** | stats | 相关系数：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch28 | `pearson-corrcoef` | AQA OCR Edexcel CIE | `[]` **改** | stats | 相关系数：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch28 | `regression-by-formula` | AQA OCR Edexcel CIE | CIE **改** | regression | C 18.1 "regression methods in machine learning"（AI / 机器学习语境下点名）；其余三家未点名 |
| ch28 | `regression-polyfit` | AQA OCR Edexcel CIE | CIE **改** | regression | C 18.1 "regression methods in machine learning"（AI / 机器学习语境下点名）；其余三家未点名 |
| ch28 | `sampling-distribution-of-mean` | AQA OCR Edexcel CIE | `[]` **改** | stats | 抽样分布：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch28 | `normal-probabilities` | AQA OCR Edexcel CIE | `[]` **改** | stats | 正态概率：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch28 | `z-test-one-sample` | AQA OCR Edexcel CIE | `[]` **改** | stats | z 检验：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch28 | `t-statistic-by-hand` | AQA OCR Edexcel CIE | `[]` **改** | stats | t 统计量：四家 CS 考纲都未点名（属数学）；NumPy 只是工具 |
| ch29 | `window-and-game-loop` | AQA OCR Edexcel CIE | `[]` **改** | pygame | 游戏循环骨架：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `move-per-frame` | AQA OCR Edexcel CIE | `[]` **改** | pygame | 每帧固定位移：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `move-with-dt` | AQA OCR Edexcel CIE | `[]` **改** | pygame | 按 dt 移动：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `draw-primitives-grid` | AQA OCR Edexcel CIE | `[]` **改** | pygame | pygame 画图元：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `colour-lerp` | AQA OCR Edexcel CIE | AQA **改** | vectors | A 4.2.8.1 附注 convex combination（按比例混合两个颜色向量）；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `keyboard-move-clamped` | AQA OCR Edexcel CIE | `[]` **改** | pygame | 键盘事件：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `mouse-click-buttons` | AQA OCR Edexcel CIE | `[]` **改** | pygame | 鼠标事件：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `text-centred` | AQA OCR Edexcel CIE | `[]` **改** | pygame | pygame 字体：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch29 | `screen-states` | AQA OCR Edexcel CIE | AQA CIE **改** | fsm | (屏幕, 事件) → 屏幕 的状态转移表：A 4.4.2.1 FSM · C 12.2 state-transition diagrams；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `sprite-subclass-group` | AQA OCR Edexcel CIE | `[]` **改** | pygame | pygame Sprite / Group 机制（用到继承，但核心是库机制）：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `image-save-and-load` | AQA OCR Edexcel CIE | `[]` **改** | pygame | pygame 图像存取与色键：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `animation-frames` | AQA OCR Edexcel CIE | `[]` **改** | pygame | 按时钟换帧：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `sprite-sheet-frames` | AQA OCR Edexcel CIE | `[]` **改** | pygame | 切精灵图：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch30 | `rect-collision-colliderect` | AQA OCR Edexcel CIE | `[]` **改** | collision | 矩形碰撞：碰撞检测四家都未点名 |
| ch30 | `rect-collision-manual` | AQA OCR Edexcel CIE | `[]` **改** | collision | 手写矩形重叠判断：碰撞检测四家都未点名 |
| ch30 | `circle-collision` | AQA OCR Edexcel CIE | `[]` **改** | collision | 圆形碰撞：碰撞检测四家都未点名 |
| ch30 | `group-collide-kill` | AQA OCR Edexcel CIE | `[]` **改** | collision | groupcollide：碰撞检测四家都未点名 |
| ch30 | `mask-pixel-collision` | AQA OCR Edexcel CIE | `[]` **改** | collision | 像素级碰撞：碰撞检测四家都未点名 |
| ch31 | `diagonal-unnormalised` | AQA OCR Edexcel CIE | AQA **改** | vectors | A 4.2.8.1 向量与数乘（缩放）；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `diagonal-normalised` | AQA OCR Edexcel CIE | AQA **改** | vectors | A 4.2.8.1 向量与数乘（缩放）；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `mouse-steer-toward` | AQA OCR Edexcel CIE | AQA **改** | vectors | A 4.2.8.1 向量；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `thrust-max-speed` | AQA OCR Edexcel CIE | AQA **改** | vectors | A 4.2.8.1 向量加法与数乘；pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `gravity-jump` | AQA OCR Edexcel CIE | `[]` **改** | physics | 重力与跳跃（速度是标量）：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `bounce-walls` | AQA OCR Edexcel CIE | `[]` **改** | physics | 碰墙反弹：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `friction-per-frame` | AQA OCR Edexcel CIE | `[]` **改** | physics | 每帧摩擦：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `friction-dt` | AQA OCR Edexcel CIE | `[]` **改** | physics | 按秒摩擦：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch31 | `screen-wrap` | AQA OCR Edexcel CIE | `[]` **改** | physics | 取模回绕：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `pong-full` | AQA OCR Edexcel CIE | `[]` **改** | pygame-game | 完整小游戏 Pong：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `pong-ai-paddle` | AQA OCR Edexcel CIE | `[]` **改** | pygame-game | 限速 AI 球拍：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `snake-full` | AQA OCR Edexcel CIE | `[]` **改** | pygame-game | 完整小游戏 Snake：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `snake-move-list` | AQA OCR Edexcel CIE | `[]` **改** | pygame-game | 贪吃蛇一步（列表）：核心是游戏步进逻辑，pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `snake-move-deque` | AQA OCR Edexcel CIE | `[]` **改** | pygame-game | 贪吃蛇一步（deque；双端队列四家也未点名）：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `breakout-full` | AQA OCR Edexcel CIE | `[]` **改** | pygame-game | 完整小游戏 Breakout：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `invaders-full` | AQA OCR Edexcel CIE | `[]` **改** | pygame-game | 完整小游戏 Space Invaders：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `bullet-cooldown` | AQA OCR Edexcel CIE | `[]` **改** | pygame-game | 开火冷却计时：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch32 | `lives-and-invulnerability` | AQA OCR Edexcel CIE | `[]` **改** | pygame-game | 生命与无敌时间：pygame / 游戏循环 / 事件驱动四家都未点名 |
| ch33 | `led-image-string` | — | `[]` | microbit-io | 5×5 亮度表拼成 Image 字符串，核心是字符串格式（R1）；四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch33 | `scroll-and-show` | — | `[]` | microbit-io | 点阵滚动与显示、sleep 毫秒：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch33 | `button-press-edges` | — | `[]` | microbit-io | 按钮上升沿计数（is_pressed / was_pressed）：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch33 | `accelerometer-tilt` | — | `[]` | microbit-io | 加速度计倾斜判定：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch33 | `spirit-level-column` | — | `[]` | microbit-io | 读数映射到点阵列：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch33 | `compass-point` | — | `[]` | microbit-io | 航向换八方位：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch33 | `radio-packet-csv` | — | `[]` | radio-text | 无线电文本报文 split 解析：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具）；字符串解析未单独点名 |
| ch33 | `radio-packet-bytes` | — | AQA OCR Edexcel CIE | twos-complement | 有符号温度按一字节收发、>127 减 256 即 8 位补码：A 4.5.4.3 · O 1.4.1(c) · E 2.1.3 · C 1.1 |
| ch33 | `music-note-frequency` | — | `[]` | microbit-io | 十二平均律算音符频率：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch34 | `blink-gpio-pin` | — | `[]` | pico-io | GPIO 输出闪灯：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch34 | `pwm-duty-percent` | — | `[]` | pico-io | 百分比换 duty_u16：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch34 | `pwm-servo-angle` | — | `[]` | pico-io | 角度换舵机脉宽：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch34 | `adc-temperature` | — | `[]` | pico-io | ADC 读数换摄氏度：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch34 | `pin-irq-counter` | — | AQA OCR Edexcel CIE | interrupts | 硬件中断与短小的中断处理函数：A 4.7.3.6 · O 1.2.1(c) · E 11.2.1(e)、1.2.2(c) · C 4.1 |
| ch34 | `timer-periodic-callback` | — | `[]` | pico-io | 定时器回调：四家都不点名 micro:bit / Pico 硬件 API（R3：库是工具） |
| ch34 | `elapsed-naive-subtract` | — | `[]` | ticks-wrap | 计数器回绕时直接相减出错：四家点名补码的表示换算与 MOD 运算符，读不出覆盖「回绕差值」（R5） |
| ch34 | `elapsed-ticks-diff` | — | `[]` | ticks-wrap | ticks_diff 的环形算术：同上（R5） |
| ch34 | `gpio-bitmask` | — | AQA OCR Edexcel CIE | bitwise | 掩码置位 / 清零 / 翻转：A 4.7.3.5 · O 1.4.1(i) · E 2.2.2、7.1.3(d) · C 4.3（点名「用位掩码控制设备」） |

## 待办

- ~~**加门**~~ **已做**：`boards_map_check`（`python/scripts/gates/library.py`，D·库）要求本附录表与各 `chapter.json` 的 `boards` 逐行一致——id 集合双向相同、章对得上、boards 集合相同、概念组与依据不为空、无重复行。**新程序必须在本附录加一行**，否则门红。（复审 S-1。）
