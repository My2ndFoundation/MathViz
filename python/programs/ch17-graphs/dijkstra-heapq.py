"""Dijkstra's shortest distances with a priority queue from heapq."""

import heapq

INF = float("inf")


def dijkstra(graph, start):
    dist = {node: INF for node in graph}
    dist[start] = 0
    heap = [(0, start)]
    while heap:
# >>> BLANK id=pop-nearest level=2 hint="从 heap 里弹出最小的那一项，拆成两个名字：先 d、后 node；用 heapq 模块的函数（写 heapq. 前缀） || 堆里每一项是 (距离, 结点) 这样的元组，元组按第一项比大小，所以弹出来的总是距离最小的" hintEn="Pop the smallest item off heap and unpack it into two names: d first, then node; use the heapq module's function (with the heapq. prefix) || Every item is a (distance, node) tuple, and tuples compare by their first item, so what comes off is always the one with the smallest distance"
        d, node = heapq.heappop(heap)
# <<< BLANK
# >>> BLANK id=skip-stale level=2 hint="一个 if：弹出来的 d 严格大于表里 node 现在的距离；d 写在比较号左边 || 同一个结点可能进堆好几次；表里已经有更短的，这一条就是过期的旧记录，下一行跳过它" hintEn="An if: the popped d is strictly greater than node's current distance in the table; d on the left of the comparison || The same node can go into the heap several times; if the table already holds something shorter, this is an out-of-date record and the next line skips it"
        if d > dist[node]:
# <<< BLANK
            continue
        for neighbour, weight in graph[node]:
            new = d + weight
            if new < dist[neighbour]:
                dist[neighbour] = new
# >>> BLANK id=push-new level=2 hint="把一个新元组压进 heap：用 heapq 模块的函数，元组里先距离、后结点 || 距离是刚算出的 new，结点是 neighbour" hintEn="Push a new tuple onto heap with the heapq module's function; distance first, then node inside the tuple || The distance is the new value just worked out, the node is neighbour"
                heapq.heappush(heap, (new, neighbour))
# <<< BLANK
    return dist


if __name__ == "__main__":
    graph = {
        "A": [("B", 4), ("C", 2)],
        "B": [("A", 4), ("C", 1), ("D", 5)],
        "C": [("A", 2), ("B", 1), ("D", 8), ("E", 10)],
        "D": [("B", 5), ("C", 8), ("E", 2), ("F", 6)],
        "E": [("C", 10), ("D", 2), ("F", 3)],
        "F": [("D", 6), ("E", 3)],
        "G": [],
    }
    for node, distance in dijkstra(graph, "A").items():
        print(node, distance)
