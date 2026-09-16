"""FizzBuzz, and why the test for both has to come first."""


def fizzbuzz(n):
# >>> BLANK id=both-first level=2 hint="最先判「既能被 3 又能被 5 整除」：只用一个取模，除数写成这两个数的乘积（不用 and 连两个取模），== 0 写在右边；下一行交回一个双引号字符串 || 交回的文字逐字是 FizzBuzz：两个大写字母 F 与 B，中间没有空格" hintEn="Test divisible by both 3 and 5 first: a single modulo whose divisor is the product of the two numbers (not two modulos joined by and), with == 0 on the right; on the next line hand back a string in double quotes || The text handed back is exactly FizzBuzz: capital F and capital B, with no space between"
    if n % 15 == 0:
        return "FizzBuzz"
# <<< BLANK
    elif n % 3 == 0:
        return "Fizz"
    elif n % 5 == 0:
        return "Buzz"
    else:
# >>> BLANK id=plain-number level=1 hint="都不能整除就交回这个数本身——但要写成字符串，和另外三支的类型一样：用 str() 转（不用 f-string）" hintEn="Divisible by neither, so hand back the number itself - but as a string, the same type as the other three branches: convert with str() (not an f-string)"
        return str(n)
# <<< BLANK


if __name__ == "__main__":
# >>> BLANK id=one-to-fifteen level=2 hint="一个 for 循环，循环变量叫 n，用两个参数的 range；两个参数都写成整数字面量（不写加法） || 从 1 数到 15，15 也要算进去——range 的终点本身取不到" hintEn="A for loop with the loop variable n, using range with two arguments, both written as plain integer literals (no addition) || Count from 1 to 15 with 15 included - range never reaches its stop value itself"
    for n in range(1, 16):
# <<< BLANK
        print(fizzbuzz(n))
