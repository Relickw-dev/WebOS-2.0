// File: js/bin/help.js

/**
 * Main logic for the help command.
 * Displays a list of available commands and details about their usage.
 */
export function* logic({ args }) {
    // We define all commands here, with descriptions and examples.
    // This structure is easy to extend as we add new commands.
    const commands = {
        'cat': {
            description: 'Displays the content of one or more files.',
            usage: 'cat [file1] [file2] ...',
            example: 'cat /etc/motd'
        },
        'cp': {
            description: 'Copies files or directories.',
            usage: 'cp [-r] [source] [destination]',
            example: 'cp /home/user/file.txt /home/user/file_backup.txt\ncp -r /home/user/docs /home/user/docs_backup'
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
            example: 'grep "error" /var/log/sys.log'
        },
        'head': {
            description: 'Displays the first lines of a file.',
            usage: 'head [-n number] [file]',
            example: 'head -n 5 /var/log/sys.log'
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
            example: 'ls -r /home/user'
        },
        'mkdir': {
            description: 'Creates one or more directories.',
            usage: 'mkdir [directory1] [directory2] ...',
            example: 'mkdir /home/user/new_folder'
        },
        'mv': {
            description: 'Moves or renames files and directories.',
            usage: 'mv [source] [destination]',
            example: 'mv old_name.txt new_name.txt'
        },
        'ps': {
            description: 'Displays the currently running processes.',
            usage: 'ps',
            example: 'ps'
        },
        'pwd': {
            description: 'Displays the current working directory (print working directory).',
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
        'stat': {
            description: 'Displays detailed information about a file or directory.',
            usage: 'stat [path]',
            example: 'stat /home/user/file.txt'
        },
        'touch': {
            description: 'Creates an empty file or updates the modification date.',
            usage: 'touch [file1] [file2] ...',
            example: 'touch new_file.txt'
        },
        'wc': {
            description: 'Counts lines, words, and characters in a file.',
            usage: 'wc [-lwc] [file]',
            example: 'wc -l /etc/motd'
        },
        'help': {
            description: 'Displays this help message or details about a specific command.',
            usage: 'help [command]',
            example: 'help ls'
        },
        'theme': {
        description: 'Changes the visual theme of the terminal.',
        usage: 'theme [light|true-dark|nord|dracula|solarized-light|neon-blade|matrix-green]',
        example: 'theme dark'
    },
    };

    // Case 1: `help [command]` - Display details for a single command
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
            yield { type: 'stdout', data: { type: 'error', message: `help: command '${commandName}' not found.` } };
        }
        return;
    }

    // Case 2: `help` - Display the list of all commands
    yield { type: 'stdout', data: { message: 'WebOS v2.0 - Available Commands:' } };
    yield { type: 'stdout', data: { message: 'Use `help [command]` to see details.\n' } };

    const commandList = Object.keys(commands).sort().map(name => {
        const desc = commands[name].description;
        // padEnd is used for alignment
        return `${name.padEnd(12)} - ${desc}`;
    }).join('\n');

    yield { type: 'stdout', data: { message: commandList } };
}