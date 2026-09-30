"""Join two tables on a shared id: a left join keeps every pupil, and a missing score becomes None."""

import pandas as pd

PUPILS = [(1, "Ada"), (2, "Ben"), (3, "Cal"), (4, "Dee")]
SCORES = [(3, 65), (1, 72), (5, 90), (4, 81)]


def join_scores(pupils, scores):
    left = pd.DataFrame(pupils, columns=["id", "name"])
    right = pd.DataFrame(scores, columns=["id", "score"])
# >>> BLANK id=left-merge level=2 hint="用 left.merge 把 right 接上来，存进 joined：第一个实参是 right，再用两个关键字实参说明按哪一列对、用哪种接法，先 on 后 how，值都是双引号字符串 || 按 id 这一列对；左表的每一行都要留下" hintEn="Use left.merge to bring right in, keeping the result in joined: the first argument is right, then two keyword arguments say which column to match on and which kind of join, on first and how second, each value a string in double quotes || Match on the id column; every row of the left table must stay"
    joined = left.merge(right, on="id", how="left")
# <<< BLANK
    result = []
    for pupil_id, name, score in joined.itertuples(index=False):
# >>> BLANK id=nan-to-none level=2 hint="一个 if / else 的前半：只写 if 的头和它下面那一行。判断分数是否缺失用 pandas 的 isna 函数（pandas 在这个程序里叫 pd），缺失时往 result 里追加一个三元组，样子照下面 else 那一行 || 缺失时三元组的第三项是 None，不是 NaN" hintEn="The first half of an if / else: write only the head of the if and the line under it. Test whether the score is missing with pandas' isna function (pandas is called pd in this program); when it is missing, append a triple to result shaped like the one on the else line below || When it is missing, the third item of the triple is None, not NaN"
        if pd.isna(score):
            result.append((pupil_id, name, None))
# <<< BLANK
        else:
            result.append((pupil_id, name, int(score)))
    return result


if __name__ == "__main__":
    left = pd.DataFrame(PUPILS, columns=["id", "name"])
    right = pd.DataFrame(SCORES, columns=["id", "score"])
    print(pd.merge(left, right, on="id", how="left"))
    print(pd.merge(left, right, on="id", how="inner"))
    print(join_scores(PUPILS, SCORES))
    print(join_scores(PUPILS, []))
    missing = float("nan")
    print(missing == missing, None == None)
