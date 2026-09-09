import { reactive, readonly, toRaw } from "vue";

import { createAccountStateAdapter } from "./state-continuity/account-adapter.js";
import { createDemoStateAdapter } from "./state-continuity/demo-adapter.js";

function clone(value) {
  return structuredClone(toRaw(value));
}

function createEmptySnapshot() {
  return {
    tasks: [],
    dailyRecords: {},
    weeklySummaries: {},
    drafts: {},
  };
}

function normalizeIdentity(identity = {}) {
  const demo = identity?.mode === "demo" || identity?.demo === true;
  const id = String(identity?.id || "").trim();
  return {
    id: demo ? "demo" : id,
    demo,
    preferences: clone(identity?.preferences || {}),
  };
}

function getTodayData(snapshot, date, drafts) {
  return readonly({
    tasks: Array.isArray(snapshot?.tasks) ? snapshot.tasks : [],
    record: snapshot?.dailyRecords?.[date] || null,
    drafts,
    onboarding: snapshot?.onboarding || null,
  });
}

function getInformationData(snapshot) {
  return readonly({
    items: snapshot?.content?.items || {},
    sources: snapshot?.content?.sources || {},
    favorites: snapshot?.content?.favorites || {},
    preferences: snapshot?.preferences || {},
    readItems: snapshot?.content?.readItems || {},
  });
}

function getPeriodReviewFacts(snapshot) {
  return readonly({
    tasks: Array.isArray(snapshot?.tasks) ? snapshot.tasks : [],
    dailyRecords: snapshot?.dailyRecords || {},
    weeklySummaries: snapshot?.weeklySummaries || {},
  });
}

function getHomeData(snapshot, supplemental) {
  return readonly({
    dailyRecords: snapshot?.dailyRecords || {},
    supplemental: supplemental || {},
  });
}

function replaceRecord(snapshot, date, record) {
  return {
    ...snapshot,
    dailyRecords: {
      ...(snapshot.dailyRecords || {}),
      [date]: record,
    },
  };
}

function toTaskPatch(payload = {}) {
  return {
    ...payload,
    ...(Object.hasOwn(payload, "displayOrder") ? { display_order: payload.displayOrder } : {}),
    ...(Object.hasOwn(payload, "archivedAt") ? { archived_at: payload.archivedAt } : {}),
    ...(Object.hasOwn(payload, "lifecycleEvents") ? { lifecycle_events: payload.lifecycleEvents } : {}),
  };
}

function preserveLegacyArchiveEvent(snapshot, taskId, payload = {}) {
  if (!Array.isArray(payload.lifecycleEvents)) {
    return payload;
  }
  const task = (snapshot?.tasks || []).find((candidate) => String(candidate?.id) === String(taskId));
  const archivedAt = String(task?.archived_at || task?.archivedAt || "");
  const lifecycleEvents = [...payload.lifecycleEvents];
  const alreadyRecorded = lifecycleEvents.some((event) => (
    event?.type === "archive" && String(event?.changedAt || "") === archivedAt
  ));
  if (archivedAt && !alreadyRecorded) {
    lifecycleEvents.unshift({ taskId: String(taskId), type: "archive", changedAt: archivedAt });
  }
  return { ...payload, lifecycleEvents };
}

function isPreferenceCommand(command) {
  return command.type === "preferences.replace"
    || command.type === "preferences.merge"
    || command.type === "today.updateTaskPreferences"
    || command.type === "information.toggleRead"
    || command.type === "information.markRead"
    || command.type === "information.setSourceHidden";
}

