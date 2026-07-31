# MathViz 新工具 Claude Code Prompt 命令集

## 使用说明

* 使用 /math-viz-tool skill；
* 先读取最新源码和设计规范；
* 先简要确定教学设计，然后直接实现，不等待确认；
* 不只输出设计方案，必须完成代码、验证和注册；
* 使用subagent来进行工具的开发，因为每个工具都是独立的，因此可以并行做开发任务；
* 按批次来调度subagent，完成一个批次再进入下一个批次；
* 每完成一个任务后自动 push 到远程仓库。

---

# 第一批：A-Level Mathematics 核心缺口

## 01 · 函数、变换、复合与反函数

```text
使用仓库内的 math-viz-tool skill，为 MathViz 新增一个完整的交互式数学教学工具。

不要只写方案。先读取：

- .claude/skills/math-viz-tool/SKILL.md
- design-system/math-viz-design-system.md
- design-system/math-viz-starter.html
- CLAUDE.md
- outputs/parametric-curves-3d.html
- outputs/inverse-trig-essence-3d.html

先简短说明最终教学设计，然后直接完成实现，不等待我的确认。

工具元信息：

- id：function-mapping-transformations-3d
- 文件：outputs/function-mapping-transformations-3d.html
- 中文标题：函数的本质 · 映射、变换与逆
- 英文标题：The Essence of Functions · Maps, Transformations & Inverses
- category：func
- 如果 index.html 中不存在 func 分类，新增：
  - 中文：函数、数列与代数
  - 英文：Functions, Sequences & Algebra

核心顿悟：

函数不是一条公式或一张曲线，而是从输入集合到输出集合的唯一对应关系；函数图像、变换、复合和反函数只是同一映射结构的不同视角。

至少设计以下四个 SCENES：

1. 映射 · 输入到输出
   - 左侧输入轴、右侧输出轴，中间以连线表示 x → f(x)。
   - 同时在空间中提升出点集 (x,f(x))。
   - 顿悟视角：沿映射连线方向观察时，映射网络应塌缩成通常的函数图像。
   - 展示垂直线检验与“每个输入只有一个输出”的含义。

2. 图像变换
   - 展示基础函数 f(x) 与 y = a f(b(x−h)) + k。
   - 参数至少包括 a、b、h、k。
   - 清晰区分输入空间变换和输出空间变换。
   - 强调水平伸缩中的 1/b 效果为什么看起来与参数方向相反。
   - 可以提供二次、三次、绝对值三个函数预设，但不要让界面过载。

3. 函数复合
   - 展示 x → g(x) → f(g(x)) 的两级机器。
   - 使用同一批探针点贯穿两级映射。
   - 顿悟视角：从侧面观察，两次映射串联成一条完整轨迹。
   - 显示 f∘g 与 g∘f 一般不相等。

4. 反函数
   - 同时绘制 y=f(x)、y=f⁻¹(x) 和 y=x。
   - 通过交换输入和输出，让图像绕 y=x 镜像。
   - 使用一个单调函数展示真正的反函数。
   - 使用二次函数展示为什么必须限制定义域才能得到反函数。
   - 明确提示 f⁻¹(x) 不等于 1/f(x)。

建议参数：

- functionFamily
- probeX
- a、b、h、k
- compositionMix 或复合过程进度
- inverseBranch

不要为了动画而强行让所有对象运动。探针点可以随共享时钟移动，函数参数由滑杆静态控制。

数学公式、读数、Canvas 标注及所有说明必须完整中英双语。保持曲线配色不超过四条主曲线，并遵守 six places, one colour。

完成后：

- 实际在浏览器打开并检查所有页签、滑杆和顿悟视角；
- 检查非单射函数的分支限制是否数学正确；
- 执行嵌入脚本 node --check；
- 检查中英文切换、URL lang 参数和移动端面板；
- 注册到 tools.json；
- 同步 index.html 内 TOOLS；
- 添加 README 工具表行；
- 使用 1.0.0 初始版本和当前 Starter engine version；
- 不要修改共享引擎，push 远程仓库。
```

---

## 02 · 指数与对数

```text
使用仓库内的 math-viz-tool skill，为 MathViz 新增一个指数与对数的交互式教学工具。

先完整读取 skill、设计系统、Starter 和以下现有工具：

- outputs/e-essence-3d.html
- outputs/limit-essence-3d.html
- outputs/calculus-essence-3d.html

先用几句话确定教学设计，然后直接实现，不等待确认，也不要只提供方案。

工具元信息：

- id：exponential-logarithm-essence-3d
- 文件：outputs/exponential-logarithm-essence-3d.html
- 中文标题：指数与对数的本质
- 英文标题：The Essence of Exponentials & Logarithms
- category：func
- 如果 func 分类不存在，新增“函数、数列与代数 / Functions, Sequences & Algebra”。

总顿悟：

指数函数把相等的输入步长变成相等的倍数变化；对数则反过来回答“需要经历多少次倍增”。对数不是另一个孤立运算，而是指数映射的逆。

至少实现四个 SCENES：

1. 重复乘法与指数增长
   - 展示离散序列 bⁿ 和连续曲线 bˣ。
   - 每走一个相同的 x 步长，高度乘以相同的 b。
   - 将“固定增加量”和“固定增长比例”并列比较。
   - 顿悟视角应让等距输入层和成倍输出层直接对齐。

2. 指数与对数互为逆
   - 同时绘制 y=bˣ、y=log_b x 和 y=x。
   - 一个联动点在两条曲线上交换坐标。
   - 顿悟视角：正视 x·y 时，两条曲线关于 y=x 完全镜像。
   - 处理 b>1 和 0<b<1 两种情况，但避免 b=1。

3. 对数把乘法变成加法
   - 直观展示 log(xy)=log x+log y。
   - 可以把正数轴提升到 log 空间，使乘法缩放转变为平移。
   - 展示科学计数法、数量级和对数坐标。
   - 使用有限、安全的正值范围，明确 x>0。

4. 倍增、半衰期与自然对数
   - 展示 y=y₀e^{kt}。
   - k>0 为增长，k<0 为衰减。
   - 标出 doubling time ln2/k 和 half-life ln2/|k|。
   - 与现有 e 工具形成连接，但不要重复“e 的六条来源”。

建议参数：

- base b，范围避开 1
- exponent x
- initial y₀
- rate k
- timeScale 或 probe position
- discreteSteps

需要正确处理：

- b=1 附近；
- 0<b<1 时曲线方向；
- log 定义域；
- 极大和极小数值的裁剪；
- y=0 垂直渐近线。

完成浏览器实测、node --check、i18n、移动端检查，并同步 tools.json、index.html 和 README。初始版本 1.0.0。不要修改共享引擎，自动 push。
```

