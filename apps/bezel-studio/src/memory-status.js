// Presentation of the backend's already scoped/aggregated byte counts.
// Decimal MB, rounded only at display time, like memory::megabytes in Rust.
export function memoryStatus(report, t) {
  const value = (bytes) => bytes === null || bytes === undefined ? t('shell.memoryUnavailable') : t('shell.memoryMB', { value: Math.round(bytes / 1_000_000) });
  const demo = report?.demo === true;
  const amount = value(report?.totalBytes);
  const label = t('shell.memoryChip', { value: amount });
  const note = t(demo ? 'shell.memoryDemo' : 'shell.memoryMethod');
  const rows = (report?.processes ?? []).map(p => t('shell.memoryProcess', { name: t(`shell.memoryRole.${p.role}`), pid: p.pid, value: value(p.bytes) }));
  return { label: demo ? `${label} · ${t('shell.memoryDemoBadge')}` : label, note, rows, title: [label, note, ...rows].join('\n'), demo };
}
