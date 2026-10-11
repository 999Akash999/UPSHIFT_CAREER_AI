// Original practice prompts inspired by common interview patterns.
// Keep answer keys on the server; the page only receives prompt and choices.
module.exports = [
  {
    id: "pair-sum-map", title: "Find a pair that reaches the target", pattern: "Hash map", difficulty: "Easy",
    prompt: "You need to return the indices of two distinct numbers whose sum equals a target. The input has 100,000 values. Which approach gives the best expected runtime?",
    choices: ["Check every pair with two loops", "Sort and scan, then search for original indices", "Store seen values in a hash map while scanning", "Compare each value only with the next value"], correctIndex: 2,
    hint: "For each number, ask whether its complement has already appeared.", explanation: "A hash map stores previously seen values and their indices, giving O(n) expected time and O(n) extra space.",
  },
  {
    id: "balanced-brackets", title: "Check balanced brackets", pattern: "Stack", difficulty: "Easy",
    prompt: "A string contains (), {}, and []. What data structure best tracks the most recent unmatched opening bracket?",
    choices: ["Queue", "Stack", "Min-heap", "Hash set"], correctIndex: 1,
    hint: "The last opening bracket must match the next closing bracket.", explanation: "A stack is last-in, first-out. Each closing bracket must match the top opening bracket.",
  },
  {
    id: "binary-search-boundary", title: "Find the first valid position", pattern: "Binary search", difficulty: "Easy",
    prompt: "A sorted array may contain duplicates. You need the first index whose value is at least x. What change makes binary search find the left boundary?",
    choices: ["Return immediately whenever the midpoint equals x", "When the predicate is true, save the midpoint and continue left", "Scan the array after a normal search", "Use a stack to remember equal values"], correctIndex: 1,
    hint: "Finding any valid index is not enough; there may be an earlier one.", explanation: "Keep the midpoint as a candidate when it satisfies the condition, then continue searching the left half.",
  },
  {
    id: "merge-intervals", title: "Combine overlapping time ranges", pattern: "Sorting + intervals", difficulty: "Medium",
    prompt: "Given many closed intervals, combine every overlapping pair. Which first step enables a single forward pass?",
    choices: ["Sort intervals by start time", "Sort by interval length", "Put intervals in a queue in input order", "Build a graph between every pair"], correctIndex: 0,
    hint: "After ordering, intervals that can overlap become neighbors.", explanation: "Sorting by start time lets you compare each interval with the last merged interval in O(n log n) total time.",
  },
  {
    id: "sliding-window-sum", title: "Longest range under a limit", pattern: "Sliding window", difficulty: "Medium",
    prompt: "All values are non-negative. Find the longest contiguous range whose sum is at most K. Which technique is most suitable?",
    choices: ["Expand a right pointer and shrink the left pointer while sum exceeds K", "Run binary search independently for every subarray", "Use depth-first search over all ranges", "Sort the values before scanning"], correctIndex: 0,
    hint: "Non-negative values mean shrinking the left edge never increases the sum.", explanation: "A sliding window visits each index at most twice, so it runs in O(n) time.",
  },
  {
    id: "linked-list-cycle", title: "Detect a linked-list loop", pattern: "Two pointers", difficulty: "Easy",
    prompt: "A singly linked list may contain a cycle. You need O(1) extra space. Which method detects one in linear time?",
    choices: ["Store every node in a hash set", "Use slow and fast pointers that move one and two links", "Reverse the list and compare it", "Count nodes until a null link appears"], correctIndex: 1,
    hint: "If two runners move at different speeds around a loop, the faster one eventually catches the slower one.", explanation: "Floyd's tortoise-and-hare method uses O(1) space and O(n) time.",
  },
  {
    id: "top-k-elements", title: "Keep only the largest K values", pattern: "Heap", difficulty: "Medium",
    prompt: "A stream contains millions of values, but K is small. You need the K largest values without sorting the whole stream. Which structure is efficient?",
    choices: ["A min-heap of size K", "A max-heap containing every value", "A queue of size K", "A stack sorted after each insert"], correctIndex: 0,
    hint: "Keep the smallest value among your current K candidates easy to remove.", explanation: "A min-heap of size K takes O(n log K) time and O(K) space; its root is the weakest current candidate.",
  },
  {
    id: "tree-level-order", title: "Visit a tree level by level", pattern: "Tree + BFS", difficulty: "Easy",
    prompt: "You must return a binary tree's nodes grouped by depth, from top to bottom. Which traversal naturally does this?",
    choices: ["In-order depth-first traversal", "Pre-order depth-first traversal", "Breadth-first traversal using a queue", "Post-order depth-first traversal"], correctIndex: 2,
    hint: "Process all nodes at the current depth before their children.", explanation: "BFS with a queue visits nodes level by level. Capture the queue size at each level to group results.",
  },
  {
    id: "graph-components", title: "Count connected groups", pattern: "Graph traversal", difficulty: "Medium",
    prompt: "An undirected graph has N vertices and adjacency lists. You need the number of connected components. What is the standard approach?",
    choices: ["Start BFS/DFS at each unvisited vertex and count each start", "Run binary search on the vertex labels", "Sort each adjacency list and count duplicates", "Use a stack to store only degree-one vertices"], correctIndex: 0,
    hint: "One traversal from an unvisited vertex reaches exactly its component.", explanation: "Mark vertices visited during BFS/DFS. Each new unvisited start contributes one component; total time is O(V + E).",
  },
  {
    id: "coin-change-dp", title: "Minimum coins for a total", pattern: "Dynamic programming", difficulty: "Medium",
    prompt: "Coin values can be reused. You need the minimum number of coins to make amount A. Which state is useful for bottom-up dynamic programming?",
    choices: ["dp[x] = minimum coins needed to make amount x", "dp[x] = number of coins larger than x", "dp[x] = largest coin seen so far", "dp[x] = sorted list of all amounts"], correctIndex: 0,
    hint: "Build the answer for each smaller amount from reachable previous amounts.", explanation: "For each amount x, try every coin c and use dp[x - c] + 1 when x - c is reachable.",
  },
  {
    id: "lru-cache", title: "Design an LRU cache", pattern: "Hash map + doubly linked list", difficulty: "Hard",
    prompt: "A cache needs O(1) average get and put operations, and must evict the least recently used key. Which combination supports both lookup and recency updates?",
    choices: ["Array and binary search", "Hash map plus doubly linked list", "Queue plus a set only", "Binary search tree alone"], correctIndex: 1,
    hint: "You need direct key lookup and constant-time removal/reinsertion in recency order.", explanation: "The map finds a node in O(1) average time; the doubly linked list moves or removes that node in O(1).",
  },
  {
    id: "course-order", title: "Check whether prerequisites are possible", pattern: "Topological sort", difficulty: "Medium",
    prompt: "Courses form a directed prerequisite graph. A course can be taken only after its prerequisites. How can you detect whether all courses can be completed?",
    choices: ["Run BFS from every course and count shortest paths", "Topologically sort and check whether all vertices are emitted", "Sort course names alphabetically", "Use a minimum spanning tree"], correctIndex: 1,
    hint: "A directed cycle means at least one course depends on itself indirectly.", explanation: "Kahn's algorithm or DFS topological sorting emits every vertex only when the graph is acyclic.",
  },
];
