"""Count, and ask all or any, with generator expressions instead of lists."""


def mark_report(marks, pass_mark):
# >>> BLANK id=count-passes level=2 hint="数出及格的人数存进 passes：把 sum 用在一个生成器表达式上，每个及格的 mark 贡献一个 1（生成器里带 if 筛选，循环变量叫 mark），不建列表、不用 len；及格线本身算及格，mark 写在比较号左边 || 圆括号只有 sum 调用自己那一对——生成器表达式作为唯一实参时不用再套一层" hintEn="Count the passes into passes: use sum on a generator expression in which every passing mark contributes a 1 (the generator filters with an if, and its loop variable is mark), with no list and no len; a mark equal to the pass mark counts as a pass, and mark goes on the left of the comparison || The only brackets are sum's own - a generator expression passed as the sole argument needs no second pair"
    passes = sum(1 for mark in marks if mark >= pass_mark)
# <<< BLANK
# >>> BLANK id=all-passed level=1 hint="everyone 为真当且仅当每个 mark 都及格：把内置的 all 直接用在生成器表达式上，不建列表（循环变量叫 mark，比较写法与上一行相同）" hintEn="everyone is true only when every mark passes: use the built-in all directly on a generator expression, with no list (loop variable mark, comparison written as in the line above)"
    everyone = all(mark >= pass_mark for mark in marks)
# <<< BLANK
    full_marks = any(mark == 100 for mark in marks)
    return passes, everyone, full_marks


if __name__ == "__main__":
    print(mark_report([72, 40, 100, 55, 38], 40))
    print(mark_report([90, 85], 40))
    print(mark_report([], 40))
    squares = (m * m for m in [1, 2, 3])
    print(type(squares).__name__)
    print(sum(squares), sum(squares))
