"""Topological sort by Kahn's algorithm: repeatedly take a node with nothing left before it."""


def topological_order(graph):
    indegree = {node: 0 for node in graph}
    for node in graph:
        for successor in graph[node]:
# >>> BLANK id=count-in level=1 hint="successor 的入度加一：用增强赋值 +=（不要写成 x = x + 1）" hintEn="Add one to successor's in-degree: use the augmented assignment += (not x = x + 1)"
            indegree[successor] += 1
# <<< BLANK
    ready = [node for node in graph if indegree[node] == 0]
    order = []
    while ready:
# >>> BLANK id=pick-smallest level=2 hint="从 ready 里挑一个存进 node：用内置函数直接求最小的那个（不排序） || 可选的结点往往不止一个，总取最小的，排出来的顺序才唯一；下一行再把它从 ready 里拿掉" hintEn="Choose one from ready into node: use the built-in that returns the smallest directly (no sorting) || There is often more than one node to choose from; always taking the smallest makes the order unique; the next line then removes it from ready"
        node = min(ready)
# <<< BLANK
        ready.remove(node)
        order.append(node)
        for successor in graph[node]:
            indegree[successor] -= 1
            if indegree[successor] == 0:
                ready.append(successor)
# >>> BLANK id=cycle-left level=2 hint="一个 if：排出来的 order 比图里的结点少；两边都用 len，order 写在左边，用严格的小于号 || 环上的结点入度永远减不到零，永远进不了 ready——少掉的正是它们" hintEn="An if: order came out shorter than the number of nodes in the graph; len on both sides, order on the left, with a strict less-than || Nodes on a cycle never have their in-degree reach zero and never join ready - they are exactly the ones missing"
    if len(order) < len(graph):
# <<< BLANK
        return None
    return order


if __name__ == "__main__":
    tasks = {"A": ["D"], "B": ["A", "D"], "C": ["A"], "D": ["E"], "E": []}
    print(topological_order(tasks))
    loop = {"A": ["B"], "B": ["C"], "C": ["A"], "D": ["A"]}
    print(topological_order(loop))
