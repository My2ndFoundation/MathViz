"""A hash table built by hand: key % SIZE picks a slot, and a collision probes forward to the next free one."""

SIZE = 11


def build_table(keys):
    table = [None] * SIZE
    for key in keys:
        slot = key % SIZE
        while table[slot] is not None:
            slot = (slot + 1) % SIZE
# >>> BLANK id=place level=1 hint="while 停下时，slot 指着的一定是一个空格——key 就住在这一格" hintEn="When the while stops, slot is sure to point at an empty slot - that slot is where key lives"
        table[slot] = key
# <<< BLANK
    return table


def hash_search(table, target):
    slot = target % SIZE
    while table[slot] is not None:
# >>> BLANK id=found level=2 hint="一个 if 问：这一格装的是不是正要找的数；表里那一项写在 == 左边 || 那一格是 table[slot]，拿来和 target 比；相等时下一行就交回 True" hintEn="An if asking whether this slot holds the very number being looked for; the table side goes on the left of == || That slot is table[slot], compared with target; when they are equal the next line returns True"
        if table[slot] == target:
# <<< BLANK
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
