"""ch25-numpy-linalg 的 property 参考实现。

规矩见 gates/properties.py 文件头：参照与被测程序**机制不同**；举例说明它守什么时，
举的变异必须先跑过、真让门变红。每个被测入口的每个 return 分支都各做过一次变异
（把被测 `.py` 里那一行改坏、跑 `algorithm_property_check()` 看到红；协议：种子
properties.SEED、SAMPLES 组、本文件的生成器；红在哪组实参上见构建报告）。

本章的生成器写在本文件里，不动 `_gen.py`（那个文件逐字符冻结，理由见它的文件头）。

**参照一律纯 Python，不 import numpy**（第 4 期清单 §1.3）：被测是 numpy / LAPACK，
参照是下标循环、余子式展开、克拉默法则、二次方程求根公式——机制都不同。

**入口约定。** 入口收内置值（列表、整数），内部转 np.array，返回逐层内置类型
（`.tolist()`、`int()`、`float()`）；不改实参——本章入口都只读实参（np.array 复制一份）。

**舍入写法（两边一致）。** 浮点结果：入口写 `round(float(v), 9)`（先转成 Python float，
再舍入到 9 位）；参照先算出自己的 float（或把 Fraction 精确值转成 float），同样
`round(…, 9)`。两边的 float 只在末几位不同，9 位舍入把它抹平。唯一的风险是真值恰好落在
第 10 位的 5 上（十进制有限小数、正好 10 位）：
· 线性方程组：解是 p/q，q 整除 det(A)。|元素| ≤ 4 的 3×3 矩阵 |det| ≤ 4³·3^1.5 < 1024，
  q 不可能含 2^10 或 5^10，所以解不会是恰好 10 位的有限小数；
· 马尔可夫：P 的元素是 1/4 的倍数，n ≤ 26 步内 float 精确（二进制有限、两边逐位相同），
  之后的值离稳态 2/3 不到 1e-15，远离舍入边界；
· 夹角余弦、特征值：分母是平方根，非有理值不落在边界上，有理值的分母很小。
构建时在 20000 组上两边逐一比对过（见构建报告），没有一组撞边界。
"""
from fractions import Fraction
import math


# ── 共用：余子式展开求行列式（参照专用，递归；学生看不到，不算「讲递归」）──────

def _det(m):
    n = len(m)
    if n == 1:
        return m[0][0]
    total = 0
    for j in range(n):
        minor = [row[:j] + row[j + 1:] for row in m[1:]]
        total += (-1) ** j * m[0][j] * _det(minor)
    return total


# ── matrix-product-matmul ────────────────────────────────────────────────

def _matrices(rng):
    # m、n、p 各自独立取 1..4：大多数是非方阵，行列下标写混在方阵上可能不露馅。
    m, n, p = rng.randint(1, 4), rng.randint(1, 4), rng.randint(1, 4)
    a = [[rng.randint(-5, 5) for _ in range(n)] for _ in range(m)]
    b = [[rng.randint(-5, 5) for _ in range(p)] for _ in range(n)]
    return a, b


def _matmul_loops(a, b):
    # 被测：left @ right（numpy）；参照：三重下标循环逐格累加。
    out = []
    for i in range(len(a)):
        row = []
        for j in range(len(b[0])):
            total = 0
            for k in range(len(b)):
                total += a[i][k] * b[k][j]
            row.append(total)
        out.append(row)
    return out


# ── dot-product-angle ────────────────────────────────────────────────────

def _nonzero_vector(rng, dim):
    while True:
        v = [rng.randint(-5, 5) for _ in range(dim)]
        if any(v):
            return v


def _vector_pair(rng):
    # 裁决 M6A-D5：两条向量都不是零向量（cosine 的文档串写明「non-zero」）。
    # 维数 2..4。约三分之一专门造特殊角：垂直（2 维 (x, y) 配 (-ky, kx)）、
    # 同向与反向（v = k·u，k 取 ±1..±3，余弦恰为 ±1——四舍五入到 9 位才不越出 [-1, 1]）。
    dim = rng.randint(2, 4)
    u = _nonzero_vector(rng, dim)
    roll = rng.random()
    if roll < 0.12:
        x, y = rng.randint(-5, 5), rng.randint(-5, 5)
        if x == 0 and y == 0:
            x = 1
        k = rng.choice([-2, -1, 1, 2])
        return [x, y], [-k * y, k * x]
    if roll < 0.3:
        k = rng.choice([-3, -2, -1, 1, 2, 3])
        return u, [k * c for c in u]
    return u, _nonzero_vector(rng, dim)


def _cosine_hypot(u, v):
    # 被测：a @ b 与 np.linalg.norm；参照：生成式 sum(x*y) 与 math.hypot。
    dot = sum(x * y for x, y in zip(u, v))
    return round(float(dot / (math.hypot(*u) * math.hypot(*v))), 9)


# ── linear-system-solve / linear-system-inverse ──────────────────────────

