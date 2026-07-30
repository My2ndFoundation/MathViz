## 1. 三角函数体系已经相当完整

已有：

* 单位圆、正弦、正切；
* 三角恒等式；
* 万能代换；
* 反三角函数。

这组已经覆盖：

* 单位圆投影；
* 三角函数图像；
* 和角与诱导公式；
* 主值区间；
* 函数折叠；
* 半角代换；
* 三角函数有理化。

因此，以下内容暂时不值得再单独立项：

* 三角函数图像变换；
* 和差化积、积化和差；
* 一般三角方程；
* 正弦定理、余弦定理；
* 单独的 Euler 公式入门工具。

除非是作为现有工具的一个新 Tab，否则三角函数领域已经接近饱和。([GitHub][1])、曲线和几何已有较强基础

已有：

* 直角坐标与极坐标；
* 圆锥曲线；
* 极坐标螺线、玫瑰线；
* 离心率对椭圆、抛物线和双曲线的统一。

因此应该排除：

* 单纯的极坐标曲线展示；
* 单纯的椭圆、抛物线、双曲线；
* “圆锥切片”第二个版本；
* 只展示 (r=f(\theta)) 图像的工具。

现有极坐标工具已经明确包括“同一个函数换一种读取方式成为螺线或玫瑰线”，圆锥曲线工具也已经通过连续切割角度和离心率统一三类曲线。([GitHub][3])代数的基础层已经实现

已有工具已经包含：

* 向量加法；
* 点积与投影；
* 叉积；
* 有向面积；
* 矩阵的列；
* 矩阵对空间的变形；
* 行列式与面积缩放。

因此应该排除：

* 基础向量加法；
* 基础点积；
* 基础叉积；
* “矩阵就是空间变换”；
* 单纯讲行列式是面积；
* 矩阵列就是基向量去向。

这些正是现有 Linear Algebra 工具的核心内容。([GitHub][3]) 特征向量和特征值；

* 不变方向；
* 逆矩阵；
* 奇异性；
* 重复应用矩阵；
* 三维直线与平面。

所以这几个仍然值得做。

---

## 4. 微积分已有内容以“积分”为主

现有 Calculus 工具的核心是：

> 切片 → 求值 → 堆叠

并且已经覆盖：

* 微积分基本定理；
* 一重积分；
* 二重积分；
* 三重积分；
* 面积、体积和质量。

Limits 又覆盖：

* 局部缩放；
* 函数光滑性；
* 可导、尖点和跳跃；
* 无穷小的阶；
* 级数收敛速度。

Taylor Expansion 覆盖：

* 局部多项式逼近；
* 展开阶数；
* 收敛半径；
* 最近奇点。

因此应排除：

* 泛泛的“积分是面积”；
* 泛泛的“二重积分和三重积分”；
* 普通 Riemann sum；
* 只讲切线斜率的基础导数工具；
* 单纯讲 Taylor 多项式逼近；
* 单纯讲极限的放大镜。

真正仍有明显空间的是：

* 导数作为局部线性变换；
* 链式法则；
* 参数方程；
* 微分方程；
* 梯度和切平面；
* Jacobian；
* 相空间。

([GitHub][3])和信号也已有明确覆盖

已有：

* Gaussian、中心极限定理、标准差和拐点；
* Kelly Criterion；
* Fourier Transform；
* DFT、采样、逆重建和滤波。

因此应排除：

* 再做一个正态分布钟形曲线；
* 再做一个中心极限定理；
* 再做傅立叶频谱；
* 再做采样和滤波；
* 单纯展示期望收益或复利增长。

但概率领域还缺：

* 二维联合分布；
* 条件概率；
* 相关性；
* 协方差；
* 回归；
* Binomial 到 Normal 的几何过渡。

([GitHub][1])新增内容

下面只保留目前仓库里**没有实质覆盖**，而且 3D 或动态视觉确实能带来理解增益的主题。

---

# 第一优先级：直接支持 A-Level / Further Maths

## 1. 参数方程的本质

### Parametric Curves as Shadows of Motion

建议文件：

```text
parametric-curves-3d.html
```

### 核心本体

构造一条三维空间曲线：

[
\mathbf r(t)=\bigl(x(t),y(t),t\bigr)
]

然后显示三个投影：

* (x)-(t) 平面：(x=f(t))；
* (y)-(t) 平面：(y=g(t))；
* (x)-(y) 平面：参数曲线。

### 最适合的案例

[
x=\cos t,\qquad y=\sin t
]

