"""Read a text file and list its most common words, ignoring stopwords."""

import string

STOPWORDS = {"the", "a", "and", "on", "to", "is", "it", "was", "no"}


def clean_words(text):
    table = str.maketrans("", "", string.punctuation)
    return text.lower().translate(table).split()


def top_words(text, n, stopwords):
    counts = {}
    for word in clean_words(text):
# >>> BLANK id=skip-stopword level=1 hint="这个词在 stopwords 这个集合里就跳过：用成员运算 in 写一个 if，被测的词写在左边（下一行的 continue 已经写好）" hintEn="Skip the word when it is in the set stopwords: an if with the membership operator in, the word on the left (the continue on the next line is already there)"
        if word in stopwords:
# <<< BLANK
            continue
        counts[word] = counts.get(word, 0) + 1
# >>> BLANK id=rank level=3 hint="把 counts 的键值对排好存进 ranked：sorted 的第一个实参是 counts.items()，再用关键字实参 key 给一个 lambda，它的参数叫 pair，返回一个二元组；次数那一项用一元负号取反（不用 reverse=True，也不乘以 -1） || 二元组第一项让次数大的排前面；第二项是单词本身，次数相同时按字母顺序 || pair[0] 是单词，pair[1] 是次数" hintEn="Sort the key-value pairs of counts and keep them in ranked: the first argument to sorted is counts.items(), then the keyword argument key gets a lambda whose parameter is called pair and which returns a 2-tuple; the count is negated with a unary minus (not reverse=True, and not multiplying by -1) || The first item of the tuple puts bigger counts first; the second item is the word itself, so equal counts go in alphabetical order || pair[0] is the word and pair[1] is the count"
    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
# <<< BLANK
# >>> BLANK id=take-n level=1 hint="交回 ranked 的前 n 项：用切片，冒号前面的起点留空（不写 0）" hintEn="Return the first n items of ranked with a slice, leaving the start before the colon empty (do not write 0)"
    return ranked[:n]
# <<< BLANK


if __name__ == "__main__":
    with open("_fixtures/passage.txt") as f:
        text = f.read()
    for word, count in top_words(text, 4, STOPWORDS):
        print(f"{word:<6}{count}")
    print(len(clean_words(text)), "words before the stopwords go")
    print(top_words("b a c a b", 10, set()))
