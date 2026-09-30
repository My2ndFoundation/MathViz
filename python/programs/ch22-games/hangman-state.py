"""Hangman: guess a hidden word one letter at a time."""
import random

WORDS = ["python", "variable", "function", "boolean", "integer", "string"]


def mask(word, guessed):
    shown = ""
    for ch in word:
# >>> BLANK id=known level=1 hint="这个字母已经被猜过，就把它亮出来：一个 if，用成员运算 in" hintEn="If this letter has already been guessed, show it: an if using the membership operator in"
        if ch in guessed:
# <<< BLANK
            shown += ch
        else:
            shown += "_"
    return shown


def play(word, lives):
    guessed = set()
    while lives > 0:
        print(mask(word, guessed), "lives:", lives)
        letter = input("Letter: ").strip().lower()
        if len(letter) != 1 or not letter.isalpha():
            print("One letter, please")
        elif letter in guessed:
            print("Already tried", letter)
        else:
            guessed.add(letter)
# >>> BLANK id=miss level=1 hint="猜的字母不在词里才扣一条命：一个 if，用 not in" hintEn="A life is lost only when the letter is not in the word: an if using not in"
            if letter not in word:
# <<< BLANK
                lives -= 1
# >>> BLANK id=solved level=2 hint="猜完这个字母后，看遮住的词里是否一个下划线都不剩：一个 if，用 not in，右边重新调用 mask，字符串用双引号 || 被遮住的字母显示成下划线" hintEn="After this letter, check whether the masked word has no underscore left: an if using not in, calling mask again on the right, with the string in double quotes || A hidden letter is shown as an underscore"
            if "_" not in mask(word, guessed):
# <<< BLANK
                print("You win:", word)
                return True
    print("Out of lives, it was", word)
    return False


if __name__ == "__main__":
    rng = random.Random(2026)
    play(rng.choice(WORDS), 6)
    play(rng.choice(WORDS), 3)
