"""Remove duplicates but keep the first-seen order, using a seen set."""


def dedupe(items):
# >>> BLANK id=empty-set level=2 hint="一个空集合，名字叫 seen，用来记住见过的元素。小心：一对空花括号造出来的不是集合 || 空集合只能靠调用集合类型本身来造" hintEn="An empty set called seen, to remember the items already met. Careful: a pair of empty curly braces does not make a set || The only way to make an empty set is to call the set type itself"
    seen = set()
# <<< BLANK
    result = []
    for item in items:
# >>> BLANK id=not-seen level=1 hint="只在这个元素还没见过时才往下做：用 not in 这个成员运算符，不写成 not 放在最前面的样子" hintEn="Carry on only if this item has not been seen yet: use the not in membership operator, not a not placed at the front"
        if item not in seen:
# <<< BLANK
# >>> BLANK id=record-keep level=2 hint="两行，顺序照这里：先把 item 记进 seen，再把它追加到 result 的末尾 || 集合用 add，列表用 append" hintEn="Two lines, in this order: first record item in seen, then append it to the end of result || A set uses add; a list uses append"
            seen.add(item)
            result.append(item)
# <<< BLANK
    return result


if __name__ == "__main__":
    names = ["Cara", "Ben", "Cara", "Ada", "Ben"]
    print(dedupe(names))
    print(dedupe([3, 1, 3, 3, 2, 1]))
    print(dedupe([]))
    print(type({}).__name__, type(set()).__name__)
