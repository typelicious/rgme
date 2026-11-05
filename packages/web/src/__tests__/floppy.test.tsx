import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FloppyController } from "@rgme/core";
import { FloppyDrives } from "../components/FloppyDrives";

const discs = [
  { id: "d1", label: "Flight of the Amazon Queen (Disk 1 of 11)" },
  { id: "d2", label: "Flight of the Amazon Queen (Disk 2 of 11)" }
];

describe("FloppyDrives", () => {
  it("renders DF0:-DF3: with LED, cylinder and motor state following controller events", () => {
    const c = new FloppyController();
    render(<FloppyDrives controller={c} />);
    expect(screen.getAllByText(/^DF\d:$/)).toHaveLength(4);
    expect(screen.getByTestId("led-0")).toHaveAttribute("data-led", "off");
    act(() => { c.insertDisk(0, { id: "x", label: "My Disk" }); c.setMotor(0, true); c.seek(0, 12); });
    expect(screen.getByTestId("disk-0")).toHaveTextContent("My Disk");
    expect(screen.getByTestId("led-0")).toHaveAttribute("data-led", "green");
    expect(screen.getByTestId("cyl-0")).toHaveTextContent("12");
    expect(screen.getByTestId("motor-0")).toHaveAttribute("aria-label", "Motor on");
    act(() => c.pulseActivity(0, "read", 1000));
    expect(screen.getByTestId("led-0")).toHaveAttribute("data-led", "amber");
    fireEvent.click(screen.getByTestId("eject-0"));
    expect(screen.getByTestId("disk-0")).toHaveTextContent("empty");
  });

  it("disk swap drawer inserts a chosen disc into a chosen drive and reports it", () => {
    const c = new FloppyController();
    const onSwap = vi.fn();
    render(<FloppyDrives controller={c} discs={discs} onSwap={onSwap} />);
    expect(screen.queryByTestId("swap-drawer")).toBeNull();
    fireEvent.click(screen.getByTestId("swap-toggle"));
    fireEvent.click(screen.getByTestId("insert-d1"));
    expect(c.getState(0).media?.id).toBe("d1");
    fireEvent.change(screen.getByTestId("target-d2"), { target: { value: "1" } });
    fireEvent.click(screen.getByTestId("insert-d2"));
    expect(c.getState(1).media?.id).toBe("d2");
    expect(onSwap).toHaveBeenLastCalledWith(1, "d2");
    // swapping into an occupied drive replaces the disc
    fireEvent.change(screen.getByTestId("target-d2"), { target: { value: "0" } });
    fireEvent.click(screen.getByTestId("insert-d2"));
    expect(c.getState(0).media?.id).toBe("d2");
    expect(screen.getByTestId("disk-0")).toHaveTextContent("Disk 2 of 11");
  });

  it("shows a hint when no multi-disk title is loaded", () => {
    render(<FloppyDrives controller={new FloppyController()} />);
    fireEvent.click(screen.getByTestId("swap-toggle"));
    expect(screen.getByTestId("swap-drawer")).toHaveTextContent(/No multi-disk/);
  });
});
