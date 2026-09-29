"""Huffman coding: how many bits the text needs, without building the tree."""
import heapq


def huffman_bits(text):
    counts = {}
    for ch in text:
        counts[ch] = counts.get(ch, 0) + 1
    if len(counts) == 1:
        return len(text)
    heap = [(n, [ch]) for ch, n in counts.items()]
    heapq.heapify(heap)
    length = dict.fromkeys(counts, 0)
    while len(heap) > 1:
# >>> BLANK id=pop-two level=2 hint="从堆里取出最轻的两组：两行，每行从 heap 里取一次、直接拆成（次数, 字符列表）两个变量——第一组叫 n1 与 group1，第二组叫 n2 与 group2；通过模块名 heapq 调用 || 取出堆里当前最小那一项的函数叫 heappop，实参是 heap；连取两次就是最轻的两组" hintEn="Take the two lightest groups off the heap: two lines, each taking one item from heap and unpacking it straight into two variables (count, list of characters) - the first called n1 and group1, the second n2 and group2; call through the module name heapq || The function that takes out the smallest item on the heap right now is heappop, with heap as its argument; two in a row give the two lightest groups"
        n1, group1 = heapq.heappop(heap)
        n2, group2 = heapq.heappop(heap)
# <<< BLANK
        for ch in group1 + group2:
# >>> BLANK id=one-deeper level=1 hint="两组合并成一组，里面每个字符的码字前面都多了一位：把 length 里这个字符的码长加 1，用 +=" hintEn="Merging two groups puts one more bit in front of the code of every character in them: add 1 to this character's code length in length, using +="
            length[ch] += 1
# <<< BLANK
        heapq.heappush(heap, (n1 + n2, group1 + group2))
    return sum(counts[ch] * length[ch] for ch in counts)


if __name__ == "__main__":
    text = "abracadabra"
    print(huffman_bits(text), len(text) * 8)
    print(huffman_bits("aaaaaaab"), huffman_bits("abcdefgh"))
    print(huffman_bits("zzzz"), huffman_bits(""))
