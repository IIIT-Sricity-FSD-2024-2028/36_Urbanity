const ICON_PATHS = {
  communities: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h2m2 0h2m-6 4h2m2 0h2m-6 7v-3h6v3" /></>,
  towers: <><path d="M4 21V5l8-3 8 3v16M8 8h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2M2 21h20" /></>,
  apartments: <><path d="M4 21V4h10v17M14 9h6v12M8 8h2m-2 4h2m-2 4h2m8-3h1m-1 4h1M2 21h20" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  complaints: <><path d="M6 3h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 3V5a2 2 0 0 1 2-2Z" /><path d="M12 7v5m0 3h.01" /></>,
  workers: <><path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 3.6 12 2 17l5-1.6L15.4 7l2.3 2.3a4 4 0 0 0-3-5Z" /><path d="m14 14 6 6" /></>,
  submitted: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
  review: <><path d="M9 5h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1" /><path d="M9 3h6v4H9zM8 12h8M8 16h5" /></>,
  progress: <><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v6h-6" /></>,
  verification: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  resolved: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  tasks: <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M9 4V2h6v2M8 10h8M8 14h8M8 18h5" /></>,
};

export function MetricIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name] || ICON_PATHS.tasks}
    </svg>
  );
}
