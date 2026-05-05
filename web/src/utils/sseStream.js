// Parse a fetch() ReadableStream as a sequence of SSE `data:` events.
//
// sse-starlette emits `: ping - N` keepalive comments every ~15s. Long-running
// streams (model pulls, Ollama install) WILL hit them. We drop SSE comments
// (`:` prefix) and any non-`data:` control frames, and silently skip any
// `data:` payload that fails to JSON.parse.
export async function* parseSseStream(reader) {
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6);
      let evt;
      try {
        evt = JSON.parse(raw);
      } catch {
        continue;
      }
      yield evt;
    }
  }
}
