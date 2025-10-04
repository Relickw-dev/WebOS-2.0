// File: js/bin/date.js

/**
 * Logica principală pentru comanda date.
 * Afișează data și ora curentă, adaptată pentru noul sistem de procese.
 */
export function* logic() {
    // Creăm un nou obiect Date, care conține data și ora curentă a clientului (browserului).
    const currentDate = new Date();
    
    // Folosim metoda .toString() pentru a obține o reprezentare lizibilă.
    // Exemplu: Fri Oct 03 2025 18:30:06 GMT+0300 (Eastern European Summer Time)
    const dateString = currentDate.toString();
    
    // Trimitem string-ul formatat către scheduler pentru afișare, folosind 'yield'.
    yield {
        type: 'stdout',
        data: { message: dateString }
    };
}