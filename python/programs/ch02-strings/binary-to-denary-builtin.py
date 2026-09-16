"""Convert between binary and denary with the built-ins int() and bin()."""


def to_denary(bits):
# >>> BLANK id=int-base level=1 hint="交回 int() 的结果：告诉它这串字符是按几进制写的，进制直接作为第二个实参写数字，不写 base=" hintEn="Hand back the result of int(): tell it which base the characters are written in, passing the base as a plain second argument, not base="
    return int(bits, 2)
# <<< BLANK


def to_binary(number):
# >>> BLANK id=strip-prefix level=2 hint="用 bin() 得到二进制串，再用一个切片把它开头那两个字符切掉——不用 format()、f-string 或 replace() || bin() 交回的串总是以 0b 开头；切片从下标 2 开始、一直到末尾" hintEn="Use bin() to get the binary string, then cut off its first two characters with a slice - not format(), an f-string or replace() || The string bin() hands back always starts with 0b; the slice starts at index 2 and runs to the end"
    return bin(number)[2:]
# <<< BLANK


if __name__ == "__main__":
    for bits in ("0", "1", "101", "1111", "00101", "10000000", "11111111"):
        print(bits, "->", to_denary(bits))
    print(bin(10), to_binary(10))
    print(to_binary(to_denary("00101")))
    print(int("0b101", 2), int("ff", 16), int("101"))
