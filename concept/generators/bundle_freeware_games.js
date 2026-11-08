import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { mfmEncodeBytes, decodeAmigaTrack, ADF_SIZE } from '../../packages/core/dist/ipf/mfm.js';

function decodeIpf(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u32 = (o) => dv.getUint32(o, false);
  const imges = [];
  const areas = new Map();
  let off = 0;
  while (off + 8 <= buf.length) {
    const type = String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
    const len = u32(off + 4);
    if (type === 'IMGE') {
      const g = (i) => u32(off + 12 + i * 4);
      imges.push({
        track: g(0), side: g(1), density: g(2), signalType: g(3), trackBytes: g(4),
        startBytePos: g(5), startBitPos: g(6), dataBits: g(7), gapBits: g(8), trackBits: g(9),
        blockCount: g(10), encoderProcess: g(11), flags: g(12), dataKey: g(13),
        blocks: [], protected: false, reasons: []
      });
    } else if (type === 'DATA') {
      const dataLen = u32(off + 12);
      const key = u32(off + 24);
      areas.set(key, buf.subarray(off + len, off + len + dataLen));
      off += len + dataLen;
      continue;
    }
    off += len;
  }

  const diskSectors = [];
  let tracksOk = 0;
  for (let cyl = 0; cyl < 80; cyl++) {
    for (let head = 0; head < 2; head++) {
      const t = imges.find((img) => img.track === cyl && img.side === head);
      if (!t) {
        for (let s = 0; s < 11; s++) diskSectors.push(new Uint8Array(512));
        continue;
      }
      const area = areas.get(t.dataKey);
      if (!area) {
        for (let s = 0; s < 11; s++) diskSectors.push(new Uint8Array(512));
        continue;
      }
      const areaDv = new DataView(area.buffer, area.byteOffset, area.byteLength);
      const gBlock = (b, i) => areaDv.getUint32(b * 32 + i * 4, false);
      t.blocks = [];
      for (let b = 0; b < t.blockCount; b++) {
        t.blocks.push({
          dataBits: gBlock(b, 0), gapBits: gBlock(b, 1), gapOffset: gBlock(b, 2),
          cellType: gBlock(b, 3), encoderType: gBlock(b, 4), blockFlags: gBlock(b, 5),
          gapDefault: gBlock(b, 6), dataOffset: gBlock(b, 7)
        });
      }

      const out = [];
      let prev = 0;
      for (let b = 0; b < t.blocks.length; b++) {
        let p = t.blocks[b].dataOffset;
        while (p < area.length) {
          const headByte = area[p++];
          if (headByte === 0) break;
          const type = headByte & 0x1f;
          const nb = headByte >> 5;
          let size = 0;
          for (let i = 0; i < nb; i++) size = size * 256 + area[p++];
          if (p + size > area.length) break;
          const payload = area.subarray(p, p + size);
          p += size;

          if (type === 1 || type === 4) {
            for (const v of payload) out.push(v);
            if (payload.length) prev = payload[payload.length - 1] & 1;
          } else if (type === 2 || type === 3) {
            const r = mfmEncodeBytes(payload, prev);
            prev = r.prev;
            for (const v of r.out) out.push(v);
          }
        }
      }

      const mfm = Uint8Array.from(out);
      const dec = decodeAmigaTrack(mfm, out.length * 8);
      if (dec.sectors.size === 11) {
        tracksOk++;
        for (let s = 0; s < 11; s++) diskSectors.push(dec.sectors.get(s));
      } else {
        for (let s = 0; s < 11; s++) diskSectors.push(dec.sectors.get(s) ?? new Uint8Array(512));
      }
    }
  }

  const adf = new Uint8Array(ADF_SIZE);
  let ptr = 0;
  for (const sec of diskSectors) {
    if (ptr + 512 <= adf.byteLength) {
      if (sec) adf.set(sec, ptr);
      ptr += 512;
    }
  }
  return { adf, tracksOk };
}

const outBase = 'packages/web/public/media/freeware';
mkdirSync(outBase, { recursive: true });

const results = {};

