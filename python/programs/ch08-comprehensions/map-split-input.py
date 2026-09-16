"""Read several whole numbers typed on one line."""


def read_ints(prompt):
# >>> BLANK id=map-int level=2 hint="一行 return：用 prompt 读一行，按空白切开，再把内置的 int 套到每一段上，最后交回一个列表——用 map，外面包 list()，不用推导式 || 从里往外：input(prompt) 读到的字符串先调不带实参的 split()；map 的第一个实参是函数 int 本身，不带括号" hintEn="One line of return: read a line with prompt, split it on whitespace, apply the built-in int to every piece and hand back a list - use map wrapped in list(), not a comprehension || From the inside out: call split() with no argument on the string input(prompt) reads; map's first argument is the function int itself, with no brackets after it"
    return list(map(int, input(prompt).split()))
# <<< BLANK


if __name__ == "__main__":
    numbers = read_ints("Numbers: ")
    print(numbers, sum(numbers))
# >>> BLANK id=unpack-two level=2 hint="同样用 map 把一行里的两个整数转好，但不包 list()：左边直接用两个名字 width、height 接住（不加括号）；input 的提示语用双引号写 || input 的提示语是 Width and height: （冒号后面有一个空格）" hintEn="Convert the two whole numbers on one line with map again, but without list(): catch them directly in two names on the left, width and height (no brackets); the prompt for input is in double quotes || The prompt passed to input is Width and height: (with one space after the colon)"
    width, height = map(int, input("Width and height: ").split())
# <<< BLANK
    print(width * height)
    parts = input("Comma list: ").split(",")
    print(parts)
    print([int(part) for part in parts])
