"""Count each word in one line with get and a default of 0."""


def word_count(words):
# >>> BLANK id=empty-dict level=1 hint="计数表一开始是空的字典，名字叫 counts；用一对空花括号写，不调用 dict()" hintEn="The tally starts as an empty dictionary called counts; write it as a pair of empty curly braces, not a call to dict()"
    counts = {}
# <<< BLANK
    for word in words:
# >>> BLANK id=get-plus-one level=2 hint="一行，不用 if：等号右边先用 get 取出这个词现在的计数（缺省给 0），再在它后面加 1；等号左边用下标写回 counts || 还没见过的词 get 交回缺省值 0，加 1 之后正好是第一次出现时的计数" hintEn="One line, no if: on the right, first read this word's current count with get (default 0), then add 1 after it; on the left, store it back into counts with an index || For a word not seen yet, get hands back the default 0, and adding 1 gives exactly the count for its first appearance"
        counts[word] = counts.get(word, 0) + 1
# <<< BLANK
    return counts


if __name__ == "__main__":
    text = "the cat sat on the mat the end"
    print(word_count(text.split()))
    print(word_count(["b", "a", "b", "b"]))
    print(word_count([]))
