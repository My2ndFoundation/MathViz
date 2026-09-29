"""Dijkstra's shortest distances, the table way: scan for the closest unfinished node."""

INF = float("inf")


def dijkstra(graph, start):
    dist = {node: INF for node in graph}
    dist[start] = 0
    done = set()
    while len(done) < len(graph):
        current = None
        for node in graph:
# >>> BLANK id=pick-closest level=3 hint="一个 if，两个条件用 and 连起来：前一个是 node 还不在 done 里；后一个整体放在一对括号里 || 括号里两种情况用 or：current 还是 None（is None），或者 node 的距离严格小于 current 的距离；node 的那一项写在比较号左边 || 还没选中任何结点时，第一个没做完的结点直接当候选；之后只有更近的才替换它——这就是在表里找「未定结点中距离最小的那一行」" hintEn="An if with two conditions joined by and: first, node is not yet in done; the second is wrapped as a whole in a pair of brackets || Inside the brackets, two cases joined by or: current is still None (is None), or node's distance is strictly less than current's; node's side goes on the left of the comparison || Before anything is chosen, the first unfinished node becomes the candidate; after that only a closer one replaces it - this is finding the unfinished row with the smallest distance in the table"
            if node not in done and (current is None or dist[node] < dist[current]):
# <<< BLANK
                current = node
        if dist[current] == INF:
            break
        done.add(current)
        for neighbour, weight in graph[current]:
# >>> BLANK id=relax level=2 hint="一个 if：经由 current 走过去的新距离严格小于 neighbour 眼下记着的距离；新距离写在比较号左边，写成 current 的距离加 weight（按这个先后） || 下一行就是把这个更短的距离写进表里；这一步叫「松弛」" hintEn="An if: the new distance going via current is strictly less than the distance neighbour has now; the new distance goes on the left, written as current's distance plus weight (in that order) || The next line writes that shorter distance into the table; this step is called relaxation"
            if dist[current] + weight < dist[neighbour]:
# <<< BLANK
                dist[neighbour] = dist[current] + weight
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
