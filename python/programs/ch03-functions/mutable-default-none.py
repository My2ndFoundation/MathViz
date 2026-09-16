"""Use None as the default and make a fresh list inside the function."""


# >>> BLANK id=sentinel-default level=1 hint="形参表与陷阱版一样是 item 在前、basket 在后；变的只有 basket 的默认值：这次给一个「什么都没给」的哨兵，不是列表" hintEn="The parameter list is the same as in the trap version, item then basket; only basket's default changes: this time a sentinel meaning nothing was given, not a list"
def add_item(item, basket=None):
# <<< BLANK
# >>> BLANK id=fresh-list level=2 hint="调用方没给列表时，就在函数里现造一个新的：一个 if 加下一行一句赋值（不用条件表达式）；判断用 is 比较身份，不用 == 也不用 not basket；新列表写成空方括号，不写 list() || 判断的是 basket 是不是上面形参表里那个默认值；成立时让 basket 重新指向新列表" hintEn="When the caller gave no list, build a new one inside the function: an if with one assignment on the next line (not a conditional expression); test identity with is, not == and not not basket; write the new list as empty square brackets, not list() || the test asks whether basket is the default from the parameter list above; when it is, point basket at the new list"
    if basket is None:
        basket = []
# <<< BLANK
    basket.append(item)
    return basket


if __name__ == "__main__":
    first = add_item("apple")
    print(first)
    second = add_item("bread")
    print(second)
    print(first)
    print(first is second)
    print(add_item("tea", []))
    print(add_item("milk"))
    print(add_item.__defaults__)
