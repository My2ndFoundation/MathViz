"""Two jobs where a plain loop reads better than a comprehension."""


def shout_all_comprehension(words):
    return [print(word.upper()) for word in words]


def shout_all_loop(words):
    for word in words:
        print(word.upper())


def rising_triples_comprehension(n):
    return [(a, b, c) for a in range(n) for b in range(n) for c in range(n) if a < b < c]


def rising_triples_loop(n):
    triples = []
    for a in range(n):
# >>> BLANK id=inner-start level=2 hint="第二层循环，循环变量叫 b：b 从比 a 大 1 的数开始、到 n 之前为止，这样 a < b 不用再判断；range 用两个实参，a 写在加号左边 || 比 a 小或等于 a 的 b 根本不会出现，所以 rising_triples_comprehension 先造出来、再被它的 if 扔掉的那些组合，这里一个都不产生" hintEn="The second loop, with loop variable b: b starts one above a and stops before n, so a < b never needs testing; range takes two arguments, with a on the left of the plus || A b that is not bigger than a never comes up at all, so none of the combinations that rising_triples_comprehension builds and then throws away with its if are ever produced"
        for b in range(a + 1, n):
# <<< BLANK
            for c in range(b + 1, n):
# >>> BLANK id=append-triple level=1 hint="把 a、b、c 按这个顺序组成一个元组，接到 triples 末尾（用 append，元组自己的圆括号要写出来）" hintEn="Put a, b and c together, in that order, as one tuple and add it to the end of triples (with append, and write out the tuple's own brackets)"
                triples.append((a, b, c))
# <<< BLANK
    return triples


if __name__ == "__main__":
    wasted = shout_all_comprehension(["hi", "there"])
    print(wasted)
    shout_all_loop(["hi", "there"])
    print(rising_triples_comprehension(4))
    print(rising_triples_loop(4) == rising_triples_comprehension(4))
