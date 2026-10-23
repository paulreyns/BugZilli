import { useCallback, useEffect, useState } from "react";
import { resolveDetailFields } from "../shared/detail-fields";
import {
  ALL_FILTER_ID,
  parseSelectedFilters,
  resolveSelectedFilterId,
  rulesForSelectedFilter,
  type SelectedFiltersByProduct,
} from "../shared/list-filters";
import type {
  AppSettings,
  Bug,
  BugAttachmentDraft,
  BugCommentDraft,
  BugDetail,
  BugUpdate,
  FilterRule,
  SavedFilter,
  SettingsUpdate,
} from "../shared/types";
import { BugDetailPage } from "./components/BugDetailPage";
import { BugsPage } from "./components/BugsPage";
import { GoToBugDialog } from "./components/GoToBugDialog";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar, type Page } from "./components/Sidebar";
import { errorMessage } from "./errors";

const LAST_LOCATION_KEY = "bugzilli.lastLocation";
const SELECTED_FILTERS_KEY = "bugzilli.selectedFilters";

interface LastLocation {
  projectId?: string;
  page: Page;
  globalSettings: boolean;
}

function readLastLocation(): LastLocation | undefined {
  try {
    const saved = localStorage.getItem(LAST_LOCATION_KEY);
    if (!saved) return undefined;

    const value: unknown = JSON.parse(saved);
    if (!value || typeof value !== "object") {
      console.error("Saved navigation state has an invalid format.");
      return undefined;
    }
    const projectId = "projectId" in value ? value.projectId : undefined;
    if (
      "page" in value &&
      (value.page === "list" ||
        value.page === "board" ||
        value.page === "settings") &&
      "globalSettings" in value &&
      typeof value.globalSettings === "boolean" &&
      (!("projectId" in value) || typeof projectId === "string")
    ) {
      return {
        page: value.page,
        globalSettings: value.globalSettings,
        ...(typeof projectId === "string" ? { projectId } : {}),
      };
    }
    console.error("Saved navigation state has an invalid format.");
  } catch (error) {
    console.error("Could not read saved navigation state.", error);
  }
  return undefined;
}

function readSelectedFilters(): SelectedFiltersByProduct {
  try {
    const saved = localStorage.getItem(SELECTED_FILTERS_KEY);
    if (!saved) return {};
    return parseSelectedFilters(JSON.parse(saved));
  } catch (error) {
    console.error("Could not read saved filter selection.", error);
    return {};
  }
}

