// Porting fedele di difflib.SequenceMatcher (solo il necessario per .ratio()),
// per garantire lo stesso comportamento di matching usato negli script Python.
// Algoritmo di Ratcliff-Obershelp: stesso approccio di CPython difflib.

function findLongestMatch(a, b, alo, ahi, blo, bhi, b2j) {
  let besti = alo, bestj = blo, bestsize = 0;
  let j2len = {};
  for (let i = alo; i < ahi; i++) {
    const newj2len = {};
    const indices = b2j[a[i]] || [];
    for (const j of indices) {
      if (j < blo) continue;
      if (j >= bhi) break;
      const k = (j2len[j - 1] || 0) + 1;
      newj2len[j] = k;
      if (k > bestsize) {
        besti = i - k + 1;
        bestj = j - k + 1;
        bestsize = k;
      }
    }
    j2len = newj2len;
  }
  return [besti, bestj, bestsize];
}

function getMatchingBlocks(a, b) {
  const b2j = {};
  for (let j = 0; j < b.length; j++) {
    const ch = b[j];
    if (!b2j[ch]) b2j[ch] = [];
    b2j[ch].push(j);
  }

  const queue = [[0, a.length, 0, b.length]];
  const matchingBlocks = [];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const [i, j, k] = findLongestMatch(a, b, alo, ahi, blo, bhi, b2j);
    if (k > 0) {
      matchingBlocks.push([i, j, k]);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  matchingBlocks.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  return matchingBlocks;
}

function ratio(a, b) {
  if (a.length === 0 && b.length === 0) return 1.0;
  const blocks = getMatchingBlocks(a, b);
  let matches = 0;
  for (const [, , size] of blocks) matches += size;
  return (2.0 * matches) / (a.length + b.length);
}

// Esporta sia come modulo (per i test Node) sia come globale (per il browser)
const SeqMatch = { ratio };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SeqMatch;
} else {
  window.SeqMatch = SeqMatch;
}
