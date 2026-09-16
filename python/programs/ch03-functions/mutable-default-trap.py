"""A default list is made once, when def runs, and every call shares it."""


# >>> BLANK id=shared-default level=1 hint="两个形参：先是 item；再是 basket，调用方不给时它默认是一个空列表——就写在形参表里，用方括号" hintEn="Two parameters: item first, then basket, which defaults to an empty list when the caller gives none - written right in the parameter list, with square brackets"
def add_item(item, basket=[]):
# <<< BLANK
# >>> BLANK id=grow level=1 hint="把 item 加到 basket 末尾，就地改这个列表：用列表的 append 方法，不用 += 也不用 + 拼一个新列表" hintEn="Put item on the end of basket, changing that list in place: use the list's append method, not += and not + to build a new list"
    basket.append(item)
# <<< BLANK
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
