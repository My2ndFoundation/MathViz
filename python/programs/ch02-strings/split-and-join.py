"""Cut a string into a list of pieces, and glue a list of pieces back into a string."""


def reverse_words(sentence):
# >>> BLANK id=cut level=1 hint="把句子切成词的列表存进 words：按任意长度的空白切，两头多出来的空白不能切出空串来——所以这次调用不传任何实参" hintEn="Cut the sentence into a list of words stored in words: split on runs of whitespace of any length, without leftover spaces at either end turning into empty strings - which is why this call is given no argument at all"
    words = sentence.split()
# <<< BLANK
# >>> BLANK id=glue level=2 hint="交回把词倒过来、用一个空格粘回去的句子：粘的那个空格串写在点号左边，词序倒转用步长为 -1、起点终点都留空的切片，不用 reversed()；字符串用双引号 || 调方法的是分隔符本身，实参是要粘起来的那个（倒过来的）列表" hintEn="Hand back the words in reverse order glued together with a single space: the space string goes to the left of the dot, and the reversing is a slice with step -1 and both start and stop left empty, not reversed(); double quotes for the string || The method is called on the separator itself, and its argument is the (reversed) list of pieces to glue"
    return " ".join(words[::-1])
# <<< BLANK


def key_and_value(line):
# >>> BLANK id=maxsplit level=2 hint="用 split 只在第一个冒号处切一刀，切出的两段分别解包给 key 和 value；最多切几刀作为第二个实参直接写数字，不写 maxsplit= ；冒号串用双引号 || 第一个实参是分隔符，第二个实参是最多切的刀数——值里本身还带冒号，所以只能切一刀" hintEn="Use split to cut only at the first colon, and unpack the two pieces into key and value; pass the maximum number of cuts as a plain second argument, not maxsplit=; double quotes for the colon string || The first argument is the separator and the second is the most cuts allowed - the value has colons of its own, so only one cut"
    key, value = line.split(":", 1)
# <<< BLANK
    return key, value


if __name__ == "__main__":
    text = "  to be   or not  "
    print(text.split())
    print(text.split(" "))
    row = "Ada,Lovelace,1815,London"
    print(row.split(","))
    print(row.split(",", 2))
    print("-".join(["2026", "09", "16"]))
    print("".join(["a", "b", "c"]))
    print(reverse_words("the quick brown fox"))
    print(reverse_words(text))
    print(key_and_value("time:12:30:05"))
