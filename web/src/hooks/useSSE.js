import { useEffect, useRef, useState, useCallback } from "react";

/**
 * B4: Subscribe to a run's SSE stream with full exponential-backoff reconnect.
 * Supports ?since=<seq> for missed-event replay on reconnect.
 * Returns { events, status, error, cancel }.
 *
 * Status: idle | connecting | streaming | reconnecting | done | error
 * Backoff: 1s → 2s → 4s → 8s → 16s → 30s cap, max 10 attempts.
 */
export function useSSE(runId) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const esRef = useRef(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef(null);
  const terminalRef = useRef(false);
  // B4: track sequence number for ?since= replay
  const seqRef = useRef(0);

  const connect = useCallback(() => {
    if (!runId || terminalRef.current) return;

    const since = seqRef.current;
    const url = since > 0
      ? `/api/run/${runId}/stream?since=${since}`
      : `/api/run/${runId}/stream`;

    const es = new EventSource(url);
    esRef.current = es;
    setStatus(attemptsRef.current === 0 ? "connecting" : "reconnecting");
    setReconnectAttempt(attemptsRef.current);

    es.onopen = () => {
      setStatus("streaming");
      attemptsRef.current = 0;
      setReconnectAttempt(0);
    };

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        seqRef.current += 1;
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
        } else if (event.type === "timeout") {
          terminalRef.current = true;
          setError(event.message ?? "Run timed out");
          setStatus("timeout");
          es.close();
        } else if (event.type === "cancelled") {
          terminalRef.current = true;
          setStatus("cancelled");
          es.close();
        }
      } catch (parseErr) {
        console.warn("[useSSE] malformed event data:", e.data, parseErr);
      }
    };

    es.onerror = () => {
      es.close();
      if (terminalRef.current) return;

      attemptsRef.current += 1;
      if (attemptsRef.current > 10) {
        setStatus("error");
        setError("Lost connection to run stream after 10 retries. Check your network and refresh.");
        return;
      }

      // B4: exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s cap
      const delay = Math.min(Math.pow(2, attemptsRef.current - 1) * 1000, 30000);
      setStatus("reconnecting");
      setReconnectAttempt(attemptsRef.current);
      timerRef.current = setTimeout(connect, delay);
    };
  }, [runId]);

  useEffect(() => {
    if (!runId) return;

    setEvents([]);
    setStatus("idle");
    setError(null);
    setReconnectAttempt(0);
    attemptsRef.current = 0;
    terminalRef.current = false;
    seqRef.current = 0;

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

  return { events, status, error, cancel, reconnectAttempt };
}
