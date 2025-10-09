// File: js/ui/window.js
import { windowManager } from './windowManager.js';
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';

const windowHTML = `
  <div class="glow-container">
    <main class="container" tabindex="0">
      <div class="terminal-header">
        <div class="title">
          <span class="title-icon"></span>
          <span class="title-text">{title}</span> <span class="pid-text">(PID: {pid})</span>
        </div>
        <div class="buttons">
          <button type="button" class="btn minimize" aria-label="Minimize"></button>
          <button type="button" class="btn maximize" aria-label="Maximize"></button>
          <button type="button" class="btn close" aria-label="Close"></button>
        </div>
      </div>
      <div class="window-content" role="region" aria-label="Window content"></div>
      <div class="resize-handle s" data-handle="s"></div>
      <div class="resize-handle e" data-handle="e"></div>
      <div class="resize-handle se" data-handle="se"></div>
    </main>
  </div>
`;

export class Window {
  constructor(pid, options = {}) {
    if (typeof pid !== 'number' || !Number.isFinite(pid) || pid < 0) {
      throw new TypeError('pid must be a non-negative finite number');
    }

    this.pid = pid;
    this.options = {
      title: typeof options.title === 'string' ? options.title : 'Untitled',
      v_offset: typeof options.v_offset === 'number' ? options.v_offset : (pid - 1) * 25,
      h_offset: typeof options.h_offset === 'number' ? options.h_offset : (pid - 1) * 25,
    };

    this.isMaximized = false;
    this.previousState = {};
    this._bound = new Map();

    try {
      this._createDOM();
      this._appendDOM();
      this._bindEvents();

      windowManager.register(this);
      logger.info(`[PID ${this.pid}] Window successfully initialized.`);
    } catch (err) {
      logger.error(`[PID ${this.pid}] Window initialization failed:`, err?.message || err);
      throw err;
    }
  }

  static _escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _createDOM() {
    this.element = document.createElement('div');
    this.element.id = `process-${this.pid}`;
    this.element.className = 'app-window';
    this.element.style.position = 'absolute';
    this.element.style.width = '70vw';
    this.element.style.height = '80vh';

    const vOff = Number(this.options.v_offset) || 0;
    const hOff = Number(this.options.h_offset) || 0;
    this.element.style.top = `calc(50% - 40vh + ${vOff}px)`;
    this.element.style.left = `calc(50% - 35vw + ${hOff}px)`;

    const safeHTML = windowHTML
      .replace('{pid}', Window._escapeHTML(this.pid))
      .replace('{title}', Window._escapeHTML(this.options.title));

    this.element.innerHTML = safeHTML;

    this.contentElement = this.element.querySelector('.window-content');
    this.headerElement = this.element.querySelector('.terminal-header');
    this.closeButton = this.element.querySelector('.btn.close');
    this.maximizeButton = this.element.querySelector('.btn.maximize');
    this.minimizeButton = this.element.querySelector('.btn.minimize');
    this.resizeHandles = Array.from(this.element.querySelectorAll('.resize-handle'));

    this.element.dataset.pid = String(this.pid);
  }

  _appendDOM() {
    const desktop = document.getElementById('desktop');
    if (!desktop) {
      throw new Error('Fatal: #desktop element not found. Cannot create window.');
    }
    desktop.appendChild(this.element);
  }

  _bindEvents() {
    const focusHandler = () => windowManager.focus(this);
    this._bound.focusHandler = focusHandler;
    this.element.addEventListener('mousedown', focusHandler);

    const closeHandler = (e) => {
      e.stopPropagation();
      this._handleClose();
    };
    this._bound.closeHandler = closeHandler;
    this.closeButton.addEventListener('click', closeHandler);

    const maxHandler = (e) => {
      e.stopPropagation();
      this._handleMaximize();
    };
    this._bound.maxHandler = maxHandler;
    this.maximizeButton.addEventListener('click', maxHandler);

    this._makeDraggable();
    this._makeResizable();

    const keyHandler = (e) => {
      if (e.key === 'Escape' && document.activeElement && this.element.contains(document.activeElement)) {
        this._handleClose();
      }
    };
    this._bound.keyHandler = keyHandler;
    this.element.addEventListener('keydown', keyHandler);
  }

  _handleClose() {
    try {
      new Promise((resolve, reject) => {
        eventBus.emit('proc.kill', { pid: this.pid, resolve, reject });
      }).catch((error) => {
        logger.error(`[PID ${this.pid}] Failed to kill process:`, error?.message || error);
      });
    } catch (err) {
      logger.error(`[PID ${this.pid}] Error emitting proc.kill:`, err?.message || err);
    }
  }

