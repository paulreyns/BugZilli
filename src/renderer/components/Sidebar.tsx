import {
  Bug,
  ChevronDown,
  ChevronRight,
  Columns3,
  List,
  Plus,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FavouriteBug, Project } from "../../shared/types";

const EXPANDED_PROJECTS_KEY = "bugzilli.expandedProjects";

export type Page = "list" | "board" | "settings";

interface SidebarProps {
  projects: Project[];
  favourites: FavouriteBug[];
  activeProjectId?: string;
  activeFavouriteId?: number;
  page: Page;
  onNavigate: (projectId: string, page: Page) => void;
  onOpenFavourite: (id: number) => void;
  onGlobalSettings: () => void;
}

export function Sidebar({
  projects,
  favourites,
  activeProjectId,
  activeFavouriteId,
  page,
  onNavigate,
  onOpenFavourite,
  onGlobalSettings,
}: SidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => {
      try {
        const saved = localStorage.getItem(EXPANDED_PROJECTS_KEY);
        if (!saved) return new Set(projects.map(({ id }) => id));

        const value: unknown = JSON.parse(saved);
        if (
          Array.isArray(value) &&
          value.every((id) => typeof id === "string")
        ) {
          return new Set(value);
        }
        console.error("Saved expanded products have an invalid format.");
      } catch (error) {
        console.error("Could not read saved expanded products.", error);
      }
      return new Set(projects.map(({ id }) => id));
    },
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        EXPANDED_PROJECTS_KEY,
        JSON.stringify([...expanded]),
      );
    } catch (error) {
      console.error("Could not save expanded products.", error);
    }
  }, [expanded]);

  function toggle(projectId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Bug size={19} strokeWidth={2.5} />
        </span>
        <span>Bugzilli</span>
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-heading">
          <span>Products</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Add project"
            title="Add project"
            onClick={onGlobalSettings}
          >
            <Plus size={16} />
          </button>
        </div>

        <nav className="project-nav" aria-label="Projects">
          {projects.map((project) => {
            const isExpanded = expanded.has(project.id);
            return (
              <div className="project-group" key={project.id}>
                <button
                  type="button"
                  className="project-toggle"
                  onClick={() => toggle(project.id)}
                >
                  {isExpanded ? (
                    <ChevronDown size={15} />
                  ) : (
                    <ChevronRight size={15} />
                  )}
                  <span className="project-avatar">
                    {project.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate">{project.name}</span>
                </button>
                {isExpanded && (
                  <div className="project-links">
                    <NavButton
                      icon={<List size={16} />}
                      label="List"
                      active={activeProjectId === project.id && page === "list"}
                      onClick={() => onNavigate(project.id, "list")}
                    />
                    <NavButton
                      icon={<Columns3 size={16} />}
                      label="Board"
                      active={activeProjectId === project.id && page === "board"}
                      onClick={() => onNavigate(project.id, "board")}
                    />
                    <NavButton
                      icon={<Settings size={16} />}
                      label="Settings"
                      active={
                        activeProjectId === project.id && page === "settings"
                      }
                      onClick={() => onNavigate(project.id, "settings")}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-heading">
          <span>Favourites</span>
        </div>

        <nav className="favourites-nav" aria-label="Favourites">
          {favourites.length === 0 ? (
            <p className="favourites-empty">No favourites yet</p>
          ) : (
            favourites.map((favourite) => (
              <button
                key={favourite.id}
                type="button"
                className={`nav-link favourite-link ${
                  activeFavouriteId === favourite.id ? "active" : ""
                }`}
                onClick={() => onOpenFavourite(favourite.id)}
                title={`${favourite.id} ${favourite.name}`}
              >
                <span className="favourite-id">{favourite.id}</span>
                <span className="truncate">{favourite.name}</span>
              </button>
            ))
          )}
        </nav>
      </div>

      <button
        type="button"
        className="sidebar-settings"
        onClick={onGlobalSettings}
      >
        <Settings size={17} />
        App settings
      </button>
    </aside>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`nav-link ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
