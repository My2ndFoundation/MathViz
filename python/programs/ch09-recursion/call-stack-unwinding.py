"""Watch calls pile up on the call stack and come off again in reverse order."""


def countdown(n, depth=0):
    indent = "    " * depth
    print(f"{indent}enter countdown({n})")
# >>> BLANK id=recurse level=2 hint="两行：只要 n 还严格大于 0（n 写在比较号左边；不写 >= 1、!= 0 或光秃秃的 if n:），就再调一次 countdown；两个实参都按位置给（不写 depth=），先传 n 减 1、再传 depth 加 1 || depth 每深一层加 1，缩进就多一级；n 走到 0 时不再调用——那就是这里的基例" hintEn="Two lines: as long as n is still strictly greater than 0 (n on the left of the comparison; not >= 1, != 0 or a bare if n:), call countdown again; pass both arguments by position (no depth=), n minus 1 first and then depth plus 1 || depth goes up by 1 for each level deeper, which adds one step of indent; when n reaches 0 no call is made - that is the base case here"
    if n > 0:
        countdown(n - 1, depth + 1)
# <<< BLANK
    print(f"{indent}leave countdown({n})")


def no_base_case(n):
# >>> BLANK id=runaway level=1 hint="一行 return：拿比 n 大 1 的数再调用自己——n 只会越走越远，没有任何一个值能让它停下" hintEn="One return that calls the function itself again with the number one bigger than n - n only moves further away, and no value ever makes it stop"
    return no_base_case(n + 1)
# <<< BLANK


if __name__ == "__main__":
    countdown(3)
    try:
        no_base_case(0)
# >>> BLANK id=catch level=1 hint="接住调用栈太深时 Python 抛出的那个内置异常，并用 as 把它绑定到名字 error 上" hintEn="Catch the built-in exception Python raises when the call stack gets too deep, and bind it to the name error with as"
    except RecursionError as error:
# <<< BLANK
        print("Stopped by", type(error).__name__)