---

## 03 · 数列、级数与部分和

```text
使用 math-viz-tool skill 新增一个“数列与级数”工具。

开始前读取完整 skill、设计系统、Starter，以及：

- outputs/recurrence-iteration-dynamics-3d.html
- outputs/limit-essence-3d.html
- outputs/phi-essence-3d.html

本工具不能重复现有递推工具中的蛛网图、不动点和 Newton–Raphson。重点应放在 A-Level 所需的项、部分和、等差、等比和无穷级数。

工具元信息：

- id：sequences-series-essence-3d
- 文件：outputs/sequences-series-essence-3d.html
- 中文标题：数列与级数的本质
- 英文标题：The Essence of Sequences & Series
- category：func
- func 不存在时新增对应分类。

核心顿悟：

数列是定义在离散整数上的函数；级数不是数列本身，而是这些项不断累积形成的另一条数列。aₙ→0 是级数收敛的必要条件，却不是充分条件。

至少实现以下四个 SCENES：

1. 等差与等比
   - 并列展示：
     aₙ=a₁+(n−1)d
     gₙ=a₁rⁿ⁻¹
   - 等差是相同高度差，等比是相同高度比例。
   - 顿悟视角让等距台阶和按比例伸缩清晰可见。

2. 项与部分和
   - 同时显示 aₙ 和 Sₙ=Σaₖ。
   - 每加入一项，部分和高度增加对应的 aₙ。
   - 正项、负项和交替项需要表现出方向。
   - 明确“项趋近什么”和“和趋近什么”是两个问题。

3. 无穷等比级数
   - 展示长度或面积不断按 r 缩小并填充剩余空间。
   - 推导 S=a+rS，从而 S=a/(1−r)。
   - 拖动 r 穿过 −1、0、1，展示收敛、交替收敛和发散。
   - |r|=1 边界必须正确处理。

4. 项趋零但级数仍发散
   - 比较几何级数和调和级数。
   - 两者项都趋近 0，但部分和行为不同。
   - 可使用 n 轴上的高度和部分和轨迹，不必计算极大 n。
   - 清楚标注这是必要条件与充分条件的区别。

建议参数：

- sequenceType
- a₁
- d
- r
- nMax
- animationSpeed

所有离散点、柱体、部分和曲线必须有统一语义配色。使用共享时钟逐项增加时，历史记录必须保存当时真实值。

完成实际浏览器检查、node --check、双语和移动端验证，并注册 tools.json、index.html、README。版本 1.0.0，不修改共享引擎，自动 push。
```

---

## 04 · 二项式定理与 Pascal 三角形

```text
使用 math-viz-tool skill 新增一个二项式定理和 Pascal 三角形教学工具。

先读取完整规范、Starter，并参考：

- outputs/gaussian-essence-3d.html
- outputs/phi-essence-3d.html
- outputs/recurrence-iteration-dynamics-3d.html

工具元信息：

- id：binomial-pascal-probability-3d
- 文件：outputs/binomial-pascal-probability-3d.html
- 中文标题：二项式定理 · Pascal 三角形与概率
- 英文标题：The Binomial Theorem · Pascal’s Triangle & Probability
- category：prob

核心顿悟：

同一个二项式系数 C(n,k)，既是代数展开中的系数，也是 Pascal 三角形中的节点，也是 n 次二选一路径中恰好选择 k 次的路径数。

至少实现以下四个 SCENES：

1. 几何展开
   - 先以 (a+b)² 的面积分割说明 a²+2ab+b²。
   - 再推广到 (a+b)ⁿ 的项结构。
   - 不需要试图真实绘制高维几何，但要清楚表现系数和幂次变化。

2. Pascal 三角形
   - 每个节点由左上和右上两个节点相加。
   - n 层沿第三维排开。
   - 顿悟视角：正视三角形得到 Pascal 结构；从侧面观察则看到递推层级。
   - 高亮第 n 行以及第 k 个系数。

3. 路径计数
   - 从顶部经过 n 次左/右选择到达第 k 个位置。
   - 高亮所有或抽样展示到达该节点的路径。
   - 路径数量必须等于 C(n,k)。

4. 二项分布
   - 为每条左/右路径赋予概率 p 和 1−p。
   - 得到 P(X=k)=C(n,k)pᵏ(1−p)ⁿ⁻ᵏ。
   - 展示 n 和 p 如何改变分布形状。
   - 与现有 Gaussian 工具建立“n 增大后趋向钟形”的链接，但不要重复完整 CLT 场景。

建议参数：

- n，建议上限 10 或 12
- k
- p
- a
- b
- animationStep

注意性能，不要尝试绘制 2ⁿ 条完整路径。可对路径进行聚合、采样或只绘制当前目标节点的代表路径。

完成 browser verification、node --check、i18n、mobile、版本和注册流程。初始版本 1.0.0，不修改共享引擎，自动 push。
```

---

## 05 · 条件概率与贝叶斯更新

```text
使用 math-viz-tool skill 新增一个条件概率和贝叶斯定理工具。

先读取完整规范和 Starter，并参考：

- outputs/gaussian-essence-3d.html
- outputs/kelly-essence-3d.html

本工具使用质量检测、垃圾邮件筛选或机器故障检测作为现实案例，不使用赌博作为主要场景。

工具元信息：

- id：conditional-probability-bayes-3d
- 文件：outputs/conditional-probability-bayes-3d.html
- 中文标题：条件概率与贝叶斯更新
- 英文标题：Conditional Probability & Bayesian Updating
- category：prob

核心顿悟：

条件概率就是先删掉不符合条件的世界，再把剩余概率重新归一化；贝叶斯定理则是在同一张联合概率图上交换观察方向。

至少实现以下四个 SCENES：

1. 面积模型
   - 用一个总面积表示完整样本空间。
   - A、B 及交集 A∩B 由矩形或区域表示。
   - 条件化到 B 时，非 B 区域淡出，B 区域放大并重新归一化。
   - 顿悟视角应直接显示：
     P(A|B)=P(A∩B)/P(B)。

2. 树状图与联合概率
   - 第一层按 A/非 A 分支，第二层按 B/非 B 分支。
   - 每条路径的概率等于沿途概率相乘。
   - 同一叶节点应与面积模型中的对应区域联动。

3. 贝叶斯反转
   - 使用“产品缺陷率、检测灵敏度和误报率”案例。
   - 展示：
     先验 → 似然 → 后验。
   - 显示 P(defect|positive) 与 P(positive|defect) 完全不同。
   - 使用自然频数，例如 10,000 件产品，帮助理解基准率。

4. 独立与互斥
   - 独立：条件化后比例不变。
   - 互斥：交集为空。
   - 通过同一面积图改变区域位置和面积，展示两者不是同一概念。

建议参数：

- baseRate
- sensitivity
- specificity
- P(A)
- P(B|A)
- P(B|notA)
- sampleSize 只用于自然频数显示

确保所有概率保持在 [0,1]，总概率归一化，极端参数不会造成除零或不可读布局。

完成数学验证、浏览器交互检查、node --check、中英双语、移动端和注册流程。版本 1.0.0，不修改引擎，自动 push。
```

