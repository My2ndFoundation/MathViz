"""Sort, and find the smallest and largest, by a key you choose."""


def by_score(players):
# >>> BLANK id=key-lambda level=2 hint="一行 return 内置 sorted 的结果：按每个 (名字, 分数) 元组的分数从低到高排；key= 给一个 lambda，参数叫 player、取分数时用正的下标，不用 operator.itemgetter || lambda 交回的是排序时拿来比较的那个值：player 里下标为 1 的那一项" hintEn="One line: return the result of the built-in sorted, ordering the (name, score) tuples by score from low to high; pass key= a lambda whose parameter is player and which reaches the score with a positive index, not operator.itemgetter || What the lambda hands back is the value compared while sorting: the item of player at index 1"
    return sorted(players, key=lambda player: player[1])
# <<< BLANK


def by_score_desc_then_name(players):
# >>> BLANK id=tuple-key level=3 hint="一行 return sorted 的结果：分数高的在前，同分按名字字母序；只用一个 key= lambda（参数叫 player），它交回一个元组，不用 reverse= || lambda 交回一个二元组：先比第一项，相等时才比第二项 || 让分数从高到低，是在第一项的分数前面直接写一个负号；名字原样放在第二项" hintEn="One line: return the result of sorted with higher scores first and equal scores in alphabetical order of name; use a single key= lambda (parameter player) that hands back a tuple, and no reverse= || The lambda hands back a pair: the first items are compared first, and the second only when the first are equal || High-to-low scores come from writing a minus sign straight in front of the score in the first item; the name goes second, unchanged"
    return sorted(players, key=lambda player: (-player[1], player[0]))
# <<< BLANK


if __name__ == "__main__":
    players = [("Chen", 88), ("Ada", 91), ("Eve", 64), ("Bob", 88), ("Dan", 91)]
    print(by_score(players))
    print(by_score_desc_then_name(players))
    print(min(players, key=lambda player: player[1]))
# >>> BLANK id=max-key level=1 hint="照上一行的样子打印分数最高的那个元组：换一个内置函数，key= 的 lambda 一字不改" hintEn="Following the line above, print the tuple with the highest score: swap to the other built-in function and keep the key= lambda exactly the same"
    print(max(players, key=lambda player: player[1]))
# <<< BLANK
    print(max(players))
