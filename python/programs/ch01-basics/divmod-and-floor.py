"""Break a whole number of seconds into hours, minutes and seconds."""


def split_seconds(total):
    hours, rest = divmod(total, 3600)
# >>> BLANK id=minutes-seconds level=2 hint="对 rest 再拆一次 || 这次把两个运算符分开写，好看清上一行 divmod 一次交回来的正是这一对" hintEn="The hours are already out of the way, so the value still to be cut up is rest, not total || cut it the same way as the line above but spell the two operators out separately this time - the pair you get is exactly what divmod handed back in one go"
    minutes = rest // 60
    seconds = rest % 60
# <<< BLANK
    return hours, minutes, seconds


if __name__ == "__main__":
    for total in (0, 59, 61, 3600, 7325):
        hours, minutes, seconds = split_seconds(total)
        print(f"{total} -> {hours}:{minutes:02d}:{seconds:02d}")
    print(divmod(7325, 3600))
    print(7 // 2, 7 % 2, -7 // 2, -7 % 2)
    print(10 % 2 == 0, 7 % 2 != 0)
    print(10 ** 3 // 7, 10 ** 3 % 7)
    print(round(2.5), round(3.5), round(2.675, 2))
