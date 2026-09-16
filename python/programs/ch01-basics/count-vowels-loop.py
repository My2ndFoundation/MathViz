"""Count the vowels in a word, one character at a time."""


def count_vowels(text):
    vowels = "aeiouAEIOU"
    total = 0
# >>> BLANK id=accumulate level=2 hint="每个字符恰好看一次（循环变量叫 ch），只有元音才让 total 加一——加一用 += 写 || 所以是一个遍历字符的 for 循环，里面套一个对 vowels 的成员测试，加一那句单独占一行" hintEn="Every character gets looked at exactly once (call the loop variable ch), and only the vowels add one to total - write the adding with += || so that is a for loop over the characters with a membership test on vowels inside it, and the adding on a line of its own"
    for ch in text:
        if ch in vowels:
            total += 1
# <<< BLANK
    return total


if __name__ == "__main__":
    print(count_vowels("Programming"))
    print(count_vowels("rhythm"))
    print(count_vowels(""))
