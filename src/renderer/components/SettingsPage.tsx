import { KeyRound, Plus, Save, Server, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DEFAULT_BOARD_GROUP_BY,
  defaultBoardStatuses,
} from "../../shared/board-statuses";
import { defaultDetailFields } from "../../shared/detail-fields";
import { defaultListColumns } from "../../shared/list-columns";
import type {
  AppSettings,
  Project,
  SettingsUpdate,
} from "../../shared/types";
import { BoardStatusesEditor } from "./BoardStatusesEditor";
import { DetailFieldsEditor } from "./DetailFieldsEditor";
import { ListColumnsEditor } from "./ListColumnsEditor";

interface SettingsPageProps {
  settings: AppSettings;
  activeProjectId?: string;
  onSave: (update: SettingsUpdate) => Promise<void>;
}

export function SettingsPage({
  settings,
  activeProjectId,
  onSave,
}: SettingsPageProps) {
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [projects, setProjects] = useState<Project[]>(settings.projects);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setBaseUrl(settings.baseUrl);
    setProjects(settings.projects);
  }, [settings]);

  function updateProject(id: string, values: Partial<Project>) {
    setProjects((current) =>
      current.map((project) =>
        project.id === id ? { ...project, ...values } : project,
      ),
    );
  }

  function addProject() {
    const project: Project = {
      id: crypto.randomUUID(),
      name: "New product",
      product: "",
      showClosedBugs: false,
      detailFields: defaultDetailFields(),
      listColumns: defaultListColumns(),
      boardGroupBy: DEFAULT_BOARD_GROUP_BY,
      boardStatuses: defaultBoardStatuses(),
    };
    setProjects((current) => [...current, project]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await onSave({
        baseUrl,
        projects,
        ...(apiKey.trim() ? { apiKey } : {}),
        ...(clearApiKey ? { clearApiKey: true } : {}),
      });
      setApiKey("");
      setClearApiKey(false);
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  const scopedToProject = Boolean(activeProjectId);
  const visibleProjects = activeProjectId
    ? projects.filter(({ id }) => id === activeProjectId)
    : projects;
  const activeProject = visibleProjects[0];

  return (
    <main className="page settings-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>{scopedToProject ? "Project settings" : "App settings"}</h1>
          <p className="page-subtitle">
            {scopedToProject
              ? `Configure how ${activeProject?.name ?? "this product"} appears, including board columns, list columns, and detail fields.`
              : "Connect Bugzilli to your Bugzilla instance and choose which products appear as products."}
          </p>
        </div>
      </header>

      <form onSubmit={submit} className="settings-form">
        {!scopedToProject && (
          <section className="settings-card">
            <div className="settings-card-title">
              <Server size={19} />
              <div>
                <h2>Bugzilla connection</h2>
                <p>Used for all searches, bug details, and attachments.</p>
              </div>
            </div>
            <label>
              Bugzilla URL
              <input
                type="url"
                value={baseUrl}
                placeholder="https://bugzilla.example.com"
                onChange={(event) => setBaseUrl(event.target.value)}
                required
              />
            </label>
            <label>
              <span className="label-with-status">
                API key
                {settings.hasApiKey && !clearApiKey && (
                  <span className="saved-pill">
                    <KeyRound size={12} /> Saved
                  </span>
                )}
              </span>
              <input
                type="password"
                value={apiKey}
                placeholder={
                  settings.hasApiKey && !clearApiKey
                    ? "Leave blank to keep the saved key"
                    : "Paste your Bugzilla API key"
                }
                onChange={(event) => {
                  setApiKey(event.target.value);
                  if (event.target.value) setClearApiKey(false);
                }}
              />
            </label>
            {settings.hasApiKey && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setClearApiKey((value) => !value);
                  setApiKey("");
                }}
              >
                {clearApiKey ? "Keep saved API key" : "Remove saved API key"}
              </button>
            )}
            {settings.keyStorage === "plain" && (
              <p className="warning">
                Your operating system credential store is unavailable. The API
                key is stored locally but is not encrypted.
              </p>
            )}
          </section>
        )}

        <section className="settings-card">
          <div className="settings-card-title projects-title">
            <div>
              <h2>{scopedToProject ? "Product" : "Products"}</h2>
              <p>
                {scopedToProject
                  ? "Display name, Bugzilla product mapping, board columns, list columns, and detail fields."
                  : "Each product maps to a Bugzilla product name."}
              </p>
            </div>
            {!scopedToProject && (
              <button
                type="button"
                className="secondary-button"
                onClick={addProject}
              >
                <Plus size={16} /> Add product
              </button>
            )}
          </div>
          <div className="project-editor-list">
            {!scopedToProject && visibleProjects.length === 0 && (
              <button
                type="button"
                className="empty-projects"
                onClick={addProject}
              >
                <Plus size={20} />
                Add your first Bugzilla project
              </button>
            )}
            {visibleProjects.map((project) => (
              <div
                className={`project-editor${scopedToProject ? " scoped" : ""}`}
                key={project.id}
              >
                <span className="project-avatar large">
                  {project.name.slice(0, 1).toUpperCase() || "P"}
                </span>
                <label>
                  Display name
                  <input
                    value={project.name}
                    onChange={(event) =>
                      updateProject(project.id, { name: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Bugzilla product
                  <input
                    value={project.product}
                    placeholder="Exact product name"
                    onChange={(event) =>
                      updateProject(project.id, { product: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="checkbox-setting">
                  <input
                    type="checkbox"
                    checked={project.showClosedBugs ?? false}
                    onChange={(event) =>
                      updateProject(project.id, {
                        showClosedBugs: event.target.checked,
                      })
                    }
                  />
                  <span>
                    Show closed bugs
                    <small>
                      Include resolved bugs in lists and show the Closed column
                      on the Board.
                    </small>
                  </span>
                </label>
                <BoardStatusesEditor
                  product={project.product}
                  boardGroupBy={project.boardGroupBy}
                  boardStatuses={project.boardStatuses}
                  showClosedBugs={project.showClosedBugs ?? false}
                  onGroupByChange={(groupBy, columns) =>
                    updateProject(project.id, {
                      boardGroupBy: groupBy,
                      boardStatuses: columns,
                    })
                  }
                  onColumnsChange={(statuses) =>
                    updateProject(project.id, { boardStatuses: statuses })
                  }
                />
                <ListColumnsEditor
                  product={project.product}
                  listColumns={project.listColumns}
                  onChange={(columns) =>
                    updateProject(project.id, { listColumns: columns })
                  }
                />
                <DetailFieldsEditor
                  product={project.product}
                  detailFields={project.detailFields}
                  onChange={(fields) =>
                    updateProject(project.id, { detailFields: fields })
                  }
                />
                {!scopedToProject && (
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Remove ${project.name}`}
                    onClick={() =>
                      setProjects((current) =>
                        current.filter(({ id }) => id !== project.id),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="settings-actions">
          {message && <span className="form-message">{message}</span>}
          <button className="primary-button" type="submit" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </main>
  );
}