[
x=t-\sin t,\qquad y=1-\cos t
]

[
x=\sin(at),\qquad y=\sin(bt)
]

并加入：

* 运动点；
* 速度向量；
* 加速度向量；
* 参数速度；
* 相同轨迹的不同参数化。

### 一句话本质

> 参数方程不是两条函数，而是一个运动点的两组坐标记录。

这是与你的三角函数工具设计逻辑最一致的新项目，也是 OCR MEI A-Level 明确涉及的内容。([OCR][4])---

## 2. 三维直线与平面的本质

### Lines, Planes and Skew Geometry

建议文件：

```text
lines-planes-3d.html
```

注意，它不应该重复现有 Linear Algebra 工具中的点积和叉积基础。

### 核心内容

#### 直线

[
\mathbf r=\mathbf a+\lambda\mathbf d
]

展示：

* 起点；
* 方向向量；
* 参数 (\lambda)；
* 点沿直线运动。

#### 平面

[
(\mathbf r-\mathbf a)\cdot\mathbf n=0
]

展示：

* 平面上的一点；
* 法向量；
* 平面如何随法向量旋转。

#### 两平面的交线

两个平面连续旋转，相交形成一条直线：

[
\mathbf d=\mathbf n_1\times\mathbf n_2
]

#### 异面直线

重点表现：

* 不平行；
* 不相交；
* 却位于不同平面；
* 两线间最短线段同时垂直于两线。

#### 距离

* 点到平面；
* 点到直线；
* 两条异面直线；
* 平行平面。

### 一句话本质

> 三维解析几何就是用方向向量和法向量定位空间中的自由度与约束。

这是 Further Maths 中最需要真实 3D 环境的主题之一。OCR MEI Core Pure 明确包含向量方法、直线和平面。([OCR][5])---

## 3. 复数的幂、根与轨迹

### Complex Powers, Roots and Loci

建议把它作为现有 `complex-mult-3d.html` 的二期，而不是完全独立重做。

建议扩展名称：

```text
complex-powers-roots-loci-3d.html
```

### 与现有工具的边界

现有工具已经解释：

[
z_1z_2
]

为什么是：

* 模长相乘；
* 幅角相加。

新内容从这里继续：

### 模块一：De Moivre

[
(\cos\theta+i\sin\theta)^n
==========================

\cos n\theta+i\sin n\theta
]

同时显示：

* 输入点转一圈；
* 输出点转 (n) 圈；
* 角度如何被放大；
* 单位圆如何被映射到自身。

### 模块二：(n) 次根

[
z^n=w
]

展示：

* 半径开 (n) 次方；
* 角度除以 (n)；
* 由于角度具有周期性，产生 (n) 个均匀分布的根。

### 模块三：复数轨迹

动态展示：

[
|z-a|=r
]

[
|z-a|=|z-b|
]

[
\arg(z-a)=\theta
]

[
\left|\frac{z-a}{z-b}\right|=k
]

### 一句话本质

> 复数方程不是纯代数条件，而是在平面中施加距离、角度和旋转约束。

De Moivre、复数的 (n) 次根和 Argand 图都是 Further Maths Core Pure 的直接内容。([OCR][5])---

## 4. 特征向量与特征值

### Eigenvectors as Invariant Directions

建议作为 Linear Algebra 的二期：

```text
eigenvectors-essence-3d.html
```

### 为什么不重复

现有工具已经解释了：

* 矩阵如何变形空间；
* 列向量；
* 行列式。

新工具只回答一个问题：

> 当整个空间都被扭曲时，哪些方向仍然没有转弯？

### 核心场景

显示大量从原点发出的向量，矩阵连续施加变换：

[
\mathbf v\mapsto A\mathbf v
]

多数向量方向改变，但某些方向满足：

[
A\mathbf v=\lambda\mathbf v
]

它们只会：

* 拉长；
* 缩短；
* 反向；
* 保持不变。

### 可以加入

* 两个实特征方向；
* 一个重复特征值；
* 只有一个特征方向；
* 没有实特征向量的二维旋转；
* 矩阵重复作用：
  [
  A^n\mathbf v
  ]
* 最大特征值方向逐渐支配结果；
* determinant 与特征值乘积；
* trace 与特征值之和。

### 一句话本质

> 特征向量是空间变换中不会改变方向的天然坐标轴。

**优先级：最高。**

---

## 5. 微分方程与相空间

### Differential Equations as Flow

建议文件：

```text
differential-equations-phase-space-3d.html
```

