"""Depth-first search with an explicit stack instead of recursion."""


def dfs_order(graph, start):
    visited = set()
    order = []
    stack = [start]
    while stack:
# >>> BLANK id=pop-top level=1 hint="从栈顶取出一个结点、存进 node：list 自带的方法，不带参数（栈顶就是列表末尾）" hintEn="Take one node off the top of the stack into node: the list's own method, with no argument (the top of the stack is the end of the list)"
        node = stack.pop()
# <<< BLANK
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
# >>> BLANK id=reverse-push level=2 hint="一个 for：邻居要倒着走一遍，用内置函数 reversed 包住 graph[node]（不用切片） || 后压进去的先弹出来；倒着压，第一个邻居就最后压、最先弹，访问顺序才与递归版一样" hintEn="A for loop that walks the neighbours backwards: wrap graph[node] in the built-in reversed (not a slice) || The last one pushed is the first one popped; pushing in reverse puts the first neighbour on last, so it comes off first and the order matches the recursive version"
        for neighbour in reversed(graph[node]):
# <<< BLANK
            if neighbour not in visited:
                stack.append(neighbour)
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
    print(dfs_order(graph, "A"))
    print(dfs_order(graph, "E"))
    print(dfs_order(graph, "G"))
