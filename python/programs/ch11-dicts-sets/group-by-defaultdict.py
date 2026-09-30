"""Group words by their first letter with a defaultdict."""

from collections import defaultdict


def group_by_first_letter(words):
# >>> BLANK id=make-defaultdict level=2 hint="groups 是一个 defaultdict：缺的键一出现就自动配上一个空列表。把 list 这个类型本身交给它，不要调用它 || 交进去的是「以后每缺一个键就调用一次」的工厂；写 list() 就成了只调用一次、交进去一个现成的列表" hintEn="groups is a defaultdict: a missing key gets an empty list the moment it is used. Hand it the type list itself, without calling it || What you pass is a factory, called once for every missing key later on; writing list() would call it once now and pass in a ready-made list instead"
    groups = defaultdict(list)
# <<< BLANK
    for word in words:
# >>> BLANK id=append-group level=1 hint="用 word 的第一个字符（下标，不用切片）当键从 groups 里取出那个列表，直接在它上面 append 这个 word；不用 setdefault，也不先判断键在不在" hintEn="Index groups with the first character of word (an index, not a slice) to get that list, and append word to it straight away; no setdefault, and no check first for whether the key is there"
        groups[word[0]].append(word)
# <<< BLANK
    return dict(groups)


if __name__ == "__main__":
    words = ["apple", "bean", "avocado", "cherry", "banana", "apricot"]
    groups = group_by_first_letter(words)
    print(groups)
    for letter in sorted(groups):
        print(letter, len(groups[letter]), groups[letter])
    tally = defaultdict(int)
    tally["x"] += 1
    print(tally["x"], tally["y"], len(tally))
