"""Find the missing readings (NaN), then drop them or fill each gap with the mean of the readings that are there."""

import pandas as pd

READINGS = [12.0, None, 15.0, 9.0, None, 14.0]


def fill_with_mean(values):
    s = pd.Series(values, dtype="float64")
# >>> BLANK id=fill-gaps level=2 hint="把 s 里每个缺失的位置补上 s 的均值，结果存进 filled——用 fillna，实参直接写（不写 value=），就是 s 自己的 .mean() || mean() 求均值时会跳过 NaN，所以算出来的就是在场那些读数的均值，不用先 dropna" hintEn="Fill every missing place in s with the mean of s, keeping the result in filled - use fillna with the argument written straight in (no value=), and that argument is s's own .mean() || mean() skips NaN when it averages, so this is already the mean of the readings that are there; no need to dropna first"
    filled = s.fillna(s.mean())
# <<< BLANK
    return [round(v, 9) for v in filled]


if __name__ == "__main__":
    s = pd.Series(READINGS, dtype="float64")
    print(s.tolist())
    print(s.isna().tolist())
# >>> BLANK id=count-missing level=2 hint="打印缺了几个读数：s.isna() 给出一列 True / False，接着调用它的 .sum() 方法求和（True 算 1），再用 int() 转成普通整数，整句套在 print() 里 || 链式写，外面两层是 print 和 int" hintEn="Print how many readings are missing: s.isna() gives a column of True / False; call its .sum() method on that (True counts as 1), then turn the result into a plain whole number with int(), all wrapped in print() || Written as a chain, with print and int as the two outer layers"
    print(int(s.isna().sum()))
# <<< BLANK
    print(s.dropna().tolist())
    print(len(s), len(s.dropna()))
    print(float(s.mean()))
    print(float(s.fillna(0).mean()))
    print(fill_with_mean(READINGS))
    print(fill_with_mean([None, 3, None]))
