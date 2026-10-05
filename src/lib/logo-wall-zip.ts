// Small ZIP writer using stored entries: PNG is already compressed.
// Files are bounded by the caller; no temporary asset files are written.
export function logoWallZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Buffer[] = []; const directory: Buffer[] = []; let offset = 0;
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  for (const file of files) {
    if (!file.name || file.name.includes('..') || /^[\\/]/.test(file.name) || file.name.includes('\\')) throw new Error('unsafe ZIP filename');
    const name = Buffer.from(file.name); const data = Buffer.from(file.data);
    if (name.length > 65535) throw new Error('ZIP filename too long');
    let crc = 0xffffffff; for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    chunks.push(header, name, data);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(33, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    directory.push(central, name); offset += header.length + name.length + data.length;
  }
  const dir = Buffer.concat(directory); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, dir, end]));
}
