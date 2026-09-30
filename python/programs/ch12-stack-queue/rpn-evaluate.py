"""Evaluate an expression written in Reverse Polish Notation, using a stack."""


def evaluate_rpn(expression):
    stack = []
    for token in expression.split():
        if token in ("+", "-", "*"):
# >>> BLANK id=operands level=2 hint="两行：从栈里弹出两个数，分别存进 right 和 left——想清楚哪一个先弹出来；每行一次 pop，不用一行同时赋两个 || 后压进去的先弹出来：先弹出的是写在运算符右边的那个数" hintEn="Two lines: pop two numbers off the stack into right and left - think about which one comes off first; one pop per line, not both in a single assignment || The last one pushed is the first one popped: the first number off is the one written to the right of the operator"
            right = stack.pop()
            left = stack.pop()
# <<< BLANK
            if token == "+":
                stack.append(left + right)
            elif token == "-":
# >>> BLANK id=minus level=1 hint="减法的结果压回栈里：和上下两行同一个样子，只是换成减号；注意谁减谁" hintEn="Push the result of the subtraction back on the stack: the same shape as the lines around it, with a minus instead; mind which one is taken from which"
                stack.append(left - right)
# <<< BLANK
            else:
                stack.append(left * right)
        else:
# >>> BLANK id=number level=1 hint="不是运算符就是一个数：先用 int 把这个记号变成整数，再压栈——一行写完" hintEn="If it is not an operator it is a number: turn the token into an integer with int, then push it - all on one line"
            stack.append(int(token))
# <<< BLANK
    return stack.pop()


if __name__ == "__main__":
    examples = ["3 4 +", "10 3 -", "3 4 + 2 *", "3 4 2 * +", "5 1 2 + 4 * + 3 -", "7"]
    for expression in examples:
        print(expression, "=", evaluate_rpn(expression))
