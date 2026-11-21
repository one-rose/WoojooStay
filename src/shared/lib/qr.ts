/**
 * QR 코드 만들기 (바이트 모드 · 오류 정정 M · 버전 1~10, 최대 약 210바이트) — 출근 QR 인쇄용.
 * 외부 라이브러리 없이 ISO/IEC 18004 절차 그대로: 데이터 → 리드-솔로몬 → 배치 → 마스크(벌점 가장 낮은 것).
 * 알고리즘 구성은 Project Nayuki 의 QR Code generator(MIT) 를 따랐다.
 */

/** 버전 1~10, 오류 정정 M — 블록당 정정 코드 수 · 블록 수 */
const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;
/** 오류 정정 M 의 형식 비트 */
const ECC_FORMAT_M = 0;

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

const dataCodewords = (ver: number) =>
  Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver - 1] * NUM_BLOCKS[ver - 1];

/* GF(256) 곱셈 — 원시 다항식 0x11D */
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)));
  }
  return result;
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

/** UTF-8 바이트 → 정정 코드까지 섞은 최종 코드워드 */
function encodeCodewords(bytes: Uint8Array, ver: number): number[] {
  const bits: number[] = [];
  const put = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0b0100, 4); // 바이트 모드
  put(bytes.length, ver <= 9 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const capacity = dataCodewords(ver) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const numBlocks = NUM_BLOCKS[ver - 1];
  const eccLen = ECC_PER_BLOCK[ver - 1];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++)
    blocks.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(b[i]);
    });
  return result;
}

class Grid {
  readonly ver: number;
  readonly size: number;
  readonly dark: boolean[][];
  readonly fixed: boolean[][];

  constructor(ver: number) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  setFixed(x: number, y: number, isDark: boolean) {
    this.dark[y][x] = isDark;
    this.fixed[y][x] = true;
  }

  alignPositions(): number[] {
    if (this.ver === 1) return [];
    const n = Math.floor(this.ver / 7) + 2;
    const step = Math.ceil((this.ver * 4 + 4) / (n * 2 - 2)) * 2;
    const out = [6];
    for (let pos = this.size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  drawFunctionPatterns() {
    const s = this.size;
    for (let i = 0; i < s; i++) {
      this.setFixed(6, i, i % 2 === 0);
      this.setFixed(i, 6, i % 2 === 0);
    }
    const finder = (cx: number, cy: number) => {
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || x >= s || y < 0 || y >= s) continue;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          this.setFixed(x, y, d !== 2 && d !== 4);
        }
    };
    finder(3, 3);
    finder(s - 4, 3);
    finder(3, s - 4);
    const pos = this.alignPositions();
    const n = pos.length;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            this.setFixed(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    this.drawFormat(0);
    if (this.ver >= 7) {
      let rem = this.ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (this.ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const a = s - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.setFixed(a, b, bit(bits, i));
        this.setFixed(b, a, bit(bits, i));
      }
    }
  }

  drawFormat(mask: number) {
    const data = (ECC_FORMAT_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const s = this.size;
    for (let i = 0; i <= 5; i++) this.setFixed(8, i, bit(bits, i));
    this.setFixed(8, 7, bit(bits, 6));
    this.setFixed(8, 8, bit(bits, 7));
    this.setFixed(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.setFixed(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.setFixed(s - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.setFixed(8, s - 15 + i, bit(bits, i));
    this.setFixed(8, s - 8, true);
  }

  drawCodewords(data: readonly number[]) {
    const s = this.size;
    let i = 0;
    for (let right = s - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < s; vert++)
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? s - 1 - vert : vert;
          if (!this.fixed[y][x] && i < data.length * 8) {
            this.dark[y][x] = bit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        if (this.fixed[y][x]) continue;
        let invert: boolean;
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0;
            break;
          case 1:
            invert = y % 2 === 0;
            break;
          case 2:
            invert = x % 3 === 0;
            break;
          case 3:
            invert = (x + y) % 3 === 0;
            break;
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0;
            break;
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          default:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (invert) this.dark[y][x] = !this.dark[y][x];
      }
  }

  /** 마스크 고르기용 벌점 (규칙 1·2·3·4) */
  penalty(): number {
    const s = this.size;
    const d = this.dark;
    let p = 0;
    const line = (get: (i: number) => boolean) => {
      let run = 1;
      for (let i = 1; i <= s; i++) {
        if (i < s && get(i) === get(i - 1)) run++;
        else {
          if (run >= 5) p += 3 + (run - 5);
          run = 1;
        }
      }
      // 1:1:3:1:1 (앞뒤 4칸 밝음)
      for (let i = 0; i + 6 < s; i++) {
        const core = [true, false, true, true, true, false, true].every((v, k) => get(i + k) === v);
        if (!core) continue;
        const lightBefore = [1, 2, 3, 4].every((k) => i - k < 0 || !get(i - k));
        const lightAfter = [7, 8, 9, 10].every((k) => i + k >= s || !get(i + k));
        if (lightBefore || lightAfter) p += 40;
      }
    };
    for (let y = 0; y < s; y++) line((x) => d[y][x]);
    for (let x = 0; x < s; x++) line((y) => d[y][x]);
    for (let y = 0; y + 1 < s; y++)
      for (let x = 0; x + 1 < s; x++) {
        const c = d[y][x];
        if (c === d[y][x + 1] && c === d[y + 1][x] && c === d[y + 1][x + 1]) p += 3;
      }
    const darkCount = d.reduce((a, row) => a + row.filter(Boolean).length, 0);
    const total = s * s;
    p += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10;
    return p;
  }
}

/** QR 모듈 표 (true = 검은 칸). 내용이 너무 길면 오류 */
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let ver = 1;
  while (ver <= MAX_VERSION && 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8 > dataCodewords(ver) * 8) ver++;
  if (ver > MAX_VERSION) throw new Error("QR 내용이 너무 길어요.");
  const codewords = encodeCodewords(bytes, ver);
  let best: Grid | null = null;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = new Grid(ver);
    g.drawFunctionPatterns();
    g.drawCodewords(codewords);
    g.applyMask(mask);
    g.drawFormat(mask);
    const p = g.penalty();
    if (p < bestPenalty) {
      best = g;
      bestPenalty = p;
    }
  }
  return best!.dark;
}

/** QR 을 SVG path 하나로 (조용한 여백 4칸 포함, viewBox 단위 = 모듈 1칸) */
export function qrSvgPath(text: string): { size: number; path: string } {
  const m = qrMatrix(text);
  const quiet = 4;
  let path = "";
  m.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }),
  );
  return { size: m.length + quiet * 2, path };
}