def _system(rng):
    # 清单 §2.2：2×2 与 3×3 整数矩阵，**先保证行列式非 0**（用参照自己的余子式展开判断）。
    # 元素 -4..4、右边 -9..9：|det| < 1024，理由见文件头「舍入写法」。
    n = rng.choice([2, 3])
    while True:
        a = [[rng.randint(-4, 4) for _ in range(n)] for _ in range(n)]
        if _det(a) != 0:
            break
    b = [rng.randint(-9, 9) for _ in range(n)]
    return a, b


def _cramer(a, b):
    # 被测：np.linalg.solve / np.linalg.inv(A) @ b（LU 分解）；参照：克拉默法则，
    # 第 i 个未知数 = 把 A 的第 i 列换成 b 之后的行列式 ÷ det(A)，Fraction 精确算完再转 float。
    d = _det(a)
    out = []
    for i in range(len(a)):
        replaced = [row[:i] + [b[r]] + row[i + 1:] for r, row in enumerate(a)]
        out.append(round(float(Fraction(_det(replaced), d)), 9))
    return out


# ── determinant-and-identity ─────────────────────────────────────────────

def _square(rng):
    # 1×1 到 4×4，偶数阶加重（清单 §2.2：「列顺序反了」这类错奇数次交换才改符号，
    # 偶数阶上更常露馅）：阶数取自 [1, 2, 2, 3, 4, 4]。
    # 约三分之一造行列式为 0 的：某一行换成另一行的 k 倍（k 可为 0，即整行为 0）。
    n = rng.choice([1, 2, 2, 3, 4, 4])
    m = [[rng.randint(-5, 5) for _ in range(n)] for _ in range(n)]
    if n >= 2 and rng.random() < 1 / 3:
        src, dst = rng.sample(range(n), 2)
        k = rng.randint(-2, 2)
        m[dst] = [k * x for x in m[src]]
    return (m,)


# ── transform-2d-points ──────────────────────────────────────────────────

def _points(rng):
    # 非空（文档串写明 non-empty）：1..8 个点，坐标 -9..9。
    return ([[rng.randint(-9, 9), rng.randint(-9, 9)] for _ in range(rng.randint(1, 8))],)


def _rotate_swap(points):
    # 被测：pts @ R.T；参照：逐点 (x, y) → (-y, x)。
    return [[-y, x] for x, y in points]


# ── eigen-2x2 ────────────────────────────────────────────────────────────

def _symmetric(rng):
    # [[a, b], [b, d]]，元素 -9..9。约四分之一令 b = 0（对角阵，特征值就是 a 与 d，
    # 顺序要按大小排）；其中一半再令 a = d（重根）。
    a, b, d = rng.randint(-9, 9), rng.randint(-9, 9), rng.randint(-9, 9)
    if rng.random() < 0.25:
        b = 0
        if rng.random() < 0.5:
            d = a
    return a, b, d


def _eigen_formula(a, b, d):
    # 被测：np.linalg.eigvalsh（LAPACK）；参照：特征方程 λ² − tλ + det = 0 的求根公式，
    # t = a + d，判别式 t² − 4·det = (a − d)² + 4b² ≥ 0；小的在前。
    t = a + d
    s = math.sqrt((a - d) ** 2 + 4 * b * b)
    return [round((t - s) / 2, 9), round((t + s) / 2, 9)]


# ── markov-weather ───────────────────────────────────────────────────────

# 与被测程序里的 P 相同（改程序的 P 时这里一起改）。
_P = [[0.75, 0.25], [0.5, 0.5]]


def _start_and_days(rng):
    # 清单 §2.2：n = 0 必须出现——约四分之一的组 n = 0（返回起始向量本身）。
    # 起始向量取几个概率分布（元素是 1/8 的倍数，二进制精确），也有整数写法 [1, 0]、[0, 1]。
    start = rng.choice([[1, 0], [0, 1], [1.0, 0.0], [0.5, 0.5], [0.25, 0.75], [0.875, 0.125]])
    n = 0 if rng.random() < 0.25 else rng.randint(1, 40)
    return list(start), n


def _markov_loop(start, n):
    # 被测：state @ np.linalg.matrix_power(P, n)（反复平方）；参照：逐天做 n 次行向量乘矩阵。
    state = [float(x) for x in start]
    for _ in range(n):
        state = [state[0] * _P[0][j] + state[1] * _P[1][j] for j in range(2)]
    return [round(p, 9) for p in state]


REFERENCES = {
    'matrix-product-matmul': {'ref': _matmul_loops, 'cases': _matrices},
    'dot-product-angle': {'ref': _cosine_hypot, 'cases': _vector_pair},
    'linear-system-solve': {'ref': _cramer, 'cases': _system},
    'linear-system-inverse': {'ref': _cramer, 'cases': _system},
    'determinant-and-identity': {'ref': _det, 'cases': _square},
    'transform-2d-points': {'ref': _rotate_swap, 'cases': _points},
    'eigen-2x2': {'ref': _eigen_formula, 'cases': _symmetric},
    'markov-weather': {'ref': _markov_loop, 'cases': _start_and_days},
}
