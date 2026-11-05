import type { DriveId, FloppyController } from "../drive/floppy-controller.js";
import { ADF_SIZE } from "./mfm.js";
import { IpfParser, identifyImage } from "./ipf-parser.js";

/** Thrown when an IPF cannot be reduced to a plain ADF (copy protection, custom tracks, damage). */
export class IpfProtectedError extends Error {
  constructor(readonly reasons: string[]) {
    super(`IPF cannot be mounted as a plain disk (needs flux-level emulation): ${reasons[0] ?? "unknown reason"}`);
    this.name = "IpfProtectedError";
  }
}

/**
 * Mounts an .adf or .ipf into a virtual drive. IPF images are decoded to a plain ADF when every track is standard
 * AmigaDOS MFM; otherwise `IpfProtectedError` is thrown and nothing is inserted. `sha256` must be the hash of the
 * ORIGINAL file bytes (the file itself is never modified).
 */
export function mountDiskImage(controller: FloppyController, drive: DriveId, bytes: Uint8Array, name: string, sha256: string): { format: "adf" | "ipf"; adf: Uint8Array } {
  const kind = identifyImage(bytes);
  if (kind === "adf") {
    controller.insertDisk(drive, { id: name, label: name, sha256, format: "adf", image: bytes });
    return { format: "adf", adf: bytes };
  }
  if (kind === "ipf") {
    const { adf, reasons } = IpfParser.parse(bytes).toAdfResult();
    if (!adf) throw new IpfProtectedError(reasons);
    controller.insertDisk(drive, { id: name, label: name, sha256, format: "ipf", image: adf });
    return { format: "ipf", adf };
  }
  throw new Error(`Unrecognized disk image '${name}' (${bytes.length} bytes; expected ${ADF_SIZE}-byte ADF or an IPF with CAPS magic)`);
}
