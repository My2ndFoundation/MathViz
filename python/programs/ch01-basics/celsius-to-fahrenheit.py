"""Convert Celsius temperatures to Fahrenheit."""


def to_fahrenheit(celsius):
    return celsius * 9 / 5 + 32


if __name__ == "__main__":
    for c in (-40, 0, 36.6, 100):
        print(f"{c}C = {to_fahrenheit(c)}F")
    print(round(to_fahrenheit(36.6), 1))
    print(round(to_fahrenheit(36.6)))