---

## 06 · 随机变量、期望与方差

```text
使用 math-viz-tool skill 新增随机变量、期望和方差教学工具。

先读取完整设计规范、Starter，并参考：

- outputs/gaussian-essence-3d.html
- outputs/linear-essence-3d.html

工具元信息：

- id：random-variable-expectation-variance-3d
- 文件：outputs/random-variable-expectation-variance-3d.html
- 中文标题：随机变量、期望与方差
- 英文标题：Random Variables · Expectation & Variance
- category：prob

总顿悟：

随机变量把随机结果映射成数；期望值是概率质量在数轴上的平衡点，而方差衡量概率质量相对这个平衡点的平方距离。

至少实现以下四个 SCENES：

1. 从结果到随机变量
   - 左侧展示有限样本空间，右侧展示数轴。
   - 多个不同结果可以映射到同一个数值。
   - 明确随机变量是函数，不是“随机变化的未知字母”。

2. 期望作为重心
   - 在数轴上放置若干概率质量块。
   - 质量大小为 pᵢ，位置为 xᵢ。
   - 一根平衡杆在 E(X)=Σxᵢpᵢ 处平衡。
   - 顿悟视角：正视数轴时，期望点就是概率质量的重心。
   - 允许展示“期望值不一定是可能结果”。

3. 方差与标准差
   - 从每个 xᵢ 到 μ 画距离。
   - 展示平方距离加权：
     Var(X)=Σpᵢ(xᵢ−μ)²。
   - 与平均绝对距离作直觉对比，但不要混淆定义。
   - 标准差作为方差的平方根，恢复原单位。

4. 线性变换与独立求和
   - 展示 Y=aX+b 时：
     E(Y)=aE(X)+b
     Var(Y)=a²Var(X)
   - 可再用两个简单独立随机变量展示期望相加、方差相加。
   - 不要暗示非独立变量的方差总能直接相加。

建议使用几个离散分布预设：公平骰子、偏斜分布、双峰分布。参数包括分布预设、偏斜程度、缩放 a、平移 b。

保持概率总和为 1。若使用用户可调概率，必须实现归一化或采用不会破坏总和的参数化方式。

完成浏览器、数学、i18n、mobile、node --check 和注册验证。版本 1.0.0，不改共享引擎，自动 push。
```

---

## 07 · 力、约束与自由体图

```text
使用 math-viz-tool skill 新增一个 A-Level Mechanics 自由体图工具。

先读取完整规范、Starter，并参考：

- outputs/kinematics-projectile-3d.html
- outputs/energy-phase-portrait-3d.html
- outputs/linear-essence-3d.html

工具元信息：

- id：forces-free-body-diagrams-3d
- 文件：outputs/forces-free-body-diagrams-3d.html
- 中文标题：力、约束与自由体图
- 英文标题：Forces, Constraints & Free-Body Diagrams
- category：mech

核心顿悟：

自由体图不是把公式贴到物体上，而是先隔离研究对象，只保留外界对它施加的力；坐标轴应根据约束方向选择，而不是永远固定为水平和竖直。

至少实现以下四个 SCENES：

1. 斜面上的物体
   - 展示重力 mg、支持力 R、摩擦力 F 和外加力。
   - 可在世界坐标和沿斜面坐标之间切换。
   - 把 mg 分解为 mg sinθ 和 mg cosθ。
   - 顿悟视角：沿斜面坐标正视时，重力分量三角形与运动方向完全对齐。

2. 支持力不是固定等于 mg
   - 改变斜面角度和额外垂直力。
   - 展示 R 如何由垂直于约束面的加速度条件决定。
   - 包含水平面、斜面和外力压向/拉离平面的情况。

3. 静摩擦与极限摩擦
   - 静摩擦应自动响应平衡需求，直到达到 μR。
   - 未达到极限时不能错误显示 F=μR。
   - 达到极限后标出 impending motion。
   - 动摩擦可作为简化扩展，但要明确模型。

4. 连接粒子系统
   - 两个质量通过轻绳连接，可使用桌面+悬挂质量或双斜面。
   - 展示张力、共享加速度和约束关系。
   - 分别显示两个自由体图，而不是把整个系统的力混在一起。

建议参数：

- m₁、m₂
- inclineAngle
- appliedForce
- forceAngle
- μ
- gravity
- animationSpeed

力箭头长度需要采用可读缩放，并在读数中显示真实数值，避免箭头过大。力的语义配色必须稳定。

完成所有极端参数测试、浏览器交互、node --check、i18n、mobile 和注册。版本 1.0.0，不修改引擎，自动 push。
```

---

## 08 · 力矩、平衡与质心

```text
使用 math-viz-tool skill 新增一个“力矩、平衡与质心”工具。

先读取完整规范、Starter，并参考：

- outputs/energy-phase-portrait-3d.html
- outputs/linear-essence-3d.html
- outputs/kinematics-projectile-3d.html

工具元信息：

- id：torque-equilibrium-centre-mass-3d
- 文件：outputs/torque-equilibrium-centre-mass-3d.html
- 中文标题：力矩、平衡与质心
- 英文标题：Moments, Equilibrium & Centre of Mass
- category：mech

核心顿悟：

力矩取决于力到支点的垂直距离，而不是物体上的普通距离；平衡要求合力与合力矩同时为零。质心的重力作用线越过支撑区域时，系统就会倾倒。

至少实现以下四个 SCENES：

1. 力矩与垂直距离
   - 一根刚性杆绕支点转动。
   - 一个力可改变作用点和作用方向。
   - 清楚展示：
     τ=rF sinθ=F×perpendicular distance。
   - 顿悟视角：正视杆所在平面时，同时看到位置向量、力和垂距。
   - 当作用线穿过支点时，力矩为零。

2. 刚体平衡
   - 杆上有两个或三个可移动载荷。
   - 显示顺时针与逆时针力矩。
   - 平衡时两侧力矩读数相等。
   - 同时显示竖直合力条件，避免只讲力矩平衡。

3. 质心
   - 多个质点或非均匀杆组成系统。
   - 质心位置由加权平均得到：
     x̄=Σmᵢxᵢ/Σmᵢ。
   - 改变质量和位置，质心联动移动。
   - 可展示悬挂法：重力铅垂线的交点确定质心。

4. 倾倒与支撑区域
   - 方块或简单物体放在有限宽度底座上。
   - 改变倾角或外力。
   - 重力作用线落在支撑区域内时稳定，越过边界时产生倾倒力矩。
   - 标出临界状态。

建议参数：

- pivotPosition
- masses 和 positions
- forceMagnitude
- forceAngle
- baseWidth
- tiltAngle

不要加入复杂刚体动力学；重点是 A-Level 静力学直觉。完成 browser、node check、i18n、mobile 和注册。版本 1.0.0，不修改引擎，自动 push。
```

