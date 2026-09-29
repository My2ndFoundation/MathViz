"""Double n again and again and see how many times more steps each task takes."""


def largest_steps(n):
    steps = 0
    for i in range(1, n):
        steps += 1
    return steps


def all_pairs_steps(n):
    steps = 0
    for i in range(n):
        for j in range(i + 1, n):
            steps += 1
    return steps


def halving_steps(n):
    steps = 0
    for i in range(n):
        k = n
# >>> BLANK id=halve-test level=2 hint="数 k 要对半分几次才降到 1：一个 while，k 写在比较号左边，与 1 比较 || 用严格的大于号——k 已经是 1 就不再分了；写成与 0 比较会多数一次" hintEn="Count how many halvings bring k down to 1: a while with k on the left of the comparison, compared with 1 || Use a strict greater-than - once k is 1 there is no more halving; comparing with 0 would count one halving too many"
        while k > 1:
# <<< BLANK
            steps += 1
            k //= 2
    return steps


def doubling_ratios(count_steps, start, rounds):
    ratios = []
    n = start
    previous = count_steps(n)
    for _ in range(rounds):
        n *= 2
        current = count_steps(n)
# >>> BLANK id=ratio level=2 hint="记下这一轮的倍数：新的步数除以上一轮的步数，用 append 加进 ratios || 用 / 真除（倍数不一定是整数），current 在前" hintEn="Record this round's ratio: the new step count divided by the previous one, added to ratios with append || Use / for true division (the ratio need not be whole), current first"
        ratios.append(current / previous)
# <<< BLANK
# >>> BLANK id=move-on level=1 hint="为下一轮做准备：这一轮的步数变成下一轮的「上一轮」，一个简单赋值" hintEn="Get ready for the next round: this round's count becomes the next round's previous count, as a plain assignment"
        previous = current
# <<< BLANK
    return ratios


if __name__ == "__main__":
    tasks = (("largest", largest_steps), ("all pairs", all_pairs_steps), ("halving", halving_steps))
    for name, count_steps in tasks:
        ratios = doubling_ratios(count_steps, 16, 5)
        print(name, " ".join(f"{r:.2f}" for r in ratios))
