"""Find the largest value in a list and the position where it first appears."""


def max_and_index(numbers):
# >>> BLANK id=start-best level=2 hint="到目前为止最大的，先当它是列表里的第一个元素——不是 0；用下标取出来 || 全是负数的列表里，0 比每个元素都大，却根本不在列表里；下标写 0" hintEn="The largest so far starts out as the first element of the list - not 0; take it out by index || In a list of negative numbers 0 is bigger than every element, yet it is not in the list at all; the index is 0"
    best = numbers[0]
# <<< BLANK
    best_index = 0
# >>> BLANK id=walk-rest level=2 hint="一个 for 循环，循环变量叫 i，走剩下的每一个下标：用两个参数的 range（不用 enumerate），起点是 1——下标 0 已经当作初值了，不必拿它和自己比 || 终点是列表的长度，用 len() 求" hintEn="A for loop with the loop variable i over every remaining index: use range with two arguments (not enumerate), starting at 1 - index 0 is already the starting value and need not be compared with itself || The stop value is the length of the list, found with len()"
    for i in range(1, len(numbers)):
# <<< BLANK
# >>> BLANK id=bigger level=2 hint="只有比目前最大的还大才换：严格的大于号，下标取出的元素写在比较号左边 || 一样大时不换，所以第二个同样大的值不会把第一次出现的下标盖掉" hintEn="Only replace it when this one is bigger than the largest so far: a strict greater-than, with the element taken by index on the left of the comparison || On a tie nothing changes, so a second equal value never overwrites the index where it first appeared"
        if numbers[i] > best:
# <<< BLANK
            best = numbers[i]
            best_index = i
    return best, best_index


if __name__ == "__main__":
    print(max_and_index([3, 9, 2, 9, 4]))
    print(max_and_index([-7, -2, -5]))
    print(max_and_index([42]))
