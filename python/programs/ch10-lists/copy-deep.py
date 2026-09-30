"""A deep copy rebuilds the lists inside as well, so nothing is shared."""

# >>> BLANK id=import level=1 hint="导入标准库里负责复制的那个模块——整个模块导入，下面调用时带着模块名（不用 from … import）" hintEn="Import the standard-library module that does copying - import the whole module, because the call below goes through its name (no from ... import)"
import copy
# <<< BLANK


def deep_copy_and_change():
    a = [[1, 2], [3, 4]]
# >>> BLANK id=deep level=2 hint="给 b 一个里里外外全新的副本：调用 copy 模块里的函数，写成 模块名.函数名(…) || 函数名是「深」与「复制」两个英文词连写，没有下划线" hintEn="Give b a copy that is new all the way down: call a function of the copy module, written module.function(...) || The function name is the English words for deep and copy run together, with no underscore"
    b = copy.deepcopy(a)
# <<< BLANK
    b[0][0] = 99
    b.append([5, 6])
    return a, b


if __name__ == "__main__":
    a, b = deep_copy_and_change()
    print(a)
    print(b)
    print(b is a, b[0] is a[0])
