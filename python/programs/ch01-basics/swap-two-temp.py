"""Swap two values through a temporary variable."""


def swap(a, b):
    temp = a
    a = b
    b = temp
    return a, b


if __name__ == "__main__":
    x, y = 1, 2
    print(x, y)
    x, y = swap(x, y)
    print(x, y)
