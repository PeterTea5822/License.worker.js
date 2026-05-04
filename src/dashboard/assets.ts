export const DASHBOARD_HTML = `<!doctype html>
<html lang="zh-CN" class="mdui-theme-auto">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/mdui@2/mdui.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/material-icons@1.13.12/iconfont/material-icons.min.css" />
  <title>License.worker.js</title>
  <style>
    .page {
      display: none;
      flex-direction: column;
      gap: 20px;
      padding: 24px 32px;
    }
    .page.active {
      display: flex;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
    }
    .badge.ok {
      background: #d4f5d4;
      color: #1a5c1a;
    }
    .badge.deny {
      background: rgb(var(--mdui-color-error-container));
      color: #8f1a16;
    }
    .mdui-table td,
    .mdui-table th {
      border-right: none !important;
      border-left: none !important;
    }
    .mdui-table th {
      box-shadow: none !important;
    }
  </style>
</head>
<body>
  <mdui-navigation-drawer open id="sidebar">
    <div style="padding:20px 16px;display:flex;align-items:center;gap:10px;">
      <mdui-icon name="fingerprint" style="font-size:28px;color:rgb(var(--mdui-color-primary));"></mdui-icon>
      <strong>License.worker.js</strong>
    </div>
    <mdui-divider></mdui-divider>
    <mdui-list>
      <mdui-list-item active data-page="dashboard" icon="dashboard">概览</mdui-list-item>
      <mdui-list-item data-page="licenses" icon="badge">许可证管理</mdui-list-item>
      <mdui-list-item data-page="versions" icon="code">版本白名单</mdui-list-item>
      <mdui-list-item data-page="settings" icon="settings">设置</mdui-list-item>
      <mdui-list-item data-page="auth-events" icon="security">认证事件</mdui-list-item>
      <mdui-list-item data-page="audit-logs" icon="history">审计日志</mdui-list-item>
    </mdui-list>
  </mdui-navigation-drawer>

  <mdui-layout full-height>
    <mdui-top-app-bar>
      <mdui-button-icon icon="menu" id="sidebar-toggle"></mdui-button-icon>
      <mdui-top-app-bar-title id="page-title">概览</mdui-top-app-bar-title>
      <div style="flex:1"></div>
      <mdui-button-icon icon="refresh" id="refresh-btn"></mdui-button-icon>
      <mdui-button-icon icon="palette" id="palette-btn"></mdui-button-icon>
      <mdui-button-icon icon="brightness_auto" id="theme-btn"></mdui-button-icon>
    </mdui-top-app-bar>

    <mdui-layout-main>
      <section class="page active" id="page-dashboard">
        <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
          <mdui-card variant="elevated" style="padding:20px;display:flex;align-items:center;gap:14px;">
            <mdui-icon name="badge" style="font-size:28px;color:rgb(var(--mdui-color-primary));background:rgb(var(--mdui-color-primary-container));padding:10px;border-radius:12px;"></mdui-icon>
            <div>
              <p style="color:rgb(var(--mdui-color-on-surface-variant));font-size:0.8rem;margin:0 0 2px;">许可证总数</p>
              <strong id="stat-license-total" style="font-size:1.5rem;font-weight:700;">0</strong>
            </div>
          </mdui-card>
          <mdui-card variant="elevated" style="padding:20px;display:flex;align-items:center;gap:14px;">
            <mdui-icon name="verified" style="font-size:28px;color:rgb(var(--mdui-color-primary));background:rgb(var(--mdui-color-primary-container));padding:10px;border-radius:12px;"></mdui-icon>
            <div>
              <p style="color:rgb(var(--mdui-color-on-surface-variant));font-size:0.8rem;margin:0 0 2px;">活跃许可证</p>
              <strong id="stat-license-active" style="font-size:1.5rem;font-weight:700;">0</strong>
            </div>
          </mdui-card>
          <mdui-card variant="elevated" style="padding:20px;display:flex;align-items:center;gap:14px;">
            <mdui-icon name="code" style="font-size:28px;color:rgb(var(--mdui-color-primary));background:rgb(var(--mdui-color-primary-container));padding:10px;border-radius:12px;"></mdui-icon>
            <div>
              <p style="color:rgb(var(--mdui-color-on-surface-variant));font-size:0.8rem;margin:0 0 2px;">版本白名单</p>
              <strong id="stat-version-total" style="font-size:1.5rem;font-weight:700;">0</strong>
            </div>
          </mdui-card>
        </div>
        <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));">
          <mdui-card variant="outlined" style="padding:20px;display:flex;flex-direction:column;">
            <p style="margin:0 0 12px;font-size:0.85rem;font-weight:600;color:rgb(var(--mdui-color-on-surface-variant));">许可证状态分布</p>
            <div style="flex:1;display:flex;align-items:center;justify-content:center;"><div style="max-width:240px;"><canvas id="chart-license-status"></canvas></div></div>
          </mdui-card>
          <mdui-card variant="outlined" style="padding:20px;display:flex;flex-direction:column;">
            <p style="margin:0 0 12px;font-size:0.85rem;font-weight:600;color:rgb(var(--mdui-color-on-surface-variant));">认证结果统计</p>
            <div style="flex:1;display:flex;align-items:center;justify-content:center;"><canvas id="chart-auth-verdicts" height="200"></canvas></div>
          </mdui-card>
        </div>
      </section>

      <section class="page" id="page-licenses">
        <mdui-card variant="outlined" style="padding:24px;">
          <h3 style="font-size:1rem;font-weight:600;margin:0 0 4px;">创建许可证</h3>
          <p style="color:rgb(var(--mdui-color-on-surface-variant));font-size:0.82rem;margin:0 0 16px;">支持设置时长与后端备注（备注不回传到软件端）</p>
          <form id="license-form" style="display:flex;flex-wrap:wrap;gap:12px;align-items:end;">
            <mdui-text-field variant="outlined" type="number" min="1" id="license-duration" label="时长（天，可选）" placeholder="留空按默认规则"></mdui-text-field>
            <mdui-text-field variant="outlined" type="text" id="license-note" maxlength="500" label="备注（仅后端可见）" placeholder="例如：客户A / 渠道B"></mdui-text-field>
            <mdui-button variant="filled" type="submit">生成许可证</mdui-button>
          </form>
        </mdui-card>
        <mdui-card variant="outlined" style="padding:24px;">
          <h3 style="font-size:1rem;font-weight:600;margin:0 0 16px;">许可证列表</h3>
          <div style="overflow:auto;border-radius:var(--mdui-shape-corner-m);">
            <table class="mdui-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>License Key</th>
                  <th>备注</th>
                  <th>状态</th>
                  <th>设备 ID</th>
                  <th>到期时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody id="license-table-body"></tbody>
            </table>
          </div>
        </mdui-card>
      </section>

      <section class="page" id="page-versions">
        <mdui-card variant="outlined" style="padding:24px;">
          <h3 style="font-size:1rem;font-weight:600;margin:0 0 4px;">允许版本白名单</h3>
          <p style="color:rgb(var(--mdui-color-on-surface-variant));font-size:0.82rem;margin:0 0 16px;">仅允许白名单中的版本在线校验</p>
          <form id="version-form" style="display:flex;flex-wrap:wrap;gap:12px;align-items:end;">
            <mdui-text-field variant="outlined" type="text" id="version-input" label="版本号" placeholder="例如 1.2.3" required style="flex:1;min-width:140px;"></mdui-text-field>
            <mdui-button variant="tonal" type="submit">添加版本</mdui-button>
          </form>
          <div id="version-list" style="margin:14px 0 0;display:flex;flex-wrap:wrap;gap:8px;"></div>
        </mdui-card>
      </section>

      <section class="page" id="page-settings">
        <mdui-card variant="outlined" style="padding:24px;">
          <h3 style="font-size:1rem;font-weight:600;margin:0 0 4px;">全局时长设置</h3>
          <p style="color:rgb(var(--mdui-color-on-surface-variant));font-size:0.82rem;margin:0 0 16px;">默认授权有效期（天）</p>
          <form id="global-duration-form" style="display:flex;flex-wrap:wrap;gap:12px;align-items:end;">
            <mdui-text-field variant="outlined" type="number" min="1" id="global-duration" label="天数" required></mdui-text-field>
            <mdui-button variant="filled" type="submit">保存</mdui-button>
          </form>
        </mdui-card>
      </section>

      <section class="page" id="page-auth-events">
        <mdui-card variant="outlined" style="padding:24px;">
          <h3 style="font-size:1rem;font-weight:600;margin:0 0 4px;">许可证认证事件日志</h3>
          <p style="color:rgb(var(--mdui-color-on-surface-variant));font-size:0.82rem;margin:0 0 16px;">最近 300 条认证结果</p>
          <div style="overflow:auto;border-radius:var(--mdui-shape-corner-m);">
            <table class="mdui-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>许可证ID</th>
                  <th>License Key</th>
                  <th>设备ID</th>
                  <th>版本</th>
                  <th>结果</th>
                  <th>原因</th>
                  <th>IP</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody id="auth-events-table-body"></tbody>
            </table>
          </div>
        </mdui-card>
      </section>

      <section class="page" id="page-audit-logs">
        <mdui-card variant="outlined" style="padding:24px;">
          <h3 style="font-size:1rem;font-weight:600;margin:0 0 4px;">审计日志</h3>
          <p style="color:rgb(var(--mdui-color-on-surface-variant));font-size:0.82rem;margin:0 0 16px;">最近 100 条管理操作记录</p>
          <div style="overflow:auto;border-radius:var(--mdui-shape-corner-m);">
            <table class="mdui-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>操作者</th>
                  <th>操作</th>
                  <th>详情</th>
                  <th>IP</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody id="audit-logs-table-body"></tbody>
            </table>
          </div>
        </mdui-card>
      </section>
    </mdui-layout-main>
  </mdui-layout>
  <div id="palette-popover" style="position:fixed;z-index:9999;padding:16px;background:rgb(var(--mdui-color-surface-container));border-radius:var(--mdui-shape-corner-m);box-shadow:var(--mdui-elevation-level3);opacity:0;transform:scale(0.92) translateY(-8px);pointer-events:none;transition:opacity 0.2s ease,transform 0.2s ease;">
    <p style="margin:0 0 10px;font-size:0.82rem;color:rgb(var(--mdui-color-on-surface-variant));">主题配色</p>
    <div id="palette-colors" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
  </div>
  <script src="https://unpkg.com/mdui@2/mdui.global.js"></script>
  <script>
    (function(){
      var t = localStorage.getItem('qcf-theme') || 'auto';
      if (t === 'light') document.documentElement.classList.replace('mdui-theme-auto','mdui-theme-light');
      else if (t === 'dark') document.documentElement.classList.replace('mdui-theme-auto','mdui-theme-dark');
      var c = localStorage.getItem('qcf-color') || '#0d7377';
      mdui.setColorScheme(c);
    })();
  </script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <script src="/admin/app.js" defer></script>
</body>
</html>
`;

