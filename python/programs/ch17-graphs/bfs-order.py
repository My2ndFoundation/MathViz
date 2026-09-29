"""Breadth-first search: visit a graph level by level with a queue."""

from collections import deque


def bfs_order(graph, start):
    visited = {start}
    queue = deque([start])
    order = []
    while queue:
# >>> BLANK id=take-front level=2 hint="从队列里取出一个结点、存进 node：用 deque 自己的方法，一次调用，不带参数 || 队列是先进先出——取的是最早进去的那一个，也就是最左边那头" hintEn="Take one node out of the queue into node: use the deque's own method, one call, no arguments || A queue is first in, first out - take the one that went in earliest, from the left-hand end"
        node = queue.popleft()
# <<< BLANK
        order.append(node)
        for neighbour in graph[node]:
            if neighbour not in visited:
# >>> BLANK id=mark-and-enqueue level=2 hint="两行，同一层缩进：第一行先把 neighbour 记进 visited，第二行再把它放进队列尾部；各用一次方法调用 || 在入队的那一刻就做标记，同一个结点才不会被两个邻居各放进队列一次" hintEn="Two lines at the same indentation: the first records neighbour in visited, the second then puts it on the back of the queue; one method call each || Marking at the moment it joins the queue is what stops the same node being queued twice by two different neighbours"
                visited.add(neighbour)
                queue.append(neighbour)
# <<< BLANK
    return order


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
    print(bfs_order(graph, "A"))
    print(bfs_order(graph, "E"))
    print(bfs_order(graph, "G"))
