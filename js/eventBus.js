// File: js/eventBus.js
const handlers = new Map();

export const eventBus = {
    on: (eventName, handler) => {
        if (!handlers.has(eventName)) {
            handlers.set(eventName, []);
        }
        handlers.get(eventName).push(handler);
    },
    emit: (eventName, data) => {
        const eventHandlers = handlers.get(eventName);
        if (eventHandlers) {
            eventHandlers.forEach(handler => handler(data));
        }
    },
    off: (eventName, handlerToRemove) => {
        const eventHandlers = handlers.get(eventName);
        if (eventHandlers) {
            handlers.set(eventName, eventHandlers.filter(h => h !== handlerToRemove));
        }
    }
};