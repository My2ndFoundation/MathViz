"""Convert between int, float and str, and name the type you end up with."""


def describe(value):
    return f"{value!r} -> {type(value).__name__}"


if __name__ == "__main__":
    text = "42"
    print(describe(text))
    print(describe(int(text)))
    print(describe(float(text)))
    print(describe(str(3.5)))
    print("3" + "4")
    print(int("3") + int("4"))
    print("42" == 42, int("42") == 42)
    print(int(3.9), int(-3.9))
