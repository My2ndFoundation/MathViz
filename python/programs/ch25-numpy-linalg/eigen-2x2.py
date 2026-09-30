"""Eigenvalues and eigenvectors of a symmetric 2 by 2 matrix."""
import numpy as np


def eigenvalues(a, b, d):
    """Eigenvalues of [[a, b], [b, d]], smallest first, to 9 places."""
    M = np.array([[a, b], [b, d]], dtype=float)
    values = np.linalg.eigvalsh(M)
    return [round(float(lam), 9) for lam in values]


if __name__ == "__main__":
    M = np.array([[2, 1], [1, 2]])
# >>> BLANK id=eigh level=1 hint="np.linalg.eigh 一次交回两样东西：特征值（升序）与特征向量；按这个顺序拆包进 vals 与 vecs 两个名字" hintEn="np.linalg.eigh hands back two things at once: the eigenvalues (in ascending order) and the eigenvectors; unpack them, in that order, into the two names vals and vecs"
    vals, vecs = np.linalg.eigh(M)
# <<< BLANK
    print(vals)
    for i in range(2):
        lam = vals[i]
# >>> BLANK id=column level=2 hint="第 i 个特征向量是 vecs 的第 i 列，不是第 i 行；用一个方括号里的逗号二维下标取出来，存进 vec || 行的位置写冒号表示「所有行」，列的位置写 i" hintEn="Eigenvector number i is column i of vecs, not row i; take it out with a single pair of square brackets holding a comma, and store it in vec || Put a colon in the row position to mean every row, and i in the column position"
        vec = vecs[:, i]
# <<< BLANK
# >>> BLANK id=sign level=2 hint="特征向量乘以 −1 仍是特征向量；为了打印得一致，第一个分量小于 0 时整条取反。写成两行：一个 if（分量写在比较号左边，用严格的小于号），下一行给 vec 重新赋值（不用 *=） || 第一个分量是下标 0；取反用一元负号，不乘以 -1" hintEn="An eigenvector times -1 is still an eigenvector; to print consistently, flip the whole vector when its first component is below 0. Two lines: an if (the component on the left of a strict less-than), and on the next line a fresh assignment to vec (not *=) || The first component is index 0; flip it with a unary minus rather than multiplying by -1"
        if vec[0] < 0:
            vec = -vec
# <<< BLANK
        print(round(float(lam), 6), np.round(vec, 4))
        print(np.allclose(M @ vec, lam * vec))

    print(eigenvalues(2, 1, 2))
    print(eigenvalues(3, 0, 5))
    print(eigenvalues(1, 2, 1))

    # trace = sum of eigenvalues, det = product of eigenvalues
    S = np.array([[4, 2], [2, 3]])
    ev = np.linalg.eigvalsh(S)
    print(np.round(ev, 4))
    print(np.trace(S), round(float(ev.sum()), 6))
    print(round(float(np.linalg.det(S)), 6), round(float(ev.prod()), 6))
