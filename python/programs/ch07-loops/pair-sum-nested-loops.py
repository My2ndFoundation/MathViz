"""Do any two numbers in the list add up to the target? Try every pair."""


def has_pair_sum(numbers, target):
    n = len(numbers)
    for i in range(n):
# >>> BLANK id=inner-start level=2 hint="里层循环，循环变量叫 j，走 i 之后的每一个下标：两个参数的 range，终点用上面算好的 n；起点写成一个加法，i 在加号左边 || 起点是 i 的下一个下标——从 i 开始会让一个数和它自己配对，从 0 开始会把每一对试两遍" hintEn="The inner loop, with the loop variable j over every index after i: range with two arguments, using the n worked out above as the stop; write the start as an addition with i on the left of the plus || The start is the index after i - starting at i pairs a number with itself, and starting at 0 tries every pair twice"
        for j in range(i + 1, n):
# <<< BLANK
# >>> BLANK id=pair-matches level=1 hint="这一对加起来正好是 target 吗：下标 i 的元素写在加号左边、下标 j 的写在右边，整个和写在 == 左边，target 在右边" hintEn="Does this pair add up to exactly target: the element at index i on the left of the plus and the one at index j on the right, the whole sum on the left of == and target on the right"
            if numbers[i] + numbers[j] == target:
# <<< BLANK
                return True
# >>> BLANK id=no-pair level=1 hint="每一对都试过、一对都没配上时才走到这里：交回假——这一行和外层的 for 对齐，不在任何一层循环里面" hintEn="Only reached once every pair has been tried and none matched: hand back False - this line lines up with the outer for, inside neither loop"
    return False
# <<< BLANK


if __name__ == "__main__":
    numbers = [1, 3, 4, 6, 9]
    for target in (10, 8, 11, 13):
        print(target, has_pair_sum(numbers, target))
