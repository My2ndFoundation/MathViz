"""Move a shape with 2 by 2 transformation matrices."""
import numpy as np


def rotate90(points):
    """Rotate a non-empty list of (x, y) points 90 degrees anticlockwise."""
    pts = np.array(points)
# >>> BLANK id=rotation level=2 hint="逆时针转 90° 的矩阵，写成 np.array 包住两行的列表，存进 R；数字都是整数 || 旋转 θ 的矩阵是 [[cos θ, −sin θ], [sin θ, cos θ]]，θ = 90° 时 cos 是 0、sin 是 1" hintEn="The matrix for a 90 degree anticlockwise turn, written as np.array around a list of two rows, stored in R; all the numbers are whole numbers || The matrix for a turn through theta is [[cos theta, -sin theta], [sin theta, cos theta]], and at 90 degrees cos is 0 and sin is 1"
    R = np.array([[0, -1], [1, 0]])
# <<< BLANK
# >>> BLANK id=apply level=2 hint="点一行一个，所以用点数组右乘 R 的转置（pts 在 @ 左边，转置用 .T），再用 tolist() 转回嵌套列表，一行 return || R 作用在一个列向量 p 上是 R @ p；把很多个点当行叠起来时，同一件事写成 pts @ R.T" hintEn="There is one point per row, so multiply the points array on the right by the transpose of R (pts on the left of @, transpose with .T), then turn it back into nested lists with tolist(), all in one return || R acting on one column vector p is R @ p; with many points stacked as rows, the same thing is written pts @ R.T"
    return (pts @ R.T).tolist()
# <<< BLANK


if __name__ == "__main__":
    square = np.array([[0, 0], [2, 0], [2, 1], [0, 1]])
    print(square.shape)
    print(rotate90(square.tolist()))

    stretch = np.array([[3, 0], [0, 2]])
    print(square @ stretch.T)

# >>> BLANK id=reflect level=2 hint="关于 x 轴反射的矩阵，存进 flip，写法同上面的 stretch：np.array 包住两行的列表 || 反射后 x 不变、y 变号：(x, y) 变成 (x, −y)" hintEn="The matrix for a reflection in the x-axis, stored in flip, written like stretch above: np.array around a list of two rows || After the reflection x stays the same and y changes sign: (x, y) becomes (x, -y)"
    flip = np.array([[1, 0], [0, -1]])
# <<< BLANK
    print(square @ flip.T)

    # two turns of 90 degrees are one turn of 180 degrees
    print(rotate90(rotate90([[3, 1], [-2, 5]])))

    # det is the area scale factor: 6 for the stretch, -1 for the flip
    print(round(np.linalg.det(stretch)), round(np.linalg.det(flip)))
