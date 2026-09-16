"""property 的参考实现登记表。

规矩（spec §2.3）：新增一个 property 必须**同时写出它的参考实现**，
而且参考实现要用**与被测程序不同的机制**——否则这道门就退化成拿自己验自己
（根 CLAUDE.md 记过这类前科：把 `String(object)` 和自己比了 3600 次，宣布
一条结构定律"确认"）。

`ref` 拿被测程序的实参跑一遍，结果必须与被测程序的 `entry` 相同。
`cases` 产出随机实参（元组），跑 `SAMPLES` 组，种子固定为 `SEED`（门必须逐次可复现）。

裁决 R6：本表**按被测程序的 `id` 索引，不是按 property 族名**。`chapter.json` 里的
`check.property`（第 0 期合法取值只有 `"pure"`）只是一个族名，T14 的
`algorithm_property_check()` 用它挑错误信息的措辞，真正的参考实现与实参生成器
都是逐个程序单独登记的——同一个族名下的两个程序（这里 `max-of-three-if` 与
`max-of-three-builtin`）机制不同，参照也就必须不同，不能共用一份。

裁决 R26：`max-of-three-builtin.py` 的代码本身就是 `return max(a, b, c)`，如果拿
`max` 当它的参照，等于拿自己验自己——被测程序错的地方参照会跟着错，任何变异都测不出来。
所以三条参照都特意选了与被测程序**不同**的实现路径：

- `max-of-three-if`（手写 `if/elif/else` 分支链）—— 参照用内置 `max`：
  被测程序若**在某个分支里交出错的那个变量**（`elif b >= c:` 底下写成
  `largest = c`），或者**比较的是错的一对**（`elif b >= c` 写成 `elif a >= c`），
  返回值就会与内置 `max` 分道扬镳。实测：`range(-3,4)^3` = 343 组里分别有
  **91 组 / 35 组**不匹配；在门自己那 200 组随机实参上是 64 / 29 组。
  把 `largest = b` 改成 `largest = c` 再跑 `algorithm_property_check()`，
  它当场红在 `(-20, 47, 25)` 上。
- `max-of-three-builtin`（`return max(a, b, c)`）—— 参照用 `sorted([a, b, c])[-1]`：
  一个是比较链，一个是排序取末位，互不复用对方的判断逻辑。**漏掉一个参数**
  （`max(a, b)`，343 组里 91 组不匹配）或**用错内置函数**（`min`，336 组）都跑不掉。
- `count-vowels-loop`（索引循环 + 累加器）—— 参照用生成式 `sum(...)`：
  被测程序若把判断写反（`if ch in vowels` 变成 `not in`）或者干脆漏掉那次加一，
  累加器路径与生成式路径给出的计数会不一致，两条路径没有共享的中间状态。
  实测 500 条随机串：分别 475 / 412 条不匹配。

⚠ **举例子要举能被观察到的那一种。** 上面三条的原文各举过一个「漏等号 / 参数顺序
写错」的例子，而它们在值比对下**一个都测不出来**：`elif b > c` 与
`if a > b and a > c` 丢掉 `=` 之后落到的那一支返回的是一个**相等的值**
（343 组，各 0 处不匹配）；`max(a, c, b)` 与 `max(a, b, c)` 则本来就恒等
（343 组，0 处）。门本身有判别力，**假的是写下来的理由**——而下一个照着这段
理由挑参照实现的人会照着挑错。这是本仓一号失败模式的镜像形态：不是「测量测不
到」，是「解释一个有效测量时举了一个它测不到的例子」。每条例子在写进来之前都要
先跑一遍，看它真的会让门变红。
"""
import random
import string


def _rand_words(rng):
    return (''.join(rng.choice(string.ascii_letters + ' ') for _ in range(rng.randint(0, 30))),)


def _rand_triples(rng):
    return (rng.randint(-50, 50), rng.randint(-50, 50), rng.randint(-50, 50))


REFERENCES = {
    # 被测程序 id -> {'ref': 参考实现, 'cases': 实参生成器}
    'count-vowels-loop': {
        # 被测的是「索引循环 + 累加」，参考的是「生成式 + sum」：机制不同
        'ref': lambda s: sum(ch in 'aeiouAEIOU' for ch in s),
        'cases': _rand_words,
    },
    'max-of-three-if': {
        # 被测的是手写的 if/elif/else 分支链，参考的是内置 max()：机制不同。
        # 实测能被它抓住的变异见文件头（交错变量 / 比错一对）；「漏等号」那一类
        # 抓不住，因为漏掉 `=` 之后落到的那一支返回的是一个相等的值。
        'ref': lambda a, b, c: max(a, b, c),
        'cases': _rand_triples,
    },
    'max-of-three-builtin': {
        # 被测的是 max()，参考的是「排序取末位」：机制不同——绝不能拿 max 当
        # max() 自己的参照，那是拿自己验自己。实测抓得住的是「漏参数 / 用错内置
        # 函数」；「参数顺序写错」抓不住，因为 max 本来就与实参顺序无关。
        'ref': lambda a, b, c: sorted([a, b, c])[-1],
        'cases': _rand_triples,
    },
}

SAMPLES = 200
SEED = 20260916          # 固定种子：门必须逐次可复现
