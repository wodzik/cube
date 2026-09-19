import { describe, expect, it, beforeEach } from "bun:test";
import "../testSetup";
import { ACADEMY_VIEW_KEY, ATTACK_VIEW_KEY, PRACTICE_VIEW_KEY, loadAcademyView, loadGroupView, saveAcademyView, saveGroupView } from "./lastView";

describe("remembered group view (Drill Algorithms / Time Attack)", () => {
  beforeEach(() => localStorage.clear());

  it("nothing saved → null", () => {
    expect(loadGroupView(PRACTICE_VIEW_KEY)).toBeNull();
  });

  it("round-trips a group, and a folder inside a group that has subgroups", () => {
    saveGroupView(PRACTICE_VIEW_KEY, "eo4a", null);
    expect(loadGroupView(PRACTICE_VIEW_KEY)).toEqual({ group: "eo4a", subgroup: null });
    saveGroupView(PRACTICE_VIEW_KEY, "f2l", "front-left");
    expect(loadGroupView(PRACTICE_VIEW_KEY)).toEqual({ group: "f2l", subgroup: "front-left" });
  });

  it("ignores a group that no longer exists; keeps the group but drops a folder that no longer exists", () => {
    saveGroupView(PRACTICE_VIEW_KEY, "deleted-group", null);
    expect(loadGroupView(PRACTICE_VIEW_KEY)).toBeNull();
    saveGroupView(PRACTICE_VIEW_KEY, "f2l", "no-such-folder");
    expect(loadGroupView(PRACTICE_VIEW_KEY)).toEqual({ group: "f2l", subgroup: null });
    // a folder id on a group without subgroups is meaningless
    saveGroupView(PRACTICE_VIEW_KEY, "eo4a", "front-right");
    expect(loadGroupView(PRACTICE_VIEW_KEY)).toEqual({ group: "eo4a", subgroup: null });
  });

  it("Time Attack only restores what is Attack-enabled today", () => {
    saveGroupView(ATTACK_VIEW_KEY, "eo4a", null); // opted out of Attack
    expect(loadGroupView(ATTACK_VIEW_KEY, { attackOnly: true })).toBeNull();
    saveGroupView(ATTACK_VIEW_KEY, "oll", null);
    expect(loadGroupView(ATTACK_VIEW_KEY, { attackOnly: true })).toEqual({ group: "oll", subgroup: null });
    saveGroupView(ATTACK_VIEW_KEY, "f2l", "front-left"); // group is available (front-right is enabled) but this folder isn't
    expect(loadGroupView(ATTACK_VIEW_KEY, { attackOnly: true })).toEqual({ group: "f2l", subgroup: null });
    saveGroupView(ATTACK_VIEW_KEY, "f2l", "front-right");
    expect(loadGroupView(ATTACK_VIEW_KEY, { attackOnly: true })).toEqual({ group: "f2l", subgroup: "front-right" });
  });

  it("garbage in storage is ignored, never thrown", () => {
    for (const raw of ["", "not json", "null", "42", '{"group":5}', "[]"]) {
      localStorage.setItem(PRACTICE_VIEW_KEY, raw);
      expect(loadGroupView(PRACTICE_VIEW_KEY)).toBeNull();
    }
  });
});

describe("remembered Academy view", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a lesson and one of its steps", () => {
    saveAcademyView("zeta-slotting", "zeta-corners");
    expect(loadAcademyView()).toEqual({ lesson: "zeta-slotting", step: "zeta-corners" });
  });

  it("rejects an unknown lesson, or a step that belongs to another lesson", () => {
    saveAcademyView("nope", "corners");
    expect(loadAcademyView()).toBeNull();
    saveAcademyView("zeta-slotting", "corners"); // "corners" is a step of two-first-layers
    expect(loadAcademyView()).toBeNull();
  });

  it("garbage in storage is ignored", () => {
    localStorage.setItem(ACADEMY_VIEW_KEY, "{oops");
    expect(loadAcademyView()).toBeNull();
  });
});
