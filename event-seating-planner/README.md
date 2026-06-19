# Event Seating Planner

A drag-and-drop seating planner for weddings, seminars, and classrooms — built with React, Vite, and real [@dnd-kit/core](https://dndkit.com/) for the drag-and-drop engine.

## Features

- Round tables or rows, with adjustable capacity
- Drag a guest onto any seat (powered by DnD Kit) — drop on an occupied seat to swap, drop on a full table to get a capacity warning
- Tap-to-place fallback: tap a guest, then tap a seat — works without dragging, and is keyboard-accessible (Tab + Enter/Space)
- Search filters the unseated list and highlights matching seated guests on the floor plan
- Color-coded seats: each table has its own color, empty seats are outlined, VIP guests get a gold star
- Switch between Wedding / Seminar / Classroom terminology
- Export the seating plan as a readable `.txt` file
- Responsive layout (sidebar collapses above the floor plan on narrow screens)

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview   # serves the production build locally
```

The production build is already verified working — `npm run build` outputs to `dist/`.

## Project structure

```
src/
  App.jsx       — all app logic + components (drag-and-drop, tables, seats, sidebar)
  main.jsx      — React entry point
  index.css     — all styling
index.html
vite.config.js
```

## Notes

- Drag-and-drop uses `@dnd-kit/core`'s `DndContext`, `useDraggable`, `useDroppable`, and `DragOverlay`.
- All data is in-memory (no backend) — refreshing the page resets to the seed data.
