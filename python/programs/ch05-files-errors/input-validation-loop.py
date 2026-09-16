"""Keep asking until the answer is a whole number inside a range."""


def ask_int(prompt, low, high):
# >>> BLANK id=loop-forever level=1 hint="一个本身永远不会停的循环——离开它的唯一出口是下面那个 return；条件直接写布尔常量" hintEn="A loop that never stops on its own - the only way out is the return further down; write the condition as the Boolean constant itself"
    while True:
# <<< BLANK
        text = input(prompt)
        try:
# >>> BLANK id=convert-text level=1 hint="把读到的文字转成整数，存进 value——int() 自己会忽略两端的空格，所以 text 原样交进去；读不懂时抛出的异常由下面的 except 接住" hintEn="Turn the text that was read into an int and keep it in value - int() ignores surrounding spaces by itself, so pass text as it is; if it cannot be read, the exception is caught by the except below"
            value = int(text)
# <<< BLANK
        except ValueError:
            print(f"{text!r} is not a whole number")
            continue
# >>> BLANK id=range-check level=2 hint="value 落在 low 到 high 之间（两端都算）才交回去——写成一个链式比较，不用 and，按从小到大的顺序写（小的界在最左） || 从左到右依次是 low、value、high，两个比较号都带等号" hintEn="Only hand value back when it lies between low and high, both ends included - write it as one chained comparison, not with and, in ascending order (the smaller bound on the far left) || left to right: low, value, high, and both comparison signs include equals"
        if low <= value <= high:
# <<< BLANK
            return value
        print(f"{value} is not between {low} and {high}")


if __name__ == "__main__":
    rating = ask_int("Rating 1-5: ", 1, 5)
    print(f"Thanks, you gave it {rating}")
