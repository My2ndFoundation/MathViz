"""Count each word, checking with in before every update."""


def word_count(words):
# >>> BLANK id=empty-dict level=1 hint="计数表一开始是空的字典，名字叫 counts；用一对空花括号写，不调用 dict()" hintEn="The tally starts as an empty dictionary called counts; write it as a pair of empty curly braces, not a call to dict()"
    counts = {}
# <<< BLANK
    for word in words:
# >>> BLANK id=in-test level=1 hint="问这个词是不是已经是 counts 的一个键：直接对字典用成员运算符，不调用 keys()" hintEn="Ask whether this word is already a key of counts: use the membership operator on the dictionary itself, not on keys()"
        if word in counts:
# <<< BLANK
# >>> BLANK id=add-one level=2 hint="见过的词：把它的计数加一，用增强赋值写，不把 counts[word] 重复写一遍 || 下标取出这个词的计数，就在原地加 1" hintEn="A word already seen: add one to its count with an augmented assignment, not by writing counts[word] out twice || Index out this word's count and add 1 to it in place"
            counts[word] += 1
# <<< BLANK
        else:
            counts[word] = 1
    return counts


if __name__ == "__main__":
    text = "the cat sat on the mat the end"
    print(word_count(text.split()))
    print(word_count(["b", "a", "b", "b"]))
    print(word_count([]))
