import { describe, it, expect } from "vitest";
import { FloppyController, ZipParser, FREEWARE_CLASSICS, createClassicMultiDiskProfile } from "../index.js";

describe("Floppy Swap Subsystem (Lane 3 & 4)", () => {
  it("swapDisk atomically updates disk media, resets to cylinder 0 and pulses activity", () => {
    const controller = new FloppyController();
    const events: string[] = [];
    controller.onEvent((e) => events.push(e.type));

    controller.insertDisk(0, { id: "disk1", label: "Disk 1" });
    controller.seek(0, 45);
    expect(controller.getState(0).cylinder).toBe(45);

    // Swap to Disk 2
    controller.swapDisk(0, { id: "disk2", label: "Disk 2" });
    const s = controller.getState(0);
    expect(s.media?.id).toBe("disk2");
    expect(s.cylinder).toBe(0); // Recalibrated to 0
    expect(events).toContain("eject");
    expect(events).toContain("insert");
    expect(events).toContain("track0");
    expect(events).toContain("activity");
  });

  it("ZipParser detects ZIP buffer and extracts stored media entries", async () => {
    // Build a minimal valid stored ZIP with one ADF file inside
    const filename = "test.adf";
    const nameBytes = new TextEncoder().encode(filename);
    const fileData = new Uint8Array(1024).fill(0x42);

    const header = new Uint8Array(30 + nameBytes.length + fileData.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // Local header signature
    view.setUint16(4, 20, true); // Version
    view.setUint16(6, 0, true); // Flags
    view.setUint16(8, 0, true); // Method: Store (0)
    view.setUint32(18, fileData.length, true); // Compressed size
    view.setUint32(22, fileData.length, true); // Uncompressed size
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true); // Extra length
    header.set(nameBytes, 30);
    header.set(fileData, 30 + nameBytes.length);

    expect(ZipParser.isZip(header)).toBe(true);
    const zip = new ZipParser(header);
    expect(zip.entries.length).toBe(1);
    expect(zip.entries[0]!.filename).toBe("test.adf");
    expect(zip.getMediaEntries().length).toBe(1);

    const extracted = await zip.extract("test.adf");
    expect(extracted).toBeDefined();
    expect(extracted?.length).toBe(1024);
    expect(extracted?.[0]).toBe(0x42);
  });

  it("Freeware classics have accurate disk manifests and profiles", () => {
    expect(FREEWARE_CLASSICS.length).toBe(3);
    const fotaq = FREEWARE_CLASSICS.find((c) => c.id === "flight-of-the-amazon-queen")!;
    expect(fotaq.totalDisks).toBe(11);
    expect(fotaq.disks.length).toBe(11);
    expect(fotaq.rightsClass).toBe("C");

    const profile = createClassicMultiDiskProfile(fotaq);
    expect(profile.media.length).toBe(11);
    expect(profile.launch.bootMediaId).toBe("disk-1");
  });
});