---

# 第二批：Further Mathematics 与大学过渡

## 09 · 证明、量词与数学归纳法

```text
使用 math-viz-tool skill 新增一个数学证明与逻辑教学工具。

先完整读取 skill、设计规范和 Starter。这个主题不应被强行包装成持续运动的三维曲线；允许主要使用静态的逻辑层、证明树、集合区域和离散状态，但仍应使用 MathViz 的可旋转空间、统一视觉语言和顿悟视角。

工具元信息：

- id：proof-logic-induction-3d
- 文件：outputs/proof-logic-induction-3d.html
- 中文标题：证明的本质 · 量词、反例与归纳
- 英文标题：The Essence of Proof · Quantifiers, Counterexamples & Induction
- category：disc
- 如果 disc 不存在，新增：
  - 中文：证明、离散数学与算法
  - 英文：Proof, Discrete Mathematics & Algorithms

核心顿悟：

数学证明不是检查大量例子，而是建立一个覆盖所有允许情况的必然推理结构；全称命题只需一个反例即可推翻，而存在命题只需一个有效见证即可成立。

至少实现以下四个 SCENES：

1. 命题与逆否
   - 展示 P→Q、Q→P、¬P→¬Q、¬Q→¬P。
   - 用集合包含关系或状态点展示原命题与逆否命题等价，而逆命题通常不等价。
   - 提供一个简单预设，如“能被 4 整除 → 是偶数”。

2. 量词顺序
   - 可视化 ∀x∃y 和 ∃y∀x 的区别。
   - 使用有限网格作为直觉模型，每个 x 是否能找到自己的 y，与是否存在一个统一 y。
   - 明确有限演示只是帮助理解语义，不是替代一般证明。

3. 反例与反证法
   - 一个全称命题对应一片允许状态区域。
   - 找到一个反例时，命题整体被击穿。
   - 反证法展示“假设结论为假 → 推理链进入矛盾状态”。

4. 数学归纳法
   - 使用多米诺骨牌或层级桥梁。
   - 基础步骤确认第一层成立。
   - 归纳步骤展示 P(k)→P(k+1)。
   - 两者同时存在才覆盖所有自然数。
   - 明确“只证明归纳步骤但没有基础步骤”为什么不够。

建议参数：

- propositionPreset
- finiteDomainSize
- witness
- inductionN
- proofStep

z 轴可用于表示逻辑层级或推理时间，而不是人为物理时间。顿悟视角应让证明依赖关系塌缩成清晰的二维证明图。

完成浏览器验证、逻辑准确性检查、node --check、i18n、mobile 和完整注册。版本 1.0.0，不修改共享引擎，自动 push。
```

---

## 10 · 线性方程组、秩与零空间

```text
使用 math-viz-tool skill 新增线性方程组、秩和零空间教学工具。

先读取完整规范、Starter，并参考：

- outputs/linear-essence-3d.html
- outputs/lines-planes-3d.html

不要重复现有工具已经完成的向量加法、叉积、矩阵网格变形、行列式和特征向量。本工具重点是“解空间”和矩阵映射中的维度。

工具元信息：

- id：linear-systems-rank-nullspace-3d
- 文件：outputs/linear-systems-rank-nullspace-3d.html
- 中文标题：线性方程组、秩与零空间
- 英文标题：Linear Systems, Rank & Null Spaces
- category：alg

核心顿悟：

解线性方程组是在寻找多个约束几何对象的公共交集；秩表示真正独立的约束或输出方向数量，零空间则是矩阵完全压扁掉的输入方向。

至少实现以下四个 SCENES：

1. 二元方程组
   - 两条直线对应两个方程。
   - 展示唯一解、无解、无穷多解。
   - 系数变化时，交点和行列式同步变化。
   - det=0 时两条约束不再独立。

2. 三元方程组
   - 三个平面在三维空间中相交。
   - 提供预设：一点、一条线、一个平面、无公共交集。
   - 顿悟视角应展示“解集的维度”。

3. 列空间与可解性
   - 将 Ax=b 解释为用矩阵列向量的线性组合构造 b。
   - b 在列空间中时有解；不在列空间中时无精确解。
   - 与后续最小二乘工具形成接口，但本工具不展开拟合。

4. 零空间与降维
   - 展示不同输入向量经 A 映射到相同输出。
   - 两个输入之差位于 Null(A)。
   - 顿悟视角：沿零空间方向观察，整条输入线被压成同一个点。
   - 显示 rank + nullity = number of columns 的直觉。

参数可采用矩阵预设加有限的系数滑杆，避免面板出现过多控件。至少支持 2×2 和一个 3×3/3×2 示例。

所有矩阵约定、行列顺序和 Ax=b 方向必须一致。处理近奇异矩阵时使用容差并明确显示“接近退化”。

完成数学验证、浏览器查看、node check、双语、移动端和注册。版本 1.0.0，不改引擎，自动 push。
```

---

## 11 · 基底与换坐标

