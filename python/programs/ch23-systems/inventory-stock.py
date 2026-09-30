"""Keep stock with a dataclass: goods in, goods out, and a warning when an item falls to its reorder level."""

from dataclasses import dataclass


class OutOfStock(Exception):
    def __init__(self, sku, wanted, available):
        super().__init__(f"{sku}: wanted {wanted}, only {available} left")
        self.sku = sku
        self.wanted = wanted
        self.available = available


@dataclass
class Item:
    sku: str
    quantity: int
    reorder_level: int


class Inventory:
    def __init__(self):
        self.items = {}

    def add_item(self, sku, reorder_level):
        self.items[sku] = Item(sku, 0, reorder_level)

    def receive(self, sku, amount):
        self.items[sku].quantity += amount
        return self.items[sku].quantity

    def dispatch(self, sku, amount):
        item = self.items[sku]
# >>> BLANK id=too-many level=2 hint="一个 if 的头：要发的数量比库存多——amount 写在比较号左边，用严格的大于号 || 恰好发光全部库存是允许的，只有「多于」才不行" hintEn="The head of an if: more is wanted than is in stock - amount on the left of the comparison, with a strict greater-than || Sending out exactly everything in stock is allowed; only more than that is refused"
        if amount > item.quantity:
# <<< BLANK
# >>> BLANK id=raise-short level=2 hint="抛出本程序自定义的库存不足异常，三个位置实参按它 __init__ 的顺序：货号（就用参数 sku）、想要多少、实际还有多少 || 实际还有多少就是 item 的 quantity 属性" hintEn="Raise this program's own out-of-stock exception with three positional arguments in the order its __init__ takes them: the SKU (just the parameter sku), how many were wanted, how many there really are || How many there really are is item's quantity attribute"
            raise OutOfStock(sku, amount, item.quantity)
# <<< BLANK
        item.quantity -= amount
# >>> BLANK id=needs-reorder level=2 hint="交回一个布尔值：发货之后，库存是否已经落到再订货线或更低——item.quantity 写在比较号左边 || 恰好等于再订货线也要报警" hintEn="Return a boolean: after the dispatch, has the stock fallen to the reorder level or below - item.quantity on the left of the comparison || Landing exactly on the reorder level must also raise the warning"
        return item.quantity <= item.reorder_level
# <<< BLANK


def run_ops(ops):
    stock = Inventory()
    results = []
    for op in ops:
        if op[0] == "new":
            stock.add_item(op[1], op[2])
        elif op[0] == "in":
            results.append(stock.receive(op[1], op[2]))
        else:
            try:
                low = stock.dispatch(op[1], op[2])
                results.append("reorder" if low else "ok")
            except OutOfStock as e:
                results.append(f"short by {e.wanted - e.available}")
    return results


if __name__ == "__main__":
    shop = Inventory()
    shop.add_item("PEN", 5)
    print(shop.receive("PEN", 12), shop.dispatch("PEN", 4), shop.items["PEN"])
    print(shop.dispatch("PEN", 3), shop.items["PEN"].quantity)
    try:
        shop.dispatch("PEN", 9)
    except OutOfStock as e:
        print("refused:", e.sku, e.wanted, e.available)
    print(run_ops([("new", "INK", 2), ("in", "INK", 3), ("out", "INK", 1), ("out", "INK", 5)]))
