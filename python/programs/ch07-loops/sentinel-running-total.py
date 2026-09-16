"""Add up whole numbers typed one per line, until the word done."""


def read_until_done():
    total = 0
    count = 0
    text = input("Number (or done): ")
# >>> BLANK id=sentinel-test level=2 hint="只要读到的不是哨兵就接着转：用 != 比较，text 写在比较号左边，哨兵字符串写在右边、用双引号 || 哨兵就是提示语括号里的那个小写单词" hintEn="Keep going as long as what was read is not the sentinel: compare with !=, text on the left of the comparison and the sentinel string on the right, in double quotes || The sentinel is the lower-case word inside the brackets of the prompt"
    while text != "done":
# <<< BLANK
# >>> BLANK id=accumulate level=2 hint="把这一行读到的数加进 total——用 += 写，不写成 total = total + … || 读到的是文字，先用 int() 把 text 变成整数再加" hintEn="Add the number read on this line to total - write it with +=, not as total = total + ... || What was read is text, so turn text into a whole number with int() before adding it"
        total += int(text)
# <<< BLANK
        count += 1
# >>> BLANK id=read-again level=1 hint="循环体的最后一步：照循环前那一行的样子再读一次、存回 text，提示语一字不差——少了这一行，text 永远不变，循环停不下来" hintEn="The last step of the loop body: read again exactly as the line before the loop does, back into text, with the very same prompt - without this line text never changes and the loop never stops"
        text = input("Number (or done): ")
# <<< BLANK
    return total, count


if __name__ == "__main__":
    total, count = read_until_done()
    print(f"{count} numbers, total {total}")
    if count > 0:
        print(f"mean {total / count}")
    else:
        print("no numbers, so no mean")