```text
使用 math-viz-tool skill 新增“基底与换坐标”教学工具。

先完整读取规范、Starter，并参考：

- outputs/linear-essence-3d.html
- outputs/dft-essence-3d.html
- outputs/polar-cartesian-3d.html

不要重复一般矩阵变形。重点是区分几何向量本身和描述它的坐标数字。

工具元信息：

- id：basis-change-coordinates-3d
- 文件：outputs/basis-change-coordinates-3d.html
- 中文标题：基底与换坐标的本质
- 英文标题：The Essence of Basis & Change of Coordinates
- category：alg

核心顿悟：

向量是空间中的几何对象，坐标只是用某组基底对它进行描述的数字。同一个向量不动，改变基底后坐标会改变；换基不是把向量变了，而是换了一套语言。

至少实现以下四个 SCENES：

1. 标准基底分解
   - 向量 v=v₁e₁+v₂e₂。
   - 拖动向量，显示在标准基底上的两个分量。
   - 分量投影和向量和保持联动。

2. 斜基底
   - 允许改变两根基向量的长度和夹角。
   - 世界中的 v 保持固定，但坐标 [v]ᴮ 实时变化。
   - 顿悟视角：正视 x·y 时清楚看到不同平行四边形分解得到同一个 v。

3. 换基矩阵
   - 展示基底矩阵 B=[b₁ b₂]。
   - 世界坐标满足 v=B[v]ᴮ。
   - 坐标恢复为 [v]ᴮ=B⁻¹v。
   - 将两次变换表示为“坐标 → 世界 → 新坐标”的接力。

4. 好基底与坏基底
   - 当两根基向量接近平行时，坐标值急剧增大并对微小变化敏感。
   - 展示基底退化和条件不良的直觉。
   - 不必全面讲 condition number，但可在读数中给出简单指标。

建议参数：

- vectorAngle、vectorLength
- basis1Angle、basis1Length
- basis2Angle、basis2Length
- morph 或 basisInterpolation

对接近平行、行列式接近 0 的情况必须稳定处理，显示无法形成基底，而不是产生 NaN。

完成浏览器检查、node check、i18n、mobile 和注册。版本 1.0.0，不修改引擎，自动 push。
```

---

## 12 · 最小二乘与正交投影

```text
使用 math-viz-tool skill 新增最小二乘与正交投影教学工具。

先读取完整规范、Starter，并参考：

- outputs/linear-essence-3d.html
- outputs/gradient-contours-surface-3d.html
- outputs/gaussian-essence-3d.html

工具元信息：

- id：least-squares-orthogonal-projection-3d
- 文件：outputs/least-squares-orthogonal-projection-3d.html
- 中文标题：最小二乘与正交投影
- 英文标题：Least Squares & Orthogonal Projection
- category：alg

核心顿悟：

当 Ax=b 没有精确解时，最小二乘不是随便找一个“看起来接近”的答案，而是把 b 正交投影到 A 的列空间；残差与整个列空间垂直。

至少实现以下四个 SCENES：

1. 向量投影
   - 向量 b 投影到一条直线或一个平面。
   - 显示投影 p 和残差 r=b−p。
   - r 与子空间垂直。
   - 顿悟视角应让直角关系一眼可见。

2. 列空间中的最接近点
   - 使用一个 3×2 矩阵，其列空间是三维空间中的平面。
   - b 不在平面内。
   - A x̂ 是平面上离 b 最近的点。
   - 直接展示 Aᵀ(b−Ax̂)=0。

3. 直线拟合
   - 显示若干二维数据点和直线 y=mx+c。
   - 每个残差应为竖直残差，平方和作为误差曲面。
   - 拖动 m、c 看 SSE 改变，并标出最优点。
   - 不要把几何最短距离和普通线性回归的竖直残差混为一谈。

4. 正规方程
   - 将回归问题连接到矩阵形式。
   - 展示 AᵀA x̂=Aᵀb。
   - 直观说明正规方程来自“残差与列空间正交”。

建议参数：

- projectionDimension 或 preset
- vector b
- lineSlope、intercept
- noiseAmount
- datasetPreset
- morph

不需要实现大型数值库；使用稳定的小矩阵闭式计算或高斯消元。接近奇异时要有容差和提示。

完成浏览器、数学、node check、i18n、mobile、注册和版本检查。版本 1.0.0，不改引擎，自动 push。
```

---

## 13 · 优化、凸性与梯度下降

```text
使用 math-viz-tool skill 新增优化与梯度下降教学工具。

先读取完整规范、Starter，并参考：

- outputs/gradient-contours-surface-3d.html
- outputs/recurrence-iteration-dynamics-3d.html
- outputs/energy-phase-portrait-3d.html

工具元信息：

- id：optimization-convexity-gradient-descent-3d
- 文件：outputs/optimization-convexity-gradient-descent-3d.html
- 中文标题：优化、凸性与梯度下降
- 英文标题：Optimisation, Convexity & Gradient Descent
- category：calc

核心顿悟：

梯度只描述当前位置最陡的上升方向；负梯度给出局部最陡下降方向。凸性决定局部最小值能否保证是全局最小值，学习率则决定下降是稳定、缓慢还是发散。

至少实现以下四个 SCENES：

1. 一维下降
   - 在一维函数上展示当前位置、切线斜率和更新：
     xₙ₊₁=xₙ−ηf′(xₙ)。
   - 比较 η 太小、合适、太大。
   - 轨迹沿 n 或时间轴展开。

2. 二维损失曲面
   - 选择椭圆抛物面作为凸函数。
   - 同时展示三维曲面、等高线和梯度下降路径。
   - 顿悟视角：俯视时，下降轨迹穿过等高线并指向中心。
   - 展示条件差的狭长谷地为何产生 zig-zag。

3. 凸与非凸
   - 比较凸碗、双井和带鞍点的曲面。
   - 从不同初始点出发，展示局部最小值依赖。
   - 不要暗示梯度下降总能找到全局最优。

4. 约束优化与 Lagrange multiplier
   - 在曲面或等高线图上加入约束曲线 g(x,y)=c。
   - 最优点处目标函数等高线与约束相切。
   - 显示 ∇f=λ∇g。
   - 顿悟视角：俯视时两根梯度箭头平行。

建议参数：

- functionPreset
- startX、startY
- learningRate η
- anisotropy
- constraintRadius 或 constraintLevel
- animationSpeed

迭代历史必须记录当时真实位置。参数改变后不要重算旧轨迹，除非用户按重置。

完成浏览器交互、数值稳定性、node check、双语、移动端和注册。版本 1.0.0，不修改引擎，自动 push。
```

---

## 14 · 图论与网络算法

