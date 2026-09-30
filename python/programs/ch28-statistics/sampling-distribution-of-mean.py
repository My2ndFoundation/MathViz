"""How the spread of sample means shrinks as the samples grow."""
import numpy as np

MU = 50
SIGMA = 10
REPEATS = 2000


def sample_means(rng, n, repeats):
# >>> BLANK id=draw level=3 hint="一次抽出 repeats 组、每组 n 个正态随机数，存进 samples。写法先定下：调用 rng 的 normal 方法，均值和标准差按位置写常量 MU、SIGMA（不写 loc=、scale=），形状用关键字 size 给一个元组 || 形状是（组数, 每组个数）：repeats 行、n 列，每一行是一组样本 || 和演示块里抽一组 4 个的那一行同一个写法，只是 size 换成了二维的元组" hintEn="Draw repeats groups of n normal random numbers in one go and store them in samples. Fix the form first: call rng's normal method with the mean and standard deviation given by position as the constants MU and SIGMA (not loc=, scale=), and the shape as a tuple through the keyword size || The shape is (number of groups, size of each group): repeats rows and n columns, each row one sample || Written the same way as the line in the demo that draws one group of 4, only size becomes a two-dimensional tuple"
    samples = rng.normal(MU, SIGMA, size=(repeats, n))
# <<< BLANK
# >>> BLANK id=row-means level=2 hint="一行 return：每一行（每一组样本）的均值。写法先定下：调用 samples 自己的 mean 方法（不用 np.mean），轴用关键字 axis 写 || axis=0 是沿行往下、每列一个结果；这里要每行一个结果" hintEn="One return line: the mean of every row (every sample). Fix the form first: call samples' own mean method (not np.mean), and give the axis with the keyword axis || axis=0 runs down the rows and gives one result per column; here you want one result per row"
    return samples.mean(axis=1)
# <<< BLANK


def share_within(means, width):
    return float((np.abs(means - MU) < width).mean())


if __name__ == "__main__":
    rng = np.random.default_rng(2026)
    one = rng.normal(MU, SIGMA, size=4)
    print("one sample of 4:", np.round(one, 1))
    print("its mean:", round(float(one.mean()), 2))

    print("n  mean_of_means  sd_of_means  sigma/sqrt(n)")
    for n in (4, 16, 64):
        means = sample_means(rng, n, REPEATS)
# >>> BLANK id=standard-error level=1 hint="理论上样本均值的标准差，存进 predicted：SIGMA 除以 n 的平方根，平方根用 np.sqrt（不用 ** 0.5，也不用 math.sqrt）" hintEn="The standard deviation that theory predicts for the sample means, stored in predicted: SIGMA divided by the square root of n, taking the root with np.sqrt (not ** 0.5, not math.sqrt)"
        predicted = SIGMA / np.sqrt(n)
# <<< BLANK
        spread = round(float(means.std()), 2)
        print(n, round(float(means.mean()), 2), spread, round(float(predicted), 2))

    means = sample_means(rng, 16, REPEATS)
    print("n = 16, share within 5 of MU:", share_within(means, 5))
    print("n = 16, share within 2.5 of MU:", share_within(means, 2.5))

    single = rng.normal(MU, SIGMA, size=REPEATS)
    print("single values, share within 5 of MU:", share_within(single, 5))
