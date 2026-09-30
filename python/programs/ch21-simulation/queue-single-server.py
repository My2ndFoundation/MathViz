"""One checkout, one queue: customers arrive, wait their turn and are served one at a time."""
import random
from collections import deque


def simulate(gaps, services):
    clock = 0
    free_at = 0
    waits = []
    line = deque()
    longest = 0
    for gap, service in zip(gaps, services):
        clock += gap
        while line and line[0] <= clock:
            line.popleft()
# >>> BLANK id=start-time level=2 hint="一行，用一个内置函数算出来，存进 start；两个实参 clock 在前、free_at 在后 || 她开始被服务的时刻，是她到达的时刻与柜台空出来的时刻里较晚的那一个" hintEn="One line using a built-in function, stored in start; its two arguments are clock first and free_at second || She starts being served at whichever is later: the moment she arrives or the moment the till is free"
        start = max(clock, free_at)
# <<< BLANK
        waits.append(start - clock)
        if start > clock:
            line.append(start)
        longest = max(longest, len(line))
# >>> BLANK id=free-again level=1 hint="柜台下一次空出来的时刻：从她开始被服务算起，再过她的服务时长；一行赋值，start 在加号左边" hintEn="The next moment the till is free: her service time after she starts; one assignment, with start on the left of the plus"
        free_at = start + service
# <<< BLANK
    return waits, longest


def run(seed, customers, slowest):
    rng = random.Random(seed)
    gaps = [rng.randint(1, 6) for _ in range(customers)]
    services = [rng.randint(1, slowest) for _ in range(customers)]
    waits, longest = simulate(gaps, services)
    return sum(waits) / customers, max(waits), longest


if __name__ == "__main__":
    print(simulate([0, 1, 1, 5], [3, 3, 1, 2]))
    print("slowest mean_wait max_wait longest_line")
    for slowest in (3, 4, 5, 6):
        mean_wait, max_wait, longest = run(42, 1000, slowest)
        print(slowest, f"{mean_wait:.2f}", max_wait, longest)
