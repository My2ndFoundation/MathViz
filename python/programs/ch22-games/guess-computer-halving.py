"""The computer guesses the number you are thinking of, by halving the range."""


def play(low, high):
    print(f"Think of a number from {low} to {high}.")
    tries = 0
# >>> BLANK id=still-possible level=2 hint="只要还有数可能是答案，就接着猜：一个 while，low 写在比较号左边 || low 与 high 相等时区间里还剩一个数，那时还得再猜一次" hintEn="Keep guessing while some number could still be the answer: a while with low on the left of the comparison || When low equals high there is still one number left in the range, so it still needs a guess"
    while low <= high:
# <<< BLANK
# >>> BLANK id=middle level=1 hint="猜区间正中间的那个整数：先把 low 与 high 相加（加括号），再用整除除以 2" hintEn="Guess the whole number in the middle of the range: add low and high first (in brackets), then floor-divide by 2"
        guess = (low + high) // 2
# <<< BLANK
        reply = input(f"Is it {guess}? (h = higher, l = lower, c = correct) ")
        if reply not in ("h", "l", "c"):
            print("Please type h, l or c")
            continue
        tries += 1
        if reply == "c":
            print(f"Got it in {tries} tries")
            return tries
        if reply == "h":
# >>> BLANK id=go-higher level=2 hint="答案比 guess 大：把区间的下界挪上来，改的是 low；guess 写在加号左边 || guess 本身已经被排除了，所以新下界不是 guess" hintEn="The answer is bigger than guess: move the bottom of the range up, which means changing low; guess goes on the left of the plus sign || guess itself has just been ruled out, so the new bottom is not guess"
            low = guess + 1
# <<< BLANK
        else:
            high = guess - 1
    print("No number fits all of those answers")
    return None


if __name__ == "__main__":
    play(1, 100)
    play(1, 100)
    play(1, 100)
