import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { feltTrae, fordeling } from "./felttrae.ts";

Deno.test("feltTrae giver kun navne og typer, aldrig værdier", () => {
  const ud = feltTrae({ cdr: { id: 42, timestamp: "2026-10-30T10:00:00Z" }, recording: { name: "x.mp3", download: null }, clips: [{ id: 1, tagId: 7, download: "https://h/x" }], timestamp: "t" });
  assertEquals(ud, [
    "cdr: object", "cdr.id: number", "cdr.timestamp: string",
    "clips: array", "clips[]: object", "clips[].download: string", "clips[].id: number", "clips[].tagId: number",
    "recording: object", "recording.download: null", "recording.name: string",
    "timestamp: string",
  ]);
  assertEquals(ud.join(" ").includes("x.mp3"), false);
  assertEquals(ud.join(" ").includes("42"), false);
});

Deno.test("feltTrae håndterer tomme arrays og dybde", () => {
  assertEquals(feltTrae({ a: [] }), ["a: array", "a[]: tom"]);
  assertEquals(feltTrae({ a: { b: { c: { d: 1 } } } }, 1), ["a: object", "a.b: object"]);
});

Deno.test("fordeling tæller lukkede værdisæt", () => {
  assertEquals(fordeling([{ d: "answered" }, { d: "answered" }, { d: "no-answer" }, {}, { d: null }], "d"), { answered: 2, "no-answer": 1, "(mangler)": 1, "(null)": 1 });
});
