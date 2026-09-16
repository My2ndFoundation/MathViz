"""Swap two values with tuple unpacking."""


def swap(a, b):
    a, b = b, a
    return a, b


if __name__ == "__main__":
    x, y = 1, 2
    print(x, y)
    x, y = swap(x, y)
    print(x, y)
