import { useCallback, useEffect, useState } from "react";
import type {
  AppSettings,
  Bug,
  BugAttachmentDraft,
  BugCommentDraft,
  BugDetail,
  BugUpdate,
  SettingsUpdate,
} from "../shared/types";
import { BugDetailPage } from "./components/BugDetailPage";
import { BugsPage } from "./components/BugsPage";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar, type Page } from "./components/Sidebar";
import { errorMessage } from "./errors";

export default function App() {
  const [settings, setSettings] = useState<AppSettings>();
  const [activeProjectId, setActiveProjectId] = useState<string>();
  const [page, setPage] = useState<Page>("list");
  const [globalSettings, setGlobalSettings] = useState(false);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [query, setQuery] = useState("");
  const [loadingBugs, setLoadingBugs] = useState(false);
  const [bugsError, setBugsError] = useState("");
  const [selectedBug, setSelectedBug] = useState<BugDetail>();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [startupError, setStartupError] = useState("");

  useEffect(() => {
    window.bugzilli
      .getSettings()
      .then((value) => {
        setSettings(value);
        setActiveProjectId(value.projects[0]?.id);
        if (!value.baseUrl || value.projects.length === 0) {
          setGlobalSettings(true);
          setPage("settings");
        }
      })
      .catch((error: unknown) => setStartupError(errorMessage(error)));
  }, []);

  const loadBugs = useCallback(async (projectId: string, searchQuery = "") => {
    setLoadingBugs(true);
    setBugsError("");
    try {
      setBugs(
        await window.bugzilli.searchBugs({
          projectId,
          ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
        }),
      );
    } catch (error) {
      setBugs([]);
      setBugsError(errorMessage(error));
    } finally {
      setLoadingBugs(false);
    }
  }, []);

  useEffect(() => {
    if (
      activeProjectId &&
      (page === "list" || page === "board") &&
      !selectedBug
    ) {
      void loadBugs(activeProjectId);
    }
  }, [activeProjectId, page, selectedBug, loadBugs]);

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
        loading={loadingDetail}
        error={detailError}
        onBack={() => {
          setSelectedBug(undefined);
          setDetailError("");
        }}
        onOpenAttachment={(id) => {
          void window.bugzilli.openAttachment(id);
        }}
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
    content = (
      <BugsPage
        project={activeProject}
        mode={page}
        bugs={bugs}
        query={query}
        loading={loadingBugs}
        error={bugsError}
        onQueryChange={setQuery}
        onSearch={() => void loadBugs(activeProject.id, query)}
        onRefresh={() => void loadBugs(activeProject.id, query)}
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
    </div>
  );
}
