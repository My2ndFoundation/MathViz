"""Keep only the even numbers with filter and a lambda."""


def keep_evens(numbers):
# >>> BLANK id=filter-call level=2 hint="调用内置的 filter，结果存进 evens：第一个实参是一个 lambda（参数叫 n），第二个是 numbers，这一行不包 list()；判断偶数写成 n 除以 2 的余数等于 0（取余写在 == 左边，不用 not，判断外面不加括号） || filter 要的是一个对每项回答「留不留」的函数，lambda 冒号后面就是那个判断" hintEn="Call the built-in filter and keep the result in evens: the first argument is a lambda (parameter n), the second is numbers, and this line has no list() round it; write the even test as n modulo 2 equals 0 (the % on the left of ==, no not, and no brackets round the test) || filter wants a function that answers keep-or-drop for each item, and what follows the lambda's colon is that test"
    evens = filter(lambda n: n % 2 == 0, numbers)
# <<< BLANK
# >>> BLANK id=to-list level=1 hint="filter 交回的不是列表，是一个用一次就空的迭代器；把 evens 变成真正的列表再 return：调用列表类型本身来转换，不用推导式，也不用 * 解包" hintEn="filter does not hand back a list but an iterator that is empty after one use; turn evens into a real list and return that by calling the list type itself - no comprehension and no * unpacking"
    return list(evens)
# <<< BLANK


if __name__ == "__main__":
    print(keep_evens([3, 8, 5, 12, 7, 0, -4]))
    print(keep_evens([1, 3, 5]))
    print(keep_evens(range(10)))
