"""Guess the secret number, with a limited number of tries."""


def play(secret, max_tries):
    tries = 0
# >>> BLANK id=tries-left level=2 hint="还有次数就接着猜：一个 while，tries 写在比较号左边、max_tries 在右边 || 用严格的小于号——tries 从 0 数起，等于 max_tries 时次数已经用完了" hintEn="Keep guessing while there are tries left: a while with tries on the left of the comparison and max_tries on the right || Use a strict less-than - tries counts from 0, so when it equals max_tries they have all been used"
    while tries < max_tries:
# <<< BLANK
        guess = int(input("Guess: "))
        tries += 1
        if guess == secret:
            print(f"Got it in {tries}")
# >>> BLANK id=stop-guessing level=1 hint="猜中了就不再问下去，并且跳过循环的 else 那一支——一个关键字，只离开这个循环（不是离开整个函数的 return）" hintEn="Guessed it, so stop asking, and skip the loop's else branch as well - a single keyword that leaves only this loop (not return, which leaves the whole function)"
            break
# <<< BLANK
        if guess < secret:
            print("Too low")
        else:
            print("Too high")
# >>> BLANK id=out-of-tries level=2 hint="次数用完、从没 break 过才走的那一支：这个关键字和 while 对齐，不和里面的 if 对齐；下一行打印一个 f-string，用双引号 || 打印的文字逐字是 Out of tries, it was（逗号后一个空格），再空一格接上花括号里的 secret" hintEn="The branch taken only when the tries ran out without a break: this keyword lines up with while, not with the if inside it; on the next line print an f-string in double quotes || The words printed are exactly Out of tries, it was (one space after the comma), then one more space and secret in curly brackets"
    else:
        print(f"Out of tries, it was {secret}")
# <<< BLANK


if __name__ == "__main__":
    play(37, 5)
    play(12, 3)
