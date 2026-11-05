import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CHAIN_DATA, actionStatus, classInfo, evidenceFor, findChain, parseChain, searchTitles, type ChainRecord } from "../lib/chain/chain";
import { ChainOfTitle } from "../components/ChainOfTitle";

const names = (r: ChainRecord) => parseChain(r).map((n) => n.name);

describe("chain logic", () => {
  it("bundles ~40+ records incl. fixtures", () => {
    expect(CHAIN_DATA.length).toBeGreaterThanOrEqual(40);
    expect(findChain("RGME Scene Intro: Turrican Tribute")?.rights_class).toBe("A");
    expect(findChain("Beneath a Steel Sky")?.rights_class).toBe("C");
  });
  it("Cinemaware → Starbreeze → Nordcurrent, oldest first, documented links", () => {
    const r = findChain("Defender of the Crown")!;
    const nodes = parseChain(r);
    expect(nodes.map((n) => n.name)).toEqual(["Cinemaware", "Starbreeze", "Nordcurrent / Nordcurrent Labs"]);
    expect(nodes.map((n) => n.role)).toEqual(["original", "intermediate", "current"]);
    expect(nodes[1]!.link).toBe("documented");
    expect(nodes[2]!.evidence.join(" ")).toMatch(/Nordcurrent acquired/);
  });
  it("Psygnosis → Sony via audit family label is flagged as unverified link", () => {
    const nodes = parseChain(findChain("Lemmings")!);
    expect(nodes.map((n) => n.name)).toEqual(["Psygnosis", "Sony Interactive Entertainment"]);
    expect(nodes[1]!.link).toBe("family-label");
  });
  it("never invents links: unrelated slash families and missing routes give a single unverified node", () => {
    const base = findChain("Lemmings")!;
    const r: ChainRecord = { ...base, source_families: ["Electronic Arts / Bullfrog / Origin Systems / Maxis"], licensing_route: "", current_rights_assessment: "Historical EA publishing relationship" };
    const nodes = parseChain(r);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.role).toBe("unverified");
    expect(names({ ...r, source_families: [], licensing_route: "" })).toEqual(["Unknown rightsholder"]);
  });
  it("class explanations are honest; unknown never grants permission", () => {
    expect(classInfo("A").tone).toBe("cleared");
    expect(classInfo("C").text).toMatch(/explicitly authorized/);
    expect(classInfo("D").tone).toBe("restricted");
    expect(classInfo("E/D").uncertain).toBe(true);
    expect(classInfo("E").text).toMatch(/unclear|contested/);
    const u = classInfo(undefined);
    expect(u.letter).toBe("?");
    expect(u.text).toMatch(/never become permission/);
  });
  it("evidence, action status and search", () => {
    const ev = evidenceFor(findChain("Defender of the Crown")!);
    expect(ev.entries.length).toBeGreaterThan(0);
    expect(ev.confidence).toBeGreaterThan(0);
    expect(actionStatus("deny_without_license").tone).toBe("restricted");
    expect(actionStatus("allow_local_byog").tone).toBe("local-only");
    expect(actionStatus("allow").tone).toBe("cleared");
    expect(searchTitles("lemmings").length).toBeGreaterThan(1);
    expect(searchTitles("zzzz")).toHaveLength(0);
  });
});

describe("ChainOfTitle component", () => {
  it("renders timeline, evidence, class badge and action matrix for a known title", () => {
    render(<ChainOfTitle title="It Came from the Desert" />);
    const tl = screen.getByTestId("chain-timeline");
    expect(within(tl).getAllByTestId("chain-node")).toHaveLength(3);
    expect(screen.getByTestId("chain-class")).toHaveTextContent("Class");
    expect(screen.getByLabelText("Evidence", { selector: "section" })).toBeInTheDocument();
    expect(screen.getByTestId("chain-confidence")).toBeInTheDocument();
    expect(screen.getByTestId("chain-action-binary_redistribution")).toHaveAttribute("data-tone", "restricted");
    expect(screen.getByTestId("chain-action-private_execution")).toHaveAttribute("data-tone", "local-only");
  });
  it("fixture titles show cleared actions", () => {
    render(<ChainOfTitle title="RGME Scene Intro: Turrican Tribute" />);
    expect(screen.getByTestId("chain-class")).toHaveTextContent("Class A");
    expect(screen.getByTestId("chain-action-binary_redistribution")).toHaveAttribute("data-tone", "cleared");
  });
  it("shows the unknown state with no inventing", () => {
    render(<ChainOfTitle title="Totally Unknown Game" />);
    expect(screen.getByTestId("chain-unknown")).toHaveTextContent("No chain of title on record: local play only");
    expect(screen.queryByTestId("chain-timeline")).toBeNull();
  });
  it("picker filters by search and shows the chosen chain", () => {
    render(<ChainOfTitle />);
    expect(screen.getByText(/Pick a title/)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("chain-search"), { target: { value: "defender" } });
    const picker = screen.getByTestId("chain-picker");
    expect(within(picker).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(within(picker).getByRole("button", { name: "Defender of the Crown" }));
    expect(screen.getByTestId("chain-detail")).toHaveTextContent("Starbreeze");
    fireEvent.change(screen.getByTestId("chain-search"), { target: { value: "qqq" } });
    expect(screen.getByText("No titles match.")).toBeInTheDocument();
  });
});
