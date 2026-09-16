"""Convert a binary string to denary, reading the bits from left to right."""


def to_denary(bits):
    value = 0
    for bit in bits:
# >>> BLANK id=double-add level=2 hint="每往右读一位，之前读到的所有位都往左挪一格——在二进制里往左挪一格就是乘 2，挪完再把这一位加进来；一行赋值写回 value，不用 *= 或 += 分两步 || 写法钉死：value 写在 * 左边，乘法那一项写在 + 左边，不加括号；这一位是个字符，先用 int() 把它变成数再加" hintEn="Every time one more bit is read on the right, all the bits read before it move one place left - and in binary moving one place left means multiplying by 2 - then this bit is added in; one assignment back into value, not split into *= and += || The exact form: value on the left of *, the multiplication on the left of +, no brackets; the bit is a character, so turn it into a number with int() before adding it"
        value = value * 2 + int(bit)
# <<< BLANK
    return value


if __name__ == "__main__":
    for bits in ("0", "1", "101", "1111", "00101", "10000000", "11111111"):
        print(bits, "->", to_denary(bits))
