import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  pointerWithin,
} from "@dnd-kit/core";
import {
  Search,
  Plus,
  X,
  Trash2,
  Star,
  Download,
  UserPlus,
  Users,
  Armchair,
  Check,
  Sparkles,
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/* Constants & helpers                                                    */
/* ---------------------------------------------------------------------- */

const TABLE_COLORS = [
  "#8C3A3A", // wine
  "#6E8267", // sage
  "#C08A2E", // ochre
  "#3F5A6B", // slate
  "#6B4A6E", // plum
  "#A14E2A", // rust
];

const TERMS = {
  wedding: {
    title: "Wedding Reception",
    person: "Guest",
    people: "Guests",
    table: "Table",
    tables: "Tables",
    addTable: "Add table",
    defaultShape: "round",
    seatNoun: "seat",
  },
  seminar: {
    title: "Seminar",
    person: "Attendee",
    people: "Attendees",
    table: "Row",
    tables: "Rows",
    addTable: "Add row",
    defaultShape: "row",
    seatNoun: "seat",
  },
  classroom: {
    title: "Classroom",
    person: "Student",
    people: "Students",
    table: "Row",
    tables: "Rows",
    addTable: "Add row",
    defaultShape: "row",
    seatNoun: "desk",
  },
};

let _idCounter = 0;
const nextId = (prefix) => `${prefix}_${Date.now().toString(36)}_${++_idCounter}`;

const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const cx = (...parts) => parts.filter(Boolean).join(" ");

/* Position of seat `index` of `total` around a round table */
function seatPosition(index, total, dist) {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
  };
}

/* ---------------------------------------------------------------------- */
/* Seed data                                                              */
/* ---------------------------------------------------------------------- */

function makeSeed() {
  const guestNames = [
    ["Eleanor Hayes", true],
    ["Robert Hayes", true],
    ["Margaret Cole", true],
    ["William Cole", true],
    ["Priya Shah", false],
    ["Daniel Ortiz", false],
    ["Sofia Marsh", false],
    ["Jonah Klein", false],
    ["Aisha Bello", false],
    ["Marcus Webb", false],
    ["Lena Petrov", false],
    ["Theo Lindqvist", false],
    ["Grace Okafor", false],
    ["Hannah Pierce", false],
    ["Ivan Volkov", false],
    ["Nora Fitzgerald", false],
    ["Sam Whitfield", false],
    ["Maya Castillo", false],
  ];

  const guests = guestNames.map(([name, vip]) => ({
    id: nextId("g"),
    name,
    vip,
  }));

  const byName = (n) => guests.find((g) => g.name === n).id;

  const tables = [
    {
      id: nextId("t"),
      name: "Bride's Family",
      shape: "round",
      capacity: 8,
      color: TABLE_COLORS[0],
      seats: Array(8).fill(null),
    },
    {
      id: nextId("t"),
      name: "Groom's Family",
      shape: "round",
      capacity: 8,
      color: TABLE_COLORS[1],
      seats: Array(8).fill(null),
    },
    {
      id: nextId("t"),
      name: "Close Friends",
      shape: "round",
      capacity: 6,
      color: TABLE_COLORS[2],
      seats: Array(6).fill(null),
    },
  ];

  tables[0].seats[0] = byName("Eleanor Hayes");
  tables[0].seats[1] = byName("Robert Hayes");
  tables[0].seats[2] = byName("Priya Shah");
  tables[0].seats[3] = byName("Daniel Ortiz");

  tables[1].seats[0] = byName("Margaret Cole");
  tables[1].seats[1] = byName("William Cole");
  tables[1].seats[2] = byName("Sofia Marsh");

  tables[2].seats[0] = byName("Jonah Klein");
  tables[2].seats[1] = byName("Aisha Bello");
  tables[2].seats[2] = byName("Marcus Webb");
  tables[2].seats[3] = byName("Lena Petrov");
  tables[2].seats[4] = byName("Theo Lindqvist");
  tables[2].seats[5] = byName("Grace Okafor");

  return { guests, tables };
}

/* ---------------------------------------------------------------------- */
/* Draggable / Droppable primitives                                       */
/* ---------------------------------------------------------------------- */

function useTapKeyDown(onActivate) {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };
}

/* ---------------------------------------------------------------------- */
/* Main component                                                         */
/* ---------------------------------------------------------------------- */