```text
使用 math-viz-tool skill 新增图论与基础网络算法工具。

先读取完整规范、Starter，并参考：

- outputs/linear-essence-3d.html
- outputs/recurrence-iteration-dynamics-3d.html

这个工具应使用节点、边、算法层级和状态传播，不要为了迎合 3D 而制造无意义曲面。z 轴可以表示算法步骤或搜索层级。

工具元信息：

- id：graph-theory-network-algorithms-3d
- 文件：outputs/graph-theory-network-algorithms-3d.html
- 中文标题：图论与网络算法
- 英文标题：Graph Theory & Network Algorithms
- category：disc
- disc 不存在时新增“证明、离散数学与算法 / Proof, Discrete Mathematics & Algorithms”。

核心顿悟：

图把对象之间的关系抽象成节点与边；许多算法本质上是在局部扩张一个已知区域，同时维护某种不变量。

至少实现以下四个 SCENES：

1. 路径、环与连通性
   - 可切换无向图预设。
   - 高亮路径、简单环、连通分量。
   - 展示树为何是“连通且无环”的图。
   - 显示树有 n−1 条边的直觉。

2. 广度优先搜索
   - 从起点逐层扩张。
   - z 轴或环形层表示距离层级。
   - 顿悟视角：从侧面看到搜索波前，从正面看到原始图。
   - 生成 BFS tree。

3. Dijkstra 最短路径
   - 使用非负权重图。
   - 展示暂定距离、已确定节点和松弛操作。
   - 动画逐步推进，不只显示最终结果。
   - 明确不能使用负权边。

4. 最小生成树
   - 使用 Kruskal 或 Prim，选择其中一个并讲清。
   - 边按权重加入，同时避免形成环。
   - 显示“连接所有节点”和“总权重最小”是两个约束。
   - 可选展示并查集的集合合并，但不要使界面过载。

建议参数：

- graphPreset
- startNode
- algorithmStep
- animationSpeed
- weightVariation

算法必须使用确定性的预设图，重置可复现。颜色用于节点状态和边状态时仍需遵循现有语义色体系。

完成算法正确性验证、浏览器逐步检查、node check、i18n、mobile 和注册。版本 1.0.0，不改引擎，自动 push。
```

---

## 15 · 模运算、欧几里得算法与中国剩余定理

```text
使用 math-viz-tool skill 新增模运算与数论基础工具。

先读取完整规范、Starter，并参考：

- outputs/i-essence-3d.html
- outputs/polar-cartesian-3d.html
- outputs/recurrence-iteration-dynamics-3d.html

工具元信息：

- id：modular-arithmetic-euclid-crt-3d
- 文件：outputs/modular-arithmetic-euclid-crt-3d.html
- 中文标题：模运算、最大公约数与同余
- 英文标题：Modular Arithmetic, GCD & Congruence
- category：disc

核心顿悟：

模运算把无限整数轴按固定周期卷成一个圆；同余表示不同整数落在圆上的同一位置。欧几里得算法不断删除不影响最大公约数的整倍数，中国剩余定理则把多个周期条件重新组合为一个更长周期。

至少实现以下四个 SCENES：

1. 整数轴卷成模圆
   - 一条整数螺旋沿 z 轴上升，每经过 m 个整数绕一圈。
   - 顿悟视角：沿 z 轴俯视时，所有同余整数塌缩到同一个模圆位置。
   - 展示 a≡b mod m ⇔ m | (a−b)。

2. 模加法与模乘法
   - 在圆上逐步执行加法。
   - 乘法可解释为重复加法或点的置换。
   - 展示当 multiplier 与 modulus 互质时产生全排列，否则只访问部分剩余类。

3. 欧几里得算法
   - 使用矩形铺砖或线段相减展示：
     gcd(a,b)=gcd(b,a mod b)。
   - 每一步把大矩形切去整倍数小矩形。
   - 最终剩余正方形边长为 gcd。
   - 同时显示除法步骤。

4. 中国剩余定理
   - 使用两个互质模数 m、n。
   - 分别显示两个模圆条件，再展示满足两者的整数每 mn 周期重复。
   - 可使用二维剩余格点或两层圆柱。
   - 非互质时正确判断无解或多解条件，不要错误声称总有唯一解。

建议参数：

- modulus m
- secondModulus n
- integer a
- addend
- multiplier
- target residues

约束参数为适当小整数，以保持可视化清楚。完成数学边界测试、browser、node check、i18n、mobile 和注册。版本 1.0.0，不改引擎，自动 push。
```

---

## 16 · 算法复杂度与增长阶

```text
使用 math-viz-tool skill 新增算法复杂度和渐近增长教学工具。

先读取完整规范、Starter，并参考：

- outputs/recurrence-iteration-dynamics-3d.html
- outputs/e-essence-3d.html
- outputs/limit-essence-3d.html

工具元信息：

- id：algorithmic-complexity-growth-3d
- 文件：outputs/algorithmic-complexity-growth-3d.html
- 中文标题：算法复杂度与增长速度
- 英文标题：Algorithmic Complexity & Growth Rates
- category：disc

核心顿悟：

复杂度不是精确秒数，而是输入规模增大时工作量的增长规律。小输入下的常数优势可能很重要，但规模足够大后，增长阶决定算法是否仍然可用。

至少实现以下四个 SCENES：

1. 增长速度竞赛
   - 同时比较：
     log n、n、n log n、n²、2ⁿ、n!。
   - 允许使用线性纵轴和对数纵轴。
   - 顿悟视角：在对数视图中看清指数函数与多项式函数仍有根本区别。
   - 对极大值采用安全裁剪并标注超出范围。

2. Big-O 的含义
   - 展示 f(n) 最终被 c·g(n) 上界覆盖。
   - 可调常数 c 和起始阈值 n₀。
   - 强调 Big-O 忽略的是渐近中的常数与低阶项，不是说实际运行时间永远无关紧要。

3. 对数来自不断减半
   - 以二分查找或反复折半表示 log₂n。
   - 每一步规模减半，直到剩余一个元素。
   - z 轴表示步骤数。
   - 直接显示 2ᵏ≈n。

4. 递归树
   - 比较：
     T(n)=T(n/2)+O(1)
     T(n)=2T(n/2)+O(n)
     T(n)=T(n−1)+O(1)
   - 展示分支数、深度和每层工作量。
   - 不要求完整讲 Master theorem，但应建立其直觉。

建议参数：

- inputSize，最好使用指数映射滑杆
- scaleConstant
- complexityPreset
- branchFactor
- shrinkFactor
- animationStep

避免 factorial 和 exponential 导致 Infinity；采用对数计算或合理裁剪。

完成浏览器和数学验证、node check、i18n、mobile 和注册。版本 1.0.0，不改引擎，自动 push。
```

---

# 第三批：大学数学与计算机科学基础

## 17 · Markov 链与稳定分布

