"""Remove duplicates but keep the first-seen order, using dict.fromkeys."""


def dedupe(items):
# >>> BLANK id=fromkeys level=2 hint="一行 return：用 dict.fromkeys 把 items 变成一个字典（每个元素一个键），再把这个字典直接交给 list() 转成列表交回（不调用 keys()） || 字典的键不重复、又按第一次放进去的顺序排；把字典交给 list()，得到的是它的键" hintEn="One line of return: turn items into a dictionary with dict.fromkeys (one key per item), then hand that dictionary straight to list() and return the result (without calling keys()) || A dictionary's keys are never repeated and stay in the order they were first put in; handing a dictionary to list() gives you its keys"
    return list(dict.fromkeys(items))
# <<< BLANK


if __name__ == "__main__":
    names = ["Cara", "Ben", "Cara", "Ada", "Ben"]
# >>> BLANK id=show-fromkeys level=1 hint="把 dict.fromkeys 作用在 names 上造出的字典直接打印出来——只传一个实参，不另给值" hintEn="Print the dictionary that dict.fromkeys builds from names - just one argument, no value given"
    print(dict.fromkeys(names))
# <<< BLANK
    print(dedupe(names))
    print(sorted(set(names)))
    print(dedupe([3, 1, 3, 3, 2, 1]))
    print(dedupe([]))
