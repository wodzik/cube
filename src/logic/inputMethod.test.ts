import { describe, it, expect } from "bun:test";
import { sessionMethodsForInput } from "./inputMethod";

describe("sessionMethodsForInput", () => {
  it("cube pairs cube-move start with cube-solved stop (no discrete stop signal from a physical cube)", () => {
    expect(sessionMethodsForInput("cube")).toEqual({ startMethod: ["cube-move"], stopMethod: ["cube-solved"] });
  });

  it("spacebar starts AND stops with spacebar — symmetric", () => {
    expect(sessionMethodsForInput("spacebar")).toEqual({ startMethod: ["spacebar"], stopMethod: ["spacebar"] });
  });

  it("timer starts AND stops with timer-device — symmetric", () => {
    expect(sessionMethodsForInput("timer")).toEqual({ startMethod: ["timer-device"], stopMethod: ["timer-device"] });
  });
});
