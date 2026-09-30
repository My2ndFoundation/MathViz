"""A shuffle that looks right but is biased: swap every slot with any slot at all."""
import random
from itertools import product


def naive_shuffle(items, choices):
    for i, j in enumerate(choices):
# >>> BLANK id=swap level=1 hint="交换 i 号与 j 号两格：一行同时赋值，左边 items[i] 在前、items[j] 在后" hintEn="Swap slots i and j: one simultaneous assignment, with items[i] first and items[j] second on the left"
        items[i], items[j] = items[j], items[i]
# <<< BLANK


def random_choices(rng, n):
# >>> BLANK id=any-slot level=2 hint="一行 return 一个列表推导式：每一项用 rng 的 randrange 方法、只给一个实参（不用 randint），循环变量用下划线 || 错就错在这里：每一格都从全部 n 个位置里挑，而不是只从还没定下来的那几格里挑——所以实参就是 n，推导式循环 n 次" hintEn="One line that returns a list comprehension: each item from rng's randrange method with a single argument (not randint), and the loop variable an underscore || This is where it goes wrong: every slot picks from all n positions, not just from the slots not yet settled - so the argument is simply n, and the comprehension loops n times"
    return [rng.randrange(n) for _ in range(n)]
# <<< BLANK


def count_orders(all_choices):
    counts = {}
    for choices in all_choices:
        cards = ["A", "B", "C"]
        naive_shuffle(cards, choices)
        order = "".join(cards)
        counts[order] = counts.get(order, 0) + 1
    return counts


if __name__ == "__main__":
    rng = random.Random(2026)
    simulated = count_orders(random_choices(rng, 3) for _ in range(6000))
# >>> BLANK id=every-path level=2 hint="一行，调用 count_orders，结果存进 exact；实参用 itertools 的 product，给它关键字实参 repeat（不把 range(3) 写三遍） || 三次挑选、每次 3 种，一共 27 种；product 的第一个实参是 range(3)，repeat 是 3" hintEn="One line calling count_orders, with the result stored in exact; the argument is itertools' product with the keyword argument repeat (not range(3) written three times) || Three picks of 3 options each make 27 in all; product's first argument is range(3), and repeat is 3"
    exact = count_orders(product(range(3), repeat=3))
# <<< BLANK
    print("order simulated exact_of_27")
    for order in sorted(exact):
        print(order, simulated[order], exact[order])
