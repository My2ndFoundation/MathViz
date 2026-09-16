"""Build dictionaries and sets with comprehensions."""


def invert(mapping):
# >>> BLANK id=invert level=2 hint="一行 return 一个字典推导式：遍历 mapping.items()，循环变量依次叫 key、value（不加括号）；不用 mapping[key] 取值 || 反转就是把每一对的两边对调：冒号左边成了新键，右边成了新值" hintEn="One line: return a dictionary comprehension that walks mapping.items() with loop variables key then value (no brackets round them); do not look values up with mapping[key] || Inverting swaps the two sides of every pair: what goes left of the colon becomes the new key, what goes right becomes the new value"
    return {value: key for key, value in mapping.items()}
# <<< BLANK


def word_lengths(words):
    return {word: len(word) for word in words}


def first_letters(words):
# >>> BLANK id=set-comprehension level=2 hint="一行 return 一个集合推导式，循环变量叫 word；每一项是 word 的第一个字符变成小写——先用下标（不用切片）取出第一个字符，再调 lower() || 集合推导式和列表推导式长得一样，只是外面换成花括号，而且里面没有冒号" hintEn="One line: return a set comprehension with loop variable word; each item is the first character of word in lower case - index out the first character first (an index, not a slice), then call lower() || A set comprehension looks just like a list comprehension, except the outside is curly braces and there is no colon inside"
    return {word[0].lower() for word in words}
# <<< BLANK


if __name__ == "__main__":
    codes = {"red": "#f00", "green": "#0f0", "blue": "#00f"}
    print(invert(codes))
    print(invert({"a": 1, "b": 2, "c": 1}))
    words = ["Apple", "avocado", "Banana", "cherry", "apple"]
    print(word_lengths(words))
    print(sorted(first_letters(words)))
