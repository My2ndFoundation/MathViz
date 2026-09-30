"""One undirected graph stored two ways: an adjacency list and an adjacency matrix."""


def to_matrix(graph, nodes):
    index = {node: i for i, node in enumerate(nodes)}
    matrix = [[0] * len(nodes) for _ in nodes]
    for node in graph:
        for other in graph[node]:
# >>> BLANK id=set-cell level=2 hint="一条赋值：矩阵先按行、再按列取一格，行是当前结点 node 的下标，列是邻居 other 的下标，下标都从 index 字典里查；这一格记成 1 || 无向图里 node 与 other 互为邻居，这一格的镜像格会在轮到 other 时由同一行代码填上，所以这里只填一格" hintEn="One assignment: take one cell of the matrix, row first and then column; the row is the index of the current node, the column the index of the neighbour other, both looked up in the index dictionary; set that cell to 1 || In an undirected graph node and other are each other's neighbours, so the mirror cell gets filled by this same line when it is other's turn; fill just the one cell here"
            matrix[index[node]][index[other]] = 1
# <<< BLANK
    return matrix


def to_list(matrix, nodes):
    graph = {}
    for i in range(len(nodes)):
        graph[nodes[i]] = []
        for j in range(len(nodes)):
# >>> BLANK id=is-edge level=1 hint="一个 if：第 i 行第 j 列那一格与 1 比较，那一格写在左边，用 == 写出来（不要只写那一格让真值去判断）" hintEn="An if: compare the cell in row i, column j with 1, the cell on the left, written out with == (do not rely on the cell's truthiness alone)"
            if matrix[i][j] == 1:
# <<< BLANK
# >>> BLANK id=add-neighbour level=2 hint="用 append 往第 i 个结点的邻居列表末尾加一个：键要写结点的名字，不是下标 i；加进去的也是名字 || 名字从 nodes 里按下标取：第 i 个名字的那张列表里，加上第 j 个名字" hintEn="Use append to add one item to the end of node i's neighbour list: the key is the node's name, not the index i, and what you add is a name too || Names come out of nodes by index: to the list belonging to the i-th name, add the j-th name"
                graph[nodes[i]].append(nodes[j])
# <<< BLANK
    return graph


if __name__ == "__main__":
    nodes = ["A", "B", "C", "D"]
    graph = {"A": ["B", "C"], "B": ["A", "C"], "C": ["A", "B", "D"], "D": ["C"]}
    matrix = to_matrix(graph, nodes)
    for name, row in zip(nodes, matrix):
        print(name, row)
    print(to_list(matrix, nodes) == graph)
    print("degree of C:", len(graph["C"]), sum(matrix[2]))
    print("edge B-D?", "D" in graph["B"], matrix[1][3] == 1)
