const PREFIX = 'TO-';

/** TO-0004 → TO-0005; four digits minimum, wider once TO-9999 is reached. */
export function nextTransportOrderNo(lastNo: string | null): string {
  const last = lastNo === null ? 0 : Number(lastNo.slice(PREFIX.length));
  if (!Number.isInteger(last))
    throw new Error(`Unexpected transport order number: ${lastNo}`);
  return `${PREFIX}${String(last + 1).padStart(4, '0')}`;
}
