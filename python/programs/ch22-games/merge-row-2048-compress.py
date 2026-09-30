"""2048: slide one row to the left - squeeze out the gaps, merge pairs, pad with zeros."""


def merge_left(row):
# >>> BLANK id=squeeze level=1 hint="先挤掉空格：一个列表推导式，逐个取 row 里的 v，只留 v 不等于 0 的（写成 != 0）" hintEn="Squeeze out the gaps first: a list comprehension taking each v from row and keeping only those where v is not 0 (written as != 0)"
    tiles = [v for v in row if v != 0]
# <<< BLANK
    merged = []
    score = 0
    i = 0
    while i < len(tiles):
# >>> BLANK id=pair level=2 hint="和右边的邻居相等才合并：一个 if，and 左边先确认 i + 1 还在 tiles 里（用严格小于 len(tiles)），右边再比两块，tiles[i] 写在等号左边 || 次序不能反：右边的比较会读 tiles[i + 1]，要靠左边先挡住越界" hintEn="Merge only when the tile equals its right-hand neighbour: an if whose left side of the and first checks that i + 1 is still inside tiles (strictly less than len(tiles)), and whose right side compares the two tiles with tiles[i] on the left || The order matters: the comparison reads tiles[i + 1], so the left side has to rule out running off the end first"
        if i + 1 < len(tiles) and tiles[i] == tiles[i + 1]:
# <<< BLANK
            merged.append(tiles[i] * 2)
            score += tiles[i] * 2
# >>> BLANK id=skip-both level=1 hint="刚合并的两块都用掉了，下标跳过它们两个（增量赋值）" hintEn="Both tiles that just merged are used up, so move the index past the two of them (augmented assignment)"
            i += 2
# <<< BLANK
        else:
            merged.append(tiles[i])
            i += 1
    merged += [0] * (len(row) - len(merged))
    return merged, score


if __name__ == "__main__":
    for row in [[2, 2, 2, 2], [2, 2, 2, 0], [4, 0, 4, 8], [2, 4, 8, 16], [0, 0, 0, 0]]:
        new_row, score = merge_left(row)
        print(row, "->", new_row, "score", score)
