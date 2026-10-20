import { Check, ChevronDown, Filter, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  ALL_FILTER_ID,
  filterDisplayName,
  resolveSelectedFilterId,
} from "../../shared/list-filters";
import type { SavedFilter } from "../../shared/types";

interface FilterSelectProps {
  filters: SavedFilter[];
  selectedId: string;
  onSelect: (filterId: string) => void;
  onAddFilter: () => void;
  disabled?: boolean;
}

export function FilterSelect({
  filters,
  selectedId,
  onSelect,
  onAddFilter,
  disabled = false,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const activeId = resolveSelectedFilterId(selectedId, filters);
  const activeFilter = filters.find((filter) => filter.id === activeId);
  const label =
    activeId === ALL_FILTER_ID
      ? "All"
      : activeFilter
        ? filterDisplayName(activeFilter)
        : "All";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(filterId: string) {
    onSelect(filterId);
    setOpen(false);
  }

  return (
    <div className="filter-select" ref={rootRef}>
      <button
        type="button"
        className="filter-select-trigger secondary-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <Filter size={15} />
        <span className="filter-select-label">{label}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="filter-select-menu" id={menuId} role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={activeId === ALL_FILTER_ID}
            className="filter-select-option"
            onClick={() => choose(ALL_FILTER_ID)}
          >
            <span>All</span>
            {activeId === ALL_FILTER_ID && <Check size={15} />}
          </button>
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="option"
              aria-selected={activeId === filter.id}
              className="filter-select-option"
              onClick={() => choose(filter.id)}
            >
              <span>{filterDisplayName(filter)}</span>
              {activeId === filter.id && <Check size={15} />}
            </button>
          ))}
          <div className="filter-select-divider" role="separator" />
          <button
            type="button"
            className="filter-select-option filter-select-add"
            onClick={() => {
              setOpen(false);
              onAddFilter();
            }}
          >
            <Plus size={15} />
            <span>Add Filter</span>
          </button>
        </div>
      )}
    </div>
  );
}
