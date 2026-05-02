import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Subscribe to a run's SSE stream with exponential-backoff reconnect (QA-003).
 * Returns { events, status, error }.
 *
 * Status: idle | connecting | streaming | reconnecting | done | error
 */
export function useSSE(runId) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const esRef = useRef(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef(null);
  // Track whether we've reached a terminal event so reconnect doesn't re-fire
  const terminalRef = useRef(false);

  const connect = useCallback(() => {
    if (!runId || terminalRef.current) return;

    const es = new EventSource(`/api/run/${runId}/stream`);
    esRef.current = es;
    setStatus(attemptsRef.current === 0 ? "connecting" : "reconnecting");

    es.onopen = () => {
      setStatus("streaming");
      attemptsRef.current = 0;
    };

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);

        if (event.type === "agent_waiting" || event.type === "agent_done") {
          terminalRef.current = true;
          setStatus("done");
          setError(null);
          es.close();
        } else if (event.type === "error") {
          terminalRef.current = true;
          setError(event.message ?? "Run failed");
          setStatus("error");
          es.close();
        }
      } catch (parseErr) {
        // QA-013: log malformed SSE data rather than silently swallowing
        console.warn("[useSSE] malformed event data:", e.data, parseErr);
      }
    };

    es.onerror = () => {
      es.close();
      if (terminalRef.current) return;

      attemptsRef.current += 1;
      if (attemptsRef.current > 3) {
        setStatus("error");
        setError("Lost connection to run stream after 3 retries. Check your network and refresh.");
        return;
      }

      // Exponential backoff: 1 s, 2 s, 4 s
      const delay = Math.pow(2, attemptsRef.current - 1) * 1000;
      setStatus("reconnecting");
      timerRef.current = setTimeout(connect, delay);
    };
  }, [runId]);

  useEffect(() => {
    if (!runId) return;

    setEvents([]);
    setStatus("idle");
    setError(null);
    attemptsRef.current = 0;
    terminalRef.current = false;

    connect();

    return () => {
      esRef.current?.close();
      clearTimeout(timerRef.current);
    };
  }, [runId, connect]);

  const cancel = () => {
    terminalRef.current = true;
    esRef.current?.close();
    clearTimeout(timerRef.current);
    setStatus("done");
  };

  return { events, status, error, cancel };
}