  _handleMaximize() {
    try {
      if (this.isMaximized) {
        const ps = this.previousState || {};
        Object.assign(this.element.style, ps);
        this.element.classList.remove('maximized');
        this.headerElement.style.cursor = 'grab';
      } else {
        this.previousState = {
          top: this.element.style.top,
          left: this.element.style.left,
          width: this.element.style.width,
          height: this.element.style.height,
        };
        Object.assign(this.element.style, {
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
        });
        this.element.classList.add('maximized');
        this.headerElement.style.cursor = 'default';
      }
      this.isMaximized = !this.isMaximized;
      logger.debug(`[PID ${this.pid}] Maximize toggled: ${this.isMaximized}`);
    } catch (err) {
      logger.error(`[PID ${this.pid}] Maximize failed:`, err?.message || err);
    }
  }

  _makeDraggable() {
    const draggableElement = this.element;
    let initialX = 0, initialY = 0, startTop = 0, startLeft = 0;

    const onMouseMove = (moveEvent) => {
      if (!moveEvent || typeof moveEvent.clientX !== 'number') return;
      const dx = moveEvent.clientX - initialX;
      const dy = moveEvent.clientY - initialY;
      draggableElement.style.top = `${startTop + dy}px`;
      draggableElement.style.left = `${startLeft + dx}px`;
    };

    const onMouseUp = () => {
      draggableElement.classList.remove('is-dragging');
      if (!this.isMaximized) this.headerElement.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    const onMouseDown = (e) => {
      if (this.isMaximized) return;
      e.preventDefault();
      initialX = e.clientX;
      initialY = e.clientY;
      startTop = draggableElement.offsetTop;
      startLeft = draggableElement.offsetLeft;
      draggableElement.classList.add('is-dragging');
      this.headerElement.style.cursor = 'grabbing';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    this._bound.dragMouseDown = onMouseDown;
    this.headerElement.addEventListener('mousedown', onMouseDown);
  }

  _makeResizable() {
    const MIN_WIDTH = 300, MIN_HEIGHT = 200;
    let initialPos = { x: 0, y: 0 }, initialSize = { width: 0, height: 0 }, currentHandle = null;

    const onResize = (e) => {
      if (!e || typeof e.clientX !== 'number') return;
      const dx = e.clientX - initialPos.x;
      const dy = e.clientY - initialPos.y;
      if (!currentHandle) return;

      const handle = currentHandle.dataset.handle;
      if (handle === 'se') {
        this.element.style.width = `${Math.max(MIN_WIDTH, initialSize.width + dx)}px`;
        this.element.style.height = `${Math.max(MIN_HEIGHT, initialSize.height + dy)}px`;
      } else if (handle === 's') {
        this.element.style.height = `${Math.max(MIN_HEIGHT, initialSize.height + dy)}px`;
      } else if (handle === 'e') {
        this.element.style.width = `${Math.max(MIN_WIDTH, initialSize.width + dx)}px`;
      }
    };

    const onResizeEnd = () => {
      this.element.classList.remove('is-resizing');
      currentHandle = null;
      document.removeEventListener('mousemove', onResize);
      document.removeEventListener('mouseup', onResizeEnd);
    };

    this.resizeHandles.forEach((handle) => {
      const onHandleDown = (e) => {
        if (this.isMaximized) return;
        e.preventDefault();
        e.stopPropagation();
        currentHandle = handle;
        initialPos = { x: e.clientX, y: e.clientY };
        initialSize = {
          width: this.element.offsetWidth,
          height: this.element.offsetHeight,
        };
        this.element.classList.add('is-resizing');
        document.addEventListener('mousemove', onResize);
        document.addEventListener('mouseup', onResizeEnd);
      };
      const key = `resizeDown_${handle.dataset.handle}`;
      this._bound[key] = onHandleDown;
      handle.addEventListener('mousedown', onHandleDown);
    });
  }

  setActive(isActive) {
    this.element.classList.toggle('active', Boolean(isActive));
    logger.debug(`[PID ${this.pid}] Active state = ${Boolean(isActive)}`);
  }

  getContentElement() {
    return this.contentElement;
  }

  close() {
    try {
      windowManager.unregister(this);
      logger.info(`[PID ${this.pid}] Unregistered from windowManager.`);
    } catch (err) {
      logger.warn(`[PID ${this.pid}] windowManager.unregister failed:`, err?.message || err);
    }

    try {
      if (this._bound.focusHandler) this.element.removeEventListener('mousedown', this._bound.focusHandler);
      if (this._bound.closeHandler) this.closeButton.removeEventListener('click', this._bound.closeHandler);
      if (this._bound.maxHandler) this.maximizeButton.removeEventListener('click', this._bound.maxHandler);
      if (this._bound.keyHandler) this.element.removeEventListener('keydown', this._bound.keyHandler);
      if (this._bound.dragMouseDown) this.headerElement.removeEventListener('mousedown', this._bound.dragMouseDown);

      this.resizeHandles.forEach((handle) => {
        const key = `resizeDown_${handle.dataset.handle}`;
        const fn = this._bound[key];
        if (fn) handle.removeEventListener('mousedown', fn);
      });
    } catch (err) {
      logger.warn(`[PID ${this.pid}] Cleanup warning:`, err?.message || err);
    }

    if (this.element?.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    logger.info(`[PID ${this.pid}] Window closed and removed from DOM.`);
  }
}
