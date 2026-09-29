"""Depth-first search written recursively: go as deep as possible, then back up."""


def dfs(graph, node, visited, order):
    visited.add(node)
    order.append(node)
    for neighbour in graph[node]:
        if neighbour not in visited:
# >>> BLANK id=go-deeper level=2 hint="一次调用自己、不接返回值：四个参数照 dfs 的定义顺序传，只把第二个换成 neighbour || visited 与 order 传的是同一个集合、同一个列表，更深层加进去的东西这一层马上看得见" hintEn="Call the function itself and ignore what it returns: pass the four arguments in the order dfs defines them, with only the second one changed to neighbour || visited and order are the very same set and list, so whatever the deeper call adds is visible here at once"
                dfs(graph, neighbour, visited, order)
# <<< BLANK
    return order


def dfs_order(graph, start):
# >>> BLANK id=first-call level=2 hint="一个 return，交回第一次调用 dfs 的结果：从 start 出发，visited 给一个新建的空集合、order 给一个空列表，空列表写成一对方括号 || 空集合只能写成 set()——一对空花括号是空字典" hintEn="One return, handing back the result of the first call to dfs: start from start, with a brand-new empty set for visited and an empty list for order, written as a pair of square brackets || An empty set can only be written set() - a pair of empty curly braces is an empty dictionary"
    return dfs(graph, start, set(), [])
# <<< BLANK


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
