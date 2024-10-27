#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import figlet from 'figlet';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  checkDockerFolder,
  checkPrerequisites,
  dockerCompose,
  dockerExec,
  downloadAndExtractTemplate,
  generateComposeFiles,
  parseServices,
  validateProjectName,
} from './lib.js';

// Get __filename and __dirname equivalents in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Print the Hexabot title using figlet
console.log(chalk.blue(figlet.textSync('Hexabot')));

checkPrerequisites();

// Configuration
const FOLDER = path.resolve(process.cwd(), './docker');

// Initialize Commander
const program = new Command();

// Commands
program
  .name('Hexabot')
  .description('A CLI to manage your Hexabot chatbot instance')
  .version('2.0.0');
  program
  .command('create <projectName>')
  .description('Create a new Hexabot project')
  .option(
    '--template <template>',
    'GitHub repository in the format GITHUB_USERNAME/GITHUB_REPO',
  )
  .action(async (projectName, cmd) => {
    // Validate project name
    if (!validateProjectName(projectName)) {
      console.error(
        chalk.red(
          'Invalid project name. It should contain only lowercase letters, numbers, and dashes.',
        ),
      );
      process.exit(1); // Exit the process with an error
    }

    const projectPath = path.join(process.cwd(), projectName);

    // Create project folder
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath);
    }

    const { template } = cmd;
    let templateRepo = template || 'hexastack/hexabot-template-starter';

    try {
      // Check if a custom template was provided
      let templateUrl;
      if (template) {
        console.log(
          chalk.blue(`Downloading template from GitHub: ${templateRepo}`),
        );
        templateUrl = `https://github.com/${templateRepo}/releases/latest/download/template.zip`;
      } else {
        // Use default template repository
        console.log(
          chalk.blue(
            'No project template provided, using default Hexabot starter template.',
          ),
        );
        templateUrl = `https://github.com/hexastack/hexabot-template-starter/releases/latest/download/template.zip`;
      }

      await downloadAndExtractTemplate(templateUrl, projectPath);

      console.log('\n');
      console.log(
        chalk.green(`🎉 Project ${projectName} created successfully.`),
      );
      console.log('\n');
      console.log(chalk.bgYellow(`Next steps:`));
      console.log(chalk.gray(`1. Navigate to the project folder:`));
      console.log(chalk.yellow(`>> cd ${projectName}/`));
      console.log(chalk.gray(`2. Install dependencies:`));
      console.log(chalk.yellow(`>> npm i`));
      console.log(
        chalk.gray(`3. Generate "docker/.env" file and customize config:`),
      );
      console.log(chalk.yellow(`>> hexabot init`));
      console.log(chalk.gray(`4. Run 🤖:`));
      console.log(chalk.yellow(`>> hexabot dev --services nlu,ollama`));

      console.log('\n');
      console.log(
        chalk.yellow(
          `Installation will take some time, so grab a coffee and let's pretend it's all part of the plan! 😄`,
        ),
      );
    } catch (error) {
      console.error(chalk.red(`Error creating project:`), error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize the environment by copying .env.example to .env')
  .action(() => {
    // Check if the docker folder exists
    checkDockerFolder(FOLDER);

    const envPath = path.join(FOLDER, '.env');
    const exampleEnvPath = path.join(FOLDER, '.env.example');

    if (fs.existsSync(envPath)) {
      console.log(chalk.yellow('.env file already exists.'));
    } else {
      fs.copyFileSync(exampleEnvPath, envPath);
      console.log(chalk.green('Copied .env.example to .env'));
    }
  });

program
  .command('start')
  .description('Start specified services with Docker Compose')
  .option(
    '--services <services>',
    'Comma-separated list of services to enable',
    '',
  )
  .action((options) => {
    // Check if the docker folder exists
    checkDockerFolder(FOLDER);

    const services = parseServices(options.services);
    const composeArgs = generateComposeFiles(FOLDER, services);
    dockerCompose(`${composeArgs} up -d`);
  });

program
  .command('dev')
  .description(
    'Start specified services in development mode with Docker Compose',
  )
  .option(
    '--services <services>',
    'Comma-separated list of services to enable',
    '',
  )
  .action((options) => {
    // Check if the docker folder exists
    checkDockerFolder(FOLDER);

    const services = parseServices(options.services);
    const composeArgs = generateComposeFiles(FOLDER, services, 'dev');
    dockerCompose(`${composeArgs} up --build -d`);
  });

program
  .command('migrate [args...]')
  .description('Run database migrations')
  .action((args) => {
    // Check if the docker folder exists
    checkDockerFolder(FOLDER);

    const migrateArgs = args.join(' ');
    dockerExec(
      'api',
      `npm run migrate ${migrateArgs}`,
      '--user $(id -u):$(id -g)',
    );
  });

program
  .command('start-prod')
  .description(
    'Start specified services in production mode with Docker Compose',
  )
  .option(
    '--services <services>',
    'Comma-separated list of services to enable',
    '',
  )
  .action((options) => {
    // Check if the docker folder exists
    checkDockerFolder(FOLDER);

    const services = parseServices(options.services);
    const composeArgs = generateComposeFiles(FOLDER, services, 'prod');
    dockerCompose(`${composeArgs} up -d`);
  });

program
  .command('stop')
  .description('Stop specified Docker Compose services')
  .option(
    '--services <services>',
    'Comma-separated list of services to stop',
    '',
  )
  .action((options) => {
    // Check if the docker folder exists
    checkDockerFolder(FOLDER);

    const services = parseServices(options.services);
    const composeArgs = generateComposeFiles(FOLDER, services);
    dockerCompose(`${composeArgs} down`);
  });

program
  .command('destroy')
  .description('Destroy specified Docker Compose services and remove volumes')
  .option(
    '--services <services>',
    'Comma-separated list of services to destroy',
    '',
  )
  .action((options) => {
    // Check if the docker folder exists
    checkDockerFolder(FOLDER);

    const services = parseServices(options.services);
    const composeArgs = generateComposeFiles(FOLDER, services);
    dockerCompose(`${composeArgs} down -v`);
  });

// Parse arguments
program.parse(process.argv);

// If no command is provided, display help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

