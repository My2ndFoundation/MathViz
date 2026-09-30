"""Check whether two words are anagrams by counting their letters."""


def letter_counts(word):
    counts = {}
    for ch in word:
# >>> BLANK id=count-letter level=2 hint="一行，不用 if：等号右边先用 get 取出 ch 现在的计数（缺省给 0），再在它后面加 1；等号左边用下标写回 counts || 第一次见到的字母 get 交回 0，加 1 正好是 1" hintEn="One line, no if: on the right, first read the current count of ch with get (default 0), then add 1 after it; on the left, store it back into counts with an index || For a letter met for the first time get hands back 0, and adding 1 makes exactly 1"
        counts[ch] = counts.get(ch, 0) + 1
# <<< BLANK
    return counts


def is_anagram(a, b):
# >>> BLANK id=compare-counts level=1 hint="一行 return：分别数出 a 和 b 的字母，直接用 == 比较这两个字典；a 的写在左边，整个比较不加括号" hintEn="One line of return: count the letters of a and of b, and compare the two dictionaries directly with ==; a's goes on the left, with no brackets round the comparison"
    return letter_counts(a) == letter_counts(b)
# <<< BLANK


if __name__ == "__main__":
    print(letter_counts("listen"))
    print(letter_counts("silent"))
    for a, b in [("listen", "silent"), ("aab", "abb"), ("night", "thing"), ("", "")]:
        print(repr(a), repr(b), is_anagram(a, b))