export default function App() {
  const seed = useRef(makeSeed());
  const [eventType, setEventType] = useState("wedding");
  const [guests, setGuests] = useState(seed.current.guests);
  const [tables, setTables] = useState(seed.current.tables);
  const [search, setSearch] = useState("");
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [activeGuestId, setActiveGuestId] = useState(null);
  const [shakeKey, setShakeKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [guestVipInput, setGuestVipInput] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableShape, setNewTableShape] = useState("round");
  const [newTableCapacity, setNewTableCapacity] = useState(8);

  const terms = TERMS[eventType];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  /* ---- toast helper ---- */
  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type, key: nextId("toast") });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const triggerShake = (key) => {
    setShakeKey(key);
    setTimeout(() => setShakeKey(null), 480);
  };

  /* ---- derived data ---- */
  const seatedIds = useMemo(() => {
    const s = new Set();
    tables.forEach((t) => t.seats.forEach((g) => g && s.add(g)));
    return s;
  }, [tables]);

  const pool = useMemo(
    () => guests.filter((g) => !seatedIds.has(g.id)),
    [guests, seatedIds]
  );

  const searchLower = search.trim().toLowerCase();
  const isMatch = (name) =>
    searchLower !== "" && name.toLowerCase().includes(searchLower);

  const visiblePool = useMemo(
    () => (searchLower ? pool.filter((g) => isMatch(g.name)) : pool),
    [pool, searchLower]
  );

  const stats = useMemo(() => {
    const totalSeats = tables.reduce((a, t) => a + t.capacity, 0);
    const seated = seatedIds.size;
    return { totalSeats, seated, totalGuests: guests.length, tables: tables.length };
  }, [tables, seatedIds, guests]);

  const guestById = useCallback((id) => guests.find((g) => g.id === id), [guests]);

  /* ---- core move logic (handles assign / swap / unassign) ---- */
  const moveGuest = useCallback((guestId, destination) => {
    setTables((prev) => {
      const next = prev.map((t) => ({ ...t, seats: [...t.seats] }));

      let oldTi = -1,
        oldSi = -1;
      next.forEach((t, ti) => {
        const si = t.seats.indexOf(guestId);
        if (si !== -1) {
          oldTi = ti;
          oldSi = si;
        }
      });

      if (destination.type === "pool") {
        if (oldTi !== -1) next[oldTi].seats[oldSi] = null;
        return next;
      }

      const ti = next.findIndex((t) => t.id === destination.tableId);
      if (ti === -1) return prev;
      const si = destination.seatIndex;
      const occupant = next[ti].seats[si];

      if (occupant === guestId) return prev; // dropped on self

      if (oldTi !== -1) next[oldTi].seats[oldSi] = null;
      if (occupant && oldTi !== -1) {
        next[oldTi].seats[oldSi] = occupant; // swap
      }
      next[ti].seats[si] = guestId;
      return next;
    });
  }, []);

  const unassignGuest = (guestId) => moveGuest(guestId, { type: "pool" });

  const dropOnTableBody = (tableId, guestId) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    if (table.seats.includes(guestId)) return;
    const emptyIdx = table.seats.findIndex((s) => s === null);
    if (emptyIdx === -1) {
      showToast(
        `${table.name} is full — ${table.capacity}/${table.capacity} ${terms.seatNoun}s taken`,
        "error"
      );
      triggerShake(`table-${tableId}`);
      return;
    }
    moveGuest(guestId, { type: "seat", tableId, seatIndex: emptyIdx });
  };

  /* ---- guest CRUD ---- */
  const addGuest = (e) => {
    e.preventDefault();
    const name = guestNameInput.trim();
    if (!name) return;
    setGuests((g) => [...g, { id: nextId("g"), name, vip: guestVipInput }]);
    setGuestNameInput("");
    setGuestVipInput(false);
    showToast(`${name} added to the ${terms.people.toLowerCase()} list`, "success");
  };

  const removeGuest = (guestId) => {
    setTables((prev) =>
      prev.map((t) => ({
        ...t,
        seats: t.seats.map((s) => (s === guestId ? null : s)),
      }))
    );
    setGuests((g) => g.filter((x) => x.id !== guestId));
    if (selectedGuestId === guestId) setSelectedGuestId(null);
  };

  /* ---- table CRUD ---- */
  const addTable = (e) => {
    e.preventDefault();
    const name = newTableName.trim() || `${terms.table} ${tables.length + 1}`;
    const capacity = Math.max(1, Math.min(20, Number(newTableCapacity) || 1));
    setTables((prev) => [
      ...prev,
      {
        id: nextId("t"),
        name,
        shape: newTableShape,
        capacity,
        color: TABLE_COLORS[prev.length % TABLE_COLORS.length],
        seats: Array(capacity).fill(null),
      },
    ]);
    setNewTableName("");
    setNewTableCapacity(8);
    setShowAddTable(false);
  };

  const removeTable = (tableId) => {
    setTables((prev) => prev.filter((t) => t.id !== tableId));
  };

  /* ---- selection (tap-to-place) ---- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedGuestId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleGuestClick = (guestId) => {
    setSelectedGuestId((cur) => (cur === guestId ? null : guestId));
  };

  const handleSeatClick = (tableId, seatIndex, occupantId) => {
    if (selectedGuestId) {
      if (selectedGuestId === occupantId) {
        setSelectedGuestId(null);
        return;
      }
      moveGuest(selectedGuestId, { type: "seat", tableId, seatIndex });
      setSelectedGuestId(null);
    } else if (occupantId) {
      setSelectedGuestId(occupantId);
    }
  };

  /* ---- dnd-kit handlers ---- */
  const handleDragStart = ({ active }) => {
    setActiveGuestId(active.id);
    setSelectedGuestId(null);
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveGuestId(null);
    if (!over) return;
    const guestId = active.id;
    const overId = String(over.id);

    if (overId === "pool") {
      unassignGuest(guestId);
      return;
    }
    if (overId.startsWith("seat:")) {
      const [, tableId, idxStr] = overId.split(":");
      moveGuest(guestId, { type: "seat", tableId, seatIndex: Number(idxStr) });
      return;
    }
    if (overId.startsWith("table:")) {
      const tableId = overId.slice(6);
      dropOnTableBody(tableId, guestId);
    }
  };

  const handleDragCancel = () => setActiveGuestId(null);

  /* ---- export ---- */
  const handleExport = () => {
    const lines = [];
    lines.push(`SEATING PLAN — ${terms.title}`);
    lines.push(`Generated ${new Date().toLocaleString()}`);
    lines.push("");
    tables.forEach((t) => {
      const filled = t.seats.filter(Boolean).length;
      lines.push(`${t.name.toUpperCase()}  (${filled}/${t.capacity} seated)`);
      t.seats.forEach((gid, i) => {
        if (gid) {
          const g = guestById(gid);
          lines.push(`  ${i + 1}. ${g.name}${g.vip ? "  [VIP]" : ""}`);
        } else {
          lines.push(`  ${i + 1}. — empty —`);
        }
      });
      lines.push("");
    });
    lines.push(`UNSEATED ${terms.people.toUpperCase()} (${pool.length})`);
    if (pool.length === 0) lines.push("  none");
    pool.forEach((g) => lines.push(`  - ${g.name}${g.vip ? "  [VIP]" : ""}`));

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seating-plan.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Seating plan exported", "success");
  };

  const activeGuest = activeGuestId ? guestById(activeGuestId) : null;

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="esp-root">
        <header className="esp-header">
          <div className="esp-header-top">
            <div className="esp-title-block">
              <span className="esp-eyebrow">Floor plan</span>
              <h1 className="esp-title">Event Seating Planner</h1>
            </div>

            <div className="esp-type-switch" role="tablist" aria-label="Event type">
              {Object.keys(TERMS).map((key) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={eventType === key}
                  className={cx("esp-type-btn", eventType === key && "is-active")}
                  onClick={() => setEventType(key)}
                >
                  {TERMS[key].title}
                </button>
              ))}
            </div>

            <button className="esp-export-btn" onClick={handleExport}>
              <Download size={15} />
              Export layout
            </button>
          </div>

          <div className="esp-stats">
            <Stat label={terms.people} value={stats.totalGuests} />
            <Stat label="Seated" value={`${stats.seated}/${stats.totalSeats}`} accent />
            <Stat label="Unseated" value={pool.length} />
            <Stat label={terms.tables} value={stats.tables} />
            <div className="esp-legend">
              <span className="esp-legend-item">
                <span className="esp-dot esp-dot-filled" /> Filled
              </span>
              <span className="esp-legend-item">
                <span className="esp-dot esp-dot-empty" /> Empty
              </span>
              <span className="esp-legend-item">
                <Star size={11} className="esp-legend-star" /> VIP
              </span>
            </div>
          </div>
        </header>

        <div className="esp-body">
          {/* ---------------- Sidebar ---------------- */}
          <aside className="esp-sidebar">
            <form className="esp-add-guest" onSubmit={addGuest}>
              <div className="esp-search-row">
                <Search size={15} className="esp-search-icon" />
                <input
                  className="esp-search-input"
                  placeholder={`Search ${terms.people.toLowerCase()}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="esp-search-clear"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="esp-add-row">
                <input
                  className="esp-text-input"
                  placeholder={`Add a ${terms.person.toLowerCase()}…`}
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                />
                <label className="esp-vip-toggle" title="Mark as VIP">
                  <input
                    type="checkbox"
                    checked={guestVipInput}
                    onChange={(e) => setGuestVipInput(e.target.checked)}
                  />
                  <Star size={13} />
                </label>
                <button className="esp-icon-btn esp-icon-btn-accent" type="submit" aria-label="Add guest">
                  <UserPlus size={15} />
                </button>
              </div>
            </form>

            <div className="esp-pool-header">
              <Users size={13} />
              <span>
                Unseated {terms.people.toLowerCase()} ({visiblePool.length})
              </span>
            </div>

            <p className="esp-hint">Drag a name onto a seat — or tap a name, then tap a seat.</p>

            <PoolDropZone>
              {visiblePool.length === 0 && (
                <div className="esp-empty-pool">{searchLower ? "No matches." : "Everyone has a seat."}</div>
              )}
              {visiblePool.map((g) => (
                <PoolChip
                  key={g.id}
                  guest={g}
                  selected={selectedGuestId === g.id}
                  onClick={() => handleGuestClick(g.id)}
                  onRemove={() => removeGuest(g.id)}
                />
              ))}
            </PoolDropZone>
          </aside>

          {/* ---------------- Floor plan ---------------- */}
          <main className="esp-floor">
            <div className="esp-floor-grid">
              {tables.map((t) => (
                <TableCard
                  key={t.id}
                  table={t}
                  guestById={guestById}
                  selectedGuestId={selectedGuestId}
                  shaking={shakeKey === `table-${t.id}`}
                  isMatch={isMatch}
                  searching={!!searchLower}
                  onSeatClick={handleSeatClick}
                  onRemoveTable={removeTable}
                />
              ))}

              <div className="esp-add-table-card">
                {!showAddTable ? (
                  <button className="esp-add-table-trigger" onClick={() => setShowAddTable(true)}>
                    <Plus size={20} />
                    <span>{terms.addTable}</span>
                  </button>
                ) : (
                  <form className="esp-add-table-form" onSubmit={addTable}>
                    <input
                      className="esp-text-input"
                      placeholder={`${terms.table} name`}
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      autoFocus
                    />
                    <div className="esp-add-table-row">
                      <select
                        className="esp-select"
                        value={newTableShape}
                        onChange={(e) => setNewTableShape(e.target.value)}
                      >
                        <option value="round">Round table</option>
                        <option value="row">Row</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        className="esp-number-input"
                        value={newTableCapacity}
                        onChange={(e) => setNewTableCapacity(e.target.value)}
                      />
                    </div>
                    <div className="esp-add-table-actions">
                      <button type="submit" className="esp-icon-btn esp-icon-btn-accent">
                        <Check size={14} /> Add
                      </button>
                      <button type="button" className="esp-icon-btn" onClick={() => setShowAddTable(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </main>
        </div>

        {toast && (
          <div className={cx("esp-toast", `esp-toast-${toast.type}`)} key={toast.key}>
            {toast.type === "error" ? <X size={14} /> : <Sparkles size={14} />}
            {toast.message}
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
        {activeGuest ? <DragPreview guest={activeGuest} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ---------------------------------------------------------------------- */
/* Stat pill                                                               */
/* ---------------------------------------------------------------------- */

function Stat({ label, value, accent }) {
  return (
    <div className={cx("esp-stat", accent && "is-accent")}>
      <span className="esp-stat-value">{value}</span>
      <span className="esp-stat-label">{label}</span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Pool                                                                    */
/* ---------------------------------------------------------------------- */

function PoolDropZone({ children }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  return (
    <div ref={setNodeRef} className={cx("esp-pool-list", isOver && "is-drag-over")}>
      {children}
    </div>
  );
}

function PoolChip({ guest, selected, onClick, onRemove }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: guest.id });
  const onKeyDown = useTapKeyDown(onClick);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cx("esp-chip", selected && "is-selected", isDragging && "is-dragging")}
    >
      <span className="esp-chip-avatar">{initials(guest.name)}</span>
      <span className="esp-chip-name">{guest.name}</span>
      {guest.vip && <Star size={12} className="esp-chip-vip" />}
      <button
        className="esp-chip-remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${guest.name}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Table card                                                             */
/* ---------------------------------------------------------------------- */

function TableCard({
  table,
  guestById,
  selectedGuestId,
  shaking,
  isMatch,
  searching,
  onSeatClick,
  onRemoveTable,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `table:${table.id}` });
  const filled = table.seats.filter(Boolean).length;
  const full = filled === table.capacity;

  const seats = table.seats.map((guestId, i) => ({
    i,
    guestId,
    guest: guestId ? guestById(guestId) : null,
  }));

  return (
    <div
      ref={setNodeRef}
      className={cx(
        "esp-table-card",
        full && "is-full",
        shaking && "is-shaking",
        isOver && "is-drag-over"
      )}
      style={{ "--table-color": table.color }}
    >
      <div className="esp-table-card-header">
        <div className="esp-table-name-block">
          <span className="esp-table-swatch" />
          <h3 className="esp-table-name">{table.name}</h3>
        </div>
        <div className="esp-table-header-right">
          <span className={cx("esp-capacity-badge", full && "is-full")}>
            {filled}/{table.capacity}
          </span>
          <button
            className="esp-table-delete"
            onClick={() => onRemoveTable(table.id)}
            aria-label={`Delete ${table.name}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {table.shape === "round" ? (
        <div className="esp-round-wrap">
          <div className="esp-round-center">
            <Armchair size={18} />
            <span>{table.capacity} seats</span>
          </div>
          {seats.map(({ i, guestId, guest }) => {
            const pos = seatPosition(i, table.capacity, 96);
            return (
              <Seat
                key={`${table.id}-${i}`}
                tableId={table.id}
                index={i}
                shape="round"
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`,
                  left: "50%",
                  top: "50%",
                }}
                guestId={guestId}
                guest={guest}
                isSelectedHint={!!selectedGuestId && selectedGuestId !== guestId}
                isSearchMatch={guest && isMatch(guest.name)}
                dimmed={searching && guest && !isMatch(guest.name)}
                onClick={() => onSeatClick(table.id, i, guestId)}
              />
            );
          })}
        </div>
      ) : (
        <div className="esp-row-wrap">
          {seats.map(({ i, guestId, guest }) => (
            <Seat
              key={`${table.id}-${i}`}
              tableId={table.id}
              index={i}
              shape="row"
              guestId={guestId}
              guest={guest}
              isSelectedHint={!!selectedGuestId && selectedGuestId !== guestId}
              isSearchMatch={guest && isMatch(guest.name)}
              dimmed={searching && guest && !isMatch(guest.name)}
              onClick={() => onSeatClick(table.id, i, guestId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Seat (droppable target + draggable when occupied)                      */
/* ---------------------------------------------------------------------- */

function Seat({
  tableId,
  index,
  shape,
  style,
  guestId,
  guest,
  isSelectedHint,
  isSearchMatch,
  dimmed,
  onClick,
}) {
  const dropId = `seat:${tableId}:${index}`;
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dropId });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: guestId || `empty-${dropId}`,
    disabled: !guestId,
  });

  const setRefs = (node) => {
    setDropRef(node);
    setDragRef(node);
  };

  const onKeyDown = useTapKeyDown(onClick);

  return (
    <div
      ref={setRefs}
      {...(guestId ? attributes : {})}
      {...(guestId ? listeners : {})}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={{ ...style, opacity: isDragging ? 0.3 : 1 }}
      className={cx(
        "esp-seat",
        shape === "round" ? "esp-seat-round" : "esp-seat-row",
        guestId ? "is-filled" : "is-empty",
        isOver && "is-drag-over",
        isSelectedHint && "is-hint",
        isSearchMatch && "is-match",
        dimmed && "is-dimmed"
      )}
      title={guest ? guest.name : "Empty seat"}
    >
      {guest ? (
        <>
          <span className="esp-seat-initials">{initials(guest.name)}</span>
          {guest.vip && <Star size={10} className="esp-seat-vip" />}
          <span className="esp-seat-tooltip">{guest.name}</span>
        </>
      ) : (
        <span className="esp-seat-plus">+</span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Drag overlay preview ("lifted place card")                             */
/* ---------------------------------------------------------------------- */

function DragPreview({ guest }) {
  return (
    <div className="esp-drag-preview">
      <span className="esp-chip-avatar">{initials(guest.name)}</span>
      <span className="esp-chip-name">{guest.name}</span>
      {guest.vip && <Star size={12} className="esp-chip-vip" />}
    </div>
  );
}
