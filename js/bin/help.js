// File: js/bin/help.js

/**
 * Logica principală pentru comanda help.
 * Afișează o listă de comenzi disponibile și detalii despre utilizarea lor.
 */
export async function* logic({ args }) {
    const commands = {
        'cat': {
            description: 'Displays the content of one or more files.',
            usage: 'cat [file1] [file2] ...',
            example: 'cat /etc/motd'
        },
        'cp': {
            description: 'Copies files or directories.',
            usage: 'cp [-r] [source] [destination]',
            example: 'cp file.txt backup.txt\ncp -r /docs /docs_backup'
        },
        'date': {
            description: 'Displays the current date and time.',
            usage: 'date',
            example: 'date'
        },
        'echo': {
            description: 'Displays a specified text.',
            usage: 'echo [text ...]',
            example: 'echo "Hello, World!"'
        },
        'grep': {
            description: 'Searches for a pattern in a file or input.',
            usage: 'grep [pattern] [file]',
            example: 'ls | grep ".js"'
        },
        'head': {
            description: 'Displays the first lines of a file.',
            usage: 'head [-n number] [file]',
            example: 'phist | head -n 10'
        },
        'help': {
            description: 'Displays this help message or details about a specific command.',
            usage: 'help [command]',
            example: 'help ls'
        },
        'history': {
            description: 'Displays the history of executed commands.',
            usage: 'history',
            example: 'history'
        },
        'kill': {
            description: 'Stops a process based on its PID (Process ID).',
            usage: 'kill [pid]',
            example: 'kill 101'
        },
        'ls': {
            description: 'Lists the content of a directory.',
            usage: 'ls [-r] [path]',
            example: 'ls -r /home'
        },
        'mkdir': {
            description: 'Creates one or more directories.',
            usage: 'mkdir [directory1] [directory2] ...',
            example: 'mkdir new_folder'
        },
        'mv': {
            description: 'Moves or renames files and directories.',
            usage: 'mv [source] [destination]',
            example: 'mv old_name.txt new_name.txt'
        },
        // --- COMENZI NOI ADĂUGATE ---
        'phist': {
            description: 'Displays the history of all executed processes.',
            usage: 'phist',
            example: 'phist | grep "TERMINATED"'
        },
        'ps': {
            description: 'Displays the currently running processes.',
            usage: 'ps',
            example: 'ps'
        },
        'pwd': {
            description: 'Displays the current working directory.',
            usage: 'pwd',
            example: 'pwd'
        },
        'rm': {
            description: 'Deletes files or directories.',
            usage: 'rm [-r] [file/directory] ...',
            example: 'rm temp.txt\nrm -r old_project'
        },
        'sleep': {
            description: 'Pauses execution for a specified number of seconds.',
            usage: 'sleep [seconds]',
            example: 'sleep 5'
        },
        'sort': {
            description: 'Sorts lines of text from a file or input.',
            usage: 'sort [file]',
            example: 'ls | sort'
        },
        'stat': {
            description: 'Displays detailed information about a file or directory.',
            usage: 'stat [path]',
            example: 'stat file.txt'
        },
        'tail': {
            description: 'Displays the last lines of a file or input.',
            usage: 'tail [-n number] [file]',
            example: 'phist | tail -n 5'
        },
        // --- SFÂRȘIT COMENZI NOI ---
        'theme': {
            description: 'Changes the visual theme of the terminal.',
            usage: 'theme [light|true-dark|nord|dracula|solarized-light|neon-blade|matrix-green]',
            example: 'theme nord'
        },
        'touch': {
            description: 'Creates an empty file.',
            usage: 'touch [file1] [file2] ...',
            example: 'touch new_file.txt'
        },
        'uniq': {
            description: 'Removes adjacent duplicate lines from input.',
            usage: 'uniq [file]',
            example: 'sort file.txt | uniq'
        },
        'wc': {
            description: 'Counts lines, words, and characters in a file.',
            usage: 'wc [-lwc] [file]',
            example: 'cat file.txt | wc -l'
        },
    };

    if (args.length > 0) {
        const commandName = args[0];
        if (commands[commandName]) {
            const cmd = commands[commandName];
            let output = `Command: ${commandName}\n`;
            output += `Description: ${cmd.description}\n`;
            output += `Usage: ${cmd.usage}\n`;
            output += `Example:\n  ${cmd.example.replace(/\n/g, '\n  ')}`;
            
            yield { type: 'stdout', data: { message: output } };
        } else {
            yield { type: 'stdout', data: { message: `help: command '${commandName}' not found.`, isError: true } };
        }
        return;
    }

    yield { type: 'stdout', data: { message: ' WebOS v2.0 - Available Commands:' } };
    yield { type: 'stdout', data: { message: ' Use `help [command]` to see details.\n' } };

    const commandList = Object.keys(commands).sort().map(name => {
        const desc = commands[name].description;
        return `${name.padEnd(12)} - ${desc}`;
    }).join('\n');

    yield { type: 'stdout', data: { message: commandList } };
}