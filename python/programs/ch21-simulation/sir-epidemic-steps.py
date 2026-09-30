"""An epidemic in daily steps: susceptible, infected and recovered people."""


def step(s, i, r, beta, gamma):
    n = s + i + r
    new_infections = beta * s * i / n
    new_recoveries = gamma * i
# >>> BLANK id=all-at-once level=3 hint="一行 return 三个用逗号隔开的表达式（不加括号），顺序是 S、I、R。写法先定下：每个表达式以旧值（s、i、r）开头，I 那一项先加后减 || 三个新值都只用旧的 s、i、r 与上面算好的两个量 || S 少掉新感染的；I 多了新感染的、又少了新康复的；R 多了新康复的" hintEn="One return line with three expressions separated by commas (no brackets), in the order S, I, R. Fix the form first: each expression starts with the old value (s, i, r), and the I term adds before it subtracts || All three new values use only the old s, i and r and the two amounts worked out above || S loses the new infections; I gains the new infections and loses the new recoveries; R gains the new recoveries"
    return s - new_infections, i + new_infections - new_recoveries, r + new_recoveries
# <<< BLANK


def step_one_at_a_time(s, i, r, beta, gamma):
    n = s + i + r
    s = s - beta * s * i / n
    i = i + beta * s * i / n - gamma * i
    r = r + gamma * i
    return s, i, r


if __name__ == "__main__":
    s, i, r = 990.0, 10.0, 0.0
    beta, gamma = 0.3, 0.1
    peak_day, peak = 0, i
    print("day S I R")
    for day in range(1, 121):
        s, i, r = step(s, i, r, beta, gamma)
# >>> BLANK id=peak level=2 hint="两行：一个 if 加一次同时赋值（不用 max）。写法先定下：i 写在比较号左边、用严格的大于号；赋值的左边 peak_day 在前、peak 在后 || 今天的感染人数超过纪录时，同时记下今天是第几天（day）与人数（i）" hintEn="Two lines: an if and a simultaneous assignment (not max). Fix the form first: i on the left of the comparison, with a strict greater-than; peak_day before peak on the left of the assignment || When today's number infected beats the record, record both the day (day) and the number (i) at once"
        if i > peak:
            peak_day, peak = day, i
# <<< BLANK
        if day % 20 == 0:
            print(day, f"{s:.1f}", f"{i:.1f}", f"{r:.1f}")
    print("peak on day", peak_day, "with", f"{peak:.1f}", "infected")
    print("total, all at once:", f"{s + i + r:.6f}")
    s, i, r = 990.0, 10.0, 0.0
    for day in range(120):
        s, i, r = step_one_at_a_time(s, i, r, beta, gamma)
    print("total, one at a time:", f"{s + i + r:.6f}")