### 模块一：一阶方向场

[
\frac{dy}{dt}=f(t,y)
]

在每个 ((t,y)) 点放置一个局部方向。

不同初始点释放粒子，生成不同解曲线。

### 模块二：三维提升

把解曲线放进：

[
(t,y,y')
]

空间。

分别投影到：

* (t)-(y)：函数图像；
* (t)-(y')：变化率；
* (y)-(y')：相图。

### 模块三：二阶振动

[
x''+2\zeta\omega x'+\omega^2x=0
]

拖动阻尼参数 (\zeta)，观察：

* 无阻尼；
* 欠阻尼；
* 临界阻尼；
* 过阻尼。

三维轨迹使用：

[
(t,x,v)
]

并投影成相平面中的螺旋、闭合轨道或衰减路径。

### 一句话本质

> 微分方程不是寻找一个神秘公式，而是在一个局部方向规则中寻找完整轨迹。

一阶、二阶微分方程、阻尼和简谐运动都在 Further Maths Core Pure 内容中。([OCR][5])---

## 6. 双曲函数的本质

### Hyperbolic Functions

建议文件：

```text
hyperbolic-functions-3d.html
```

虽然已有圆锥曲线工具中的“双曲线”，但那是双曲线作为圆锥截线，不是双曲函数，因此不构成重复。

### 核心对照

圆：

[
x^2+y^2=1
]

参数化：

[
x=\cos\theta,\qquad y=\sin\theta
]

双曲线：

[
x^2-y^2=1
]

参数化：

[
x=\cosh u,\qquad y=\sinh u
]

同时展示：

[
\cos^2\theta+\sin^2\theta=1
]

与：

[
\cosh^2u-\sinh^2u=1
]

### 必须体现的关键点

(u) 不是普通欧氏角，而与双曲扇形面积有关。

工具可以同时显示：

* 单位圆；
* 单位双曲线；
* 圆扇形；
* 双曲扇形；
* 两套投影；
* 两组恒等式；
* 指数定义。

再加入悬链线：

[
y=a\cosh(x/a)
]

并与抛物线叠加比较。

### 一句话本质

> 双曲函数是单位双曲线的自然坐标，就像正弦和余弦是单位圆的自然坐标。

双曲函数是 OCR MEI Further Maths Core Pure 的明确内容。([OCR][5])--

# 第二优先级：补齐微积分和力学的空间直觉

## 7. 导数作为局部线性化

### Derivative as Local Linearisation

建议文件：

```text
derivative-local-linearisation-3d.html
```

它必须避开已有 Limits 工具中的“放大后曲线变直线”，继续向前走一步。

### 核心结构

#### 一维

[
f(x+h)\approx f(x)+f'(x)h
]

显示：

* 原函数；
* 当前点；
* 切线；
* 输入扰动 (h)；
* 真实输出变化；
* 线性预测；
* 误差。

#### 复合函数与链式法则

[
x\overset{g}{\longmapsto}u
\overset{f}{\longmapsto}y
]

显示一个小输入长度先被 (g'(x)) 缩放，再被 (f'(u)) 缩放：

[
\frac{dy}{dx}
=============

\frac{dy}{du}\frac{du}{dx}
]

#### 二维到一维

[
z=f(x,y)
]

一个小平面区域经过函数后被局部映射成切平面上的变化。

### 一句话本质

> 导数不是一条切线，而是函数在一个点附近最准确的线性替身。

**优先级：高。**

---

## 8. 曲面、等高线、梯度和切平面

### Surface, Contours and Gradient

建议文件：

```text
gradient-contours-surface-3d.html
```

虽然 Calculus 已有二重、三重积分，但没有覆盖多变量微分几何。

### 核心场景

[
z=f(x,y)
]

显示一张曲面。

水平切片：

[
z=c
]

穿过曲面，交线投影到地面形成：

[
f(x,y)=c
]

即等高线。

### 梯度

在某一点显示：

[
\nabla f
========

\left(
\frac{\partial f}{\partial x},
\frac{\partial f}{\partial y}
\right)
]

让方向向量 (\mathbf u) 旋转：

[
D_{\mathbf u}f=\nabla f\cdot\mathbf u
]

观察：

* 梯度垂直于等高线；
* 梯度方向上升最快；
* 负梯度下降最快；
* 鞍点梯度也可以为零；
* 切平面是曲面的局部线性近似。

### 推荐曲面

* Gaussian hill；
* 椭圆抛物面；
* 双曲抛物面；
* 波纹面；
* 双峰曲面。

### 一句话本质

> 等高线是曲面的水平切片，梯度则是穿过这些等高线最快的方向。

OCR Further Pure with Technology 也涉及 stationary points、contours、surfaces 和 tangent planes。([OCR][6])--

## 9. 运动学、抛体与图像投影

### Kinematics as One Motion, Many Graphs

建议文件：

```text
kinematics-projectile-3d.html
```

这可以成为三角函数工具在 Mechanics 中的对应作品。

### 直线运动

使用三维曲线：

[
(t,s,v)
]

投影得到：

* 位移—时间；
* 速度—时间；
* 速度—位移或相图。

显示：

[
v=\frac{ds}{dt},
\qquad
a=\frac{dv}{dt}
]

同时把：

* 图像斜率；
* 面积；
* 真实运动；

联系起来。

### 抛体运动

三维坐标：

[
(t,x,y)
]

空间曲线在不同平面上的投影：

* (x)-(t)：匀速直线；
* (y)-(t)：抛物线；
* (x)-(y)：实际抛物轨迹。

拖动：

* 初速度；
* 发射角；
* 重力；
* 初始高度。

### 一句话本质

> 抛体不是一种复杂运动，而是水平方向匀速和竖直方向匀加速共享同一个时间参数。

参数运动、二维向量运动、projectiles 和 kinematics 都在 OCR MEI Mathematics 中。([OCR][4])--

## 10. 递推关系、迭代和稳定性

### Recurrence and Iterative Dynamics

建议文件：

```text
recurrence-iteration-dynamics-3d.html
```

### 基础视图

[
x_{n+1}=f(x_n)
]

显示：

* (y=f(x))；
* (y=x)；
* cobweb diagram；
* 数列 (x_0,x_1,x_2,\ldots)。

### 三维视图

使用：

[
(n,x_n,x_{n+1})
]

把离散数列变成空间折线。

参数作为第三轴时，可以看到固定点如何随参数移动、分裂或失稳。

### 覆盖现象

* 单调收敛；
* 交替收敛；
* 发散；
* 两周期；
* 固定点；
* 稳定和不稳定；
* Newton–Raphson；
* fixed-point iteration。

### 一句话本质

> 递推关系不是直接给出数列，而是定义一台反复把输出送回输入的机器。

**优先级：中高。**

---

# 第三优先级：统计与高级扩展

## 11. 二维高斯、协方差和相关性

### Joint Distribution and Covariance

建议作为 Gaussian 工具的二期：

```text
joint-gaussian-covariance-3d.html
```

### 避免重复

现有 Gaussian 已经解释：

* 一维钟形曲线；
* 标准差；
* 中心极限定理。

新工具专注二维：

[
f(x,y)
]

### 交互参数

拖动：

* (\mu_x,\mu_y)；
* (\sigma_x,\sigma_y)；
* 相关系数 (\rho)。

观察密度山如何变化：

* (\rho=0)：等高线轴对齐；
* (\rho>0)：向正斜率方向倾斜；
* (\rho<0)：向负斜率方向倾斜；
* (|\rho|\to1)：压向一条线。

### 投影

对 (y) 积分得到 (x) 的边缘分布；对 (x) 积分得到 (y) 的边缘分布。

再增加：

* 顶视等密度椭圆；
* 采样散点；
* 主轴方向；
* 回归线；
* covariance matrix。

### 一句话本质

> 相关性是概率云的方向，而边缘分布是概率云沿某一方向压扁后的影子。

**优先级：中。**

---

## 12. Jacobian 与坐标变换

### Jacobian as Local Area Scaling

建议作为 Cartesian × Polar 的高级二期：

```text
jacobian-coordinate-warp-3d.html
```

### 核心场景

直角坐标的小方格：

[
dx,dy
]

经过坐标映射后变成局部平行四边形。

两条局部基向量：

[
\frac{\partial\mathbf r}{\partial u},
\qquad
\frac{\partial\mathbf r}{\partial v}
]

张成的面积就是局部面积缩放。

对于极坐标：

[
x=r\cos\theta,\qquad
y=r\sin\theta
]

小矩形 (dr,d\theta) 变成小扇形：

[
dA=r,dr,d\theta
]

### 一句话本质

> Jacobian 是坐标变换在每个局部把面积或体积放大了多少。

这个内容比“再做一个极坐标曲线工具”更有新增价值。

**优先级：中。**

---

## 13. 能量、势能与相图

### Energy Landscape and Phase Portrait

建议文件：

```text
energy-phase-portrait-3d.html
```

### 核心模型

对一个一维系统：

[
E=\frac12mv^2+V(x)
]

使用三维坐标：

[
(x,v,E)
]

能量守恒意味着运动被限制在某个等能面上。

### 示例

* 简谐振子；
* 单摆；
* 双势阱；
* 小球翻越势垒；
* 束缚态与逃逸态。

投影到 (x)-(v) 平面形成相图。

### 一句话本质

> 系统的运动不是任意的，而是沿着能量允许的几何轨道行进。

它同时支持 Further Mechanics、Physics 和微分方程。

**优先级：中。**

---

# 三、建议不要新增，而是扩展已有工具的内容

| 内容                 | 处理方式                         | 原因                       |
| ------------------ | ---------------------------- | ------------------------ |
| De Moivre 和复数根     | 扩展 Complex Multiplication    | 都由“角度相加”自然发展而来           |
| 特征向量               | 扩展 Linear Algebra，或做明确的二期    | 基础矩阵变换已经存在               |
| 极坐标面积              | 扩展 Cartesian × Polar         | 基础极坐标和曲线已经存在             |
| 二维 Gaussian        | 扩展 Gaussian                  | 一维 Gaussian 和 CLT 已存在    |
| 旋转体体积              | 扩展 Calculus                  | “切片—堆叠—体积”已有             |
| Newton–Raphson     | 放入 Recurrence / Iteration    | 本质是迭代动力系统                |
| 曲率和密切圆             | 放入 Parametric Curves 的高级 Tab | 依赖参数曲线、速度和加速度            |
| Laplace/Fourier 深化 | 暂缓                           | Fourier 和 DFT 已经占据两个完整工具 |
| 更多三角公式             | 暂缓                           | 三角体系已有四个工具               |

---

# 四、最终推荐开发顺序

## 第一批：最适合 June 近期 A-Level / Further Maths

1. **参数方程的本质**
2. **三维直线与平面**
3. **复数的幂、根与轨迹**
4. **特征向量与特征值**
5. **微分方程与相空间**
6. **双曲函数的本质**

这六个既属于课程主干，又非常适合你的“同一个数学对象，不同投影和视角”方法。Further Maths Core Pure 本身就把复数、矩阵、直线和平面、极坐标、双曲函数与微分方程列为核心发展链条。([OCR][5])应用理解

7. 导数作为局部线性化
8. 曲面、等高线、梯度和切平面
9. 运动学与抛体
10. 递推关系、迭代和稳定性

## 第三批：高级扩展

11. 二维 Gaussian、相关性与协方差
12. Jacobian 与坐标变换
13. 能量曲面与相图

---

# 五、最值得立即启动的三个

只选择三个的话，我会选：

### 1. 参数方程

它与当前三角函数工具的表达语言完全一致，开发风险最低，而且能成为很多后续工具的基础引擎。

### 2. 三维直线与平面

这是纸面教材表达最差、真实 3D 收益最高的 Further Maths 内容。

### 3. 微分方程与相空间

它可以把函数图、导数、运动、振动和力学统一进一个空间模型，能够成为整个 MathViz 中最有深度的工具之一。

其中，**参数方程工具还可以成为通用底层组件**：后面的抛体、空间曲线、微分方程、相空间、曲率和复数运动都可以复用同一套“空间轨迹 + 多平面投影”引擎。

[1]: https://github.com/My2ndFoundation/MathViz "GitHub - My2ndFoundation/MathViz · GitHub"
[2]: https://my2ndfoundation.github.io/MathViz/?lang=en "数学可视化 · MathViz"
[3]: https://github.com/My2ndFoundation/MathViz/blob/main/tools.json "MathViz/tools.json at main · My2ndFoundation/MathViz · GitHub"
[4]: https://www.ocr.org.uk/Images/308740-specification-accredited-a-level-gce-mathematics-b-mei-h640.pdf?utm_source=chatgpt.com "Mathematics B (MEI)"
[5]: https://www.ocr.org.uk/images/308768-specification-accredited-a-level-gce-further-mathematics-b-mei-h645.pdf?utm_source=chatgpt.com "Further Mathematics B (MEI)"
[6]: https://www.ocr.org.uk/images/H645%20A%20Level%20Further%20Mathematics%20B%20%28MEI%29%20Advance%20Information_Jun2022.pdf?utm_source=chatgpt.com "Advance Information Summer 2022 - H645"
