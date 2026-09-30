"""Matrix product with @ versus element-by-element product with *."""
import numpy as np


def matmul(a, b):
    """Multiply two matrices given as lists of rows; return a list of rows."""
    left = np.array(a)
    right = np.array(b)
# >>> BLANK id=product level=2 hint="用矩阵乘的运算符，不用 np.matmul、np.dot 或 .dot 方法；left 写在运算符左边 || 行乘列的那个运算符是 @，* 只会逐格相乘；结果存进 product" hintEn="Use the matrix-product operator, not np.matmul, np.dot or the .dot method; left goes on the left of the operator || The rows-times-columns operator is @ - * only multiplies cell by cell; store the result in product"
    product = left @ right
# <<< BLANK
# >>> BLANK id=to-list level=2 hint="交回去的必须是 Python 自己的嵌套列表、里面是普通 int，不是数组；用数组自带的那个方法一步转换，不用 list() 或推导式 || list(product) 只拆开最外一层，每一行还是数组；数组的 tolist() 方法把每一层都转成 Python 的列表和数" hintEn="What comes back must be Python's own nested lists holding plain ints, not an array; use the array's own method to convert in one step, not list() or a comprehension || list(product) only unpacks the outer layer and each row is still an array; the array method tolist() turns every layer into Python lists and numbers"
    return product.tolist()
# <<< BLANK


if __name__ == "__main__":
    a = np.array([[1, 2], [3, 4]])
    b = np.array([[5, 6], [7, 8]])
    print(a * b)
    print(a @ b)
    print(b @ a)

    m = np.array([[1, 2, 3], [4, 5, 6]])
    n = np.array([[7, 8], [9, 10], [11, 12]])
    print(m.shape, n.shape, (m @ n).shape, (n @ m).shape)
    try:
# >>> BLANK id=bad-shape level=2 hint="拿 m 自己乘自己，用矩阵乘的运算符；这一行只算、不存、不打印 || m 是 (2, 3)，两个 (2, 3) 相乘时中间的 3 和 2 对不上，所以这一行会抛 ValueError" hintEn="Multiply m by itself with the matrix-product operator; this line only computes - no assignment, no print || m is (2, 3); multiplying two (2, 3) matrices, the inner 3 and 2 do not match, so this line raises ValueError"
        m @ m
# <<< BLANK
    except ValueError as e:
        print(type(e).__name__)

    u = np.array([1, 2, 3])
    v = np.array([4, 5, 6])
    print(u * v)
    print(u @ v, int(np.sum(u * v)))
    print(matmul([[1, 2, 3]], [[4], [5], [6]]))
    print(matmul([[2, 0], [0, 2]], [[1, 2], [3, 4]]))
