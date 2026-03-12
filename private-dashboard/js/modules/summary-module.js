export function createSummaryModule(deps) {
  const {
    state,
    elements,
    fetchApiJson,
    persistStateSilently,
    setSaveStatus,
    formatWeekRangeText,
    renderControls,
    renderWeeklySummaryMeta,
    getWeeklySummaryDraft,
    setWeeklySummaryMode,
    closeWeeklySummarySaveModal,
    isRemoteReady,
    markWeeklySummaryPending,
    clearWeeklySummaryPending,
  } = deps;

  function updateWeeklySummaryDraft(value) {
    state.weeklySummaryDrafts[state.selectedWeek] = value;
    renderWeeklySummaryMeta();
  }

  async function saveWeeklySummary() {
    const currentWeek = state.selectedWeek;
    const content =
      elements.weeklySummaryInput && !elements.weeklySummaryInput.hidden
        ? String(elements.weeklySummaryInput.value || "").trim()
        : getWeeklySummaryDraft(currentWeek).trim();
    const summary = {
      content,
      updatedAt: new Date().toISOString(),
    };
    closeWeeklySummarySaveModal();
    state.data.weeklySummaries[currentWeek] = summary;
    state.weeklySummaryDrafts[currentWeek] = content;
    setWeeklySummaryMode(currentWeek, content ? "view" : "edit");
    persistStateSilently();
    renderControls();

    if (state.auth.user) {
      markWeeklySummaryPending(currentWeek, summary);
    }

    if (!isRemoteReady()) {
      setSaveStatus(state.auth.user ? "周总结已保存，已标记为待同步" : "周总结已保存");
      return;
    }

    if (state.selectedWeek === currentWeek) {
      elements.weeklySummarySave.disabled = true;
      elements.weeklySummarySave.textContent = "保存中...";
    }

    try {
      await fetchApiJson(`/api/weekly-summaries/${currentWeek}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      clearWeeklySummaryPending(currentWeek);
      setSaveStatus(`已保存 ${formatWeekRangeText(currentWeek)} 的周总结`);
    } catch (error) {
      console.warn("Failed to sync weekly summary.", error);
      setSaveStatus("周总结已保存在本地，云端同步稍后重试");
    } finally {
      if (state.selectedWeek === currentWeek) {
        elements.weeklySummarySave.disabled = false;
      }
      renderControls();
    }
  }

  function editWeeklySummary() {
    setWeeklySummaryMode(state.selectedWeek, "edit");
    renderControls();
    elements.weeklySummaryInput.focus();
    elements.weeklySummaryInput.setSelectionRange(
      elements.weeklySummaryInput.value.length,
      elements.weeklySummaryInput.value.length,
    );
  }

  return {
    updateWeeklySummaryDraft,
    saveWeeklySummary,
    editWeeklySummary,
  };
}
