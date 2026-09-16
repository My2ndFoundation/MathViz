"""Find the largest of three numbers with explicit comparisons."""


def max_of_three(a, b, c):
    if a >= b and a >= c:
        largest = a
# >>> BLANK id=three-way level=2 hint="a has already lost here, so each branch only has to beat what is left" hintEn="a has already lost here, so each branch only has to beat what is left"
    elif b >= c:
        largest = b
    else:
        largest = c
# <<< BLANK
    return largest


if __name__ == "__main__":
    print(max_of_three(3, 9, 5))
    print(max_of_three(9, 3, 5))
    print(max_of_three(3, 5, 9))
    print(max_of_three(7, 7, 7))