// 1. Flight of the Amazon Queen (11 Disks)
{
  const zipPath = '/Users/andrelange/Downloads/amiga_game_disk_collection/Flight of the Amazon Queen (Europe).zip';
  const outDir = join(outBase, 'flight-of-the-amazon-queen');
  mkdirSync(outDir, { recursive: true });
  const entries = execSync(`zipinfo -1 "${zipPath}" | grep ".ipf$"`, { encoding: 'utf8' }).trim().split('\n');
  entries.sort();
  results['flight-of-the-amazon-queen'] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const ipfData = execSync(`unzip -p "${zipPath}" "${entry}"`, { maxBuffer: 50 * 1024 * 1024 });
    const { adf, tracksOk } = decodeIpf(ipfData);
    const filename = `Flight of the Amazon Queen (Disk ${i + 1} of 11).adf`;
    const target = join(outDir, filename);
    writeFileSync(target, adf);
    const sha256 = createHash('sha256').update(adf).digest('hex');
    results['flight-of-the-amazon-queen'].push({
      id: `disk-${i + 1}`,
      label: `Disk ${i + 1} of 11`,
      filename,
      sha256,
      tracksOk
    });
    console.log(`[FOTAQ] Disk ${i + 1}/11 -> ${filename} (${tracksOk}/160 tracks, sha256: ${sha256})`);
  }
}

// 2. Beneath a Steel Sky (15 Disks)
{
  const zipPath = '/Users/andrelange/Downloads/amiga_game_disk_collection/Beneath a Steel Sky (Europe).zip';
  const outDir = join(outBase, 'beneath-a-steel-sky');
  mkdirSync(outDir, { recursive: true });
  const entries = execSync(`zipinfo -1 "${zipPath}" | grep ".ipf$"`, { encoding: 'utf8' }).trim().split('\n');
  // Order: Boot Disk first, then Disk 00 .. Disk 13
  entries.sort((a, b) => {
    if (a.includes('Boot Disk')) return -1;
    if (b.includes('Boot Disk')) return 1;
    return a.localeCompare(b);
  });
  results['beneath-a-steel-sky'] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const ipfData = execSync(`unzip -p "${zipPath}" "${entry}"`, { maxBuffer: 50 * 1024 * 1024 });
    const { adf, tracksOk } = decodeIpf(ipfData);
    const filename = `Beneath a Steel Sky (Disk ${i + 1} of 15).adf`;
    const target = join(outDir, filename);
    writeFileSync(target, adf);
    const sha256 = createHash('sha256').update(adf).digest('hex');
    results['beneath-a-steel-sky'].push({
      id: `disk-${i + 1}`,
      label: `Disk ${i + 1} of 15`,
      filename,
      sha256,
      tracksOk
    });
    console.log(`[BASS] Disk ${i + 1}/15 -> ${filename} (${tracksOk}/160 tracks, sha256: ${sha256})`);
  }
}

// 3. Lure of the Temptress (4 Disks)
{
  const zipPath = '/Users/andrelange/Downloads/amiga_game_disk_collection/Lure of the Temptress (Europe) (v2) (6-8-1992).zip';
  const outDir = join(outBase, 'lure-of-the-temptress');
  mkdirSync(outDir, { recursive: true });
  const entries = execSync(`zipinfo -1 "${zipPath}" | grep ".ipf$"`, { encoding: 'utf8' }).trim().split('\n');
  entries.sort((a, b) => {
    if (a.includes('Boot Disk')) return -1;
    if (b.includes('Boot Disk')) return 1;
    return a.localeCompare(b);
  });
  results['lure-of-the-temptress'] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const ipfData = execSync(`unzip -p "${zipPath}" "${entry}"`, { maxBuffer: 50 * 1024 * 1024 });
    const { adf, tracksOk } = decodeIpf(ipfData);
    // If standard 160 tracks decoded, save as ADF, else save raw IPF with proper name
    const useAdf = tracksOk >= 80;
    const ext = useAdf ? 'adf' : 'ipf';
    const filename = `Lure of the Temptress (Disk ${i + 1} of 4).${ext}`;
    const target = join(outDir, filename);
    const fileBytes = useAdf ? adf : ipfData;
    writeFileSync(target, fileBytes);
    const sha256 = createHash('sha256').update(fileBytes).digest('hex');
    results['lure-of-the-temptress'].push({
      id: `disk-${i + 1}`,
      label: `Disk ${i + 1} of 4`,
      filename,
      sha256,
      tracksOk
    });
    console.log(`[LURE] Disk ${i + 1}/4 -> ${filename} (${tracksOk} tracks, sha256: ${sha256})`);
  }
}

writeFileSync(join(outBase, 'manifest.json'), JSON.stringify(results, null, 2));
console.log('Done bundling 3 freeware games! Manifest written.');
