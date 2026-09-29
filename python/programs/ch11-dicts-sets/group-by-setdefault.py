"""Group words by their first letter with setdefault."""


def group_by_first_letter(words):
    groups = {}
    for word in words:
# >>> BLANK id=setdefault-append level=2 hint="一行：对 groups 调用 setdefault，键是 word 的第一个字符（用下标，不用切片），缺省值是一个空列表（写成一对空方括号，不调用 list()）；再在它交回的列表上 append 这个 word || setdefault 在键不存在时先放进缺省值，然后无论如何都交回这个键现在对应的那个列表" hintEn="One line: call setdefault on groups with the first character of word as the key (an index, not a slice) and an empty list as the default (a pair of empty square brackets, not list()); then append word to the list it hands back || setdefault puts the default in first if the key is missing, and either way hands back the list that key now holds"
        groups.setdefault(word[0], []).append(word)
# <<< BLANK
    return groups


if __name__ == "__main__":
    words = ["apple", "bean", "avocado", "cherry", "banana", "apricot"]
    groups = group_by_first_letter(words)
    print(groups)
# >>> BLANK id=sorted-keys level=1 hint="按字母顺序走遍 groups 的键，循环变量叫 letter；把字典本身直接交给 sorted，不调用 keys()" hintEn="Walk the keys of groups in alphabetical order with loop variable letter; hand the dictionary itself straight to sorted, without calling keys()"
    for letter in sorted(groups):
# <<< BLANK
        print(letter, len(groups[letter]), groups[letter])
