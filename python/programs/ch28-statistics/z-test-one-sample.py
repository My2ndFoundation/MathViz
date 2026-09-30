"""A one-sample z-test: is the true mean different from the claim?"""
import math
from statistics import NormalDist

ALPHA = 0.05


def z_test(sample, mu0, sigma):
    n = len(sample)
    mean = sum(sample) / n
# >>> BLANK id=z level=3 hint="检验统计量存进 z。写法先定下：分子是一对括号里的 mean 减 mu0，除以另一对括号里的标准误；标准误里 sigma 除以 n 的平方根，平方根用 math.sqrt（不用 ** 0.5） || 标准误是样本均值的标准差：σ / √n || 形状是 (… - …) / (… / math.sqrt(…))" hintEn="The test statistic, stored in z. Fix the form first: the top is mean minus mu0 in one pair of brackets, divided by the standard error in another pair; inside that, sigma divided by the square root of n, taken with math.sqrt (not ** 0.5) || The standard error is the standard deviation of the sample mean: sigma / sqrt(n) || The shape is (... - ...) / (... / math.sqrt(...))"
    z = (mean - mu0) / (sigma / math.sqrt(n))
# <<< BLANK
# >>> BLANK id=p level=3 hint="双侧 p 值存进 p。写法先定下：2 乘以一对括号，括号里是 1 减去标准正态分布在 |z| 处的 cdf；标准正态写成不带实参的 NormalDist()，绝对值用内置 abs || cdf(|z|) 是不超过 |z| 的概率，1 减去它就是右边尾巴的面积 || 双侧检验两边的尾巴都算，右尾的面积乘以 2" hintEn="The two-sided p-value, stored in p. Fix the form first: 2 times one pair of brackets, and inside them 1 minus the standard normal's cdf at |z|; write the standard normal as NormalDist() with no arguments, and take the absolute value with the built-in abs || cdf(|z|) is the probability of being at most |z|, so 1 minus it is the area of the right-hand tail || A two-sided test counts both tails: twice the right-hand tail"
    p = 2 * (1 - NormalDist().cdf(abs(z)))
# <<< BLANK
# >>> BLANK id=decide level=2 hint="一行 return 三个值，不加外层括号：z 和 p 各自 round 到 6 位，第三个是一次比较的结果（布尔值）；比较用没舍入的 p、放在左边，用严格的小于，右边是常量 ALPHA || p 小于显著性水平就拒绝 H0" hintEn="One return line with three values and no outer brackets: z and p each rounded to 6 places, and the third is the result of one comparison (a bool); compare the unrounded p, on the left, with a strict less-than against the constant ALPHA on the right || Reject H0 when p is below the significance level"
    return round(z, 6), round(p, 6), p < ALPHA
# <<< BLANK


def report(name, sample, mu0, sigma):
    z, p, reject = z_test(sample, mu0, sigma)
    print(name)
    print("  H0: mu =", mu0, "  H1: mu !=", mu0)
    mean = sum(sample) / len(sample)
    print("  mean =", round(mean, 2), " z =", round(z, 3), " p =", round(p, 4))
    if reject:
        print("  p < 0.05: reject H0 at the 5% level")
    else:
        print("  p >= 0.05: not enough evidence to reject H0")


if __name__ == "__main__":
    bags = [497, 502, 495, 498, 496, 499, 494, 501, 497, 495]
    report("bags of flour, claimed 500 g, sigma 4 g", bags, 500, 4)

    bulbs = [1012, 985, 1003, 996, 1020, 991, 1008, 999]
    report("light bulbs, claimed 1000 h, sigma 15 h", bulbs, 1000, 15)

    print("critical z for 5%, two-sided:", round(NormalDist().inv_cdf(0.975), 2))
