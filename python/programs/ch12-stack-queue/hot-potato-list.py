"""Hot potato with a list as the queue: every k-th person holding the potato is out."""


def hot_potato(names, k):
    queue = list(names)
    order = []
    while queue:
        for _ in range(k - 1):
# >>> BLANK id=pass level=2 hint="传一次土豆：队首的人离开队首、排到队尾——一行写完，出队与入队都用列表方法；出队从下标 0 取 || 里面那一半是出队，外面那一半是入队：把出队交回来的人直接交给入队" hintEn="One pass of the potato: the person at the front leaves the front and joins the back - all on one line, with list methods for both leaving and joining; leaving takes index 0 || The inner half leaves the queue and the outer half joins it: hand whoever comes off the front straight to the method that adds at the back"
            queue.append(queue.pop(0))
# <<< BLANK
# >>> BLANK id=out level=1 hint="数到第 k 下：此刻站在队首的人出局，用列表方法把他记进 order 末尾（不用 +=）——同样从下标 0 出队，一行写完" hintEn="On the k-th count, whoever is at the front now is out: record them on the end of order with a list method (not +=) - again leaving from index 0, all on one line"
        order.append(queue.pop(0))
# <<< BLANK
    return order


if __name__ == "__main__":
    players = ["Ana", "Ben", "Cai", "Dev", "Eli"]
    out = hot_potato(players, 3)
    print("out in order:", out)
    print("winner:", out[-1])
    print("players unchanged:", players)
    print(hot_potato(players, 1))
    print(hot_potato([], 4))
