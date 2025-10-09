// File: js/ui/windowManager.js (Fișier nou)

/**
 * Definește straturile de bază pentru z-index, permițând altor elemente
 * să se poziționeze garantat deasupra sau dedesubtul ferestrelor.
 */
const Z_INDEX_LAYERS = {
    DESKTOP: 0,
    WINDOWS: 100,
    MODALS: 1000,
    NOTIFICATIONS: 5000,
};

/**
 * Gestionează starea și ordonarea tuturor ferestrelor deschise.
 * Se asigură că z-index-urile rămân într-un interval controlat.
 */
class WindowManager {
    constructor() {
        this.windows = []; // Lista ferestrelor active, ordonată după z-index
        this.activeWindow = null;
    }

    /**
     * Înregistrează o nouă fereastră și o aduce în prim-plan.
     * @param {Window} windowInstance - Instanța ferestrei de adăugat.
     */
    register(windowInstance) {
        this.windows.push(windowInstance);
        this.focus(windowInstance);
    }

    /**
     * Șterge o fereastră din manager (la închidere).
     * @param {Window} windowInstance - Instanța ferestrei de eliminat.
     */
    unregister(windowInstance) {
        this.windows = this.windows.filter(w => w !== windowInstance);
        
        // Dacă fereastra închisă era cea activă, activăm următoarea de deasupra.
        if (this.activeWindow === windowInstance && this.windows.length > 0) {
            this.focus(this.windows[this.windows.length - 1]);
        } else if (this.windows.length === 0) {
            this.activeWindow = null;
        }
    }

    /**
     * Aduce o fereastră în prim-plan și o marchează ca activă.
     * @param {Window} windowInstance - Instanța ferestrei de activat.
     */
    focus(windowInstance) {
        // Mută fereastra la finalul array-ului (cel mai mare z-index)
        const index = this.windows.indexOf(windowInstance);
        if (index !== -1) {
            this.windows.splice(index, 1);
        }
        this.windows.push(windowInstance);

        // Reordonează z-index-urile tuturor ferestrelor
        this._reorder();

        // Actualizează starea vizuală activ/inactiv
        if (this.activeWindow && this.activeWindow !== windowInstance) {
            this.activeWindow.setActive(false);
        }
        this.activeWindow = windowInstance;
        this.activeWindow.setActive(true);
    }

    /**
     * @private
     * Re-aplică secvențial z-index-urile pe baza ordinii din array.
     */
    _reorder() {
        this.windows.forEach((win, i) => {
            win.element.style.zIndex = Z_INDEX_LAYERS.WINDOWS + i;
        });
    }
}

// Exportăm o singură instanță a managerului pentru a fi folosită în toată aplicația.
export const windowManager = new WindowManager();