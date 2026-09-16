"""Fibonacci where functools.lru_cache does the remembering."""
import functools


# >>> BLANK id=decorator level=2 hint="一行装饰器，写在 def 的正上方：上面 import 的是整个 functools，所以用模块名点出 lru_cache；带括号，用一个关键字实参把缓存设成没有上限（不写 @functools.cache，也不省略括号） || 那个关键字叫 maxsize，没有上限在 Python 里用 None 表示" hintEn="A one-line decorator directly above the def: the import brought in the whole functools module, so reach lru_cache through the module name; include the brackets and use one keyword argument to make the cache unlimited (not @functools.cache, and do not leave the brackets out) || That keyword is maxsize, and no limit is written as None"
@functools.lru_cache(maxsize=None)
# <<< BLANK
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)


if __name__ == "__main__":
    print(fib(30))
    info = fib.cache_info()
    print(info.hits, info.misses, info.currsize)
    print(fib(30))
    print(fib.cache_info().hits)
# >>> BLANK id=clear level=2 hint="清空 fib 的缓存：lru_cache 给函数添上的另一个方法，和上面的 cache_info 同一个前缀，调用时不带实参 || 方法名是 cache_clear" hintEn="Empty fib's cache: another method lru_cache adds to the function, with the same prefix as cache_info above, called with no arguments || The method is called cache_clear"
    fib.cache_clear()
# <<< BLANK
    print(fib.cache_info().currsize)
