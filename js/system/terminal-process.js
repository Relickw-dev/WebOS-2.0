// File: js/system/terminal-process.js
import { Window } from '../ui/window.js';
import { Terminal } from '../devices/terminal.js';
import { Shell } from '../shell/shell.js';
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';

export const process = {
  async start({ pid }) {
    if (typeof pid !== 'number' || !Number.isFinite(pid) || pid < 0) {
      throw new TypeError('Invalid PID provided to terminal process');
    }

    logger.info(`[PID ${pid}] Starting terminal process...`);

    let appWindow = null;
    let terminalInstance = null;
    let shellInstance = null;
    let terminationHandler = null;

    try {
      // 1️⃣ Creăm fereastra aplicației
      appWindow = new Window(pid, { title: 'SOLUS :: TERMINAL' });
      const contentArea = appWindow.getContentElement();

      if (!contentArea) {
        throw new Error(`[PID ${pid}] Window content area not found`);
      }

      // 2️⃣ HTML-ul terminalului (structura pe care Terminal o așteaptă)
      const terminalHTML = `
        <div id="terminal" class="terminal">
          <div id="terminal-output" class="terminal-output"></div>
          <div id="current-line" class="prompt-line">
            <span id="prompt" class="prompt"></span>
            <input type="text" id="terminal-input" class="terminal-input" autocomplete="off" spellcheck="false" />
            <span class="caret"></span>
          </div>
        </div>
      `;

      // 3️⃣ Injectăm HTML-ul în containerul ferestrei
      contentArea.innerHTML = terminalHTML;

      // 4️⃣ Căutăm root-ul terminalului în interiorul ferestrei (nu global)
      const terminalRoot = contentArea.querySelector('#terminal');
      if (!terminalRoot) {
        throw new Error(`[PID ${pid}] Terminal root element missing after injection.`);
      }

      // 5️⃣ Inițializăm Terminal + Shell
      terminalInstance = new Terminal(pid, terminalRoot);
      shellInstance = new Shell(terminalInstance);
      terminalInstance.connectShell(shellInstance);

      logger.info(`[PID ${pid}] Terminal UI initialized successfully.`);

      // 6️⃣ Înregistrăm handler pentru oprirea procesului
      terminationHandler = ({ pid: killPid }) => {
        if (killPid !== pid) return;

        logger.info(`[PID ${pid}] Termination signal received, starting cleanup.`);

        try {
          terminalInstance?.destroy?.();
          logger.debug(`[PID ${pid}] Terminal instance destroyed.`);
        } catch (e) {
          logger.warn(`[PID ${pid}] terminal.destroy() failed:`, e?.message || e);
        }

        try {
          appWindow?.close?.();
          logger.debug(`[PID ${pid}] Window closed successfully.`);
        } catch (e) {
          logger.warn(`[PID ${pid}] appWindow.close() failed:`, e?.message || e);
        }

        try {
          eventBus.off('proc.terminate_main', terminationHandler);
          logger.debug(`[PID ${pid}] Unsubscribed from terminate event.`);
        } catch (e) {
          logger.warn(`[PID ${pid}] Failed to unregister termination handler:`, e?.message || e);
        }
      };

      eventBus.on('proc.terminate_main', terminationHandler);
      logger.info(`[PID ${pid}] Terminal process ready.`);
    } catch (err) {
      logger.error(`[PID ${pid}] Terminal init failed:`, err?.message || err);

      // Cleanup defensiv în caz de eroare
      try {
        terminalInstance?.destroy?.();
        logger.debug(`[PID ${pid}] Cleanup: terminalInstance destroyed.`);
      } catch (_) {}

      try {
        if (terminationHandler) eventBus.off('proc.terminate_main', terminationHandler);
      } catch (_) {}

      try {
        appWindow?.close?.();
        logger.debug(`[PID ${pid}] Cleanup: appWindow closed.`);
      } catch (_) {}
    }
  },
};
