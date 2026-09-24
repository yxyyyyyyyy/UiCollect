function packGallery(items, columns) {
  const count = columns >= 3 ? 3 : columns === 2 ? 2 : 1;
  if (count === 1) return items.map(item => ({ item, span: 1 }));

  const pending = items.slice();
  const packed = [];
  while (pending.length) {
    const row = [];
    let used = 0;
    while (pending.length && used < count) {
      const next = pending[0];
      const nextSpan = next.size === 'large' ? 2 : 1;
      if (nextSpan <= count - used) {
        row.push({ item: pending.shift(), span: nextSpan });
        used += nextSpan;
        continue;
      }

      const fillerIndex = pending.findIndex((candidate, index) => index > 0 && candidate.size !== 'large');
      if (fillerIndex !== -1) {
        row.push({ item: pending.splice(fillerIndex, 1)[0], span: 1 });
        used += 1;
      } else {
        row[row.length - 1].span += count - used;
        used = count;
      }
    }
    if (used < count && row.length) row[row.length - 1].span += count - used;
    packed.push(...row);
  }
  return packed;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { packGallery };
if (typeof window !== 'undefined') window.packGallery = packGallery;
