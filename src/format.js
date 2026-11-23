export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const inMegabytes = bytes >= 1024 * 1024;
  const value = bytes / (inMegabytes ? 1024 * 1024 : 1024);
  return `${value.toLocaleString(undefined, { maximumFractionDigits: value < 10 ? 1 : 0 })} ${inMegabytes ? 'MB' : 'KB'}`;
}

export function plural(count, name) {
  return `${count} ${name}${count === 1 ? '' : 's'}`;
}

export function downloadName(value) {
  const stem = value.trim().replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[.\s]+$/g, '');
  const safeStem = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem) ? `_${stem}` : stem;
  return `${safeStem || 'merged-document'}.pdf`;
}
