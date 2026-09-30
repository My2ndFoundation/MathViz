"""Count each word with collections.Counter."""

# >>> BLANK id=import-counter level=1 hint="从 collections 模块里只导入 Counter 这一个名字，之后直接写 Counter，不写 collections.Counter" hintEn="Import just the one name Counter from the collections module, so that afterwards you write Counter rather than collections.Counter"
from collections import Counter
# <<< BLANK


def word_count(words):
# >>> BLANK id=as-dict level=2 hint="一行 return：用 Counter 数 words，再把结果转成普通字典交回，好和另外两种写法交回同一种类型 || Counter 本身就是字典的一种；外面再套一层 dict(...) 就成了普通 dict" hintEn="One line of return: count words with Counter, then turn the result into a plain dictionary before handing it back, so that it has the same type as the other two versions || A Counter is itself a kind of dictionary; wrapping it in dict(...) makes an ordinary dict"
    return dict(Counter(words))
# <<< BLANK


if __name__ == "__main__":
    text = "the cat sat on the mat the end"
    counts = Counter(text.split())
    print(counts["the"], counts["dog"])
# >>> BLANK id=most-common level=1 hint="打印出现次数最多的两个（词, 次数）对：调用 counts 上专门做这件事的方法，直接传 2 这一个位置实参（不写成关键字实参，也不切片）" hintEn="Print the two (word, count) pairs that occur most often: call the method on counts that does exactly this, passing 2 as its only positional argument (not as a keyword argument, and no slicing)"
    print(counts.most_common(2))
# <<< BLANK
    print(word_count(["b", "a", "b", "b"]))
    print(word_count([]))
