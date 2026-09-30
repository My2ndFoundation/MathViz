"""Kruskal's minimum spanning tree: lightest edges first, skipping any that close a cycle."""


def find(parent, node):
    while parent[node] != node:
# >>> BLANK id=climb level=2 hint="一条赋值：node 往上走一步，换成它自己的父结点 || 顺着 parent 一直往上爬，爬到「父结点就是自己」的那个结点，它就是这一组的代表（根）" hintEn="One assignment: node moves up one step, replaced by its own parent || Keep climbing through parent until you reach a node that is its own parent - that node is the group's representative, its root"
        node = parent[node]
# <<< BLANK
    return node


def kruskal_total(nodes, edges):
    parent = {node: node for node in nodes}
    total = 0
    used = 0
# >>> BLANK id=by-weight level=2 hint="一个 for：把 edges 排好序再逐条走，每条拆成三个名字，按 weight、u、v 的顺序；排序用内置的 sorted（不带 key） || 每条边存成 (权, 端点, 端点)，元组按第一项比大小，所以直接排就是从轻到重" hintEn="A for loop over edges in sorted order, unpacking each into three names in the order weight, u, v; sort with the built-in sorted (no key) || Each edge is stored as (weight, end, end), and tuples compare by their first item, so a plain sort goes from lightest to heaviest"
    for weight, u, v in sorted(edges):
# <<< BLANK
        root_u = find(parent, u)
        root_v = find(parent, v)
        if root_u != root_v:
# >>> BLANK id=union level=2 hint="一条赋值，把两组并成一组：u 那一组的根挂到 v 那一组的根下面（u 的根写在等号左边） || 两个端点的根不同，说明它们还在两棵不同的树里，这条边不会成环；合并只要改一个根的 parent" hintEn="One assignment that merges the two groups: hang the root of u's group under the root of v's group (u's root on the left of the equals sign) || Different roots mean the two ends are still in different trees, so this edge cannot make a cycle; merging only needs one root's parent changed"
            parent[root_u] = root_v
# <<< BLANK
            total += weight
            used += 1
    if used < len(nodes) - 1:
        return None
    return total


if __name__ == "__main__":
    nodes = ["A", "B", "C", "D", "E", "F"]
    edges = [
        (4, "A", "B"), (2, "A", "C"), (1, "B", "C"), (5, "B", "D"),
        (8, "C", "D"), (10, "C", "E"), (2, "D", "E"), (6, "D", "F"),
        (3, "E", "F"),
    ]
    print(kruskal_total(nodes, edges))
    print(kruskal_total(nodes + ["G"], edges))
