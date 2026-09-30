"""Hot potato with collections.deque as the queue: every k-th person holding the potato is out."""
from collections import deque


def hot_potato(names, k):
# >>> BLANK id=make level=1 hint="用 names 造一个新的双端队列存进 circle：把 names 原样直接交给 deque，不先转成列表，也不先复制" hintEn="Build a new deque from names and store it in circle: pass names to deque exactly as it is, without turning it into a list or copying it first"
    circle = deque(names)
# <<< BLANK
    order = []
    while circle:
        for _ in range(k - 1):
# >>> BLANK id=pass level=2 hint="传一次土豆：队首的人离开队首、排到队尾——一行写完，两端各用一个 deque 方法；不用 rotate || 从左端出队的方法名是 pop 加上 left，交回来的人直接交给在右端入队的方法" hintEn="One pass of the potato: the person at the front leaves the front and joins the back - all on one line, with one deque method for each end; not rotate || The method that leaves from the left end is pop with left on the end, and whoever it hands back goes straight to the method that joins on the right"
            circle.append(circle.popleft())
# <<< BLANK
        order.append(circle.popleft())
    return order


if __name__ == "__main__":
    players = ["Ana", "Ben", "Cai", "Dev", "Eli"]
    out = hot_potato(players, 3)
    print("out in order:", out)
    print("winner:", out[-1])
    print(hot_potato(players, 1))
    print(hot_potato(players, 7))
    circle = deque(players)
    circle.rotate(-2)
    print(circle)
