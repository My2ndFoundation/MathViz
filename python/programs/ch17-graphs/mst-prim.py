"""Prim's minimum spanning tree: grow one tree outwards, always along the lightest edge."""

import heapq


def prim_total(graph):
    start = next(iter(graph))
    in_tree = {start}
    heap = [(weight, node) for node, weight in graph[start]]
    heapq.heapify(heap)
    total = 0
    while heap and len(in_tree) < len(graph):
# >>> BLANK id=lightest level=2 hint="从 heap 里弹出最轻的一项，拆成两个名字：先 weight、后 node；用 heapq 模块的函数 || 堆里每一项是 (权, 结点)：弹出来的就是眼下最轻的一条跨出去的边" hintEn="Pop the lightest item off heap and unpack it into two names: weight first, then node; use the heapq module's function || Each item is (weight, node), so what comes off is the lightest edge leading out of the tree right now"
        weight, node = heapq.heappop(heap)
# <<< BLANK
        if node in in_tree:
            continue
        in_tree.add(node)
# >>> BLANK id=add-weight level=1 hint="把这条边的 weight 累加进 total：用增强赋值 +=" hintEn="Add this edge's weight to total with the augmented assignment +="
        total += weight
# <<< BLANK
        for neighbour, w in graph[node]:
            if neighbour not in in_tree:
                heapq.heappush(heap, (w, neighbour))
    if len(in_tree) < len(graph):
        return None
    return total


if __name__ == "__main__":
    graph = {
        "A": [("B", 4), ("C", 2)],
        "B": [("A", 4), ("C", 1), ("D", 5)],
        "C": [("A", 2), ("B", 1), ("D", 8), ("E", 10)],
        "D": [("B", 5), ("C", 8), ("E", 2), ("F", 6)],
        "E": [("C", 10), ("D", 2), ("F", 3)],
        "F": [("D", 6), ("E", 3)],
    }
    print(prim_total(graph))
    graph["G"] = []
    print(prim_total(graph))
