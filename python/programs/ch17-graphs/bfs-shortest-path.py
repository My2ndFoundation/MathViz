"""Shortest path in an unweighted graph: breadth-first search plus parent links."""

from collections import deque


def shortest_path(graph, start, goal):
    parent = {start: None}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        if node == goal:
            path = []
# >>> BLANK id=walk-back level=2 hint="一个 while：一直往回走，直到 node 变成 None；和 None 比较用 is not（不要写成只看 node 的真假） || 起点的父结点记的是 None，走到它就停；只看真假的话，一个叫 0 的结点也会让循环提前停下" hintEn="A while: keep walking back until node becomes None; compare with None using is not (do not just test whether node is truthy) || The start's parent is recorded as None, so that is where the walk stops; a bare truth test would also stop early at a node called 0"
            while node is not None:
# <<< BLANK
                path.append(node)
                node = parent[node]
# >>> BLANK id=reverse-path level=2 hint="交回倒过来的 path：用一个步长为负一的切片（不用 reversed，也不用 path.reverse()） || path 是从终点往起点收集的，顺序正好反了" hintEn="Return path turned around: use a slice with a step of minus one (not reversed, not path.reverse()) || path was collected from the goal back towards the start, so its order is exactly backwards"
            return path[::-1]
# <<< BLANK
        for neighbour in graph[node]:
            if neighbour not in parent:
# >>> BLANK id=record-parent level=2 hint="一条赋值：在 parent 字典里记下 neighbour 是从哪个结点走过来的 || 键是 neighbour，值是此刻正在处理的 node；有了这个键，它也就算「见过了」" hintEn="One assignment: record in the parent dictionary which node neighbour was reached from || The key is neighbour and the value is the node being processed right now; once the key is there it also counts as seen"
                parent[neighbour] = node
# <<< BLANK
                queue.append(neighbour)
    return None


if __name__ == "__main__":
    graph = {
        "A": ["B", "C"],
        "B": ["A", "D", "E"],
        "C": ["A", "F"],
        "D": ["B"],
        "E": ["B", "F"],
        "F": ["C", "E"],
        "G": ["H"],
        "H": ["G"],
    }
    path = shortest_path(graph, "D", "F")
    print(path, len(path) - 1, "steps")
    print(shortest_path(graph, "A", "A"))
    print(shortest_path(graph, "A", "H"))
