"""A one-sample t statistic when the population spread is unknown."""
import numpy as np

T_CRITICAL = {4: 2.776, 9: 2.262}


def t_statistic(sample, mu0):
    a = np.array(sample, dtype=float)
    n = len(a)
# >>> BLANK id=s level=2 hint="样本标准差存进 s：调用数组 a 自己的 std 方法（不用 np.std），用关键字实参 ddof || 总体的标准差不知道，只能拿样本来估计，所以除以 n - 1" hintEn="The sample standard deviation, stored in s: call the array a's own std method (not np.std) with the keyword argument ddof || The population's standard deviation is unknown and has to be estimated from the sample, so divide by n - 1"
    s = a.std(ddof=1)
# <<< BLANK
# >>> BLANK id=t level=3 hint="一行 return：t 统计量，用 float 转成 Python 的小数。写法先定下：float 包住整个商；分子是一对括号里 a 的均值（数组的 mean 方法）减 mu0，分母是另一对括号里 s 除以 n 的平方根，平方根用 np.sqrt || t = (x̄ - μ0) / (s / √n)：和 z 统计量同一个形状，只是 σ 换成了样本标准差 s || 形状是 float((… - …) / (s / np.sqrt(…)))" hintEn="One return line: the t statistic as a Python float. Fix the form first: float wraps the whole quotient; the top is the mean of a (the array's mean method) minus mu0 in one pair of brackets, the bottom is s divided by the square root of n in another pair, with the root taken by np.sqrt || t = (x-bar - mu0) / (s / sqrt(n)): the same shape as the z statistic, with sigma replaced by the sample standard deviation s || The shape is float((... - ...) / (s / np.sqrt(...)))"
    return float((a.mean() - mu0) / (s / np.sqrt(n)))
# <<< BLANK


def t_test(name, sample, mu0):
    t = t_statistic(sample, mu0)
    df = len(sample) - 1
    print(name)
    print("  n =", len(sample), " df =", df, " t =", round(t, 3))
    print("  critical value (two-sided, 5%):", T_CRITICAL[df])
# >>> BLANK id=compare level=2 hint="一行 if：|t| 超过临界值就拒绝 H0。写法先定下：绝对值用内置 abs，放在比较号左边，用严格的大于；右边是从字典 T_CRITICAL 里按 df 取出的临界值 || 临界值表按自由度查：一样本 t 检验的自由度是 n - 1，已经算好放在 df 里" hintEn="One if line: reject H0 when |t| is beyond the critical value. Fix the form first: take the absolute value with the built-in abs, on the left of a strict greater-than; on the right, the critical value looked up in the dictionary T_CRITICAL by df || The table is looked up by degrees of freedom: for a one-sample t-test that is n - 1, already worked out in df"
    if abs(t) > T_CRITICAL[df]:
# <<< BLANK
        print("  |t| is bigger: reject H0")
    else:
        print("  |t| is smaller: do not reject H0")


if __name__ == "__main__":
    hours = [18.2, 19.5, 17.8, 20.1, 18.9, 19.0, 18.4, 19.7, 18.1, 19.3]
    t_test("battery life, claimed 20 hours", hours, 20)

    jumps = [5.1, 4.6, 5.4, 4.9, 5.3]
    t_test("long jump, claimed 4.8 m", jumps, 4.8)

    print("z would need only 1.96; with 4 df t needs", T_CRITICAL[4])
