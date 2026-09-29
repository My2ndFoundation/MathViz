"""Convert an infix expression to Reverse Polish Notation with the shunting-yard algorithm."""

PRECEDENCE = {"+": 1, "-": 1, "*": 2, "/": 2}


def to_rpn(expression):
    output = []
    ops = []
    for token in expression.split():
        if token in PRECEDENCE:
            while ops and ops[-1] != "(" and PRECEDENCE[ops[-1]] >= PRECEDENCE[token]:
                output.append(ops.pop())
# >>> BLANK id=push-op level=1 hint="优先级不低于它的运算符都已经送进输出了，现在把这个运算符自己压进运算符栈——用列表方法，不用 +=" hintEn="Every operator of equal or higher precedence has gone to the output; now push this operator itself onto the operator stack - with a list method, not +="
            ops.append(token)
# <<< BLANK
        elif token == "(":
            ops.append(token)
        elif token == ")":
# >>> BLANK id=until-open level=2 hint="一个 while 的头：只要运算符栈顶还不是左括号就继续。不必先写 ops and 判空——括号配对的表达式里，左括号一定还在栈里；比较用 !=，字符串照本程序的写法用双引号 || 比较号左边是栈顶那一项（负下标），右边是左括号" hintEn="The head of a while: keep going as long as the top of the operator stack is not an opening bracket. No need for an ops and emptiness test first - in an expression whose brackets match, the opening bracket is certainly still on the stack; compare with !=, and write the string in double quotes like the rest of this program || The left of the comparison is the top item (a negative index), the right is the opening bracket"
            while ops[-1] != "(":
# <<< BLANK
                output.append(ops.pop())
# >>> BLANK id=drop-open level=2 hint="循环停下时，栈顶正是那个左括号：把它从栈上拿掉，而且不送进输出——用一个列表方法，不用 del 语句 || 就是出栈用的那个方法，不带实参，也不接住它的返回值" hintEn="When the loop stops, the opening bracket is on top of the stack: take it off, and do not send it to the output - with a list method, not a del statement || It is the method a stack pops with, given no argument, and what it returns is simply ignored"
            ops.pop()
# <<< BLANK
        else:
            output.append(token)
    while ops:
        output.append(ops.pop())
    return " ".join(output)


if __name__ == "__main__":
    examples = [
        "3 + 4 * 2",
        "( 3 + 4 ) * 2",
        "8 - 3 - 2",
        "8 - ( 3 - 2 )",
        "8 / 4 / 2",
        "1 + 2 * ( 3 - 4 ) / 5",
    ]
    for expression in examples:
        print(expression, "->", to_rpn(expression))
