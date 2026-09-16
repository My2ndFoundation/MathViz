"""Classify a triangle from its three side lengths."""


def classify(a, b, c):
# >>> BLANK id=inequality level=2 hint="守卫子句：三条边构不成三角形就立刻交回——任意两边之和不大于第三边就不行，三种情况用 or 连成一个 if（不写成 not 套住一整对括号的形式，各个比较也不加括号）；顺序是 a + b 对 c、a + c 对 b、b + c 对 a，两边之和写在比较号左边 || 「不大于」写成小于等于——两边之和恰好等于第三边时，三个点落在一条直线上，那也不算三角形" hintEn="A guard clause: if the three sides cannot make a triangle, hand back straight away - it fails whenever any two sides add up to no more than the third, so join three cases with or in one if (not as not wrapped round one big bracket, and no brackets round the single comparisons); the order is a + b against c, a + c against b, b + c against a, with the sum on the left of each comparison || No more than means less-than-or-equal - when two sides add up to exactly the third, the three corners lie on one straight line, and that is not a triangle either"
    if a + b <= c or a + c <= b or b + c <= a:
# <<< BLANK
        return "not a triangle"
# >>> BLANK id=equilateral level=2 hint="三条边都相等：一个 if（不用 elif——上面的守卫已经 return 了），用一条链式比较一口气写完，不拆成两个比较再用 and 连；按 a、b、c 的顺序 || 链式的相等比较里，== 可以像 < 一样连着写" hintEn="All three sides equal: an if (not elif - the guard above has already returned), saying it in one chained comparison, not two comparisons joined by and; in the order a, b, c || In a chain, == can be strung together just like <"
    if a == b == c:
# <<< BLANK
        return "equilateral"
    if a == b or b == c or a == c:
        return "isosceles"
    return "scalene"


if __name__ == "__main__":
    for a, b, c in [(3, 3, 3), (5, 5, 8), (5, 8, 5), (3, 4, 5),
                    (1, 2, 3), (2, 9, 4), (0, 4, 4), (-1, 5, 5)]:
        print(a, b, c, classify(a, b, c))
