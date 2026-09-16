"""Find the largest of three numbers with the built-in max()."""


def max_of_three(a, b, c):
    return max(a, b, c)


if __name__ == "__main__":
    print(max_of_three(3, 9, 5))
    print(max_of_three(9, 3, 5))
    print(max_of_three(3, 5, 9))
    print(max_of_three(7, 7, 7))
