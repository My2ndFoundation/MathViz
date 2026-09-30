"""Add, remove and find items in a list with its built-in methods."""


def build_names():
    names = ["Ada", "Bob"]
    names.append("Cy")
# >>> BLANK id=insert level=2 hint="把名字 Di 放进第二个位置（下标 1），原来在那里的往后挪一格：调用列表的一个方法，不用切片；字符串用双引号 || 这个方法先收位置、再收要放进去的值" hintEn="Put the name Di into the second position (index 1), shifting whatever was there one place along: call a method of the list, not a slice; double quotes for the string || This method takes the position first and the value to put in second"
    names.insert(1, "Di")
# <<< BLANK
# >>> BLANK id=extend level=2 hint="把 Ed 和 Flo 两个名字按这个顺序逐个接到末尾，而不是把它们装成一个列表整个当作一项；调用列表的一个方法，实参是一个列表（不是元组），不用 +=；双引号 || 这个方法只收这一个实参，列表里按顺序写两个名字" hintEn="Add the two names Ed and Flo to the end one by one, in that order - not as a single item that is itself a list; call a method of the list with a list (not a tuple) as its argument, not +=; double quotes || This method takes just that one argument, with the two names written in order inside the list"
    names.extend(["Ed", "Flo"])
# <<< BLANK
    return names


def show_methods():
    names = build_names()
    print(names)
    pair = ["Ada"]
    pair.append(["Bob", "Cy"])
    print(pair, len(pair))
    last = names.pop()
# >>> BLANK id=pop-index level=2 hint="把下标 1 上的那一项取出来、同时从列表里删掉，交给 second；一行，用列表的方法，不用 del || 上一行那个方法这回带一个实参：要取的下标" hintEn="Take the item at index 1 out of the list - removing it - and hand it to second; one line, using a list method, not del || The method on the line above, this time given one argument: the index to take"
    second = names.pop(1)
# <<< BLANK
    print(last, second, names)
    names.append("Bob")
    names.remove("Bob")
    print(names)
    del names[0]
    print(names, names.index("Ed"), "Ed" in names, "Zoe" in names)
    empty = []
    try:
        empty.pop()
    except IndexError as e:
        print(type(e).__name__)


if __name__ == "__main__":
    show_methods()