```text
使用 math-viz-tool skill 新增 Markov 链教学工具。

先读取完整规范、Starter，并参考：

- outputs/gaussian-essence-3d.html
- outputs/linear-essence-3d.html
- outputs/recurrence-iteration-dynamics-3d.html

工具元信息：

- id：markov-chains-stationary-distribution-3d
- 文件：outputs/markov-chains-stationary-distribution-3d.html
- 中文标题：Markov 链与稳定分布
- 英文标题：Markov Chains & Stationary Distributions
- category：prob

核心顿悟：

Markov 链用一个转移矩阵不断重新分配概率质量；长期稳定分布是经过一次转移后仍保持不变的概率向量，因此也是特征值 1 对应的特征向量。

至少实现以下四个 SCENES：

1. 状态转移网络
   - 使用三个状态。
   - 边宽或透明度表示转移概率。
   - 每个节点的流出概率总和必须为 1。
   - 概率质量随时间在节点间流动。

2. 概率向量迭代
   - 明确采用列向量或行向量约定，并始终一致。
   - 展示 pₙ₊₁=Ppₙ 或 pₙ₊₁=pₙP。
   - 每一步概率向量沿 z 轴留下轨迹。

3. 概率单纯形
   - 三状态概率满足 p₁+p₂+p₃=1，因此位于三角形内。
   - 从不同初始分布出发，轨迹逐渐靠近同一稳定点。
   - 顿悟视角：正视概率单纯形时，所有轨迹汇聚到固定点。

4. 稳定、周期与吸收
   - 提供至少三个预设：
     - 遍历链，收敛到唯一稳定分布；
     - 周期链，在多个状态间振荡；
     - 吸收链，最终进入吸收状态。
   - 不要暗示所有 Markov 链都收敛到唯一分布。

建议参数：

- chainPreset
- initial probabilities，以自动归一化方式控制
- transitionMix
- stepRate
- numberOfSteps

完成矩阵方向、归一化和边界情况验证。浏览器测试、node check、i18n、mobile、tools registry 全部完成。版本 1.0.0，不改引擎，自动 push。
```

---

## 18 · SVD、PCA 与降维

```text
使用 math-viz-tool skill 新增 SVD、PCA 与降维教学工具。

先读取完整规范、Starter，并参考：

- outputs/linear-essence-3d.html
- outputs/gaussian-essence-3d.html
- outputs/dft-essence-3d.html

不要重复现有线性代数工具的一般矩阵变形与特征向量。重点是 SVD 的三段分解以及 PCA 的数据投影含义。

工具元信息：

- id：svd-pca-dimensionality-reduction-3d
- 文件：outputs/svd-pca-dimensionality-reduction-3d.html
- 中文标题：SVD、PCA 与降维
- 英文标题：SVD, PCA & Dimensionality Reduction
- category：alg

核心顿悟：

任意线性变换都可以分解为“先旋转到自然输入方向、沿正交轴独立伸缩、再旋转到输出方向”；PCA 则寻找数据变化最大的正交方向，并把数据投影到这些方向上。

至少实现以下四个 SCENES：

1. SVD 三幕分解
   - 单位圆依次经过 Vᵀ、Σ、U。
   - 使用三个空间层或动画阶段。
   - 分别显示右奇异向量、奇异值和左奇异向量。
   - 顿悟视角：正视每一层时，看见旋转—伸缩—旋转。

2. 奇异值与秩
   - 改变 σ₁、σ₂。
   - 当 σ₂→0 时，椭圆压成线，矩阵降秩。
   - 当两个奇异值相等时，只剩等比例缩放和旋转。
   - 显示 condition ratio σ₁/σ₂ 的直觉。

3. PCA 点云
   - 生成二维相关点云。
   - 显示均值、协方差椭圆、第一和第二主成分。
   - 顿悟视角：沿第二主成分方向观察时，点云投影成保留最大变化的一维分布。

4. 降维与重建误差
   - 将二维数据投影到第一主成分，再重建回二维。
   - 显示每个点的残差线和总重建误差。
   - 可用 rank-1 与 rank-2 对比，但无需处理真实图片文件。

建议参数：

- inputRotation
- outputRotation
- sigma1、sigma2
- correlation
- cloudSpread
- retainedRank

使用确定性伪随机种子，使点云重置可复现。完成数值稳定性、浏览器、node check、i18n、mobile 和注册。版本 1.0.0，不改引擎，自动 push。
```

---

## 19 · 组合数学与生成函数

```text
使用 math-viz-tool skill 新增组合数学和生成函数教学工具。

先读取完整规范、Starter，并参考：

- outputs/phi-essence-3d.html
- outputs/recurrence-iteration-dynamics-3d.html
- 新增后的 binomial-pascal-probability-3d.html；如果该工具尚不存在，则直接参考当前代码并避免依赖它。

工具元信息：

- id：combinatorics-generating-functions-3d
- 文件：outputs/combinatorics-generating-functions-3d.html
- 中文标题：组合计数与生成函数
- 英文标题：Combinatorics & Generating Functions
- category：disc

核心顿悟：

生成函数把一个数列编码为多项式或幂级数的系数；多项式相乘时系数发生卷积，这正对应“从两个独立选择集合中组合出总数”的计数过程。

至少实现以下四个 SCENES：

1. 加法原则与乘法原则
   - “二选一的方案相加”和“连续两步选择相乘”使用节点和路径展示。
   - 不只给公式，要显示方案集合如何合并或笛卡尔积。

2. 系数是计数结果
   - 一个多项式的每个幂 xᵏ 表示总量 k，系数表示得到该总量的方法数。
   - 使用简单例子：
     (1+x+x²)(1+x³)
   - 高亮某个目标次数的所有组合来源。

3. 卷积
   - 两个系数序列沿相反方向滑动。
   - 重叠项相乘再相加，得到乘积多项式的一个系数。
   - 顿悟视角：正视滑动层时，卷积和系数乘法成为同一幅图。

4. 递推与生成函数
   - 使用 Fibonacci：
     Fₙ=Fₙ₋₁+Fₙ₋₂。
   - 展示移位后的系数序列如何在生成函数方程中对齐。
   - 推导到 F(x)=x/(1−x−x²) 的结构直觉。
   - 不必深入复分析，但要说明这是形式幂级数操作。

建议参数：

- polynomialPreset
- targetDegree
- sequenceLength
- convolutionShift
- animationStep

避免与 Pascal 工具重复路径计数；本工具重点应是“系数编码”和“乘法即组合”。

完成数学检查、浏览器、node check、i18n、mobile 和注册。版本 1.0.0，不修改引擎，自动 push。
```

---

## 20 · 向量场、散度与旋度

