// File: js/bin/date.js

/**
 * Logica principală pentru comanda date.
 * Afișează data și ora curentă.
 */
export const logic = async ({ onOutput }) => {
    // Creăm un nou obiect Date, care conține data și ora curentă a clientului (browserului).
    const currentDate = new Date();
    
    // Folosim metoda .toString() pentru a obține o reprezentare lizibilă.
    // Exemplu: Thu Oct 02 2025 13:16:24 GMT+0300 (Eastern European Summer Time)
    const dateString = currentDate.toString();
    
    // Trimitem string-ul formatat către terminal pentru afișare.
    onOutput({ message: dateString });
};