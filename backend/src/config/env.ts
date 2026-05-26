import yargs from 'yargs';
import { CommandLineArgs } from '../types/config.types.js';

export function parseCommandLineArgs(): CommandLineArgs {
    const argv = yargs(process.argv.slice(2))
        .option('port', { type: 'number', describe: 'Server port' })
        .option('host', { type: 'string', describe: 'Server host' })
        .option('dataRoot', { type: 'string', describe: 'Data root directory' })
        .option('ssl', { type: 'boolean', describe: 'Enable SSL' })
        .option('sslKeyPath', { type: 'string', describe: 'SSL key path' })
        .option('sslCertPath', { type: 'string', describe: 'SSL cert path' })
        .option('disableCsrf', { type: 'boolean', describe: 'Disable CSRF protection' })
        .option('basicAuthMode', { type: 'boolean', describe: 'Enable basic auth mode' })
        .option('corsEnabled', { type: 'boolean', describe: 'Enable CORS' })
        .option('global', { type: 'boolean', describe: 'Use global config' })
        .parseSync();

    return argv as CommandLineArgs;
}