export const DASHBOARD_CSS = `.page {
  display: none;
  flex-direction: column;
  gap: 20px;
  padding: 24px 32px;
}
.page.active {
  display: flex;
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
}
.badge.ok {
  background: #d4f5d4;
  color: #1a5c1a;
}
.badge.deny {
  background: rgb(var(--mdui-color-error-container));
  color: #8f1a16;
}`;

export const DASHBOARD_JS = `var sidebar = document.getElementById("sidebar");

var pageTitles = {
  dashboard: "概览",
  licenses: "许可证管理",
  versions: "版本白名单",
  settings: "全局设置",
  "auth-events": "认证事件",
  "audit-logs": "审计日志"
};

function showSnackbar(msg, isError, actionLabel, onAction) {
  mdui.snackbar({
    message: (isError ? "错误: " : "") + msg,
    autoCloseDelay: 4000,
    ...(actionLabel && onAction ? { action: actionLabel, onActionClick: onAction } : {})
  });
}

function showMessage(msg, isError) {
  showSnackbar(msg, isError);
}

async function api(path, options = {}) {
  var res = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  var data = await res.json().catch(function() { return {}; });
  if (!res.ok) {
    throw new Error(data.message || data.code || "request failed");
  }
  return data;
}

function fmtTime(sec) {
  return new Date(sec * 1000).toLocaleString();
}

function escHtml(str) {
  if (str == null) return "-";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function navigateTo(page) {
  document.querySelectorAll("mdui-list-item[data-page]").forEach(function(el) {
    el.removeAttribute("active");
  });
  var target = document.querySelector('mdui-list-item[data-page="' + page + '"]');
  if (target) target.setAttribute("active", "");

  document.querySelectorAll(".page").forEach(function(el) {
    el.classList.remove("active");
  });
  var pageEl = document.getElementById("page-" + page);
  if (pageEl) pageEl.classList.add("active");

  document.getElementById("page-title").textContent = pageTitles[page] || page;

  if (window.innerWidth <= 820) {
    sidebar.open = false;
  }
}

// Sidebar navigation
document.querySelectorAll("mdui-list-item[data-page]").forEach(function(item) {
  item.addEventListener("click", function() {
    navigateTo(item.getAttribute("data-page"));
  });
});

// Mobile sidebar toggle
document.getElementById("sidebar-toggle").addEventListener("click", function() {
  sidebar.open = !sidebar.open;
});

function updateStats(versions, licenses) {
  var activeCount = licenses.items.filter(function(item) { return item.status === "active"; }).length;
  document.getElementById("stat-license-total").textContent = String(licenses.items.length);
  document.getElementById("stat-license-active").textContent = String(activeCount);
  document.getElementById("stat-version-total").textContent = String(versions.items.length);
}

// Charts
var licenseChart = null;
var authChart = null;

function getMduiColors() {
  var s = getComputedStyle(document.documentElement);
  return {
    primary: "rgb(" + s.getPropertyValue("--mdui-color-primary").trim() + ")",
    secondary: "rgb(" + s.getPropertyValue("--mdui-color-secondary").trim() + ")",
    tertiary: "rgb(" + s.getPropertyValue("--mdui-color-tertiary").trim() + ")",
    error: "rgb(" + s.getPropertyValue("--mdui-color-error").trim() + ")",
    outline: "rgb(" + s.getPropertyValue("--mdui-color-outline").trim() + ")",
    onSurface: "rgb(" + s.getPropertyValue("--mdui-color-on-surface").trim() + ")",
    onSurfaceVariant: "rgb(" + s.getPropertyValue("--mdui-color-on-surface-variant").trim() + ")"
  };
}

function renderCharts(licenses, authEvents) {
  var colors = getMduiColors();
  var statusCount = { active: 0, suspended: 0, revoked: 0 };
  licenses.items.forEach(function(i) { statusCount[i.status] = (statusCount[i.status] || 0) + 1; });
  var allowCount = 0, denyCount = 0;
  authEvents.items.forEach(function(e) { if (e.verdict === "ALLOW") allowCount++; else denyCount++; });

  if (!licenseChart) {
    licenseChart = new Chart(document.getElementById("chart-license-status"), {
      type: "doughnut",
      data: {
        labels: ["活跃", "暂停", "吊销"],
        datasets: [{ data: [statusCount.active, statusCount.suspended, statusCount.revoked], backgroundColor: [colors.primary, colors.secondary, colors.error], borderWidth: 0 }]
      },
      options: {
        cutout: "68%", responsive: true,
        plugins: { legend: { position: "bottom", labels: { color: colors.onSurface, padding: 14, usePointStyle: true, pointStyleWidth: 10 } } }
      }
    });
  } else {
    licenseChart.data.datasets[0].data = [statusCount.active, statusCount.suspended, statusCount.revoked];
    licenseChart.update();
  }

  if (!authChart) {
    authChart = new Chart(document.getElementById("chart-auth-verdicts"), {
      type: "bar",
      data: {
        labels: ["通过", "拒绝"],
        datasets: [{ data: [allowCount, denyCount], backgroundColor: [colors.primary, colors.error], borderRadius: 6, barThickness: 48 }]
      },
      options: {
        responsive: true, indexAxis: "y",
        scales: {
          x: { grid: { color: colors.outline + "22" }, ticks: { color: colors.onSurfaceVariant, precision: 0 } },
          y: { grid: { display: false }, ticks: { color: colors.onSurface } }
        },
        plugins: { legend: { display: false } }
      }
    });
  } else {
    authChart.data.datasets[0].data = [allowCount, denyCount];
    authChart.update();
  }
}

function updateChartColors() {
  if (licenseChart) { licenseChart.destroy(); licenseChart = null; }
  if (authChart) { authChart.destroy(); authChart = null; }
  refresh();
}

async function refresh() {
  var result = await Promise.all([
    api("/admin/api/settings"),
    api("/admin/api/versions"),
    api("/admin/api/licenses"),
    api("/admin/api/audits"),
    api("/admin/api/license-events")
  ]);
  var settings = result[0], versions = result[1], licenses = result[2], audits = result[3], authEvents = result[4];

  document.getElementById("global-duration").value = settings.globalDurationDays;
  updateStats(versions, licenses);
  renderCharts(licenses, authEvents);

  // Versions
  var versionList = document.getElementById("version-list");
  versionList.innerHTML = "";
  versions.items.forEach(function(v) {
    var chip = document.createElement("mdui-chip");
    chip.textContent = v.version;
    chip.variant = "input";
    chip.setAttribute("deletable", "");
    chip.addEventListener("delete", async function() {
      await api("/admin/api/versions/" + encodeURIComponent(v.version), { method: "DELETE" });
      await refresh();
    });
    versionList.appendChild(chip);
  });

  // Licenses table
  var tbody = document.getElementById("license-table-body");
  tbody.innerHTML = "";
  licenses.items.forEach(function(item) {
    var tr = document.createElement("tr");

    var idTd = document.createElement("td");
    idTd.textContent = String(item.id);

    var keyTd = document.createElement("td");
    keyTd.textContent = item.licenseKey;

    var noteTd = document.createElement("td");
    noteTd.textContent = item.note || "-";

    var statusTd = document.createElement("td");
    var statusSelect = document.createElement("mdui-select");
    statusSelect.variant = "outlined";
    statusSelect.style.minWidth = "110px";
    statusSelect.dataset.id = String(item.id);
    ["active", "suspended", "revoked"].forEach(function(status) {
      var menuItem = document.createElement("mdui-menu-item");
      menuItem.value = status;
      menuItem.textContent = status;
      statusSelect.appendChild(menuItem);
    });
    statusSelect.value = item.status;
    statusTd.appendChild(statusSelect);

    var deviceTd = document.createElement("td");
    deviceTd.textContent = item.boundDeviceId ? item.boundDeviceId.slice(0, 8) + "..." : "-";
    deviceTd.title = item.boundDeviceId || "";

    var expiresTd = document.createElement("td");
    expiresTd.textContent = fmtTime(item.expiresAt);

    var actionTd = document.createElement("td");
    var noteBtn = document.createElement("mdui-button");
    noteBtn.variant = "text";
    noteBtn.textContent = "备注";
    noteBtn.dataset.id = String(item.id);
    noteBtn.dataset.note = item.note || "";
    noteBtn.classList.add("note-edit-btn");
    actionTd.appendChild(noteBtn);

    tr.appendChild(idTd);
    tr.appendChild(keyTd);
    tr.appendChild(noteTd);
    tr.appendChild(statusTd);
    tr.appendChild(deviceTd);
    tr.appendChild(expiresTd);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });

  document.querySelectorAll("mdui-select[data-id]").forEach(function(el) {
    el.addEventListener("change", async function(ev) {
      var id = ev.target.dataset.id;
      var status = ev.target.value;
      await api("/admin/api/licenses/" + id, {
        method: "PATCH",
        body: JSON.stringify({ status: status })
      });
      await refresh();
    });
  });

  document.querySelectorAll(".note-edit-btn").forEach(function(el) {
    el.addEventListener("click", function() {
      var id = el.dataset.id;
      var currentNote = el.dataset.note || "";
      mdui.dialog({
        headline: "编辑备注",
        body: '<mdui-text-field variant="outlined" label="备注" value="' + escHtml(currentNote) + '" autofocus></mdui-text-field>',
        actions: [
          { text: "取消" },
          {
            text: "保存",
            onClick: async function(dialogEl) {
              var input = dialogEl.querySelector("mdui-text-field");
              var nextNote = input ? input.value : "";
              await api("/admin/api/licenses/" + id, {
                method: "PATCH",
                body: JSON.stringify({ note: nextNote })
              });
              await refresh();
              showSnackbar("备注已更新");
            }
          }
        ],
        closeOnOverlayClick: true
      });
    });
  });

  // Auth events table
  var authTbody = document.getElementById("auth-events-table-body");
  authTbody.innerHTML = "";
  authEvents.items.forEach(function(ev) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + escHtml(ev.id) + "</td>" +
      "<td>" + escHtml(ev.licenseId) + "</td>" +
      "<td>" + escHtml(ev.licenseKey) + "</td>" +
      "<td title=\\"" + escHtml(ev.deviceId) + "\\">" + escHtml(ev.deviceId ? ev.deviceId.slice(0, 8) + "..." : "-") + "</td>" +
      "<td>" + escHtml(ev.appVersion) + "</td>" +
      "<td><span class=\\"badge " + (ev.verdict === "ALLOW" ? "ok" : "deny") + "\\">" + escHtml(ev.verdict) + "</span></td>" +
      "<td>" + escHtml(ev.reasonCode) + "</td>" +
      "<td>" + escHtml(ev.ip) + "</td>" +
      "<td>" + escHtml(fmtTime(ev.createdAt)) + "</td>";
    authTbody.appendChild(tr);
  });

  // Audit logs table
  var auditTbody = document.getElementById("audit-logs-table-body");
  auditTbody.innerHTML = "";
  audits.items.forEach(function(entry) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + escHtml(entry.id) + "</td>" +
      "<td>" + escHtml(entry.actor) + "</td>" +
      "<td>" + escHtml(entry.action) + "</td>" +
      "<td><code>" + escHtml(JSON.stringify(entry.details)) + "</code></td>" +
      "<td>" + escHtml(entry.ip) + "</td>" +
      "<td>" + escHtml(fmtTime(entry.createdAt)) + "</td>";
    auditTbody.appendChild(tr);
  });
}

// Refresh button
document.getElementById("refresh-btn").addEventListener("click", async function() {
  try {
    await refresh();
    showSnackbar("数据已刷新");
  } catch (err) {
    showMessage(err.message, true);
  }
});

// Global duration form
document.getElementById("global-duration-form").addEventListener("submit", async function(ev) {
  ev.preventDefault();
  try {
    var globalDurationDays = Number(document.getElementById("global-duration").value);
    await api("/admin/api/settings", { method: "PUT", body: JSON.stringify({ globalDurationDays: globalDurationDays }) });
    showSnackbar("全局时长已保存");
  } catch (err) {
    showMessage(err.message, true);
  }
});

// Version form
document.getElementById("version-form").addEventListener("submit", async function(ev) {
  ev.preventDefault();
  try {
    var version = document.getElementById("version-input").value.trim();
    await api("/admin/api/versions", { method: "POST", body: JSON.stringify({ version: version }) });
    document.getElementById("version-input").value = "";
    await refresh();
    showSnackbar("版本已添加");
  } catch (err) {
    showMessage(err.message, true);
  }
});

// License form
document.getElementById("license-form").addEventListener("submit", async function(ev) {
  ev.preventDefault();
  try {
    var durationRaw = document.getElementById("license-duration").value;
    var note = document.getElementById("license-note").value.trim();
    await api("/admin/api/licenses", {
      method: "POST",
      body: JSON.stringify({
        durationDays: durationRaw ? Number(durationRaw) : null,
        note: note || null
      })
    });
    document.getElementById("license-duration").value = "";
    document.getElementById("license-note").value = "";
    await refresh();
    showSnackbar("许可证已创建");
  } catch (err) {
    showMessage(err.message, true);
  }
});

// Theme toggle
var themeModes = ["auto", "light", "dark"];
var themeIcons = { auto: "brightness_auto", light: "light_mode", dark: "dark_mode" };
var themeBtn = document.getElementById("theme-btn");

function getThemeMode() {
  return localStorage.getItem("qcf-theme") || "auto";
}

function setThemeMode(mode) {
  var html = document.documentElement;
  html.classList.remove("mdui-theme-auto", "mdui-theme-light", "mdui-theme-dark");
  html.classList.add("mdui-theme-" + mode);
  localStorage.setItem("qcf-theme", mode);
  themeBtn.setAttribute("icon", themeIcons[mode]);
  setTimeout(updateChartColors, 50);
}
themeBtn.setAttribute("icon", themeIcons[getThemeMode()]);

themeBtn.addEventListener("click", function() {
  var current = getThemeMode();
  var next = themeModes[(themeModes.indexOf(current) + 1) % 3];
  setThemeMode(next);
});

// Color palette
var paletteColors = [
  { name: "青色", hex: "#0d7377" },
  { name: "靛蓝", hex: "#1a73e8" },
  { name: "紫色", hex: "#6750a4" },
  { name: "粉色", hex: "#d81b60" },
  { name: "红色", hex: "#d32f2f" },
  { name: "橙色", hex: "#e65100" },
  { name: "绿色", hex: "#2e7d32" },
  { name: "蓝灰", hex: "#546e7a" }
];

var paletteBtn = document.getElementById("palette-btn");
var palettePopover = document.getElementById("palette-popover");
var paletteColorsEl = document.getElementById("palette-colors");

paletteColors.forEach(function(item) {
  var swatch = document.createElement("div");
  swatch.style.cssText = "width:32px;height:32px;border-radius:50%;cursor:pointer;border:2px solid transparent;display:flex;align-items:center;justify-content:center;";
  swatch.style.backgroundColor = item.hex;
  swatch.title = item.name;
  swatch.dataset.hex = item.hex;
  swatch.addEventListener("click", function() {
    mdui.setColorScheme(item.hex);
    localStorage.setItem("qcf-color", item.hex);
    updatePaletteSelection(item.hex);
    setTimeout(updateChartColors, 50);
    showSnackbar("已切换为" + item.name + "配色");
  });
  paletteColorsEl.appendChild(swatch);
});

function updatePaletteSelection(hex) {
  paletteColorsEl.querySelectorAll("div").forEach(function(el) {
    if (el.dataset.hex.toLowerCase() === hex.toLowerCase()) {
      el.style.borderColor = "rgb(var(--mdui-color-on-surface))";
    } else {
      el.style.borderColor = "transparent";
    }
  });
}

paletteBtn.addEventListener("click", function(e) {
  e.stopPropagation();
  if (palettePopover.style.pointerEvents === "none") {
    var rect = paletteBtn.getBoundingClientRect();
    palettePopover.style.top = (rect.bottom + 4) + "px";
    palettePopover.style.right = (window.innerWidth - rect.right) + "px";
    palettePopover.style.opacity = "1";
    palettePopover.style.transform = "scale(1) translateY(0)";
    palettePopover.style.pointerEvents = "auto";
    updatePaletteSelection(localStorage.getItem("qcf-color") || "#0d7377");
  } else {
    palettePopover.style.opacity = "0";
    palettePopover.style.transform = "scale(0.92) translateY(-8px)";
    palettePopover.style.pointerEvents = "none";
  }
});

document.addEventListener("click", function(e) {
  if (!palettePopover.contains(e.target)) {
    palettePopover.style.opacity = "0";
    palettePopover.style.transform = "scale(0.92) translateY(-8px)";
    palettePopover.style.pointerEvents = "none";
  }
});

// Auto-load data
refresh().catch(function(err) { showMessage(err.message, true); });
`;
