"""A hash table built by hand: key % SIZE picks a slot, and a collision probes forward to the next free one."""

SIZE = 11


def build_table(keys):
    table = [None] * SIZE
    for key in keys:
        slot = key % SIZE
# >>> BLANK id=probe-insert level=2 hint="一个 while：这一格已经有人了就继续往后探；判断「有人」用 is not（不用 != 也不只写 table[slot]） || 空位里放的是 None——而 0 也可能是一个键，只写 table[slot] 会把它当成空位" hintEn="A while that keeps probing as long as this slot is taken; test taken with is not (not != and not just table[slot]) || An empty slot holds None - and 0 may well be a key, so writing just table[slot] would treat it as empty"
        while table[slot] is not None:
# <<< BLANK
# >>> BLANK id=next-slot level=2 hint="往后挪一格，走到表尾就绕回表头：slot 加 1（slot 在前），括号括住，再对 SIZE 取余（不用 len） || 11 号格不存在：10 加 1 再对 11 取余，回到 0 号格" hintEn="Move on one slot, wrapping from the end of the table back to the start: slot plus 1 (slot first) in brackets, then the remainder by SIZE (not len) || There is no slot 11: 10 plus 1, remainder by 11, lands back on slot 0"
            slot = (slot + 1) % SIZE
# <<< BLANK
        table[slot] = key
    return table


def hash_search(table, target):
    slot = target % SIZE
    while table[slot] is not None:
        if table[slot] == target:
            return True
        slot = (slot + 1) % SIZE
# >>> BLANK id=hit-empty level=2 hint="探到一个空位还没遇到 target，就能断定它不在表里——这一行写在循环外面，和 while 对齐 || 插入时它若在表里，一定放在这个空位之前：插入同样从 target % SIZE 出发、同样一格一格往后探" hintEn="Reaching an empty slot without meeting target settles it: target is not in the table - this line goes outside the loop, lined up with the while || Had it been inserted, it would sit before this empty slot: insertion starts from the same target % SIZE and probes forward the same way"
    return False
# <<< BLANK


def contains(keys, target):
    return hash_search(build_table(keys), target)


if __name__ == "__main__":
    keys = [23, 14, 9, 36, 47, 3, 21, 32]
    table = build_table(keys)
    print(table)
    for target in (9, 47, 32, 25, 43):
        print(target, target % SIZE, hash_search(table, target), target in keys)
