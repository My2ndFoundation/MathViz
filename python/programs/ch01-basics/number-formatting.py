"""Line up numbers in a report with f-string format specifications."""


def receipt_line(name, quantity, price):
    total = quantity * price
    return f"{name:<12}{quantity:>4}{price:>9.2f}{total:>12,.2f}"


if __name__ == "__main__":
    print(receipt_line("Notebook", 3, 2.5))
    print(receipt_line("Pen", 12, 0.99))
    print(receipt_line("Printer", 1, 1299.0))
    print(f"{3.14159265:.2f}")
    print(f"{1234567:,}")
    print(f"{'left':<8}|{'right':>8}|{'mid':^8}|")
    print(f"{0.1 + 0.2:.17f}")
