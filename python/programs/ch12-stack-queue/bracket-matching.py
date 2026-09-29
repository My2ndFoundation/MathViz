"""Check that every bracket in a string is closed by its own partner, in the right order."""

PAIRS = {")": "(", "]": "[", "}": "{"}


def is_balanced(text):
    stack = []
    for ch in text:
        if ch in "([{":
            stack.append(ch)
# >>> BLANK id=closer level=2 hint="否则，如果 ch 是一个闭括号：用 elif，拿上面那张字典来判断（直接对字典本身，不写 .keys()），不把三个闭括号再写一遍 || 在字典上用 in，查的是它的键——三个键正好是三个闭括号" hintEn="Otherwise, if ch is a closing bracket: use elif and ask the dictionary above (the dictionary itself, without .keys()), rather than spelling out the three closers again || Using in on a dictionary looks at its keys - and its three keys are exactly the three closing brackets"
        elif ch in PAIRS:
# <<< BLANK
            if not stack:
                return False
# >>> BLANK id=match level=2 hint="一个 if：弹出栈顶的开括号，和这个闭括号应配的那个开括号比，不相等就失败；弹出的调用写在 != 左边，不先存进变量 || 这个闭括号应配的开括号，用 ch 去 PAIRS 里查" hintEn="One if: pop the opening bracket off the top and compare it with the opener this closer needs, failing when they differ; put the pop call on the left of !=, without saving it in a variable first || The opener this closer needs is found by looking ch up in PAIRS"
            if stack.pop() != PAIRS[ch]:
# <<< BLANK
                return False
# >>> BLANK id=leftover level=1 hint="全部读完：栈里一个开括号都不剩才算平衡；直接对 stack 用 not 判空，不用 len()，也不和 [] 比" hintEn="Everything has been read: it is balanced only if no opening bracket is left on the stack; test for empty by putting not straight in front of stack, without len() and without comparing with []"
    return not stack
# <<< BLANK


if __name__ == "__main__":
    for text in ["(a[1] + b) * {c}", "([)]", "(()", "())", "", "{[()()]}"]:
        print(repr(text), is_balanced(text))
