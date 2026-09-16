"""Docstrings say what a function does; type hints say what it expects, but enforce nothing."""


def average(marks: list[int]) -> float:
# >>> BLANK id=doc level=1 hint="函数体第一行写文档串：三个双引号包起来，一行写完，文字与输出第一行逐字相同" hintEn="The first line of the body is the docstring: wrapped in three double quotes, on one line, with exactly the words of the first line of the output"
    """Return the mean of a non-empty list of marks."""
# <<< BLANK
    return sum(marks) / len(marks)


# >>> BLANK id=hinted-def level=2 hint="定义 label：score 注解为 int；passmark 同样注解为 int，默认值 40；返回值注解为 str || 带注解的形参写成「名字: 类型 = 默认值」；返回注解用 -> 写在右括号和冒号之间" hintEn="Define label: score annotated as int; passmark also annotated as int with a default of 40; the return annotated as str || an annotated parameter reads name: type = default; the return annotation goes with -> between the closing bracket and the colon"
def label(score: int, passmark: int = 40) -> str:
# <<< BLANK
    """Return "pass" or "fail" for one score."""
    if score >= passmark:
        return "pass"
    return "fail"


if __name__ == "__main__":
    print(average.__doc__)
    print(average([60, 70, 80]))
    print(average.__annotations__)
    print(label(55), label(39))
    print(average((1.5, 2.5)))
    print(label("fifty", passmark="forty"))
