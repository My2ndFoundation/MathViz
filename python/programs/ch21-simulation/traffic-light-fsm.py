"""A UK traffic light as a finite state machine driven by a transition table."""

NEXT = {
    "red": "red+amber",
    "red+amber": "green",
    "green": "amber",
    "amber": "red",
}
DURATION = {"red": 4, "red+amber": 1, "green": 3, "amber": 1}


def run(start, ticks):
    state = start
    left = DURATION[start]
    history = []
    for _ in range(ticks):
        history.append(state)
        left -= 1
        if left == 0:
# >>> BLANK id=transition level=2 hint="两行赋值，先换状态、后重新计时；两个字典都用方括号查（不用 get） || 第一行查 NEXT，键是当前状态；第二行查 DURATION，键是刚换上的新状态" hintEn="Two assignments, the state first and the timer second; look up both dictionaries with square brackets (not get) || The first line looks up NEXT with the current state as the key; the second looks up DURATION with the new state just switched to"
            state = NEXT[state]
            left = DURATION[state]
# <<< BLANK
    return history


def cycle_length():
    total = 0
# >>> BLANK id=cycle level=2 hint="两行：一个 for 加一次 +=（不用 sum）；直接遍历字典的 values()，循环变量叫 ticks || 一整圈的拍数就是时长表里四个时长之和：每个时长都加进 total" hintEn="Two lines: a for and a += (not sum); loop straight over the dictionary's values(), with the loop variable called ticks || One full cycle lasts the four durations in the duration table added up: add each duration to total"
    for ticks in DURATION.values():
        total += ticks
# <<< BLANK
    return total


if __name__ == "__main__":
    for tick, state in enumerate(run("red", 10)):
        print(tick, state)
    print(run("amber", 3))
    print("one full cycle:", cycle_length(), "ticks")
    print("same after a cycle:", run("green", 20) == run("green", 29)[9:])
