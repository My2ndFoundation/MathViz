"""Check a password against a set of rules and report every rule it breaks."""


def broken_rules(password):
    has_upper = False
    has_lower = False
    has_digit = False
    for ch in password:
        if ch.isupper():
            has_upper = True
# >>> BLANK id=lower level=1 hint="和上面大写那一支写成对称的样子：一个 elif 用和上面同一类的 is 开头的方法（不用比较号）问这个字符是不是小写字母，下一行把对应的那个标志设成 True" hintEn="Mirror the upper-case branch above: an elif using the same kind of is-method as above (no comparison operators) to ask whether this character is a lower-case letter, and on the next line the matching flag set to True"
        elif ch.islower():
            has_lower = True
# <<< BLANK
        elif ch.isdigit():
            has_digit = True
    failed = []
# >>> BLANK id=length level=2 hint="第一条规则：长度不到 8 就把这条规则的说明追加进 failed；比较写成严格小于 8，说明文字放在双引号里 || 一个 if 问 password 的长度是否小于 8，下一行调用 failed 的追加方法；说明文字逐字是：at least 8 characters" hintEn="The first rule: if the length is under 8, append this rule's description to failed; write the test as strictly less than 8, with the description in double quotes || An if asking whether the length of password is less than 8, then the append method of failed on the next line; the description reads, word for word: at least 8 characters"
    if len(password) < 8:
        failed.append("at least 8 characters")
# <<< BLANK
    if not has_upper:
        failed.append("an upper-case letter")
    if not has_lower:
        failed.append("a lower-case letter")
    if not has_digit:
        failed.append("a digit")
# >>> BLANK id=space level=2 hint="最后一条规则：密码里有空格就追加这条说明；用成员测试 in 来问，不用 find() 或 count()；说明文字放在双引号里 || 一个 if 问一个空格字符串在不在 password 里；说明文字逐字是：no spaces" hintEn="The last rule: if the password contains a space, append this rule's description; ask with the membership test in, not find() or count(); the description in double quotes || An if asking whether a string holding one space is in password; the description reads, word for word: no spaces"
    if " " in password:
        failed.append("no spaces")
# <<< BLANK
    return failed


if __name__ == "__main__":
    for attempt in ("password", "Passw0rd", "short1A", "ALL CAPS 123", "Tr0ub4dor&3"):
        problems = broken_rules(attempt)
        if problems:
            print(attempt, "fails:", ", ".join(problems))
        else:
            print(attempt, "is OK")