function applyPreferenceCommand(preferences = {}, command) {
  if (command.type === "preferences.replace") {
    return clone(command.preferences || {});
  }
  if (command.type === "preferences.merge") {
    const merge = (current, patch) => Object.fromEntries(
      [...new Set([...Object.keys(current || {}), ...Object.keys(patch || {})])].map((key) => {
        const nextValue = patch?.[key];
        const currentValue = current?.[key];
        if (
          nextValue && typeof nextValue === "object" && !Array.isArray(nextValue)
          && currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
        ) {
          return [key, merge(currentValue, nextValue)];
        }
        return [key, Object.hasOwn(patch || {}, key) ? clone(nextValue) : clone(currentValue)];
      }),
    );
    return merge(preferences, command.patch);
  }
  const next = clone(preferences || {});
  if (command.type === "today.updateTaskPreferences") {
    next.tasks = {
      ...(next.tasks || {}),
      tagsByTaskId: { ...(next.tasks?.tagsByTaskId || {}) },
      iconByTaskId: { ...(next.tasks?.iconByTaskId || {}) },
    };
    if (Array.isArray(command.patch?.tags)) {
      if (command.patch.tags.length) next.tasks.tagsByTaskId[command.taskId] = command.patch.tags;
      else delete next.tasks.tagsByTaskId[command.taskId];
    }
    if (typeof command.patch?.icon === "string") {
      if (command.patch.icon) next.tasks.iconByTaskId[command.taskId] = command.patch.icon;
      else delete next.tasks.iconByTaskId[command.taskId];
    }
    return next;
  }

  next.content = {
    ...(next.content || {}),
    readItems: { ...(next.content?.readItems || {}) },
    hiddenSources: { ...(next.content?.hiddenSources || {}) },
  };
  if (command.type === "information.toggleRead" || command.type === "information.markRead") {
    if (command.read) next.content.readItems[command.itemRef] = command.changedAt;
    else delete next.content.readItems[command.itemRef];
  }
  if (command.type === "information.setSourceHidden") {
    const key = `news:${command.sourceId}`;
    if (command.hidden) next.content.hiddenSources[key] = true;
    else delete next.content.hiddenSources[key];
  }
  return next;
}

