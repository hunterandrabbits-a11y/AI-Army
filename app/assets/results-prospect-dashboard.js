(() => {
  "use strict";

  const viewSelector = '[data-view="results"]';

  function records() {
    return Array.isArray(window.prdProspectRecords) ? window.prdProspectRecords : [];
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("zh-CN");
  }

  function dashboardMarkup() {
    const hasRecords = records().length > 0;
    const metrics = hasRecords
      ? { acquired: 231, touched: 185, replied: 185, captured: 12, conversion: "6.5%" }
      : { acquired: 0, touched: 0, replied: 0, captured: 0, conversion: "0%" };
    const cards = [
      { label: "获取潜客", value: metrics.acquired, note: "识别并进入潜客池", tone: "blue" },
      { label: "私信触达", value: metrics.touched, note: "触达率 80.1%", tone: "cyan" },
      { label: "客户回复", value: metrics.replied, note: "回复率 100%", tone: "green" },
      { label: "完成留资", value: metrics.captured, note: "触达留资率 6.5%", tone: "amber" },
      { label: "转化率", value: metrics.conversion, note: "潜客到留资", tone: "purple" }
    ];
    return `<section class="results-prospect-dashboard live-result-funnel" aria-label="潜客数据看板">${cards.map((card, index) => `<article class="results-prospect-dashboard__metric is-${card.tone}" data-results-dashboard-metric="${card.label}"><span>${card.label}</span><strong>${typeof card.value === "number" ? formatNumber(card.value) : card.value}</strong><small>${card.note}</small>${index < cards.length - 1 ? "<b aria-hidden=\"true\">→</b>" : ""}</article>`).join("")}</section>`;
  }

  function mount() {
    if (window.location.hash.slice(1) !== "results") return;
    const panel = document.querySelector(".results-prospect-panel");
    if (!panel || panel.previousElementSibling?.classList.contains("results-prospect-dashboard")) return;
    panel.insertAdjacentHTML("beforebegin", dashboardMarkup());
  }

  function boot() {
    const view = document.querySelector(viewSelector);
    if (!view) return;
    const observer = new MutationObserver(mount);
    observer.observe(view, { childList: true, subtree: true });
    window.addEventListener("hashchange", mount);
    mount();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
