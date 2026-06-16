package br.com.fiquemsabendo.figurinhas.domain

// Multi-frame agreement: commit a code only once it's seen on >= threshold frames of one hold.
// A transient one-frame slip never repeats, so it never reaches the threshold. Ports confirm.ts.
class Confirmer(private val threshold: Int) {
    private val counts = HashMap<String, Int>()
    private val committed = LinkedHashSet<String>()

    /** Record one frame's resolved codes; return those that crossed the threshold THIS frame. */
    fun add(codes: Iterable<String>): List<String> {
        val seenThisFrame = codes.toHashSet() // a code counts once per frame
        val newly = ArrayList<String>()
        for (code in seenThisFrame) {
            if (code in committed) continue
            val next = (counts[code] ?: 0) + 1
            counts[code] = next
            if (next >= threshold) { committed.add(code); newly.add(code) }
        }
        return newly
    }

    fun committedCount(): Int = committed.size

    fun reset() { counts.clear(); committed.clear() }
}
