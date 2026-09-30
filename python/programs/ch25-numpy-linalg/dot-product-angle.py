"""Dot product, vector length and the angle between two vectors."""
import numpy as np


def cosine(u, v):
    """Cosine of the angle between two non-zero vectors, to 9 places."""
    a = np.array(u)
    b = np.array(v)
# >>> BLANK id=dot level=1 hint="两个数组的点积，用矩阵乘的运算符 @（不用 np.dot 或 .dot），a 在左；存进 dot" hintEn="The dot product of the two arrays with the matrix-product operator @ (not np.dot or .dot), a on the left; store it in dot"
    dot = a @ b
# <<< BLANK
# >>> BLANK id=lengths level=2 hint="两条向量各自的长度相乘，存进 lengths；每条长度都用 np.linalg.norm 算，a 的写在乘号左边 || 长度是各分量平方和的平方根，np.linalg.norm 一步给出；不要自己写 sqrt" hintEn="Multiply the two vectors' lengths together and store the product in lengths; work out each length with np.linalg.norm, a's on the left of the times sign || A length is the square root of the sum of squared components, and np.linalg.norm gives it in one step; do not write sqrt yourself"
    lengths = np.linalg.norm(a) * np.linalg.norm(b)
# <<< BLANK
    return round(float(dot / lengths), 9)


def angle_degrees(u, v):
    """The angle between u and v in degrees."""
# >>> BLANK id=angle level=3 hint="一行 return，由里往外套三层：先调用本程序的 cosine(u, v)，再用 numpy 取反余弦，再用 numpy 的换算函数把弧度换成度（不自己乘 180 / π），最外面用 float() 转成普通的数 || 反余弦是 np.arccos，弧度换度是 np.degrees；不用 math 模块 || 最里面是 cosine(u, v)，套上 np.arccos(…)，再套 np.degrees(…)，最后 float(…)" hintEn="One return line, nested three deep from the inside out: first call this program's cosine(u, v), then take the inverse cosine with numpy, then turn radians into degrees with numpy's conversion function (not by multiplying by 180 / pi yourself), and wrap the whole thing in float() to get a plain number || The inverse cosine is np.arccos and radians to degrees is np.degrees; do not use the math module || Innermost is cosine(u, v), wrapped in np.arccos(...), then np.degrees(...), and float(...) outermost"
    return float(np.degrees(np.arccos(cosine(u, v))))
# <<< BLANK


if __name__ == "__main__":
    u = np.array([3, 4])
    v = np.array([4, 3])
    print(u @ v, np.dot(u, v), int(np.sum(u * v)))
    print(np.linalg.norm(u), np.linalg.norm(v))
    print(cosine([3, 4], [4, 3]))
    print(round(angle_degrees([3, 4], [4, 3]), 2))

    pairs = [
        ([1, 0], [0, 1]),
        ([2, 1], [-1, 2]),
        ([1, 1], [2, 2]),
        ([1, 2, 2], [-1, -2, -2]),
        ([1, 0, 0], [1, 1, 0]),
    ]
    for p, q in pairs:
        dot = int(np.array(p) @ np.array(q))
        angle = round(angle_degrees(p, q), 1)
        print(p, q, dot, cosine(p, q), angle, dot == 0)
