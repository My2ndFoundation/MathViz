"""Every ordering of a string: choose each character to go first, then arrange the rest."""


def permutations(text):
    if len(text) <= 1:
        return [text]
    result = []
    for i, first in enumerate(text):
# >>> BLANK id=rest level=2 hint="rest 是 text 去掉下标 i 那一个字符之后剩下的串：用两段切片拼起来，前一段省略起点、后一段省略终点 || 前一段停在 i 之前，后一段从 i 的下一个位置开始" hintEn="rest is text with the character at index i taken out: join two slices, leaving out the start of the first slice and the end of the second || The first slice stops just before i, and the second starts at the position after i"
        rest = text[:i] + text[i + 1:]
# <<< BLANK
# >>> BLANK id=combine level=2 hint="两行：遍历对 rest 递归求出的每一种排列（循环变量叫 perm），把 first 接在它前面、追加进 result；用 append，first 写在加号左边 || 每一种以 first 开头的排列，就是 first 加上剩下字符的某一种排列" hintEn="Two lines: go through every ordering of rest found by the recursive call (call the loop variable perm), put first in front of it and append that to result; use append, with first on the left of the plus || Every ordering that starts with first is first followed by some ordering of the remaining characters"
        for perm in permutations(rest):
            result.append(first + perm)
# <<< BLANK
    return result


if __name__ == "__main__":
    print(permutations("abc"))
    print(len(permutations("abcde")))
    print(permutations("aab"))
    print(permutations(""))
