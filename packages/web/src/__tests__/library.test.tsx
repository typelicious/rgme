import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GameLibraryStore, IndexedDbBackend, MemoryBackend, filterLibrary, resolveDroppedAdf, type LibraryRecord } from "../lib/library";
import { LibraryShelf } from "../components/LibraryShelf";

const adf = () => readFileSync(resolve(process.cwd(), "../../concept/fixtures/rgme-scene-intro.adf"));
const bytes = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function addScene(store: GameLibraryStore) {
  const data = bytes(adf());
  const r = await resolveDroppedAdf(data, "rgme-scene-intro.adf");
  return store.add(data, "rgme-scene-intro.adf", r.sha256, r.resolved);
}
async function addUnknown(store: GameLibraryStore, text = "mystery") {
  const data = new TextEncoder().encode(text).buffer as ArrayBuffer;
  const r = await resolveDroppedAdf(data, "Mystery.adf");
  return store.add(data, "Mystery.adf", r.sha256, r.resolved);
}

describe("resolveDroppedAdf", () => {
  it("identifies the real fixture as Class A public domain", async () => {
    const r = await resolveDroppedAdf(bytes(adf()), "renamed.adf");
    expect(r.identified).toBe(true);
    expect(r.resolved.rights.classification).toBe("A");
    expect(r.resolved.rights.status).toBe("public_domain");
  });
  it("unknown file is local-only (class D, unknown)", async () => {
    const r = await resolveDroppedAdf(new TextEncoder().encode("x"), "x.adf");
    expect(r.identified).toBe(false);
    expect(r.resolved.rights.status).toBe("unknown");
  });
});

describe("GameLibraryStore (IndexedDB)", () => {
  it("persists across store instances (simulated reload) and keeps ADF bytes intact", async () => {
    const factory = new IDBFactory();
    const a = new GameLibraryStore(new IndexedDbBackend(factory));
    const rec = await addScene(a);
    const b = new GameLibraryStore(new IndexedDbBackend(factory));
    const list = await b.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(rec.sha256);
    expect(Buffer.from(list[0]!.data).equals(adf())).toBe(true);
    expect(list[0]!.rightsClass).toBe("A");
    await b.remove(rec.id);
    expect(await b.count()).toBe(0);
  });
  it("stores the same disk once", async () => {
    const s = new GameLibraryStore(new MemoryBackend());
    await addScene(s); await addScene(s);
    expect(await s.count()).toBe(1);
  });
  it("drops corrupt records on read", async () => {
    const backend = new MemoryBackend();
    const s = new GameLibraryStore(backend);
    const good = await addUnknown(s, "ok");
    await backend.put({ ...good, id: "bad1", profile: { nope: true } } as unknown as LibraryRecord);
    await backend.put({ ...good, id: "bad2", rights: null } as unknown as LibraryRecord);
    await backend.put({ id: "bad3" } as unknown as LibraryRecord);
    expect((await s.list()).map((r) => r.id)).toEqual([good.id]);
  });
});

describe("filterLibrary", () => {
  it("cleared vs local-only; unknown never cleared", async () => {
    const s = new GameLibraryStore(new MemoryBackend());
    await addScene(s); await addUnknown(s);
    const all = await s.list();
    expect(filterLibrary(all, { rightsGroup: "cleared" }).map((r) => r.rightsClass)).toEqual(["A"]);
    expect(filterLibrary(all, { rightsGroup: "local-only" }).every((r) => r.rightsStatus === "unknown")).toBe(true);
    expect(filterLibrary(all, { query: "turrican" })).toHaveLength(1);
    expect(filterLibrary(all, { query: "zzz" })).toHaveLength(0);
    expect(filterLibrary(all, { platform: "amiga" })).toHaveLength(2);
    expect(filterLibrary(all, { rightsGroup: "all" })).toHaveLength(2);
  });
});

describe("LibraryShelf", () => {
  it("renders cards, searches, filters, mounts and removes", async () => {
    const s = new GameLibraryStore(new MemoryBackend());
    await addScene(s); await addUnknown(s);
    const mounted: string[] = [];
    render(<LibraryShelf store={s} onMount={(r) => mounted.push(r.title)} />);
    await waitFor(() => expect(screen.getAllByTestId("class-badge")).toHaveLength(2));
    fireEvent.click(screen.getByTestId("filter-cleared"));
    expect(screen.getAllByTestId("class-badge")).toHaveLength(1);
    expect(screen.getByTestId("class-badge")).toHaveTextContent("Class A");
    fireEvent.click(screen.getByTestId("filter-local-only"));
    expect(screen.getByTestId("class-badge")).toHaveTextContent("local only");
    fireEvent.click(screen.getByTestId("filter-all"));
    fireEvent.change(screen.getByLabelText("Search library"), { target: { value: "scene" } });
    expect(screen.getAllByTestId("class-badge")).toHaveLength(1);
    fireEvent.click(screen.getByTitle("Mount in DF0: & Play"));
    expect(mounted).toEqual(["RGME Scene Intro: Turrican Tribute"]);
    fireEvent.click(screen.getByLabelText(/^Remove RGME Scene/));
    await waitFor(() => expect(screen.getByTestId("library-empty")).toBeInTheDocument());
  });
  it("shows an empty state", async () => {
    render(<LibraryShelf store={new GameLibraryStore(new MemoryBackend())} onMount={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("library-empty")).toHaveTextContent(/empty/i));
  });
});
