"""Break a whole number of seconds into hours, minutes and seconds."""


def split_seconds(total):
    hours, rest = divmod(total, 3600)
# >>> BLANK id=minutes-seconds level=2 hint="小时已经拆走了，还要拆的是 rest，不是 total；这次用 // 与 % 两个运算符分开写，分钟一行在前、秒一行在后 || 按 60 来拆：// 给出分钟，% 给出剩下的秒——正是上一行 divmod 一次交回来的那一对" hintEn="The hours are already out of the way, so the value still to be cut up is rest, not total; this time use the two operators // and % on separate lines, minutes first and seconds second || Cut by 60: // gives the minutes and % gives the seconds left over - exactly the pair divmod handed back in one go on the line above"
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
