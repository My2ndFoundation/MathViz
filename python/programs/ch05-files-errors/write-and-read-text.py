"""Write a text file, read it back three ways, then append to it."""


def write_lines(path, lines):
    with open(path, "w") as f:
        for line in lines:
            f.write(line + "\n")


def append_line(path, line):
# >>> BLANK id=open-append level=2 hint="和上面 write_lines 里那句 with 同一个形状（文件对象同样叫 f），只换打开模式：这一次不能把文件里已有的内容清掉；模式照上面写成双引号字符串、作第二个位置实参 || 模式 w 会先把文件截成空的；你要的那个模式把新内容接在末尾，一个字母，取自 append" hintEn="The same shape as the with line in write_lines above (the file object is called f again), with only the mode changed: this time the file's existing contents must not be wiped; write the mode as above, a double-quoted string passed as the second positional argument || mode w empties the file first; the mode you want adds to the end, and it is one letter, taken from append"
    with open(path, "a") as f:
# <<< BLANK
        f.write(line + "\n")


if __name__ == "__main__":
    write_lines("shopping.txt", ["eggs", "milk", "bread"])

    with open("shopping.txt") as f:
# >>> BLANK id=read-all level=1 hint="把整份文件一次读成一个字符串，存进 text——用文件对象上那个不带实参的方法，下一行会把它的 repr 打出来" hintEn="Read the whole file in one go as a single string and keep it in text - use the method on the file object that takes no argument; the next line prints its repr"
        text = f.read()
# <<< BLANK
    print(repr(text))

    with open("shopping.txt") as f:
        print(f.readlines())

    append_line("shopping.txt", "tea")
    with open("shopping.txt") as f:
        for line in f:
# >>> BLANK id=strip-newline level=2 hint="逐行迭代拿到的每一行都还带着行尾的换行符；打印前只去掉它、别的空白一概不动——用 strip 家族里只管右端的那个方法，并把换行符作为实参明写（双引号） || 不带实参的 rstrip() 会把行尾的空格也一起削掉；实参就是上面 write_lines 里拼在每行后面的那个字符串" hintEn="Every line the loop hands you still carries its newline at the end; print it with just that removed and any other whitespace left alone - use the member of the strip family that only works on the right-hand end, and pass the newline to it explicitly (in double quotes) || rstrip() with no argument would shave trailing spaces off too; the argument is the same string write_lines glues onto each line above"
            print(line.rstrip("\n"))
# <<< BLANK
