import { describe, it, expect } from "vitest";
import { parseSseStream } from "./sseStream";

// Build a mock ReadableStream reader that yields the given chunks (strings).
function readerOf(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    async read() {
      if (i >= chunks.length) return { done: true, value: undefined };
      return { done: false, value: encoder.encode(chunks[i++]) };
    },
  };
}

async function collect(reader) {
  const out = [];
  for await (const evt of parseSseStream(reader)) out.push(evt);
  return out;
}

describe("parseSseStream", () => {
  it("yields parsed JSON for each data: line", async () => {
    const reader = readerOf([
      'data: {"status":"pulling manifest"}\n',
      'data: {"status":"pulling 4c27e0","total":100,"completed":50}\n',
      'data: {"status":"success"}\n',
    ]);
    const events = await collect(reader);
    expect(events).toEqual([
      { status: "pulling manifest" },
      { status: "pulling 4c27e0", total: 100, completed: 50 },
      { status: "success" },
    ]);
  });

  it("regression: skips sse-starlette ': ping - N' keepalive comments mid-stream", async () => {
    // Reproduces the v0.8.7 model-pull crash: ': ping - 2' was JSON.parsed
    // and threw 'Unexpected token :', killing pulls >15s long.
    const reader = readerOf([
      'data: {"status":"pulling manifest"}\n',
      ": ping - 1\n\n",
      'data: {"status":"pulling 4c27e0","total":100,"completed":33}\n',
      ": ping - 2\n\n",
      'data: {"status":"pulling 4c27e0","total":100,"completed":100}\n',
      'data: {"status":"success"}\n',
    ]);
    const events = await collect(reader);
    expect(events.map((e) => e.status)).toEqual([
      "pulling manifest",
      "pulling 4c27e0",
      "pulling 4c27e0",
      "success",
    ]);
  });

  it("handles chunks split mid-line", async () => {
    const reader = readerOf([
      'data: {"sta',
      'tus":"pull',
      'ing manifest"}\ndata: {"status":"success"}\n',
    ]);
    const events = await collect(reader);
    expect(events).toEqual([
      { status: "pulling manifest" },
      { status: "success" },
    ]);
  });

  it("ignores unknown SSE control frames (event:, id:, retry:)", async () => {
    const reader = readerOf([
      "event: progress\n",
      "id: 1\n",
      "retry: 1000\n",
      'data: {"status":"ok"}\n',
    ]);
    const events = await collect(reader);
    expect(events).toEqual([{ status: "ok" }]);
  });

  it("silently skips data: payloads that aren't valid JSON", async () => {
    const reader = readerOf([
      "data: not-json\n",
      'data: {"status":"ok"}\n',
    ]);
    const events = await collect(reader);
    expect(events).toEqual([{ status: "ok" }]);
  });
});
