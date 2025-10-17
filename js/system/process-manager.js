// File: js/system/process-manager.js
import { Window } from '../ui/window.js';
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from '../kernel/syscalls.js';

/**
 * Process Manager - improved & resilient implementation
 * - Uses event delegation for table actions
 * - Guards against concurrent updates
 * - Uses timeouts for syscalls
 * - Listens to kernel events for live updates
 */

const SYS_TIMEOUT_MS = 2500; // timeout for syscalls to avoid UI hangs
const AUTO_REFRESH_MS = 1000;

export const process = {
  async start({ pid }) {
    if (typeof pid !== 'number' || !Number.isFinite(pid) || pid < 0) {
      throw new TypeError('Invalid PID provided to process manager');
    }

    logger.info(`[PID ${pid}] Starting Process Manager...`);

    let appWindow = null;
    let autoRefreshTimer = null;
    let isUpdating = false;
    let selectedPid = null;

    // event handlers references for cleanup
    const handlers = {
      kernelRefresh: null,
      termination: null,
    };

    try {
      // create window
      appWindow = new Window(pid, { title: 'SOLUS :: PROCESS MANAGER' });
      const contentArea = appWindow.getContentElement();
      if (!contentArea) throw new Error('Window content area not found');

      // inject HTML
      contentArea.innerHTML = `
        <div class="process-manager">
          <div class="pm-toolbar">
            <button id="pm-refresh" class="pm-btn">
              <span class="pm-icon">⟳</span> Refresh
            </button>
            <button id="pm-kill" class="pm-btn pm-btn-danger" disabled>
              <span class="pm-icon">✕</span> Kill Process
            </button>
            <div class="pm-stats">
              <span id="pm-total-processes">Total: 0</span>
              <span class="pm-separator">|</span>
              <span id="pm-running-processes">Running: 0</span>
            </div>
          </div>

          <div class="pm-tabs">
            <button class="pm-tab active" data-tab="processes">Active Processes</button>
            <button class="pm-tab" data-tab="history">Process History</button>
          </div>

          <div class="pm-content">
            <div id="tab-processes" class="pm-tab-content active">
              <div id="pm-loading" class="pm-loading">Loading...</div>
              <table class="pm-table" id="pm-table-processes" style="display:none;">
                <thead>
                  <tr>
                    <th>PID</th>
                    <th>Name</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="pm-process-list"></tbody>
              </table>
              <div id="pm-no-processes" class="pm-empty" style="display: none;">
                No active processes
              </div>
            </div>

            <div id="tab-history" class="pm-tab-content">
              <div id="pm-history-loading" class="pm-loading">Loading...</div>
              <table class="pm-table" id="pm-table-history" style="display:none;">
                <thead>
                  <tr>
                    <th>PID</th>
                    <th>Name</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Exit Code</th>
                  </tr>
                </thead>
                <tbody id="pm-history-list"></tbody>
              </table>
              <div id="pm-no-history" class="pm-empty" style="display: none;">
                No process history
              </div>
            </div>
          </div>
        </div>
      `;

      // inject styles
      injectStyles(contentArea);

      // DOM refs
      const refreshBtn = contentArea.querySelector('#pm-refresh');
      const killBtn = contentArea.querySelector('#pm-kill');
      const tabs = Array.from(contentArea.querySelectorAll('.pm-tab'));
      const processListBody = contentArea.querySelector('#pm-process-list');
      const historyListBody = contentArea.querySelector('#pm-history-list');
      const totalProcessesSpan = contentArea.querySelector('#pm-total-processes');
      const runningProcessesSpan = contentArea.querySelector('#pm-running-processes');
      const loadingProcesses = contentArea.querySelector('#pm-loading');
      const tableProcesses = contentArea.querySelector('#pm-table-processes');
      const noProcesses = contentArea.querySelector('#pm-no-processes');
      const loadingHistory = contentArea.querySelector('#pm-history-loading');
      const tableHistory = contentArea.querySelector('#pm-table-history');
      const noHistory = contentArea.querySelector('#pm-no-history');

      // helper: safe syscall with timeout
      const safeSyscall = (name, params = {}) => {
        return Promise.race([
          syscall(name, params),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Syscall timeout')), SYS_TIMEOUT_MS))
        ]);
      };

      // helper: format date
      const formatDate = (date) => {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleString();
      };

      // render processes (atomic DOM update)
      const renderProcesses = (processes) => {
        if (!Array.isArray(processes) || processes.length === 0) {
          processListBody.innerHTML = '';
          noProcesses.style.display = 'block';
          tableProcesses.style.display = 'none';
          totalProcessesSpan.textContent = 'Total: 0';
          runningProcessesSpan.textContent = 'Running: 0';
          return;
        }

        noProcesses.style.display = 'none';
        tableProcesses.style.display = '';
        const runningCount = processes.filter(p => p.status === 'RUNNING').length;

        totalProcessesSpan.textContent = `Total: ${processes.length}`;
        runningProcessesSpan.textContent = `Running: ${runningCount}`;

        // build rows
        const rows = processes.map(p => {
          const isSelected = selectedPid === p.pid;
          return `
            <tr class="pm-row ${isSelected ? 'selected' : ''}" data-pid="${p.pid}">
              <td class="pm-cell-pid">${p.pid}</td>
              <td class="pm-cell-name">${escapeHtml(p.name)}</td>
              <td class="pm-cell-user">${escapeHtml(p.user || 'guest')}</td>
              <td class="pm-cell-status">
                <span class="pm-status pm-status-${String(p.status || '').toLowerCase()}">${escapeHtml(p.status || '')}</span>
              </td>
              <td class="pm-cell-actions">
                <button class="pm-action-btn pm-kill-btn" data-pid="${p.pid}">Kill</button>
              </td>
            </tr>
          `;
        }).join('');

        processListBody.innerHTML = rows;
      };

      // render history
      const renderHistory = (history) => {
        if (!Array.isArray(history) || history.length === 0) {
          historyListBody.innerHTML = '';
          noHistory.style.display = 'block';
          tableHistory.style.display = 'none';
          return;
        }

        noHistory.style.display = 'none';
        tableHistory.style.display = '';

        const recent = history.slice(-50).reverse();
        const rows = recent.map(entry => `
          <tr class="pm-row">
            <td class="pm-cell-pid">${entry.pid}</td>
            <td class="pm-cell-name">${escapeHtml(entry.name)}</td>
            <td class="pm-cell-user">${escapeHtml(entry.user || 'guest')}</td>
            <td class="pm-cell-status">
              <span class="pm-status pm-status-${String(entry.status || '').toLowerCase()}">${escapeHtml(entry.status || '')}</span>
            </td>
            <td class="pm-cell-time">${formatDate(entry.startTime)}</td>
            <td class="pm-cell-time">${formatDate(entry.endTime)}</td>
            <td class="pm-cell-exit">${entry.exitCode !== null && entry.exitCode !== undefined ? escapeHtml(String(entry.exitCode)) : 'N/A'}</td>
          </tr>
        `).join('');

        historyListBody.innerHTML = rows;
      };

      // update process list (with concurrency guard)
      const updateProcessList = async () => {
        if (isUpdating) return;
        isUpdating = true;
        loadingProcesses.style.display = '';
        tableProcesses.style.display = 'none';
        noProcesses.style.display = 'none';

        try {
          const processes = await safeSyscall('proc.list');
          renderProcesses(processes || []);
        } catch (err) {
          logger.error(`[PID ${pid}] updateProcessList failed:`, err?.message || err);
          processListBody.innerHTML = `<tr><td colspan="5" class="pm-error">Error loading processes: ${escapeHtml(err?.message || 'Unknown')}</td></tr>`;
          noProcesses.style.display = 'none';
          tableProcesses.style.display = '';
        } finally {
          loadingProcesses.style.display = 'none';
          isUpdating = false;
        }
      };

      // update history (with concurrency guard)
      const updateHistory = async () => {
        if (isUpdating) return;
        isUpdating = true;
        loadingHistory.style.display = '';
        tableHistory.style.display = 'none';
        noHistory.style.display = 'none';

        try {
          const history = await safeSyscall('proc.history');
          renderHistory(history || []);
        } catch (err) {
          logger.error(`[PID ${pid}] updateHistory failed:`, err?.message || err);
          historyListBody.innerHTML = `<tr><td colspan="7" class="pm-error">Error loading history: ${escapeHtml(err?.message || 'Unknown')}</td></tr>`;
          tableHistory.style.display = '';
        } finally {
          loadingHistory.style.display = 'none';
          isUpdating = false;
        }
      };

      // kill process function
      const killProcess = async (pidToKill) => {
        if (pidToKill === pid) {
          alert('Cannot kill the Process Manager itself!');
          return;
        }

        if (!confirm(`Are you sure you want to kill process ${pidToKill}?`)) return;

        try {
          await safeSyscall('proc.kill', { pid: pidToKill });
          logger.info(`[PID ${pid}] Successfully killed process ${pidToKill}`);
          selectedPid = null;
          killBtn.disabled = true;
          await updateProcessList();
        } catch (err) {
          logger.error(`[PID ${pid}] Failed to kill process ${pidToKill}:`, err?.message || err);
          alert(`Failed to kill process: ${err?.message || 'Unknown error'}`);
        }
      };

      // Delegated click handler for process table (select row / kill button)
      processListBody.addEventListener('click', (ev) => {
        const row = ev.target.closest('tr.pm-row');
        if (!row) return;

        const clickedPid = Number(row.dataset.pid);
        if (Number.isFinite(clickedPid)) {
          // selection (if click not on kill button)
          const isKillBtn = ev.target.closest('.pm-kill-btn');
          if (!isKillBtn) {
            // select row
            selectedPid = clickedPid;
            // update selection classes
            contentArea.querySelectorAll('.pm-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            killBtn.disabled = false;
          } else {
            // delegated kill btn click
            killProcess(clickedPid);
          }
        }
      });

      // Toolbar event handlers
      refreshBtn.addEventListener('click', async () => {
        const activeTab = contentArea.querySelector('.pm-tab.active')?.dataset.tab;
        if (activeTab === 'processes') {
          await updateProcessList();
        } else {
          await updateHistory();
        }
      });

      killBtn.addEventListener('click', async () => {
        if (selectedPid !== null) {
          await killProcess(selectedPid);
        }
      });

      // Tab switching
      tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          contentArea.querySelectorAll('.pm-tab-content').forEach(c => c.classList.remove('active'));
          contentArea.querySelector(`#tab-${tab.dataset.tab}`).classList.add('active');

          // load appropriate content
          if (tab.dataset.tab === 'processes') {
            await updateProcessList();
          } else {
            await updateHistory();
          }
        });
      });

      // Auto-refresh (only when Processes tab is active)
      autoRefreshTimer = setInterval(async () => {
        const activeTab = contentArea.querySelector('.pm-tab.active')?.dataset.tab;
        if (activeTab === 'processes') {
          await updateProcessList();
        }
      }, AUTO_REFRESH_MS);

      // kernel event-driven refresh
      handlers.kernelRefresh = async () => {
        const activeTab = contentArea.querySelector('.pm-tab.active')?.dataset.tab;
        if (activeTab === 'processes') {
          await updateProcessList();
        } else {
          await updateHistory();
        }
      };

      eventBus.on('proc.exec', handlers.kernelRefresh);
      eventBus.on('proc.kill', handlers.kernelRefresh);
      eventBus.on('proc.terminate_main', handlers.kernelRefresh);
      eventBus.on('kernel.boot_complete', handlers.kernelRefresh);

      // termination handler (when kernel asks this manager to close)
      handlers.termination = ({ pid: killPid }) => {
        if (killPid !== pid) return;
        cleanup();
      };
      eventBus.on('proc.terminate_main', handlers.termination);

      // initial load
      await updateProcessList();

      logger.info(`[PID ${pid}] Process Manager ready.`);
      // keep the process alive until termination - Window lifecyle handles visual close
      // The kernel will call proc.terminate_main to request shutdown and cleanup()

    } catch (err) {
      logger.error(`[PID ${pid}] Process Manager init failed:`, err?.message || err);
      cleanup();
    }

    // cleanup function
    function cleanup() {
      try {
        if (autoRefreshTimer) {
          clearInterval(autoRefreshTimer);
          autoRefreshTimer = null;
        }
        // remove kernel refresh listeners
        if (handlers.kernelRefresh) {
          eventBus.off('proc.exec', handlers.kernelRefresh);
          eventBus.off('proc.kill', handlers.kernelRefresh);
          eventBus.off('kernel.boot_complete', handlers.kernelRefresh);
          eventBus.off('proc.terminate_main', handlers.kernelRefresh);
        }
        if (handlers.termination) {
          eventBus.off('proc.terminate_main', handlers.termination);
        }
        // close window UI if available
        appWindow?.close?.();
      } catch (e) {
        logger.warn(`[PID ${pid}] Cleanup warning: ${e?.message || e}`);
      }
    }
  }
};

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

