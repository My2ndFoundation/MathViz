"""Open a file that may not exist: just try it, and handle FileNotFoundError."""

DEFAULTS = ["volume=5", "theme=dark"]


def read_settings(path):
    try:
        with open(path) as f:
            return f.read().splitlines()
# >>> BLANK id=except-missing level=1 hint="只接住「文件不存在」这一种异常，不绑定异常对象——其他错误（比如没有权限）应当照样抛出去" hintEn="Catch only the file-does-not-exist exception, without binding the exception object - any other error (no permission, say) should still be raised"
    except FileNotFoundError:
# <<< BLANK
        print(f"{path} not found, using defaults")
        return DEFAULTS


if __name__ == "__main__":
    print(read_settings("_fixtures/settings.txt"))
    print(read_settings("no_such_file.txt"))
    try:
        open("no_such_file.txt")
    except FileNotFoundError as e:
# >>> BLANK id=error-filename level=2 hint="打印异常对象上记着的那个出事的文件名，后面跟一个竖线、再跟异常本身——print 的三个实参，竖线是双引号字符串；异常对象原样交给 print，不自己套 str() || 文件名存在异常对象的 filename 属性里" hintEn="Print the name of the file that caused it, which the exception object records, then a vertical bar, then the exception itself - three arguments to print, the bar a double-quoted string; hand the exception object to print as it is, without wrapping it in str() || the file name lives in the exception's filename attribute"
        print(e.filename, "|", e)
# <<< BLANK
