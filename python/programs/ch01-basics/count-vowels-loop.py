"""Count the vowels in a word, one character at a time."""


def count_vowels(text):
    vowels = "aeiouAEIOU"
    total = 0
# >>> BLANK id=accumulate level=2 hint="test each character in turn, add one on a hit" hintEn="test each character in turn, add one on a hit"
    for ch in text:
        if ch in vowels:
            total = total + 1
# <<< BLANK
    return total


if __name__ == "__main__":
    print(count_vowels("Programming"))
    print(count_vowels("rhythm"))
    print(count_vowels(""))
