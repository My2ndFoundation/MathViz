"""Create, read, update and delete the entries of a dictionary."""


def report(stock):
# >>> BLANK id=items-loop level=1 hint="逐对走遍 stock 的键和值：循环变量依次叫 item、count，不加括号；用那个一次交出「键, 值」对的方法，不用下标再去取值" hintEn="Walk the keys and values of stock in pairs: loop variables item then count, with no brackets round them; use the method that hands back key, value pairs, not an index lookup afterwards"
    for item, count in stock.items():
# <<< BLANK
        print("  " + item, count)


if __name__ == "__main__":
    stock = {"apples": 12, "pears": 5}
    print(stock["apples"])
    try:
        print(stock["plums"])
# >>> BLANK id=except-key level=2 hint="接住按不存在的键取值时抛出的那种异常，把它绑定到名字 e 上 || 这个异常的名字就说出了出错的原因：是键出了问题" hintEn="Catch the kind of exception raised when you look up a key that is not there, and bind it to the name e || The exception's name says what went wrong: it was the key"
    except KeyError as e:
# <<< BLANK
        print("missing:", type(e).__name__)
    print(stock.get("plums"), stock.get("plums", 0))
    print("pears" in stock, 5 in stock)
    stock["plums"] = 8
    stock["apples"] = 10
    report(stock)
# >>> BLANK id=delete level=2 hint="两行，先后顺序照这里：第一行用 del 语句删掉 pears（del 后面不加括号）；第二行用 pop 方法删掉 plums，并把它交回的值存进 sold。键都写成双引号字符串 || del 只删、什么也不交回；pop 删掉的同时把那个值交回来" hintEn="Two lines, in this order: the first removes pears with the del statement (no brackets after del); the second removes plums with the pop method and stores what it hands back in sold. Write the keys as double-quoted strings || del only removes and hands nothing back; pop removes the entry and hands its value back as well"
    del stock["pears"]
    sold = stock.pop("plums")
# <<< BLANK
    print(sold, stock)
    print(list(stock.keys()), list(stock.values()))
