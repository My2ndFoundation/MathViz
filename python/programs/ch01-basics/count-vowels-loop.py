"""Count the vowels in a word, one character at a time."""


def count_vowels(text):
    vowels = "aeiouAEIOU"
    total = 0
# >>> BLANK id=accumulate level=2 hint="逐个字符走一遍，命中就让计数器加一；判断和计数分开写" hintEn="Every character gets looked at exactly once, and only some of them change the total; so that is a walk over the characters with the test inside it, and the counting on a line of its own"
    for ch in text:
        if ch in vowels:
            total = total + 1
# <<< BLANK
    return total


if __name__ == "__main__":
    print(count_vowels("Programming"))
    print(count_vowels("rhythm"))
    print(count_vowels(""))
