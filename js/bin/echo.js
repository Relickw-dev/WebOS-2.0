// File: js/bin/echo.js

// Logica este acum o funcție generator.
export function* logic({ args, onOutput }) {
    const output = args.join(' ');
    
    // În loc de a apela onOutput, facem 'yield' cu un obiect de output.
    yield {
        type: 'stdout',
        data: {
            type: 'string',
            message: output
        }
    };
    
    // Generatorul se termină implicit aici.
}