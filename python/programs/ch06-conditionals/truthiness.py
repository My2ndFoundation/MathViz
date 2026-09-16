"""An if does not need True or False: every value counts as truthy or falsy."""


def describe(value):
# >>> BLANK id=test-value level=1 hint="直接把 value 本身交给 if 去判真假：不调用 bool()，也不拿它去和 True 或 False 做任何比较" hintEn="Hand value itself straight to the if to be judged: do not call bool() on it, and do not compare it with True or False in any way"
    if value:
# <<< BLANK
        return "truthy"
    return "falsy"


def show_items(items):
# >>> BLANK id=test-items level=1 hint="列表里有东西才打印它：让列表自己当条件——不写 len()、不调用 bool()，也不拿它去和空列表比较" hintEn="Print the list only when it has something in it: let the list itself be the condition - no len(), no bool(), and no comparison with an empty list"
    if items:
# <<< BLANK
        print("items:", items)
    else:
        print("nothing to show")


if __name__ == "__main__":
    for value in [0, 1, -2, 0.0, 0.5, "", "0", " ", [], [0], {}, None, False]:
        print(repr(value), describe(value))
    print(bool("False"), bool([[]]), bool(()))
    show_items(["pen", "ruler"])
    show_items([])
