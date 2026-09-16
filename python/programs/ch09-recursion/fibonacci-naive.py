"""Fibonacci straight from its definition, counting every call it makes."""

calls = 0


def fib(n):
# >>> BLANK id=count level=2 hint="两行：函数要改的是模块顶层那个 calls，先用一行声明它是全局名字，再用 += 给它加一 || 不先声明的话，+= 会让 calls 在函数里变成一个局部变量，第一次读它就出错" hintEn="Two lines: the function changes the calls at the top of the module, so first declare in one line that it is the global name, then add one to it with += || Without the declaration, += makes calls a local variable inside the function, and reading it the first time fails"
    global calls
    calls += 1
# <<< BLANK
# >>> BLANK id=base level=1 hint="fib(0) 是 0、fib(1) 是 1——两个基例用一个 if 一起接住：严格小于、n 在比较号左边（不写 <= 1），下一行单独一个 return，交回 n 本身" hintEn="fib(0) is 0 and fib(1) is 1 - catch both base cases with one if: a strict less-than with n on the left of the comparison (not <= 1), and a return of its own on the next line that hands back n itself"
    if n < 2:
        return n
# <<< BLANK
# >>> BLANK id=step level=2 hint="一行 return，把两次递归调用的结果相加：往回退一步的那次写在加号左边，退两步的写在右边 || 这两次调用各自又会再调两次——调用次数就是这样一层层翻上去的" hintEn="One return that adds the results of two recursive calls: the call one step back goes on the left of the plus, the call two steps back on the right || Each of those calls makes two more of its own - that is how the number of calls keeps multiplying"
    return fib(n - 1) + fib(n - 2)
# <<< BLANK


if __name__ == "__main__":
    for n in (5, 10, 15, 20):
        calls = 0
        value = fib(n)
        print(f"fib({n}) = {value} after {calls} calls")