// Inject CSS styles (same as before, kept local to the component)
function injectStyles(container) {
  const style = document.createElement('style');
  style.textContent = `
    /* ===== MODERN PROCESS MANAGER ===== */
    .process-manager {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      background: var(--background-color);
      color: var(--text-color);
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      overflow: hidden;
      font-size: 13px;
      animation: fadeIn 0.3s ease-out;
    }

    /* ===== ENHANCED TOOLBAR ===== */
    .pm-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--header-bg);
      border-bottom: 1px solid var(--border-color);
      min-height: 48px;
      border-radius: 4px 4px 0 0;
      backdrop-filter: blur(10px);
    }

    /* ===== MODERN BUTTONS WITH MICRO-INTERACTIONS ===== */
    .pm-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--terminal-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-shadow: var(--text-glow);
      border-radius: 10px;
      position: relative;
      overflow: hidden;
    }

    .pm-btn::before {
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
      transition: left 0.5s ease;
    }

    .pm-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      border-color: var(--prompt-color);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .pm-btn:hover::before {
      left: 100%;
    }

    .pm-btn:active:not(:disabled) {
      transform: translateY(0);
      transition: transform 0.1s ease;
    }

    .pm-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none !important;
    }

    .pm-btn-danger {
      background: rgba(191, 97, 106, 0.1);
      color: var(--btn-color-close);
      border-color: rgba(191, 97, 106, 0.3);
    }

    .pm-btn-danger:hover:not(:disabled) {
      background: rgba(191, 97, 106, 0.2);
      border-color: var(--btn-color-close);
      box-shadow: 0 2px 8px rgba(191, 97, 106, 0.2);
    }

    .pm-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
    }

    .pm-btn:hover .pm-icon {
      transform: scale(1.1);
    }

    /* ===== STATS DISPLAY ===== */
    .pm-stats {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: auto;
      font-size: 12px;
      color: var(--text-color);
      opacity: 0.8;
      transition: opacity 0.2s ease;
    }

    .pm-stats:hover {
      opacity: 1;
    }

    .pm-separator {
      color: var(--border-color);
      opacity: 0.6;
    }

    /* ===== ENHANCED TABS ===== */
    .pm-tabs {
      display: flex;
      background: var(--header-bg);
      border-bottom: 1px solid var(--border-color);
      backdrop-filter: blur(10px);
    }

    .pm-tab {
      padding: 10px 20px;
      background: transparent;
      color: var(--text-color);
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0.7;
      position: relative;
    }

    .pm-tab::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 50%;
      width: 0;
      height: 2px;
      background: var(--prompt-color);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translateX(-50%);
    }

    .pm-tab:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.05);
    }

    .pm-tab.active {
      opacity: 1;
      color: var(--prompt-color);
      font-weight: 600;
    }

    .pm-tab.active::after {
      width: 100%;
    }

    /* ===== CONTENT AREA ===== */
    .pm-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0;
      background: var(--terminal-bg);
      border-radius: 0 0 4px 4px;
    }

    /* ===== SMOOTH SCROLLBAR ===== */
    .pm-content::-webkit-scrollbar {
      width: 6px;
    }

    .pm-content::-webkit-scrollbar-track {
      background: var(--scrollbar-track);
    }

    .pm-content::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
      border-radius: 3px;
      transition: background 0.3s ease;
    }

    .pm-content::-webkit-scrollbar-thumb:hover {
      background: var(--prompt-color);
    }

    /* ===== TAB CONTENT WITH TRANSITIONS ===== */
    .pm-tab-content {
      display: none;
      height: 100%;
      animation: fadeIn 0.3s ease-out;
    }

    .pm-tab-content.active {
      display: block;
    }

    /* ===== MODERN TABLE WITH ENHANCED INTERACTIONS ===== */
    .pm-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      background: var(--terminal-bg);
      border: none;
      animation: slideInUp 0.4s ease-out;
    }

    .pm-table th {
      text-align: left;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.05);
      color: var(--text-color);
      font-weight: 600;
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 10;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      backdrop-filter: blur(10px);
    }

    .pm-table td {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-color);
      transition: all 0.2s ease;
    }

    .pm-table tr:last-child td {
      border-bottom: none;
    }

    .pm-row {
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .pm-row::before {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 0;
      background: linear-gradient(90deg, var(--prompt-color), transparent);
      transition: width 0.3s ease;
      opacity: 0.1;
    }

    .pm-row:hover {
      background: rgba(0, 0, 0, 0.05);
      transform: translateX(2px);
    }

    .pm-row:hover::before {
      width: 3px;
    }

    .pm-row.selected {
      background: rgba(94, 129, 172, 0.1);
      animation: pulse 2s infinite;
    }

    .pm-cell-pid {
      color: var(--prompt-color);
      font-weight: 600;
      width: 60px;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 11px;
    }

    /* ===== ANIMATED STATUS BADGES ===== */
    .pm-status {
      display: inline-block;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid;
      border-radius: 10px;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .pm-status::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s ease;
    }

    .pm-status:hover::before {
      left: 100%;
    }

    .pm-status-running {
      background: rgba(163, 190, 140, 0.1);
      color: var(--btn-color-minimize);
      border-color: rgba(163, 190, 140, 0.3);
      animation: pulseStatus 2s infinite;
    }

    .pm-status-terminated {
      background: rgba(0, 0, 0, 0.05);
      color: var(--text-color);
      border-color: var(--border-color);
      opacity: 0.6;
    }

    .pm-status-killed {
      background: rgba(191, 97, 106, 0.1);
      color: var(--btn-color-close);
      border-color: rgba(191, 97, 106, 0.3);
    }

    .pm-status-crashed {
      background: rgba(235, 203, 139, 0.1);
      color: var(--btn-color-maximize);
      border-color: rgba(235, 203, 139, 0.3);
    }

    /* ===== ENHANCED ACTION BUTTONS ===== */
    .pm-action-btn {
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.05);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      cursor: pointer;
      font-size: 10px;
      font-weight: 600;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 10px;
      position: relative;
      overflow: hidden;
    }

    .pm-action-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
      transition: left 0.5s ease;
    }

    .pm-action-btn:hover {
      background: rgba(191, 97, 106, 0.1);
      border-color: var(--btn-color-close);
      color: var(--btn-color-close);
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(191, 97, 106, 0.2);
    }

    .pm-action-btn:hover::before {
      left: 100%;
    }

    /* ===== ANIMATED EMPTY AND LOADING STATES ===== */
    .pm-empty {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-color);
      font-size: 13px;
      opacity: 0.6;
      animation: fadeIn 0.5s ease-out;
    }

    .pm-empty::before {
      content: '📊';
      font-size: 48px;
      display: block;
      margin-bottom: 16px;
      opacity: 0.5;
      animation: bounce 2s infinite;
    }

    .pm-error {
      text-align: center;
      color: var(--btn-color-close);
      padding: 30px 20px;
      font-size: 13px;
      animation: shake 0.5s ease-out;
    }

    .pm-error::before {
      content: '⚠️';
      font-size: 32px;
      display: block;
      margin-bottom: 12px;
    }

    .pm-loading {
      padding: 40px 20px;
      text-align: center;
      color: var(--text-color);
      font-size: 13px;
      opacity: 0.7;
    }

    .pm-loading::after {
      content: '';
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid var(--border-color);
      border-top: 2px solid var(--prompt-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-left: 10px;
      vertical-align: middle;
    }

    /* ===== ANIMATION KEYFRAMES ===== */
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes pulse {
      0%, 100% {
        background: rgba(94, 129, 172, 0.1);
      }
      50% {
        background: rgba(94, 129, 172, 0.15);
      }
    }

    @keyframes pulseStatus {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(163, 190, 140, 0.4);
      }
      50% {
        box-shadow: 0 0 0 4px rgba(163, 190, 140, 0);
      }
    }

    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-5px);
      }
    }

    @keyframes shake {
      0%, 100% {
        transform: translateX(0);
      }
      25% {
        transform: translateX(-5px);
      }
      75% {
        transform: translateX(5px);
      }
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    /* ===== RESPONSIVE DESIGN ===== */
    @media (max-width: 768px) {
      .pm-toolbar {
        flex-wrap: wrap;
        gap: 6px;
      }
      
      .pm-stats {
        margin-left: 0;
        width: 100%;
        justify-content: center;
        order: 3;
        margin-top: 6px;
      }
      
      .pm-tabs {
        overflow-x: auto;
      }
      
      .pm-tab {
        padding: 8px 16px;
        white-space: nowrap;
      }
      
      .pm-table {
        font-size: 11px;
      }
      
      .pm-table th,
      .pm-table td {
        padding: 8px 12px;
      }
    }

    /* ===== ACCESSIBILITY ===== */
    @media (prefers-reduced-motion: reduce) {
      .process-manager,
      .pm-table,
      .pm-empty,
      .pm-error {
        animation: none !important;
      }
      
      .pm-btn,
      .pm-tab,
      .pm-row,
      .pm-status,
      .pm-action-btn {
        transition: none !important;
      }
      
      .pm-btn::before,
      .pm-status::before,
      .pm-action-btn::before,
      .pm-row::before {
        display: none;
      }
      
      .pm-status-running {
        animation: none !important;
      }
    }

    /* ===== DARK THEME ENHANCEMENTS ===== */
    body.dracula-theme .pm-table th,
    body.matrix-green-theme .pm-table th,
    body.neon-blade-theme .pm-table th,
    body.nord-theme .pm-table th,
    body.true-dark-theme .pm-table th {
      background: rgba(0, 0, 0, 0.2);
    }

    body.matrix-green-theme .pm-row:hover,
    body.neon-blade-theme .pm-row:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    /* ===== LIGHT THEME ENHANCEMENTS ===== */
    body.solarized-light-theme .pm-table th,
    body:not([class*="-theme"]) .pm-table th {
      background: rgba(0, 0, 0, 0.03);
    }
  `;
  container.appendChild(style);
}