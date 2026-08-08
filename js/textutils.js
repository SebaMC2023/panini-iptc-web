// Porting di textutils.py: pulizia caratteri speciali + matching fuzzy.

const REPLACEMENTS = {
  'á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u','ñ':'n',
  'Á':'A','É':'E','Í':'I','Ó':'O','Ú':'U','Ü':'U','Ñ':'N',
  'à':'a','ã':'a','â':'a','ê':'e','õ':'o','ô':'o','ç':'c',
  'À':'A','Ã':'A','Â':'A','Ê':'E','Õ':'O','Ô':'O','Ç':'C',
  'è':'e','ë':'e','î':'i','ï':'i','œ':'oe','û':'u','ù':'u',
  'ÿ':'y','È':'E','Ë':'E','Î':'I','Ï':'I','Œ':'OE','Û':'U',
  'Ù':'U','Ÿ':'Y','æ':'ae','Æ':'AE',
  'ä':'a','ö':'o','ß':'ss','Ä':'A','Ö':'O',
  'ø':'o','Ø':'O','å':'a','Å':'A',
  'þ':'th','Þ':'Th','ð':'d','Ð':'D',
  'ć':'c','Ć':'C','č':'c','Č':'C',
  'đ':'d','Đ':'D','š':'s','Š':'S',
  'ž':'z','Ž':'Z',
  'ě':'e','Ě':'E','ř':'r','Ř':'R',
  'ů':'u','Ů':'U','ý':'y','Ý':'Y',
  'ď':'d','Ď':'D','ť':'t','Ť':'T',
  'ň':'n','Ň':'N',
  'ł':'l','Ł':'L','ń':'n','Ń':'N',
  'ś':'s','Ś':'S','ź':'z','Ź':'Z',
  'ż':'z','Ż':'Z','ą':'a','Ą':'A',
  'ę':'e','Ę':'E',
  'ő':'o','Ő':'O','ű':'u','Ű':'U',
  'ğ':'g','Ğ':'G','ı':'i','İ':'I',
  'ş':'s','Ş':'S',
  'ă':'a','Ă':'A','ț':'t','Ț':'T',
  'ș':'s','Ș':'S','ţ':'t','Ţ':'T',
  'ū':'u','Ū':'U','ī':'i','Ī':'I',
  'ā':'a','Ā':'A','ē':'e','Ē':'E',
  'ģ':'g','Ģ':'G','ķ':'k','Ķ':'K',
  'ļ':'l','Ļ':'L','ņ':'n','Ņ':'N',
  'ŗ':'r','Ŗ':'R',
  'ả':'a','ạ':'a','ắ':'a','ặ':'a','ằ':'a','ẳ':'a','ẵ':'a',
  'ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a',
  'Ả':'A','Ạ':'A','Ắ':'A','Ặ':'A','Ằ':'A','Ẳ':'A','Ẵ':'A',
  'Ấ':'A','Ầ':'A','Ẩ':'A','Ẫ':'A','Ậ':'A',
  'ẻ':'e','ẽ':'e','ẹ':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e',
  'Ẻ':'E','Ẽ':'E','Ẹ':'E','Ế':'E','Ề':'E','Ể':'E','Ễ':'E','Ệ':'E',
  'ỉ':'i','ĩ':'i','ị':'i','Ỉ':'I','Ĩ':'I','Ị':'I',
  'ỏ':'o','ọ':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o',
  'ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o',
  'Ỏ':'O','Ọ':'O','Ố':'O','Ồ':'O','Ổ':'O','Ỗ':'O','Ộ':'O',
  'Ơ':'O','Ớ':'O','Ờ':'O','Ở':'O','Ỡ':'O','Ợ':'O',
  'ủ':'u','ũ':'u','ụ':'u','ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u',
  'Ủ':'U','Ũ':'U','Ụ':'U','Ư':'U','Ứ':'U','Ừ':'U','Ử':'U','Ữ':'U','Ự':'U',
  'ỳ':'y','ỷ':'y','ỹ':'y','ỵ':'y','Ỳ':'Y','Ỷ':'Y','Ỹ':'Y','Ỵ':'Y',
};

function cleanSpecialChars(text) {
  if (text === null || text === undefined) return '';
  let out = '';
  for (const ch of String(text)) {
    out += REPLACEMENTS[ch] !== undefined ? REPLACEMENTS[ch] : ch;
  }
  return out;
}

function similarity(a, b, ratioFn) {
  const aClean = cleanSpecialChars(a).toUpperCase().replace(/\s+/g, '');
  const bClean = cleanSpecialChars(b).toUpperCase().replace(/\s+/g, '');
  return ratioFn(aClean, bClean);
}

function bestMatch(nameOcr, records, ratioFn, threshold) {
  threshold = threshold === undefined ? 0.75 : threshold;
  const nameClean = nameOcr.includes(' - ') ? nameOcr.split(' - ')[0].trim() : nameOcr;
  let bestRec = null, bestRatio = 0;
  for (const rec of records) {
    const r = similarity(nameClean, rec.name, ratioFn);
    if (r > bestRatio) { bestRatio = r; bestRec = rec; }
  }
  if (bestRec !== null && bestRatio >= threshold) return { rec: bestRec, ratio: bestRatio };
  return { rec: null, ratio: bestRatio };
}

const TextUtils = { cleanSpecialChars, similarity, bestMatch };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TextUtils;
} else {
  window.TextUtils = TextUtils;
}