export default function App() {
  const [lastLocation] = useState(readLastLocation);
  const [settings, setSettings] = useState<AppSettings>();
  const [activeProjectId, setActiveProjectId] = useState<string>();
  const [page, setPage] = useState<Page>(lastLocation?.page ?? "list");
  const [globalSettings, setGlobalSettings] = useState(
    lastLocation?.globalSettings ?? false,
  );
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [query, setQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState(readSelectedFilters);
  const [loadingBugs, setLoadingBugs] = useState(false);
  const [bugsError, setBugsError] = useState("");
  const [selectedBug, setSelectedBug] = useState<BugDetail>();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [startupError, setStartupError] = useState("");
  const [goToBugOpen, setGoToBugOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !event.metaKey &&
        event.key.toLowerCase() === "g"
      ) {
        event.preventDefault();
        setGoToBugOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    window.bugzilli
      .getSettings()
      .then((value) => {
        setSettings(value);
        const savedProject = value.projects.find(
          ({ id }) => id === lastLocation?.projectId,
        );
        setActiveProjectId(savedProject?.id ?? value.projects[0]?.id);
        if (!value.baseUrl || value.projects.length === 0) {
          setGlobalSettings(true);
          setPage("settings");
        }
      })
      .catch((error: unknown) => setStartupError(errorMessage(error)));
  }, [lastLocation]);

  useEffect(() => {
    if (!settings) return;
    try {
      localStorage.setItem(
        LAST_LOCATION_KEY,
        JSON.stringify({ projectId: activeProjectId, page, globalSettings }),
      );
    } catch (error) {
      console.error("Could not save navigation state.", error);
    }
  }, [activeProjectId, globalSettings, page, settings]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SELECTED_FILTERS_KEY,
        JSON.stringify(selectedFilters),
      );
    } catch (error) {
      console.error("Could not save filter selection.", error);
    }
  }, [selectedFilters]);

  const loadBugs = useCallback(
    async (
      projectId: string,
      searchQuery = "",
      filterRules?: FilterRule[],
    ) => {
      setLoadingBugs(true);
      setBugsError("");
      try {
        setBugs(
          await window.bugzilli.searchBugs({
            projectId,
            ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
            ...(filterRules && filterRules.length > 0
              ? { filters: filterRules }
              : {}),
          }),
        );
      } catch (error) {
        setBugs([]);
        setBugsError(errorMessage(error));
      } finally {
        setLoadingBugs(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !activeProjectId ||
      (page !== "list" && page !== "board") ||
      selectedBug
    ) {
      return;
    }
    const project = settings?.projects.find(({ id }) => id === activeProjectId);
    if (!project) return;
    const filterId = resolveSelectedFilterId(
      selectedFilters[project.product],
      project.filters,
    );
    void loadBugs(
      activeProjectId,
      query,
      rulesForSelectedFilter(filterId, project.filters),
    );
    // Reload when project, page, or selected filter changes — not on every query keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query is only applied via Search/Refresh
  }, [
    activeProjectId,
    page,
    selectedBug,
    selectedFilters,
    settings,
    loadBugs,
  ]);

  function navigate(projectId: string, nextPage: Page) {
    setActiveProjectId(projectId);
    setPage(nextPage);
    setGlobalSettings(false);
    setSelectedBug(undefined);
    setDetailError("");
    setQuery("");
  }

  async function openBug(id: number) {
    setLoadingDetail(true);
    setDetailError("");
    try {
      setSelectedBug(await window.bugzilli.getBug(id));
    } catch (error) {
      setSelectedBug(undefined);
      setDetailError(errorMessage(error));
    } finally {
      setLoadingDetail(false);
    }
  }

  function rememberBug(id: number, next: BugDetail) {
    setSelectedBug((current) => (current?.id === id ? next : current));
  }

  function updateBug(id: number, update: BugUpdate) {
    return window.bugzilli.updateBug(id, update).then((next) => {
      rememberBug(id, next);
    });
  }

  function addComment(id: number, comment: BugCommentDraft) {
    return window.bugzilli.addComment(id, comment).then((next) => {
      rememberBug(id, next);
    });
  }

  function addAttachment(id: number, attachment: BugAttachmentDraft) {
    return window.bugzilli.addAttachment(id, attachment).then((next) => {
      rememberBug(id, next);
    });
  }

  async function save(update: SettingsUpdate) {
    const next = await window.bugzilli.saveSettings(update);
    setSettings(next);
    if (!next.projects.some(({ id }) => id === activeProjectId)) {
      setActiveProjectId(next.projects[0]?.id);
    }
  }

  async function addProjectFilter(projectId: string, filter: SavedFilter) {
    if (!settings) return;
    const projects = settings.projects.map((project) =>
      project.id === projectId
        ? { ...project, filters: [...(project.filters ?? []), filter] }
        : project,
    );
    await save({ baseUrl: settings.baseUrl, projects });
    const product = projects.find(({ id }) => id === projectId)?.product;
    if (product) {
      setSelectedFilters((current) => ({ ...current, [product]: filter.id }));
    }
  }

  async function updateProjectFilter(projectId: string, filter: SavedFilter) {
    if (!settings || filter.id === ALL_FILTER_ID) return;
    const projects = settings.projects.map((project) => {
      if (project.id !== projectId) return project;
      const filters = project.filters ?? [];
      if (!filters.some(({ id }) => id === filter.id)) return project;
      return {
        ...project,
        filters: filters.map((existing) =>
          existing.id === filter.id ? filter : existing,
        ),
      };
    });
    await save({ baseUrl: settings.baseUrl, projects });
  }

  async function deleteProjectFilter(projectId: string, filterId: string) {
    if (!settings || filterId === ALL_FILTER_ID) return;
    const project = settings.projects.find(({ id }) => id === projectId);
    if (!project?.filters?.some(({ id }) => id === filterId)) return;
    const projects = settings.projects.map((entry) => {
      if (entry.id !== projectId) return entry;
      const remaining = (entry.filters ?? []).filter(({ id }) => id !== filterId);
      const { filters: _removed, ...rest } = entry;
      return remaining.length > 0 ? { ...rest, filters: remaining } : rest;
    });
    await save({ baseUrl: settings.baseUrl, projects });
    setSelectedFilters((current) => {
      if (current[project.product] !== filterId) return current;
      return { ...current, [project.product]: ALL_FILTER_ID };
    });
  }

  if (startupError) {
    return (
      <div className="startup-state">
        <h1>Bugzilli could not start</h1>
        <p>{startupError}</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="startup-state">
        <span className="app-loader" />
        <p>Opening Bugzilli…</p>
      </div>
    );
  }

  const activeProject = settings.projects.find(
    ({ id }) => id === activeProjectId,
  );

  let content: React.ReactNode;
  if (loadingDetail || selectedBug || detailError) {
    content = (
      <BugDetailPage
        {...(selectedBug ? { bug: selectedBug } : {})}
        baseUrl={settings.baseUrl}
        loading={loadingDetail}
        error={detailError}
        detailFields={resolveDetailFields(activeProject?.detailFields)}
        integrationUser={settings.integrationUser}
        onBack={() => {
          setSelectedBug(undefined);
          setDetailError("");
        }}
        onOpenBug={(id) => void openBug(id)}
        onOpenAttachment={(id) => window.bugzilli.openAttachment(id)}
        onUpdateBug={updateBug}
        onAddComment={addComment}
        onAddAttachment={addAttachment}
      />
    );
  } else if (page === "settings" || globalSettings || !activeProject) {
    content = (
      <SettingsPage
        settings={settings}
        {...(!globalSettings && activeProjectId ? { activeProjectId } : {})}
        onSave={save}
      />
    );
  } else {
    const filterId = resolveSelectedFilterId(
      selectedFilters[activeProject.product],
      activeProject.filters,
    );
    const filterRules = rulesForSelectedFilter(
      filterId,
      activeProject.filters,
    );
    content = (
      <BugsPage
        project={activeProject}
        mode={page}
        bugs={bugs}
        query={query}
        selectedFilterId={filterId}
        loading={loadingBugs}
        error={bugsError}
        onQueryChange={setQuery}
        onSearch={() => void loadBugs(activeProject.id, query, filterRules)}
        onRefresh={() => void loadBugs(activeProject.id, query, filterRules)}
        onSelectFilter={(nextId) => {
          setSelectedFilters((current) => ({
            ...current,
            [activeProject.product]: nextId,
          }));
        }}
        onAddFilter={(filter) => {
          void addProjectFilter(activeProject.id, filter);
        }}
        onUpdateFilter={(filter) => {
          void updateProjectFilter(activeProject.id, filter);
        }}
        onDeleteFilter={(filterId) => {
          void deleteProjectFilter(activeProject.id, filterId);
        }}
        onSelectBug={(id) => void openBug(id)}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        projects={settings.projects}
        {...(activeProjectId ? { activeProjectId } : {})}
        page={page}
        onNavigate={navigate}
        onGlobalSettings={() => {
          setGlobalSettings(true);
          setPage("settings");
          setSelectedBug(undefined);
        }}
      />
      <div className="content">{content}</div>
      {goToBugOpen && (
        <GoToBugDialog
          baseUrl={settings.baseUrl}
          onClose={() => setGoToBugOpen(false)}
          onGo={(id) => {
            setGoToBugOpen(false);
            void openBug(id);
          }}
        />
      )}
    </div>
  );
}