function applyCommand(snapshot, command, response = {}) {
  if (isPreferenceCommand(command)) {
    const base = response?.snapshot ? clone(response.snapshot) : snapshot;
    return {
      ...base,
      preferences: response?.preferences
        ? clone(response.preferences)
        : applyPreferenceCommand(snapshot?.preferences, command),
    };
  }
  if (response?.snapshot) {
    return {
      ...clone(response.snapshot),
      preferences: clone(response.preferences || snapshot?.preferences || {}),
    };
  }
  if (command.type === "information.toggleFavorite") {
    const favorites = { ...(snapshot.content?.favorites?.news || {}) };
    if (command.favorited) delete favorites[command.itemId];
    else {
      const favorite = response?.favorite || command.item;
      favorites[String(favorite?.id || command.itemId)] = { ...favorite, is_favorite: true };
    }
    return {
      ...snapshot,
      content: { ...(snapshot.content || {}), favorites: { ...(snapshot.content?.favorites || {}), news: favorites } },
    };
  }
  if (command.type === "information.sourceCreate") {
    if (!response?.source?.id) return snapshot;
    return {
      ...snapshot,
      content: {
        ...(snapshot.content || {}),
        sources: {
          ...(snapshot.content?.sources || {}),
          news: {
            ...(snapshot.content?.sources?.news || {}),
            [response.source.id]: response.source,
          },
        },
      },
    };
  }
  if (command.type === "information.sourceUpdate") {
    const sources = { ...(snapshot.content?.sources?.news || {}) };
    if (sources[command.sourceId]) {
      sources[command.sourceId] = { ...sources[command.sourceId], ...command.source, ...(response?.source || {}) };
    }
    return {
      ...snapshot,
      content: { ...(snapshot.content || {}), sources: { ...(snapshot.content?.sources || {}), news: sources } },
    };
  }
  if (command.type === "information.refresh" && Array.isArray(response?.items)) {
    return {
      ...snapshot,
      content: {
        ...(snapshot.content || {}),
        items: {
          ...(snapshot.content?.items || {}),
          news: Object.fromEntries(response.items.map((item) => [String(item.id), item])),
        },
      },
    };
  }
  if (command.type === "information.sourceDelete") {
    const sources = { ...(snapshot.content?.sources?.news || {}) };
    const items = { ...(snapshot.content?.items?.news || {}) };
    delete sources[command.sourceId];
    Object.entries(items).forEach(([id, item]) => {
      if (item?.source_id === command.sourceId) delete items[id];
    });
    return {
      ...snapshot,
      content: {
        ...(snapshot.content || {}),
        sources: { ...(snapshot.content?.sources || {}), news: sources },
        items: { ...(snapshot.content?.items || {}), news: items },
      },
    };
  }
  if (command.type === "today.saveRecord") {
    return replaceRecord(snapshot, command.date, response?.record || {
      date: command.date,
      payload: command.payload,
    });
  }
  if (command.type === "demo.onboarding.setCollapsed") {
    return {
      ...snapshot,
      onboarding: { ...(snapshot.onboarding || {}), collapsed: Boolean(command.collapsed) },
    };
  }
  if (command.type === "demo.onboarding.markPeriodReviewOpened") {
    return {
      ...snapshot,
      onboarding: { ...(snapshot.onboarding || {}), periodReviewOpened: true },
    };
  }
  if (command.type === "today.createTask") {
    const task = response?.task;
    if (!task) {
      return snapshot;
    }
    return {
      ...snapshot,
      tasks: [...(snapshot.tasks || []), task],
    };
  }
  if (command.type === "today.updateTask") {
    const task = response?.task || { id: command.taskId, ...toTaskPatch(command.payload) };
    return {
      ...snapshot,
      tasks: (snapshot.tasks || []).map((item) => (
        String(item?.id) === String(command.taskId) ? { ...item, ...task } : item
      )),
    };
  }
  if (command.type === "today.deleteTask") {
    return {
      ...snapshot,
      tasks: (snapshot.tasks || []).filter((item) => String(item?.id) !== String(command.taskId)),
      dailyRecords: Object.fromEntries(
        Object.entries(snapshot.dailyRecords || {}).map(([date, record]) => [
          date,
          {
            ...record,
            payload: {
              ...(record?.payload || {}),
              tasks: Object.fromEntries(
                Object.entries(record?.payload?.tasks || {}).filter(([taskId]) => taskId !== String(command.taskId)),
              ),
            },
          },
        ]),
      ),
    };
  }
  if (command.type === "periodReview.saveWeeklySummary") {
    const summary = response?.summary || {
      week: command.week,
      content: command.content,
      updatedAt: command.updatedAt,
    };
    return {
      ...snapshot,
      weeklySummaries: {
        ...(snapshot.weeklySummaries || {}),
        [command.week]: {
          week: command.week,
          content: String(summary?.content ?? command.content),
          updatedAt: String(summary?.updatedAt || command.updatedAt || ""),
        },
      },
    };
  }
  return snapshot;
}

export const views = {
  today({ date } = {}) {
    return { type: "today", date: String(date || "") };
  },
  information() {
    return { type: "information" };
  },
  periodReviewFacts() {
    return { type: "periodReviewFacts" };
  },
  home() {
    return { type: "home" };
  },
};

