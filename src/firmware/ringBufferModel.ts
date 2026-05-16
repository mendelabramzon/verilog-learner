// ─────────────────────────────────────────────────────────────────────────────
// Simulated firmbuf-rs RingBuf.
// A fixed-size, power-of-2 ring buffer with separate producer/consumer
// pointers (equivalent to lock-free SPSC ring buffer).
//
// This models what firmbuf-rs does in real Rust firmware.
// In embedded systems this buffer sits between an ISR (producer) and
// the main loop (consumer), or between a DMA completion callback and
// the application parser.
// ─────────────────────────────────────────────────────────────────────────────

export interface RingBuffer {
  data: Uint8Array;
  /** Index where next byte will be written */
  head: number;
  /** Index where next byte will be read */
  tail: number;
  capacity: number;
}

export function createRingBuffer(capacityPow2 = 64): RingBuffer {
  const capacity = nextPow2(capacityPow2);
  return {
    data: new Uint8Array(capacity),
    head: 0,
    tail: 0,
    capacity,
  };
}

export function ringPush(buf: RingBuffer, byte: number): { buf: RingBuffer; ok: boolean } {
  if (ringIsFull(buf)) return { buf, ok: false };
  const next = (buf.head + 1) & (buf.capacity - 1);
  const data = new Uint8Array(buf.data);
  data[buf.head] = byte & 0xFF;
  return { buf: { ...buf, data, head: next }, ok: true };
}

export function ringPop(buf: RingBuffer): { buf: RingBuffer; byte: number | null } {
  if (ringIsEmpty(buf)) return { buf, byte: null };
  const byte = buf.data[buf.tail];
  const tail = (buf.tail + 1) & (buf.capacity - 1);
  return { buf: { ...buf, tail }, byte };
}

export function ringIsEmpty(buf: RingBuffer): boolean {
  return buf.head === buf.tail;
}

export function ringIsFull(buf: RingBuffer): boolean {
  return ((buf.head + 1) & (buf.capacity - 1)) === buf.tail;
}

export function ringCount(buf: RingBuffer): number {
  return (buf.head - buf.tail + buf.capacity) & (buf.capacity - 1);
}

export function ringReset(buf: RingBuffer): RingBuffer {
  return { ...buf, head: 0, tail: 0, data: new Uint8Array(buf.capacity) };
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
