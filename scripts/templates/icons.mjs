/** Inline SVG icons (stroke = currentColor) so pages need no icon font. */

const svg = (body, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  bed: svg('<path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5"/><path d="M3 18h18"/><path d="M5 11V7a1 1 0 0 1 1-1h5v5"/>'),
  bath: svg('<path d="M4 13h16v1a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-1z"/><path d="M6 13V6a2 2 0 0 1 4 0"/><path d="M7 18l-1 2M17 18l1 2"/>'),
  area: svg('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h5V4"/>'),
  pin: svg('<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  car: svg('<path d="M5 16l1.5-5A2 2 0 0 1 8.4 9.5h7.2a2 2 0 0 1 1.9 1.5L19 16"/><rect x="4" y="16" width="16" height="4" rx="1"/><path d="M6.5 18h.01M17.5 18h.01"/>'),
  building: svg('<rect x="6" y="3" width="12" height="18"/><path d="M10 7h1M13 7h1M10 11h1M13 11h1M10 15h1M13 15h1"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="14" r="3.5"/>'),
  arrowDown: svg('<path d="M12 4v16M5 13l7 7 7-7"/>'),
  arrowRight: svg('<path d="M4 12h16M13 5l7 7-7 7"/>'),
  close: svg('<path d="M5 5l14 14M19 5L5 19"/>'),
  facebook: svg('<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5A.5.5 0 0 1 14.5 8z"/>'),
  instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.2 6.8h.01"/>'),
  linkedin: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 11v6M8 7.5h.01M12 17v-4a2.5 2.5 0 0 1 5 0v4"/>'),
};