export function createStateContinuity({ adapter: fixedAdapter, adapters = null } = {}) {
  const selectedAdapters = adapters || (fixedAdapter ? null : {
    demo: createDemoStateAdapter(),
    account: createAccountStateAdapter(),
  });
  const fallbackAdapter = fixedAdapter || null;
  let current = null;
  let generation = 0;

  function selectAdapter(identity) {
    const selected = selectedAdapters
      ? (identity.demo ? selectedAdapters.demo : selectedAdapters.account)
      : fallbackAdapter;
    if (!selected) {
      throw new Error(`Missing ${identity.demo ? "Demo" : "account"} state continuity adapter`);
    }
    return selected;
  }

  function closeCurrent({ purge = false } = {}) {
    if (!current) {
      return;
    }
    const record = current;
    record.closed = true;
    generation += 1;
    current = null;
    if (purge) {
      record.adapter.purge(record.identity);
    }
  }

  function open(identity) {
    const normalizedIdentity = normalizeIdentity(identity);
    if (!normalizedIdentity.id) {
      throw new Error("State continuity requires an identity");
    }
    if (current && current.identity.id === normalizedIdentity.id && current.identity.demo === normalizedIdentity.demo) {
      return current.scope;
    }

    closeCurrent();

    const adapter = selectAdapter(normalizedIdentity);

    adapter.begin?.(normalizedIdentity);

    generation += 1;
    const initialSnapshot = clone(adapter.load(normalizedIdentity) || createEmptySnapshot());
    const initialSupplemental = clone(initialSnapshot.home || {});
    delete initialSnapshot.home;
    initialSnapshot.preferences = Object.keys(initialSnapshot.preferences || {}).length
      ? clone(initialSnapshot.preferences)
      : clone(normalizedIdentity.preferences || {});
    const state = reactive({
      snapshot: initialSnapshot,
      freshness: "empty",
      activity: "idle",
      issue: null,
      draftRevision: 0,
      supplemental: initialSupplemental,
    });
    const record = {
      identity: normalizedIdentity,
      adapter,
      generation,
      state,
      closed: false,
      synced: false,
      syncPromise: null,
      operationPromise: Promise.resolve(),
      confirmedSnapshot: null,
      pendingChanges: [],
      listeners: new Set(),
      scope: null,
    };
    state.freshness = adapter.freshness
      || (adapter.hasData(state.snapshot) ? "cached" : "empty");
    record.confirmedSnapshot = clone(state.snapshot);

    function isCurrent() {
      return current === record && !record.closed && record.generation === generation;
    }

    function applyPendingChanges() {
      state.snapshot = record.pendingChanges.reduce(
        (snapshot, change) => applyCommand(snapshot, change.command, change.response || {}),
        clone(record.confirmedSnapshot),
      );
      record.listeners.forEach((listener) => listener());
    }

    function updateActivity() {
      if (!isCurrent()) {
        return;
      }
      if (record.pendingChanges.length) {
        state.activity = "changing";
      } else if (record.syncPromise) {
        state.activity = "syncing";
      } else {
        state.activity = "idle";
      }
    }

    function enqueue(operation) {
      const queued = record.operationPromise.then(operation, operation);
      record.operationPromise = queued.catch(() => {});
      return queued;
    }

    async function sync(force = false) {
      if (!isCurrent()) {
        return state.snapshot;
      }
      if (!force && record.synced) {
        return state.snapshot;
      }
      if (record.syncPromise) {
        return record.syncPromise;
      }

      state.issue = null;
      const operationGeneration = record.generation;
      let queued;
      const execute = async () => {
        if (!isCurrent() || operationGeneration !== generation || operationGeneration !== record.generation) {
          return state.snapshot;
        }
        try {
          const result = await adapter.sync(record.identity, { force });
          if (!isCurrent() || operationGeneration !== generation || operationGeneration !== record.generation) {
            return state.snapshot;
          }
          const snapshot = adapter.commitSync
            ? adapter.commitSync(record.identity, result)
            : result;
          record.confirmedSnapshot = {
            ...clone(snapshot || createEmptySnapshot()),
            preferences: clone(record.confirmedSnapshot?.preferences || state.snapshot.preferences || {}),
          };
          delete record.confirmedSnapshot.home;
          applyPendingChanges();
          state.freshness = adapter.freshness || "confirmed";
          state.issue = null;
          record.synced = true;
          return state.snapshot;
        } catch (error) {
          if (isCurrent() && operationGeneration === generation && operationGeneration === record.generation) {
            state.issue = adapter.hasData(record.confirmedSnapshot) ? "offline" : "error";
          }
          throw error;
        } finally {
          if (isCurrent() && operationGeneration === generation && operationGeneration === record.generation) {
            if (record.syncPromise === queued) {
              record.syncPromise = null;
            }
            updateActivity();
          }
        }
      };
      queued = enqueue(execute);
      record.syncPromise = queued;
      updateActivity();
      return queued;
    }

    function change(callback) {
      const command = callback({
        today: {
          saveRecord: (date, payload) => ({ type: "today.saveRecord", date, payload }),
          createTask: (payload) => ({ type: "today.createTask", payload }),
          updateTask: (taskId, payload) => ({
            type: "today.updateTask",
            taskId,
            payload: preserveLegacyArchiveEvent(state.snapshot, taskId, payload),
          }),
          deleteTask: (taskId) => ({ type: "today.deleteTask", taskId }),
          updateTaskPreferences: (taskId, patch) => ({ type: "today.updateTaskPreferences", taskId, patch }),
          saveDrafts: (date, drafts) => ({ type: "today.saveDrafts", date, drafts }),
        },
        information: {
          toggleFavorite: (item) => ({ type: "information.toggleFavorite", ...item }),
          toggleRead: (itemRef, internalItemId) => ({
            type: "information.toggleRead",
            itemRef,
            internalItemId,
            read: !Boolean(state.snapshot.preferences?.content?.readItems?.[itemRef]),
            changedAt: new Date().toISOString(),
          }),
          markRead: (itemRef, internalItemId) => ({
            type: "information.markRead",
            itemRef,
            internalItemId,
            read: true,
            changedAt: new Date().toISOString(),
          }),
          setSourceHidden: (sourceId, hidden) => ({ type: "information.setSourceHidden", sourceId, hidden }),
          sourceCreate: (source) => ({ type: "information.sourceCreate", source }),
          sourceUpdate: (sourceId, source) => ({ type: "information.sourceUpdate", sourceId, source }),
          sourceDelete: (sourceId) => ({ type: "information.sourceDelete", sourceId }),
          refresh: () => ({ type: "information.refresh" }),
        },
        periodReview: {
          saveWeeklySummary: (week, content, updatedAt) => ({
            type: "periodReview.saveWeeklySummary",
            week,
            content,
            updatedAt,
          }),
        },
        demo: {
          setOnboardingCollapsed: (collapsed) => ({ type: "demo.onboarding.setCollapsed", collapsed }),
          markPeriodReviewOpened: () => ({ type: "demo.onboarding.markPeriodReviewOpened" }),
        },
        preferences: {
          replace: (preferences) => ({ type: "preferences.replace", preferences }),
          merge: (patch) => ({ type: "preferences.merge", patch }),
        },
      });
      if (!command || typeof command.type !== "string") {
        throw new Error("State continuity changes require a domain operation");
      }
      if (command.type === "today.saveDrafts") {
        if (isCurrent()) {
          adapter.saveDrafts(record.identity, command.date, clone(command.drafts || {}));
          state.draftRevision += 1;
        }
        return Promise.resolve(null);
      }

      const pendingChange = { command, response: null };
      const operationGeneration = record.generation;
      record.pendingChanges.push(pendingChange);

      applyPendingChanges();
      updateActivity();
      state.issue = null;

      const execute = async () => {
        if (!isCurrent() || operationGeneration !== generation || operationGeneration !== record.generation) {
          return null;
        }
        try {
          const preparedCommand = isPreferenceCommand(command)
            ? { ...command, preferences: applyCommand(record.confirmedSnapshot, command).preferences }
            : command;
          const response = await adapter.write(record.identity, preparedCommand);
          if (!isCurrent() || operationGeneration !== generation || operationGeneration !== record.generation) {
            return null;
          }
          record.confirmedSnapshot = applyCommand(record.confirmedSnapshot, command, response);
          record.pendingChanges = record.pendingChanges.filter((change) => change !== pendingChange);
          applyPendingChanges();
          state.freshness = adapter.freshness || "confirmed";
          adapter.saveConfirmed?.(record.identity, record.confirmedSnapshot);
          if (command.type.startsWith("information.")) {
            record.synced = false;
          }
          return response;
        } catch (error) {
          if (isCurrent() && operationGeneration === generation && operationGeneration === record.generation) {
            record.pendingChanges = record.pendingChanges.filter((change) => change !== pendingChange);
            applyPendingChanges();
            state.issue = "error";
          }
          throw error;
        } finally {
          if (isCurrent() && operationGeneration === generation && operationGeneration === record.generation) {
            updateActivity();
          }
        }
      };

      return enqueue(execute);
    }

    function resetState({ purge = false } = {}) {
      if (!isCurrent()) {
        return false;
      }
      generation += 1;
      record.generation = generation;
      record.synced = false;
      record.syncPromise = null;
      record.operationPromise = Promise.resolve();
      record.pendingChanges = [];
      record.confirmedSnapshot = {
        ...createEmptySnapshot(),
        preferences: clone(state.snapshot.preferences || {}),
      };
      state.snapshot = clone(record.confirmedSnapshot);
      state.supplemental = {};
      state.freshness = adapter.freshness || "empty";
      state.activity = "idle";
      state.issue = null;
      state.draftRevision += 1;
      record.listeners.forEach((listener) => listener());
      if (purge) {
        adapter.purge(record.identity);
      }
      return true;
    }

    function destructiveAccountOperation(operation) {
      const operationGeneration = record.generation;
      return enqueue(async () => {
        if (!isCurrent() || operationGeneration !== generation || operationGeneration !== record.generation) {
          return false;
        }
        await operation();
        if (!isCurrent() || operationGeneration !== generation || operationGeneration !== record.generation) {
          return false;
        }
        resetState({ purge: true });
        return true;
      });
    }

    const scope = {
      view(view) {
        if (view?.type !== "today" && view?.type !== "information" && view?.type !== "periodReviewFacts" && view?.type !== "home") {
          throw new Error("Unknown state continuity view");
        }
        const projection = {};
        Object.defineProperties(projection, {
          data: {
            enumerable: true,
            get: () => {
              if (view.type === "information") {
                return getInformationData(state.snapshot);
              }
              if (view.type === "periodReviewFacts") {
                return getPeriodReviewFacts(state.snapshot);
              }
              if (view.type === "home") {
                return getHomeData(state.snapshot, state.supplemental);
              }
              state.draftRevision;
              return getTodayData(state.snapshot, view.date, adapter.loadDrafts(record.identity, view.date));
            },
          },
          freshness: { enumerable: true, get: () => state.freshness },
          activity: { enumerable: true, get: () => state.activity },
          issue: { enumerable: true, get: () => state.issue },
        });
        return readonly(projection);
      },
      change,
      supplemental: {
        beginHomeUpdate() {
          const operationGeneration = record.generation;
          return (patch) => {
            if (!isCurrent() || operationGeneration !== generation || operationGeneration !== record.generation) {
              return false;
            }
            state.supplemental = { ...(state.supplemental || {}), ...(clone(patch || {})) };
            record.listeners.forEach((listener) => listener());
            adapter.saveSupplemental?.(record.identity, patch);
            return true;
          };
        },
      },
      observe(listener) {
        if (typeof listener !== "function") return () => {};
        record.listeners.add(listener);
        listener();
        return () => record.listeners.delete(listener);
      },
      control: {
        sync: () => sync(false),
        refresh: () => sync(true),
        reset: resetState,
        clearAccountData: () => destructiveAccountOperation(() => adapter.clearAccountData(record.identity)),
        deleteAccount: (password) => destructiveAccountOperation(() => adapter.deleteAccount(record.identity, password)),
        close({ purge = false } = {}) {
          if (!isCurrent()) {
            return;
          }
          closeCurrent({ purge });
        },
      },
    };
    record.scope = scope;
    current = record;
    return scope;
  }

  function transition(identity, { purgePrevious = false } = {}) {
    const normalizedIdentity = normalizeIdentity(identity || {});
    if (!normalizedIdentity.id) {
      closeCurrent({ purge: purgePrevious });
      return null;
    }
    const sameIdentity = current
      && current.identity.id === normalizedIdentity.id
      && current.identity.demo === normalizedIdentity.demo;
    if (sameIdentity && Object.hasOwn(identity || {}, "preferences")) {
      current.confirmedSnapshot = {
        ...current.confirmedSnapshot,
        preferences: clone(normalizedIdentity.preferences),
      };
      current.state.snapshot = current.pendingChanges.reduce(
        (snapshot, change) => applyCommand(snapshot, change.command, change.response || {}),
        clone(current.confirmedSnapshot),
      );
      current.listeners.forEach((listener) => listener());
      return current.scope;
    }
    if (!sameIdentity && current) {
      closeCurrent({ purge: purgePrevious });
    }
    return open(normalizedIdentity);
  }

  return { open, transition };
}

export const stateContinuity = createStateContinuity();
