"""Choose the most activities that do not overlap: sort by finishing time, then be greedy."""


def finish_time(activity):
    return activity[1]


def select_activities(activities):
    chosen = []
    last_end = None
# >>> BLANK id=by-finish level=2 hint="按结束时间从早到晚一个个看：一个 for，把每个 (start, end) 元组直接拆进两个变量（不加括号）；用 sorted 排出一份新的，按上面定义的那个函数排 || sorted 的关键字实参是 key=，给它的是函数名本身，不带括号" hintEn="Look at the activities in order of finishing time: a for that unpacks each (start, end) tuple straight into two variables (no brackets round them); use sorted to make a new ordered copy, ordered by the function defined above || sorted's keyword argument is key=, and it is given the function name itself, without brackets"
    for start, end in sorted(activities, key=finish_time):
# <<< BLANK
# >>> BLANK id=fits level=2 hint="能不能选它：还没选过任何活动，或者它开始时上一个已选的已经结束。一个 if，两个条件都只看 last_end，用 or 连起来，先判还没选过；判 None 用 is；第二个条件 start 写在比较号左边 || 首尾相接也不算重叠，所以 start 与 last_end 比用大于等于" hintEn="Can it be chosen: nothing has been chosen yet, or the last chosen activity has finished by the time it starts. An if whose two conditions both look at last_end, joined by or, the nothing-yet test first; test for None with is; in the second condition start goes on the left of the comparison || Ending exactly when the next one starts is not an overlap, so compare start with last_end using greater-than-or-equal"
        if last_end is None or start >= last_end:
# <<< BLANK
            chosen.append((start, end))
            last_end = end
    return chosen


def count_activities(activities):
    return len(select_activities(activities))


if __name__ == "__main__":
    day = [(1, 4), (3, 5), (0, 6), (5, 7), (3, 9), (5, 9), (6, 10), (8, 11)]
    print(select_activities(day))
    long_first = [(0, 10), (1, 3), (4, 6)]
    print(select_activities(long_first))
    short_middle = [(0, 5), (4, 7), (6, 11)]
    print(select_activities(short_middle))
