"""Raise ValueError inside a function and let the caller decide what to do about it."""


def percentage(part, whole):
    if whole <= 0:
# >>> BLANK id=raise-whole level=2 hint="whole 不是正数时，这个函数没有合理的答案可交：不 return、不 print，而是抛出表示「值不对」的那种异常，消息是 whole must be positive（双引号字符串） || 关键字 raise 后面紧跟异常类的调用，消息作它唯一的实参" hintEn="When whole is not positive there is no sensible answer to hand back: do not return, do not print - raise the exception that means the value is wrong, with the message whole must be positive (a double-quoted string) || the keyword raise, followed straight away by a call to the exception class, with the message as its only argument"
        raise ValueError("whole must be positive")
# <<< BLANK
    if part < 0 or part > whole:
        raise ValueError(f"part {part} is not between 0 and {whole}")
    return round(100 * part / whole, 1)


if __name__ == "__main__":
    for part, whole in [(45, 60), (70, 60), (3, 0), (-1, 10)]:
        try:
            print(f"{part}/{whole} = {percentage(part, whole)}%")
# >>> BLANK id=except-caller level=2 hint="调用方在这里接住函数抛出的那种异常，并把异常对象绑到下一行打印的那个名字上 || 类名与函数里 raise 的一致；绑定用 as" hintEn="The caller catches, right here, the kind of exception the function raises, and binds the exception object to the name the next line prints || the class matches the one raised in the function; binding uses as"
        except ValueError as e:
# <<< BLANK
            print(f"rejected {part}/{whole}: {e}")
    print("still running")
