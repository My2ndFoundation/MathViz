"""Restock from a CSV file of deliveries, skip and report the bad rows, and write the new stock to a CSV file."""

import csv

STOCK = {"PEN": 10, "INK": 3, "PAD": 0}


def restock(stock, path):
    stock = dict(stock)
    problems = []
    with open(path, newline="") as f:
# >>> BLANK id=numbered-rows level=2 hint="for 的头：边读 csv.DictReader(f) 给出的每一行字典，边数它是文件的第几行；循环变量写成 line_no 和 row；计数的起点用关键字实参 start 给出 || 表头占了文件第 1 行，所以第一行数据是第 2 行" hintEn="The head of the for: go through each row dictionary that csv.DictReader(f) gives while counting which line of the file it is; the loop variables are line_no and row; give the starting count with the keyword argument start || The header takes line 1 of the file, so the first data row is line 2"
        for line_no, row in enumerate(csv.DictReader(f), start=2):
# <<< BLANK
            sku = row["sku"]
            if sku not in stock:
                problems.append(f"line {line_no}: unknown SKU {sku}")
                continue
            try:
# >>> BLANK id=to-int level=1 hint="把这一行 quantity 列的文字转成整数，存进 amount——用 int()，按列名从 row 里取（双引号）；转不成时抛出的异常由下面的 except 接住" hintEn="Turn the text in this row's quantity column into a whole number and keep it in amount - use int(), looking the column up in row by name (double quotes); if it cannot be converted, the except below catches what is raised"
                amount = int(row["quantity"])
# <<< BLANK
            except ValueError:
                problems.append(f"line {line_no}: {row['quantity']!r} is not a whole number")
                continue
# >>> BLANK id=add-amount level=1 hint="把 amount 加到这个货号的库存上——用增强赋值 +=，写在 stock 这个字典里按 sku 取出的那一项上" hintEn="Add amount to this SKU's stock - use the augmented assignment +=, on the entry of the stock dictionary looked up by sku"
            stock[sku] += amount
# <<< BLANK
    return stock, problems


def write_stock(stock, path):
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["sku", "quantity"])
        for sku in sorted(stock):
            writer.writerow([sku, stock[sku]])


if __name__ == "__main__":
    new_stock, problems = restock(STOCK, "_fixtures/deliveries.csv")
    for problem in problems:
        print(problem)
    print(STOCK)
    write_stock(new_stock, "stock.csv")
    with open("stock.csv", newline="") as f:
        for row in csv.reader(f):
            print(row)
