// File: js/ui/window.js (Versiune finală, simplificată și corectată)

const windowHTML = `
    <div class="glow-container">
        <main class="container" tabindex="0">
            <div class="terminal-header" style="cursor: grab;">
                <div class="title">
                    <span class="title-icon"></span>
                    {title} (PID: {pid})
                </div>
                <div class="buttons">
                    <span class="btn minimize"></span>
                    <span class="btn maximize"></span>
                    <span class="btn close"></span>
                </div>
            </div>
            <div class="window-content">
                </div>
        </main>
    </div>
`;

export class Window {
    constructor(pid, options = {}) {
        this.pid = pid;
        this.options = {
            title: options.title || 'Untitled',
            v_offset: (pid - 1) * 25,
            h_offset: (pid - 1) * 25,
        };

        // 1. Creează și configurează elementul rădăcină
        this.element = document.createElement('div');
        this.element.id = `process-${this.pid}`;
        this.element.style.position = 'absolute';
        this.element.style.width = '70vw';
        this.element.style.height = '80vh';
        this.element.style.top = `calc(50% - 40vh + ${this.options.v_offset}px)`;
        this.element.style.left = `calc(50% - 35vw + ${this.options.h_offset}px)`;

        // 2. Setează structura internă folosind `innerHTML`
        this.element.innerHTML = windowHTML
            .replace(/{pid}/g, this.pid)
            .replace('{title}', this.options.title);

        // 3. Găsește zona de conținut
        this.contentElement = this.element.querySelector('.window-content');
        
        // 4. Adaugă elementul la desktop și fă-l "draggable"
        const desktop = document.getElementById('desktop');
        if (desktop) {
            desktop.appendChild(this.element);
            this._makeDraggable();
        } else {
            console.error("Fatal Error: #desktop element not found. Window cannot be created.");
        }
    }

    _makeDraggable() {
        const header = this.element.querySelector('.terminal-header');
        const draggableElement = this.element;

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - initialX;
            const dy = moveEvent.clientY - initialY;
            draggableElement.style.top = `${startTop + dy}px`;
            draggableElement.style.left = `${startLeft + dx}px`;
        };

        const onMouseUp = () => {
            header.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        let initialX, initialY, startTop, startLeft;

        header.addEventListener('mousedown', (e) => {
            e.preventDefault();
            initialX = e.clientX;
            initialY = e.clientY;
            startTop = draggableElement.offsetTop;
            startLeft = draggableElement.offsetLeft;
            header.style.cursor = 'grabbing';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    getContentElement() {
        return this.contentElement;
    }

    close() {
        this.element.remove();
    }
}