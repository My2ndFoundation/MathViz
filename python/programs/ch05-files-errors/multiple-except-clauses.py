"""Handle different exceptions with separate except clauses, most specific first."""


def parse_and_divide(text, divisor):
    try:
        number = int(text.strip())
        return number / divisor
# >>> BLANK id=except-value level=2 hint="第一个子句接住 int() 读不懂文字时抛的那种异常，并把异常对象绑到一个名字上，下一行要打印它 || 异常类是 ValueError；绑定用 as，名字就是下一行花括号里的那个" hintEn="The first clause catches the exception int() raises when it cannot read the text, and binds the exception object to a name, because the next line prints it || the class is ValueError; binding uses as, and the name is the one inside the braces on the next line"
    except ValueError as e:
# <<< BLANK
        print(f"  ValueError: {e}")
    except ZeroDivisionError:
        print("  ZeroDivisionError: the divisor is zero")
    except TypeError:
        print("  TypeError: the divisor is not a number")
# >>> BLANK id=except-catch-all level=2 hint="最后一个子句兜底：接住任何普通异常，绑定到 e，下一行要打印它的类名——它必须排在所有具体子句之后；类名要明写，不用裸 except || 用所有普通异常共同的那个基类（不是连 KeyboardInterrupt 也接住的那个更高一层的）" hintEn="The last clause is the safety net: it catches any ordinary exception and binds it to e, because the next line prints its class name - it has to come after every specific clause; name the class, no bare except || use the base class every ordinary exception shares (not the one above it that would catch KeyboardInterrupt too)"
    except Exception as e:
# <<< BLANK
        print(f"  something else: {type(e).__name__}")
    return None


if __name__ == "__main__":
    cases = [(" 12 ", 4), ("ten", 2), ("7", 0), ("9", "3"), (None, 1)]
    for text, divisor in cases:
        print(f"{text!r} / {divisor!r}")
        print(f"  result: {parse_and_divide(text, divisor)}")
