import {
  initWorkspaces,
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  restoreWorkspace,
  syncWorkspaces,
  onWorkspacesChanged,
} from '../../../services/workspace.js';

function createWorkspacesStore() {
  let workspaces = $state([]);
  let expandedIds = $state(new Set());

  return {
    get workspaces() { return workspaces; },
    get expandedIds() { return expandedIds; },

    isExpanded(id) {
      return expandedIds.has(id);
    },

    toggleExpanded(id) {
      const next = new Set(expandedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      expandedIds = next;
    },

    async init() {
      await initWorkspaces();
      workspaces = getWorkspaces();
      onWorkspacesChanged((ws) => { workspaces = ws; });
      syncWorkspaces();
    },

    async delete(id) {
      await deleteWorkspace(id);
      workspaces = getWorkspaces();
    },

    async restore(id) {
      await restoreWorkspace(id);
      window.close();
    },

    async create(name, selectedTabs, color) {
      await createWorkspace(name, selectedTabs, color);
      workspaces = getWorkspaces();
    },

    async update(id, data) {
      await updateWorkspace(id, data);
      workspaces = getWorkspaces();
    },
  };
}

export const workspacesStore = createWorkspacesStore();
