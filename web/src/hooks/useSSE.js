import { useEffect, useRef, useState } from "react";

/**
 * Subscribe to a run's SSE stream.
 * Returns { events, status, error }.
 *
 * Events: agent_start | stage_update | agent_done | agent_waiting | error
 */
export function useSSE(runId) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | connecting | streaming | done | error
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    if (!runId) return;

    setEvents([]);
    setStatus("connecting");
    setError(null);

    const es = new EventSource(`/api/run/${runId}/stream`);
    esRef.current = es;

    es.onopen = () => setStatus("streaming");

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);

        if (event.type === "agent_waiting" || event.type === "agent_done") {
          setStatus("done");
          es.close();
        }
        if (event.type === "error") {
          setError(event.message);
          setStatus("error");
          es.close();
        }
      } catch {
        // malformed event — ignore
      }
    };

    es.onerror = () => {
      setStatus("error");
      setError("Lost connection to run stream");
      es.close();
    };

    return () => {
      es.close();
    };
  }, [runId]);

  const cancel = () => {
    esRef.current?.close();
    setStatus("done");
  };

  return { events, status, error, cancel };
}
