import assert from "node:assert/strict";
import { test } from "node:test";
import { readBoundedJson } from "../src/read-bounded-json.js";

test("bounded JSON rejects declared oversized and failed responses without reading them", async () => {
  let cancelled = 0;
  const oversizedBody = () => new ReadableStream({
    pull(controller) { controller.enqueue(new TextEncoder().encode("too large")); },
    cancel() { cancelled += 1; },
  });
  await assert.rejects(readBoundedJson(new Response(oversizedBody(), { headers: { "content-length": "20" } }), 10), /upstream_size/);
  await assert.rejects(readBoundedJson(new Response(oversizedBody(), { status: 503 }), 10), /upstream_status/);
  assert.equal(cancelled, 2);
});

test("bounded JSON cancels streams that exceed the cap without Content-Length", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(8)); },
    cancel() { cancelled = true; },
  }));
  await assert.rejects(readBoundedJson(response, 10), /upstream_size/);
  assert.equal(cancelled, true);
});

test("bounded JSON parses a response whose streamed body stays within the cap", async () => {
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"ok":'));
      controller.enqueue(new TextEncoder().encode("true}"));
      controller.close();
    },
  }));
  assert.deepEqual(await readBoundedJson(response, 20), { ok: true });
});
