"""Binary search with the standard library: bisect_left gives the insertion point, then check what is there."""
from bisect import bisect_left


def bisect_search(items, target):
# >>> BLANK id=insertion-point level=1 hint="问 bisect_left：target 要插进这个有序列表的话，该插在哪个下标？把答案存进 i；实参先列表、后 target" hintEn="Ask bisect_left where target would have to be inserted to keep the list sorted, and store the answer in i; the list comes first, then target"
    i = bisect_left(items, target)
# <<< BLANK
# >>> BLANK id=is-it-there level=3 hint="插入点上的那个元素恰好等于 target，才算找到；两个条件用 and 连起来，先查下标没有越界 || 顺序不能反：插入点可能等于列表长度（target 比所有元素都大），这时先去取 items[i] 就会报错；and 短路，前一个条件不成立时后一个根本不算 || 第一个条件：i 写在左边，严格小于列表的长度（用 len）；第二个条件：items[i] 写在左边，和 target 比相等" hintEn="It is found only if the item at the insertion point is exactly target; join two conditions with and, checking first that the index is in range || The order matters: the insertion point can equal the length of the list (target bigger than every item), and reading items[i] first would then fail; and short-circuits, so the second condition is never evaluated when the first is false || First condition: i on the left, strictly less than the length of the list (use len); second condition: items[i] on the left, tested for equality with target"
    if i < len(items) and items[i] == target:
# <<< BLANK
        return i
    return -1


if __name__ == "__main__":
    ages = [3, 8, 12, 15, 21, 30, 34, 41, 50, 67]
    for target in (41, 20, 70, 1):
        print(target, bisect_left(ages, target), bisect_search(ages, target))
