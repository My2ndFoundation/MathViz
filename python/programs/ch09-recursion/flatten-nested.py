"""Flatten a list nested to any depth into one flat list."""


def flatten(items):
    flat = []
    for item in items:
# >>> BLANK id=nested level=2 hint="两行：item 本身是一个列表时（用 isinstance，不用 type(...) ==），先递归把它展平，再把结果里的元素全部接到 flat 末尾；用 extend 方法，不用 += || isinstance 的第二个实参是类型名本身，不加引号；递归的实参是 item" hintEn="Two lines: when item is itself a list (use isinstance, not type(...) ==), flatten it recursively first and add every element of the result to the end of flat; use the extend method, not += || The second argument of isinstance is the type name itself, not in quotes; the recursive call is given item"
        if isinstance(item, list):
            flat.extend(flatten(item))
# <<< BLANK
# >>> BLANK id=leaf level=1 hint="两行：否则（不是列表的单个值），把 item 原样放到 flat 末尾，一次放一个——用 append" hintEn="Two lines: otherwise (a single value that is not a list), put item on the end of flat as it is, one at a time - with append"
        else:
            flat.append(item)
# <<< BLANK
    return flat


if __name__ == "__main__":
    print(flatten([1, [2, 3], [4, [5, [6]]], 7]))
    print(flatten([[], [[]], [[[8]]]]))
    print(flatten(["ab", ["cd", ("e", "f")]]))
