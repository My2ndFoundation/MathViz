"""Line up numbers in a report with f-string format specifications."""


def receipt_line(name, quantity, price):
# >>> BLANK id=line-total level=1 hint="算出这一行的总价、存进 total：件数乘单价，两个参数按参数表里的先后写" hintEn="Work out the line total and keep it in total: the number of items times the unit price, the two parameters in the order the parameter list gives them"
    total = quantity * price
# <<< BLANK
# >>> BLANK id=receipt-specs level=3 hint="交回一整行收据，四列依次是：name 靠左占 12 列；quantity 靠右占 4 列；price 靠右占 9 列、两位小数；total 靠右占 12 列、带千位分隔、两位小数 || 四列的对齐方式都明写出来，数字本来默认靠右也照写；两位小数用定点类型 f || 整条是一个双引号 f-string，四个 {变量:规格} 首尾紧挨、中间不夹任何字符；规格内部按讲解里那个固定语序排：对齐、宽度、逗号、精度、类型" hintEn="Hand back one whole receipt line with four columns in this order: name on the left in 12 columns; quantity on the right in 4; price on the right in 9 with two decimal places; total on the right in 12 with thousands separators and two decimal places || write the alignment out for all four columns, even where a number would sit on the right by default; the two decimal places use the fixed-point type f || the whole thing is one f-string in double quotes, the four {variable:spec} fields back to back with nothing between them; inside each spec keep the fixed word order from the notes: align, width, comma, precision, type"
    return f"{name:<12}{quantity:>4}{price:>9.2f}{total:>12,.2f}"
# <<< BLANK


if __name__ == "__main__":
    print(receipt_line("Notebook", 3, 2.5))
    print(receipt_line("Pen", 12, 0.99))
    print(receipt_line("Printer", 1, 1299.0))
    print(f"{3.14159265:.2f}")
    print(f"{1234567:,}")
    print(f"{'left':<8}|{'right':>8}|{'mid':^8}|")
    print(f"{0.1 + 0.2:.17f}")
