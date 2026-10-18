export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'ai-req' | 'ai-res';

export interface LogEntry {
  id: number;
  time: number;
  level: LogLevel;
  tag?: string;
  message: string;
  details?: string;
}

type Listener = (entries: LogEntry[]) => void;

let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const MAX_ENTRIES = 500;

export function log(level: LogLevel, message: string, tag?: string, details?: string) {
  const entry: LogEntry = {
    id: nextId++,
    time: Date.now(),
    level,
    tag,
    message,
    details,
  };
  entries = [...entries, entry];
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(-MAX_ENTRIES);
  }
  listeners.forEach((l) => l(entries));
}

export function clearLogs() {
  entries = [];
  listeners.forEach((l) => l(entries));
}

export function getLogs() {
  return entries;
}

export function subscribeLogs(fn: Listener): () => void {
  listeners.add(fn);
  fn(entries);
  return () => { listeners.delete(fn); };
}