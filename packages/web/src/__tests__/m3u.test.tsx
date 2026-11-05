import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { FloppyController, type FloppyEvent } from "@rgme/core";
import { parseM3u, groupDiskSets, serializeM3u, loadM3uText, detectDisc, createDiskSwapper } from "../lib/m3u";
import { useDiskHotkeys } from "../hooks/useDiskHotkeys";
import { DiskSwapper } from "../components/DiskSwapper";

const aq = Array.from({ length: 11 }, (_, i) => `Flight of the Amazon Queen (Disk ${i + 1} of 11).adf`);

describe("m3u parser", () => {
  it("parses the 11-disk Amazon Queen list in order", () => {
    const e = parseM3u(aq.join("\n"));
    expect(e).toHaveLength(11);
    expect(e[0]).toMatchObject({ discNumber: 1, discTotal: 11, filename: aq[0] });
    expect(e[10]!.discNumber).toBe(11);
  });
  it("handles BOM, CRLF, comments, blank lines, EXTINF and relative URLs", () => {
    const text = "﻿#EXTM3U\r\n# a comment\r\n\r\n#EXTINF:-1,Steel Sky Disk 2\r\nsub/Beneath%20a%20Steel%20Sky%20Disk2.adf\r\nhttp://x.test/a/Disc%203.adf?token=1\r\n";
    const e = parseM3u(text);
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ title: "Steel Sky Disk 2", filename: "Beneath a Steel Sky Disk2.adf", discNumber: 2 });
    expect(e[1]).toMatchObject({ filename: "Disc 3.adf", discNumber: 3 });
  });
  it("detects disk numbers and letters", () => {
    expect(detectDisc("Game (Disk A).adf")).toEqual({ number: 1, total: undefined });
    expect(detectDisc("Game (Disk B).adf").number).toBe(2);
    expect(detectDisc("Game Disc 7.adf").number).toBe(7);
    expect(detectDisc("Game.adf")).toEqual({});
  });
  it("round-trips through serializeM3u", () => {
    const e = parseM3u(aq.slice(0, 3).join("\n"));
    expect(parseM3u(serializeM3u(e)).map((x) => x.discNumber)).toEqual([1, 2, 3]);
  });
});

describe("disk sets", () => {
  it("groups by title, sorts by disk number and flags gaps/duplicates", () => {
    const text = [aq[2], aq[0], "Other Game (Disk 1 of 2).adf", aq[0], "Other Game (Disk 2 of 2).adf"].join("\n");
    const sets = groupDiskSets(parseM3u(text));
    expect(sets).toHaveLength(2);
    const amazon = sets.find((s) => /amazon queen/i.test(s.title))!;
    expect(amazon.entries.map((e) => e.discNumber)).toEqual([1, 1, 3]);
    expect(amazon.duplicates).toEqual([1]);
    expect(amazon.missing).toEqual([2, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(amazon.title).toBe("Flight of the Amazon Queen");
    const other = sets.find((s) => /other game/i.test(s.title))!;
    expect(other.missing).toEqual([]);
  });
  it("loadM3uText keeps playlist order for un-numbered lists", () => {
    const sets = loadM3uText("a.adf\nb.adf", "Mixed");
    expect(sets.flatMap((s) => s.entries.map((e) => e.discNumber))).toEqual(expect.arrayContaining([1, 2]));
  });
});

describe("disk swapper", () => {
  const discs = aq.slice(0, 4).map((l, i) => ({ id: `d${i + 1}`, label: `Disk ${i + 1} of 11`, sha256: String(i).repeat(64).slice(0, 64) }));
  it("ejects then inserts with motor and head activity, wraps next/prev", () => {
    const c = new FloppyController();
    const events: FloppyEvent[] = [];
    c.onEvent((e) => events.push(e));
    const onSwap = vi.fn();
    const s = createDiskSwapper({ controller: c, discs, onSwap });
    expect(s.insertNth(1)).toBe(true);
    expect(events.map((e) => e.type)).toContain("motor");
    c.insertDisk(0, { id: "x" });
    events.length = 0;
    expect(s.insertNth(3)).toBe(true);
    const types = events.map((e) => e.type);
    expect(types.indexOf("eject")).toBeLessThan(types.indexOf("insert"));
    expect(c.getState(0).motor).toBe(true);
    expect(types).toContain("activity");
    expect(types).toContain("track0");
    expect(c.getState(0).media?.id).toBe("d3");
    expect(s.currentIndex).toBe(2);
    expect(onSwap).toHaveBeenLastCalledWith(2, discs[2]);
    s.next(); expect(s.currentIndex).toBe(3);
    s.next(); expect(s.currentIndex).toBe(0);
    s.prev(); expect(s.currentIndex).toBe(3);
    expect(s.insertNth(9)).toBe(false);
    expect(s.insertNth(0)).toBe(false);
  });
});

describe("disk hotkeys", () => {
  const setup = () => {
    const c = new FloppyController();
    const discs = [1, 2, 3].map((n) => ({ id: `d${n}`, label: `Disk ${n}` }));
    const s = createDiskSwapper({ controller: c, discs });
    renderHook(() => useDiskHotkeys(s, true));
    return { c, s };
  };
  it("key 3 inserts disk 3; ] and [ cycle", () => {
    const { c, s } = setup();
    fireEvent.keyDown(window, { key: "3" });
    expect(c.getState(0).media?.id).toBe("d3");
    fireEvent.keyDown(window, { key: "]" });
    expect(s.currentIndex).toBe(0);
    fireEvent.keyDown(window, { key: "[" });
    expect(s.currentIndex).toBe(2);
  });
  it("ignores out-of-range keys, modifiers and editable targets", () => {
    const { c } = setup();
    fireEvent.keyDown(window, { key: "9" });
    expect(c.getState(0).diskInserted).toBe(false);
    fireEvent.keyDown(window, { key: "2", ctrlKey: true });
    expect(c.getState(0).diskInserted).toBe(false);
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "2" });
    expect(c.getState(0).diskInserted).toBe(false);
    input.remove();
  });
});

describe("DiskSwapper component", () => {
  it("renders position, quick buttons, warnings, and swaps on click", () => {
    const c = new FloppyController();
    const discs = Array.from({ length: 11 }, (_, i) => ({ id: `d${i + 1}`, label: `Disk ${i + 1} of 11` }));
    const s = createDiskSwapper({ controller: c, discs });
    const onChange = vi.fn();
    const { rerender } = render(<DiskSwapper swapper={s} discs={discs} currentIndex={0} set={{ missing: [4], duplicates: [] }} onChange={onChange} />);
    expect(screen.getByTestId("disk-position")).toHaveTextContent("Disk 1 of 11");
    expect(screen.getAllByRole("button", { name: /^\d$/ })).toHaveLength(9);
    expect(screen.getByTestId("disk-gaps")).toHaveTextContent("4");
    fireEvent.click(screen.getByTestId("disk-btn-5"));
    expect(c.getState(0).media?.id).toBe("d5");
    expect(onChange).toHaveBeenCalledWith(4);
    rerender(<DiskSwapper swapper={s} discs={discs} currentIndex={4} />);
    expect(screen.getByTestId("disk-btn-5")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("disk-next"));
    expect(s.currentIndex).toBe(5);
  });
});