```text
使用 math-viz-tool skill 新增向量场、散度和旋度工具。

先读取完整规范、Starter，并参考：

- outputs/gradient-contours-surface-3d.html
- outputs/differential-equations-phase-space-3d.html
- outputs/linear-essence-3d.html

工具元信息：

- id：vector-fields-divergence-curl-3d
- 文件：outputs/vector-fields-divergence-curl-3d.html
- 中文标题：向量场、散度与旋度
- 英文标题：Vector Fields, Divergence & Curl
- category：calc

核心顿悟：

向量场为每个空间位置指定一个方向和大小；散度测量局部净流出，旋度测量局部旋转趋势，而梯度场的箭头来自某个标量势能面的最陡上升方向。

至少实现以下四个 SCENES：

1. 向量场
   - 使用规则网格上的箭头展示 F(x,y)。
   - 提供均匀场、径向场、旋转场和鞍形场预设。
   - 放置一个可移动探针，显示当前位置向量。

2. 散度
   - 在探针周围放置一个小方盒或小圆。
   - 展示进入与离开的通量。
   - source 场散度为正，sink 为负，纯旋转场散度为零。
   - 顿悟视角：俯视时直接看到局部膨胀或收缩。

3. 旋度
   - 在探针位置放置小桨轮。
   - 场使桨轮产生局部旋转时，curl 非零。
   - 纯径向场可有散度但无旋度。
   - 旋度方向使用右手规则表示。

4. 梯度场
   - 同时展示标量曲面 f(x,y)、等高线和 ∇f。
   - 展示梯度场的局部旋度为零。
   - 与现有 gradient 工具连接，但本页重点是“标量场产生向量场”。

建议参数：

- fieldPreset
- fieldStrength
- probeX、probeY
- sampleDensity
- animationSpeed

箭头数量需要适配移动端性能。对原点奇点采用裁剪或避开采样，不能产生 NaN。

完成数学、浏览器、node check、i18n、mobile 和注册。版本 1.0.0，不改引擎，自动 push。
```

---

## 21 · 线积分、Green 定理与 Stokes 定理

```text
使用 math-viz-tool skill 新增线积分、Green 定理和 Stokes 定理教学工具。

先读取完整规范、Starter，并参考：

- outputs/calculus-essence-3d.html
- outputs/gradient-contours-surface-3d.html
- 新增后的 vector-fields-divergence-curl-3d.html；如果尚不存在，则直接实现所需最小向量场辅助。

工具元信息：

- id：line-integrals-green-stokes-3d
- 文件：outputs/line-integrals-green-stokes-3d.html
- 中文标题：线积分、Green 定理与 Stokes 定理
- 英文标题：Line Integrals, Green’s Theorem & Stokes’ Theorem
- category：calc

核心顿悟：

边界上的总环流可以由内部每一点的局部旋转累积得到。Green 定理是二维版本，Stokes 定理是同一思想在三维曲面上的推广。

至少实现以下三个主要 SCENES，可增加第四个辅助场景：

1. 沿路径做功
   - 向量场 F 和一条参数曲线 C。
   - 沿曲线移动探针，显示切向量 dr 与 F·dr。
   - 正贡献和负贡献使用不同语义显示。
   - 累积得到 ∫C F·dr。
   - 比较保守场中不同路径同端点积分相同，以及非保守场中的路径依赖。

2. Green 定理
   - 在平面区域内部显示 curl 标量或局部旋转小单元。
   - 边界箭头显示正向环流。
   - 将区域划分为小格，内部相邻边贡献相互抵消，只剩外边界。
   - 顿悟视角：正视平面时清楚看到“内部边抵消，外边界留下”。
   - 展示：
     ∮∂R F·dr = ∬R curl F dA。

3. Stokes 定理
   - 一个可调弯曲曲面及其固定边界。
   - 在曲面上显示法向量和 curl 的法向分量。
   - 边界显示环流方向。
   - 改变曲面形状但保持边界时，两边积分保持一致。
   - 顿悟视角：沿曲面法向看，三维结构投影成 Green 定理。

4. 方向与符号，可作为独立页签或辅助状态
   - 翻转法向量时，边界正方向也反转。
   - 强调右手规则和 orientation。

建议参数：

- fieldPreset
- curveRadius
- curveShape
- surfaceBulge
- probePosition
- partitionDensity

使用可解析的简单场，必要时通过数值积分近似并显示误差。确保方向约定一致。

完成 browser、数值和符号验证、node check、i18n、mobile 和注册。版本 1.0.0，不修改引擎，自动 push。
```

---

## 22 · 信息熵与编码

```text
使用 math-viz-tool skill 新增信息熵与编码教学工具。

先读取完整规范、Starter，并参考：

- outputs/gaussian-essence-3d.html
- outputs/dft-essence-3d.html
- outputs/e-essence-3d.html

工具元信息：

- id：information-entropy-coding-3d
- 文件：outputs/information-entropy-coding-3d.html
- 中文标题：信息熵、惊奇度与编码
- 英文标题：Information Entropy, Surprise & Coding
- category：prob

核心顿悟：

一个事件越不可能，发生时带来的信息越大，因此惊奇度是 −log₂p；熵是平均惊奇度，也是对随机结果进行无损编码时平均所需比特数的理论下界。

至少实现以下四个 SCENES：

1. 惊奇度
   - 展示 I(x)=−log₂p(x)。
   - p 接近 1 时信息接近 0；p 很小时信息增大。
   - 使用概率尺和比特层级展示“概率每减半，惊奇度增加 1 bit”。
   - 正确处理 p→0，不直接计算 log(0)。

2. 二元熵
   - 展示：
     H(p)=−p log₂p−(1−p)log₂(1−p)。
   - p=0 或 1 时熵为 0，p=0.5 时最大为 1 bit。
   - 顿悟视角：正视曲线时看到“最不可预测的公平二选一位于峰顶”。

3. 多结果概率分布
   - 用概率柱、单纯形或概率质量块展示多个结果。
   - 当分布趋于均匀时熵升高；当概率集中在一个结果时熵降低。
   - 显示 H=ΣpᵢIᵢ。
   - 概率控制必须自动归一化。

4. 编码树
   - 使用一个小型符号分布构建前缀编码树。
   - 高频符号使用短码，低频符号使用长码。
   - 展示理想码长 −log₂p 与实际整数码长。
   - 可实现简单 Huffman 构建过程，但节点数量保持较小。
   - 显示平均码长不能低于熵，并可能略高于熵。

建议参数：

- binaryProbability
- distributionPreset
- skew
- symbolCount
- codingStep

不要延伸成密码学或通信系统大全；本工具只建立概率、不确定性、信息量与编码长度之间的统一直觉。

完成概率归一化、极端参数、浏览器、node check、i18n、mobile 和注册验证。版本 1.0.0，不改共享引擎，自动 push。
```
