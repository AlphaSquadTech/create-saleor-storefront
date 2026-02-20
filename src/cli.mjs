#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

const TEMPLATE_DEFINITIONS = {
  basic: {
    id: "basic",
    label: "Basic",
    npmPackage: "@alphasquad/saleor-template-basic",
    repository: "AlphaSquadTech/saleor-template-basic",
    fallbackEnvExample: `# Required
NEXT_PUBLIC_API_URL="https://your-saleor-domain/graphql/"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_SALEOR_CHANNEL="default-channel"

# PartsLogic (YMM + search)
NEXT_PUBLIC_PARTSLOGIC_URL="https://your-partslogic-domain"
NEXT_PUBLIC_SEARCH_URL="https://your-search-service-domain"

# Branding
NEXT_PUBLIC_BRAND_NAME="Saleor Storefront"
NEXT_PUBLIC_LOGO_URL="/Logo.png"

# Dealer locator (optional)
NEXT_PUBLIC_DEALER_LOCATOR_ENABLED="true"
NEXT_PUBLIC_DEALER_LOCATOR_TOKEN=""
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""

# Forms (optional)
ALLOWED_WEBHOOK_DOMAINS="hooks.zapier.com,example.com"

# SMTP (optional)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="no-reply@example.com"
SMTP_TO="leads@example.com"
SMTP_REPLY_TO=""
EMAIL_SUBJECT_PREFIX=""

# Analytics (optional)
NEXT_PUBLIC_GTM_CONTAINER_ID=""
NEXT_PUBLIC_GA_MEASUREMENT_ID=""
NEXT_PUBLIC_GOOGLE_ADSENSE_PUBLISHER_ID=""
NEXT_PUBLIC_GOOGLE_SEARCH_CONSOLE_VERIFICATION_CONTENT=""
NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY=""

# next/image allowlist (optional)
NEXT_PUBLIC_IMAGE_HOSTS=""

# Social links (optional)
NEXT_PUBLIC_SOCIAL_FACEBOOK_URL=""
NEXT_PUBLIC_SOCIAL_X_URL=""
NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL=""
`
  },
  standard: {
    id: "standard",
    label: "Standard",
    npmPackage: "@alphasquad/saleor-template-standard",
    repository: "AlphaSquadTech/saleor-template-standard",
    fallbackEnvExample: `# Theme / Branding
NEXT_PUBLIC_THEME_LAYOUT=showroom
NEXT_PUBLIC_THEME_PALETTE=forest-green
NEXT_PUBLIC_BRAND_NAME="AutoParts Store"
NEXT_PUBLIC_LOGO_URL="/Logo.png"
NEXT_PUBLIC_APP_ICON="/icons/appIcon.png"

# Tenant
NEXT_PUBLIC_TENANT_NAME="tenant-slug"
NEXT_PUBLIC_ASSETS_BASE_URL=""

# Saleor GraphQL
NEXT_PUBLIC_API_URL="https://your-saleor-domain/graphql/"
NEXT_PUBLIC_SALEOR_CHANNEL="default-channel"

# Site URLs
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_STOREFRONT_URL="http://localhost:3000"

# Search / PartsLogic (YMM)
NEXT_PUBLIC_SEARCH_URL="https://your-search-service-domain"
NEXT_PUBLIC_PARTSLOGIC_URL="https://your-partslogic-domain"

# next/image allowlist (optional)
NEXT_PUBLIC_IMAGE_HOSTS=""

# Forms delivery
ALLOWED_WEBHOOK_DOMAINS=""

# SMTP (optional)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="no-reply@example.com"
SMTP_TO="leads@example.com"
SMTP_REPLY_TO=""
EMAIL_SUBJECT_PREFIX=""

NODE_ENV="production"
`
  },
  advance: {
    id: "advance",
    label: "Advance",
    npmPackage: "@alphasquad/saleor-template-advance",
    repository: "AlphaSquadTech/saleor-template-advance",
    fallbackEnvExample: `# Core
NEXT_PUBLIC_API_URL="https://your-saleor-domain/graphql/"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_SALEOR_CHANNEL="default-channel"

# External configuration service
NEXT_PUBLIC_TENANT_NAME="tenant-slug"

# PartsLogic (YMM + fitment + option sets)
NEXT_PUBLIC_PARTSLOGIC_URL="https://your-partslogic-domain"

# Search service base URL
NEXT_PUBLIC_SEARCH_URL="https://your-search-service-domain"

# Storefront URL
NEXT_PUBLIC_STOREFRONT_URL="http://localhost:3000"

# Branding
NEXT_PUBLIC_BRAND_NAME="AutoParts Store"
NEXT_PUBLIC_LOGO_URL="/Logo.png"
NEXT_PUBLIC_APP_ICON="/icons/appIcon.png"

# Theme
NEXT_PUBLIC_THEME_LAYOUT="showroom"
NEXT_PUBLIC_THEME_PALETTE="forest-green"

# Assets (optional)
NEXT_PUBLIC_ASSETS_BASE_URL=""

# Optional (Kount)
NEXT_PUBLIC_KOUNT_BASE_URL="https://kount.wsm-dev.com/api"

# next/image allowlist (optional)
NEXT_PUBLIC_IMAGE_HOSTS=""

# Social links (optional)
NEXT_PUBLIC_SOCIAL_FACEBOOK_URL=""
NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL=""

# Forms (optional)
ALLOWED_WEBHOOK_DOMAINS="hooks.zapier.com,example.com"

# SMTP (optional)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="no-reply@example.com"
SMTP_TO="leads@example.com"
SMTP_REPLY_TO=""
EMAIL_SUBJECT_PREFIX=""
`
  }
};

const REQUIRED_ENV_KEYS = new Set([
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SALEOR_CHANNEL"
]);

const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn"]);

const HELP_TEXT = `Usage:
  npx @alphasquad/create-saleor-storefront@latest <tenant-directory> [options]

Options:
  --template <basic|standard|advance>  Template to use.
  --config <path>                       JSON file with template + env values.
  --yes                                 Use defaults for all prompts.
  --package-manager <npm|pnpm|yarn>     Package manager for local install.
  --no-install                          Skip dependency installation.
  --ci                                  Generate GitHub workflows.
  --no-ci                               Do not generate GitHub workflows.
  -h, --help                            Show help.
`;

function logError(message) {
  process.stderr.write(`${message}\n`);
}

function parseArgs(argv) {
  const options = {
    targetDirArg: null,
    templateArg: null,
    configPath: null,
    yes: false,
    packageManager: "npm",
    noInstall: false,
    ci: undefined,
    help: false
  };

  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "--yes") {
      options.yes = true;
      continue;
    }

    if (arg === "--no-install") {
      options.noInstall = true;
      continue;
    }

    if (arg === "--ci") {
      options.ci = true;
      continue;
    }

    if (arg === "--no-ci") {
      options.ci = false;
      continue;
    }

    if (arg.startsWith("--template=")) {
      options.templateArg = arg.slice("--template=".length);
      continue;
    }

    if (arg === "--template") {
      i += 1;
      options.templateArg = argv[i];
      continue;
    }

    if (arg.startsWith("--config=")) {
      options.configPath = arg.slice("--config=".length);
      continue;
    }

    if (arg === "--config") {
      i += 1;
      options.configPath = argv[i];
      continue;
    }

    if (arg.startsWith("--package-manager=")) {
      options.packageManager = arg.slice("--package-manager=".length);
      continue;
    }

    if (arg === "--package-manager") {
      i += 1;
      options.packageManager = argv[i];
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positionals.push(arg);
  }

  if (positionals.length > 0) {
    options.targetDirArg = positionals[0];
  }

  if (!PACKAGE_MANAGERS.has(options.packageManager)) {
    throw new Error(`Invalid package manager: ${options.packageManager}`);
  }

  return options;
}

function resolveTemplate(templateValue) {
  if (!templateValue) {
    return null;
  }

  const normalized = templateValue.trim().toLowerCase();

  if (TEMPLATE_DEFINITIONS[normalized]) {
    return TEMPLATE_DEFINITIONS[normalized];
  }

  for (const template of Object.values(TEMPLATE_DEFINITIONS)) {
    if (template.npmPackage.toLowerCase() === normalized) {
      return template;
    }
    if (template.repository.toLowerCase() === normalized) {
      return template;
    }
    if (template.repository.toLowerCase().endsWith(normalized)) {
      return template;
    }
  }

  return null;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureEmptyDirectory(dirPath) {
  if (!(await exists(dirPath))) {
    await mkdir(dirPath, { recursive: true });
    return;
  }

  const entries = await readdir(dirPath);
  if (entries.length > 0) {
    throw new Error(`Target directory exists and is not empty: ${dirPath}`);
  }
}

function slugify(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function titleCaseFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((chunk) => `${chunk[0].toUpperCase()}${chunk.slice(1)}`)
    .join(" ");
}

async function maybeFetchText(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

async function maybeFetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

async function loadTemplateSchema(template) {
  const branches = ["main", "master"];
  for (const branch of branches) {
    const schemaUrl = `https://raw.githubusercontent.com/${template.repository}/${branch}/template/config.schema.json`;
    const schema = await maybeFetchJson(schemaUrl);
    if (schema && typeof schema === "object") {
      return schema;
    }
  }
  return null;
}

async function loadTemplateEnvExample(template) {
  const branches = ["main", "master"];
  for (const branch of branches) {
    const envUrl = `https://raw.githubusercontent.com/${template.repository}/${branch}/.env.example`;
    const envText = await maybeFetchText(envUrl);
    if (typeof envText === "string" && envText.trim().length > 0) {
      return envText;
    }
  }
  return template.fallbackEnvExample;
}

function parseEnvValue(rawValue) {
  if (rawValue === undefined) {
    return "";
  }

  const trimmed = String(rawValue).trim();
  if (trimmed.length === 0) {
    return "";
  }

  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvEntries(envText) {
  const entries = [];
  const seen = new Set();
  const lines = envText.split(/\r?\n/);
  const pendingComments = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      pendingComments.length = 0;
      continue;
    }

    if (trimmed.startsWith("#")) {
      pendingComments.push(trimmed.replace(/^#\s?/, ""));
      continue;
    }

    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) {
      pendingComments.length = 0;
      continue;
    }

    const key = match[1];
    if (seen.has(key)) {
      pendingComments.length = 0;
      continue;
    }

    const description = pendingComments.join(" ").trim();
    const defaultValue = parseEnvValue(match[2]);

    entries.push({
      key,
      description,
      defaultValue,
      required: REQUIRED_ENV_KEYS.has(key) || /required/i.test(description)
    });

    seen.add(key);
    pendingComments.length = 0;
  }

  return entries;
}

function schemaEntriesFromObject(properties, requiredSet = new Set(), prefix = "") {
  const entries = [];

  for (const [key, prop] of Object.entries(properties || {})) {
    const fullKey = prefix ? `${prefix}_${key}` : key;

    if (prop && prop.type === "object" && prop.properties) {
      const nestedRequired = new Set(Array.isArray(prop.required) ? prop.required : []);
      entries.push(...schemaEntriesFromObject(prop.properties, nestedRequired, fullKey));
      continue;
    }

    const envKey = fullKey.toUpperCase();
    const defaultValue = prop?.default === undefined ? "" : String(prop.default);
    const description = typeof prop?.description === "string" ? prop.description : "";

    entries.push({
      key: envKey,
      description,
      defaultValue,
      required: requiredSet.has(key)
    });
  }

  return entries;
}

function parseSchemaEntries(schema) {
  if (!schema || typeof schema !== "object") {
    return [];
  }

  if (schema.properties?.env?.properties) {
    const requiredSet = new Set(Array.isArray(schema.properties.env.required) ? schema.properties.env.required : []);
    return schemaEntriesFromObject(schema.properties.env.properties, requiredSet, "");
  }

  if (schema.properties) {
    const requiredSet = new Set(Array.isArray(schema.required) ? schema.required : []);
    return schemaEntriesFromObject(schema.properties, requiredSet, "");
  }

  return [];
}

function computeDefaultValue(entry, tenantSlug, brandName) {
  if (entry.key === "NEXT_PUBLIC_TENANT_NAME") {
    return tenantSlug;
  }

  if (entry.key === "NEXT_PUBLIC_BRAND_NAME" && (!entry.defaultValue || entry.defaultValue === "AutoParts Store" || entry.defaultValue === "Saleor Storefront")) {
    return brandName;
  }

  if (entry.key === "NEXT_PUBLIC_SITE_URL") {
    return entry.defaultValue || "http://localhost:3000";
  }

  if (entry.key === "NEXT_PUBLIC_STOREFRONT_URL") {
    return entry.defaultValue || "http://localhost:3000";
  }

  return entry.defaultValue;
}

function sanitizeEnvValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function quoteEnvValue(value) {
  const escaped = sanitizeEnvValue(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function parseConfigPayload(input) {
  if (!input || typeof input !== "object") {
    return { templateValue: null, envValues: {}, ci: undefined };
  }

  const templateValue =
    typeof input.template === "string"
      ? input.template
      : typeof input.templateId === "string"
      ? input.templateId
      : null;

  let envValues = {};
  if (input.env && typeof input.env === "object") {
    envValues = input.env;
  } else if (input.values && typeof input.values === "object") {
    envValues = input.values;
  } else {
    const direct = {};
    for (const [key, value] of Object.entries(input)) {
      if (/^[A-Z0-9_]+$/.test(key)) {
        direct[key] = value;
      }
    }
    envValues = direct;
  }

  const ci = typeof input.ci === "boolean" ? input.ci : undefined;
  return { templateValue, envValues, ci };
}

async function loadConfigFile(configPath, cwd) {
  if (!configPath) {
    return { templateValue: null, envValues: {}, ci: undefined };
  }

  const absolutePath = path.resolve(cwd, configPath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);
  return parseConfigPayload(parsed);
}

async function promptSelectTemplate(rl) {
  const templateList = Object.values(TEMPLATE_DEFINITIONS);
  process.stdout.write("Select a Saleor core template:\n");
  templateList.forEach((template, index) => {
    process.stdout.write(`  ${index + 1}. ${template.label} (${template.id})\n`);
  });

  while (true) {
    const answer = (await rl.question("Template number [1]: ")).trim();
    if (!answer) {
      return templateList[0];
    }

    const numeric = Number.parseInt(answer, 10);
    if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= templateList.length) {
      return templateList[numeric - 1];
    }

    const byId = resolveTemplate(answer);
    if (byId) {
      return byId;
    }

    process.stdout.write("Invalid template selection. Try again.\n");
  }
}

async function promptConfirmCi(rl) {
  const answer = (await rl.question("Generate GitHub Actions for automatic template sync? [Y/n]: ")).trim().toLowerCase();
  if (!answer) {
    return true;
  }
  return answer === "y" || answer === "yes";
}

async function collectEnvValues({ rl, yes, entries, configValues, tenantSlug, brandName }) {
  const values = {};

  for (const entry of entries) {
    const valueFromConfig = configValues[entry.key];
    if (valueFromConfig !== undefined) {
      values[entry.key] = sanitizeEnvValue(valueFromConfig);
      continue;
    }

    const computedDefault = computeDefaultValue(entry, tenantSlug, brandName);

    if (yes) {
      if (entry.required && !computedDefault) {
        throw new Error(`Missing required value for ${entry.key}. Provide it via --config.`);
      }
      values[entry.key] = computedDefault;
      continue;
    }

    if (entry.description) {
      process.stdout.write(`\n${entry.description}\n`);
    }

    while (true) {
      const promptSuffix = computedDefault ? ` [${computedDefault}]` : "";
      const requiredSuffix = entry.required ? " (required)" : "";
      const answer = await rl.question(`${entry.key}${requiredSuffix}${promptSuffix}: `);
      const trimmed = answer.trim();

      if (!trimmed) {
        if (entry.required && !computedDefault) {
          process.stdout.write(`${entry.key} is required.\n`);
          continue;
        }
        values[entry.key] = computedDefault;
        break;
      }

      values[entry.key] = trimmed;
      break;
    }
  }

  return values;
}

function formatEnvFile(entries, values) {
  const lines = [
    "# Generated by @alphasquad/create-saleor-storefront",
    "# Edit values as needed for each tenant environment",
    ""
  ];

  for (const entry of entries) {
    if (entry.description) {
      lines.push(`# ${entry.description}`);
    }
    lines.push(`${entry.key}=${quoteEnvValue(values[entry.key] ?? "")}`);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function generateTenantPackageJson({ tenantSlug, template, packageManager }) {
  return {
    name: tenantSlug,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "node ./scripts/template-runner.mjs dev",
      build: "node ./scripts/template-runner.mjs build",
      start: "node ./scripts/template-runner.mjs start",
      lint: "node ./scripts/template-runner.mjs lint",
      "template:update": `node ./scripts/update-template.mjs ${packageManager}`,
      "template:check": "node ./scripts/check-template-update.mjs"
    },
    dependencies: {
      [template.npmPackage]: "latest"
    },
    devDependencies: {
      "@tailwindcss/postcss": "^4",
      tailwindcss: "^4",
      typescript: "^5"
    }
  };
}

function generateTemplateRunner(templatePackage) {
  return `import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const command = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!command) {
  process.stderr.write("Usage: node scripts/template-runner.mjs <dev|build|start|lint>\\n");
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\\r?\\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env"));
loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const templatePackageJson = require.resolve("${templatePackage}/package.json", { paths: [process.cwd()] });
const templateDir = path.dirname(templatePackageJson);
const nextBin = require.resolve("next/dist/bin/next", { paths: [process.cwd(), templateDir] });

const child = spawn(process.execPath, [nextBin, command, templateDir, ...extraArgs], {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
`;
}

function generateTemplateUpdateScript(templatePackage) {
  return `import { spawn } from "node:child_process";
import process from "node:process";

const packageManager = process.argv[2] || "npm";
const packageName = "${templatePackage}";

const commandMap = {
  npm: ["npm", ["install", packageName + "@latest"]],
  pnpm: ["pnpm", ["add", packageName + "@latest"]],
  yarn: ["yarn", ["add", packageName + "@latest"]]
};

if (!commandMap[packageManager]) {
  process.stderr.write("Unsupported package manager: " + packageManager + "\\n");
  process.exit(1);
}

const [command, args] = commandMap[packageManager];

const child = spawn(command, args, {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
`;
}

function generateTemplateCheckScript(templatePackage) {
  return `import { execSync } from "node:child_process";
import process from "node:process";

const packageName = "${templatePackage}";

try {
  const out = execSync("npm outdated --json " + packageName, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  if (!out) {
    process.stdout.write("No update available for " + packageName + "\\n");
    process.exit(0);
  }

  const json = JSON.parse(out);
  const details = json[packageName];
  if (!details) {
    process.stdout.write("No update available for " + packageName + "\\n");
    process.exit(0);
  }

  process.stdout.write("Update available for " + packageName + ": " + details.current + " -> " + details.latest + "\\n");
  process.exit(0);
} catch {
  process.stdout.write("Could not determine update status for " + packageName + "\\n");
  process.exit(0);
}
`;
}

function packageManagerInstallCommand(packageManager) {
  if (packageManager === "pnpm") {
    return "pnpm install --no-frozen-lockfile";
  }
  if (packageManager === "yarn") {
    return "yarn install --mode=update-lockfile";
  }
  return "npm install";
}

function packageManagerUpdateCommand(packageManager) {
  if (packageManager === "pnpm") {
    return "pnpm run template:update";
  }
  if (packageManager === "yarn") {
    return "yarn template:update";
  }
  return "npm run template:update";
}

function packageManagerRunCommand(packageManager, script) {
  if (packageManager === "pnpm") {
    return `pnpm run ${script}`;
  }
  if (packageManager === "yarn") {
    return `yarn ${script}`;
  }
  return `npm run ${script}`;
}

function generateCiWorkflow(packageManager) {
  const installCmd = packageManagerInstallCommand(packageManager);
  const lintCmd = packageManagerRunCommand(packageManager, "lint");
  const testCmd = packageManagerRunCommand(packageManager, "test");
  const buildCmd = packageManagerRunCommand(packageManager, "build");

  const setupCache = packageManager === "pnpm" ? "pnpm" : packageManager === "yarn" ? "yarn" : "npm";

  const pnpmSetup = packageManager === "pnpm"
    ? `
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9`
    : "";

  return `name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: ${setupCache}${pnpmSetup}
      - name: Install dependencies
        run: ${installCmd}
      - name: Lint (if present)
        run: |
          node -e "process.exit(require('./package.json').scripts?.lint ? 0 : 1)" && ${lintCmd} || echo "No lint script, skipping"
      - name: Test (if present)
        run: |
          node -e "process.exit(require('./package.json').scripts?.test ? 0 : 1)" && ${testCmd} || echo "No test script, skipping"
      - name: Build (if present)
        run: |
          node -e "process.exit(require('./package.json').scripts?.build ? 0 : 1)" && ${buildCmd} || echo "No build script, skipping"
`;
}

function generateTemplateSyncWorkflow({ packageManager, template }) {
  const installCmd = packageManagerInstallCommand(packageManager);
  const updateCmd = packageManagerUpdateCommand(packageManager);
  const lintCmd = packageManagerRunCommand(packageManager, "lint");
  const testCmd = packageManagerRunCommand(packageManager, "test");
  const buildCmd = packageManagerRunCommand(packageManager, "build");
  const setupCache = packageManager === "pnpm" ? "pnpm" : packageManager === "yarn" ? "yarn" : "npm";

  const pnpmSetup = packageManager === "pnpm"
    ? `
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9`
    : "";

  return `name: Template Sync

on:
  workflow_dispatch:
  schedule:
    - cron: "0 */6 * * *"
  repository_dispatch:
    types: [template-release]

jobs:
  sync:
    if: >
      github.event_name != 'repository_dispatch' ||
      github.event.client_payload.templatePackage == '${template.npmPackage}' ||
      github.event.client_payload.templateId == '${template.id}'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    env:
      TEMPLATE_PACKAGE: '${template.npmPackage}'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: ${setupCache}${pnpmSetup}
      - name: Install dependencies
        run: ${installCmd}
      - name: Update template package
        run: ${updateCmd}
      - name: Lint (if present)
        run: |
          node -e "process.exit(require('./package.json').scripts?.lint ? 0 : 1)" && ${lintCmd} || echo "No lint script, skipping"
      - name: Test (if present)
        run: |
          node -e "process.exit(require('./package.json').scripts?.test ? 0 : 1)" && ${testCmd} || echo "No test script, skipping"
      - name: Build (if present)
        run: |
          node -e "process.exit(require('./package.json').scripts?.build ? 0 : 1)" && ${buildCmd} || echo "No build script, skipping"
      - name: Create pull request
        id: cpr
        uses: peter-evans/create-pull-request@v6
        with:
          commit-message: "chore(template): update ${template.npmPackage}"
          branch: "chore/template-sync"
          delete-branch: true
          title: "chore(template): update ${template.npmPackage}"
          body: |
            Automated template sync to the latest published package version.
            This PR was created by \.github/workflows/template-sync.yml.
      - name: Enable auto-merge
        if: steps.cpr.outputs.pull-request-number
        uses: peter-evans/enable-pull-request-automerge@v3
        with:
          pull-request-number: \${{ steps.cpr.outputs.pull-request-number }}
          merge-method: squash
`;
}

function generateGitignore() {
  return `node_modules
.next
out
coverage
.env
.env.local
npm-debug.log*
pnpm-debug.log*
yarn-error.log*
`;
}

function generateTenantReadme({ tenantSlug, template }) {
  return `# ${tenantSlug}

This tenant wrapper was generated by \`@alphasquad/create-saleor-storefront\`.

## Selected base template
- Template ID: \`${template.id}\`
- npm package: \`${template.npmPackage}\`
- Source repository: https://github.com/${template.repository}

## Local development
\`\`\`bash
npm install
npm run dev
\`\`\`

The dev/build/start scripts run Next.js against the installed template package and load env values from this repo's \`.env.local\`.

## Configuration
- Tenant-level env values are stored in \`.env.local\`.
- Generated answers are also stored in \`storefront.config.json\` for automation.

## Homepage override
- Override scaffold: \`src/overrides/HomePage.tsx\`
- Registry scaffold: \`src/overrides/index.ts\`

Your template package should read this override contract and render the local homepage override when present.

## Automatic template updates
If \`--ci\` was used during scaffold:
- \`.github/workflows/template-sync.yml\` updates \`${template.npmPackage}\` to \`latest\` every 6 hours and on \`repository_dispatch\`.
- It opens a PR and enables auto-merge after checks pass.

Manual update:
\`\`\`bash
npm run template:update
\`\`\`
`;
}

function generateStorefrontConfig({ template, tenantSlug, envValues }) {
  return {
    template: {
      id: template.id,
      packageName: template.npmPackage,
      repository: `https://github.com/${template.repository}`
    },
    tenant: {
      slug: tenantSlug
    },
    env: envValues,
    generatedAt: new Date().toISOString()
  };
}

function generateOverrideFiles() {
  const homePage = `"use client";

export default function HomePageOverride() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Tenant homepage override</h1>
      <p>
        Replace this component with your full custom homepage.
      </p>
    </main>
  );
}
`;

  const registry = `import HomePageOverride from "./HomePage";

export const storefrontOverrides = {
  HomePage: HomePageOverride
};
`;

  return { homePage, registry };
}

async function writeFileSafe(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function runCommand(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function installDependencies(packageManager, targetDir) {
  if (packageManager === "pnpm") {
    await runCommand("pnpm", ["install"], targetDir);
    return;
  }

  if (packageManager === "yarn") {
    await runCommand("yarn", ["install"], targetDir);
    return;
  }

  await runCommand("npm", ["install"], targetDir);
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    logError(error.message);
    logError(HELP_TEXT);
    process.exit(1);
  }

  if (options.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  if (!options.targetDirArg) {
    logError("Missing tenant directory name.");
    logError(HELP_TEXT);
    process.exit(1);
  }

  const cwd = process.cwd();
  const targetDir = path.resolve(cwd, options.targetDirArg);
  const targetBaseName = path.basename(targetDir);
  const tenantSlug = slugify(targetBaseName);

  if (!tenantSlug) {
    logError("Could not derive tenant slug from target directory.");
    process.exit(1);
  }

  const brandName = titleCaseFromSlug(tenantSlug) || "Saleor Storefront";

  let configPayload;
  try {
    configPayload = await loadConfigFile(options.configPath, cwd);
  } catch (error) {
    logError(`Failed to load config: ${error.message}`);
    process.exit(1);
  }

  const chosenTemplate =
    resolveTemplate(options.templateArg) ||
    resolveTemplate(configPayload.templateValue) ||
    null;

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const template = chosenTemplate || (options.yes ? TEMPLATE_DEFINITIONS.basic : await promptSelectTemplate(rl));

    if (!template) {
      throw new Error("Invalid template selection.");
    }

    let ciEnabled;
    if (typeof options.ci === "boolean") {
      ciEnabled = options.ci;
    } else if (typeof configPayload.ci === "boolean") {
      ciEnabled = configPayload.ci;
    } else if (options.yes) {
      ciEnabled = true;
    } else {
      ciEnabled = await promptConfirmCi(rl);
    }

    process.stdout.write(`\nUsing template: ${template.label} (${template.npmPackage})\n`);

    const schema = await loadTemplateSchema(template);
    const schemaEntries = parseSchemaEntries(schema);

    let entries = schemaEntries;
    if (entries.length === 0) {
      const envExample = await loadTemplateEnvExample(template);
      entries = parseEnvEntries(envExample);
    }

    if (entries.length === 0) {
      throw new Error("No configurable values found for selected template.");
    }

    const envValues = await collectEnvValues({
      rl,
      yes: options.yes,
      entries,
      configValues: configPayload.envValues,
      tenantSlug,
      brandName
    });

    await ensureEmptyDirectory(targetDir);

    const tenantPackageJson = generateTenantPackageJson({
      tenantSlug,
      template,
      packageManager: options.packageManager
    });

    const envOutput = formatEnvFile(entries, envValues);
    const storefrontConfig = generateStorefrontConfig({ template, tenantSlug, envValues });
    const overrides = generateOverrideFiles();

    await writeFileSafe(path.join(targetDir, "package.json"), `${JSON.stringify(tenantPackageJson, null, 2)}\n`);
    await writeFileSafe(path.join(targetDir, ".gitignore"), generateGitignore());
    await writeFileSafe(path.join(targetDir, ".env.example"), envOutput);
    await writeFileSafe(path.join(targetDir, ".env.local"), envOutput);
    await writeFileSafe(path.join(targetDir, "README.md"), generateTenantReadme({ tenantSlug, template }));
    await writeFileSafe(path.join(targetDir, "storefront.config.json"), `${JSON.stringify(storefrontConfig, null, 2)}\n`);
    await writeFileSafe(path.join(targetDir, "src/overrides/HomePage.tsx"), overrides.homePage);
    await writeFileSafe(path.join(targetDir, "src/overrides/index.ts"), overrides.registry);
    await writeFileSafe(path.join(targetDir, "scripts/template-runner.mjs"), generateTemplateRunner(template.npmPackage));
    await writeFileSafe(path.join(targetDir, "scripts/update-template.mjs"), generateTemplateUpdateScript(template.npmPackage));
    await writeFileSafe(path.join(targetDir, "scripts/check-template-update.mjs"), generateTemplateCheckScript(template.npmPackage));

    if (ciEnabled) {
      await writeFileSafe(path.join(targetDir, ".github/workflows/ci.yml"), generateCiWorkflow(options.packageManager));
      await writeFileSafe(
        path.join(targetDir, ".github/workflows/template-sync.yml"),
        generateTemplateSyncWorkflow({ packageManager: options.packageManager, template })
      );
    }

    if (!options.noInstall) {
      process.stdout.write(`\nInstalling dependencies with ${options.packageManager}...\n`);
      await installDependencies(options.packageManager, targetDir);
    }

    process.stdout.write(`\nStorefront tenant scaffold created at ${targetDir}\n`);
    process.stdout.write(`Template package: ${template.npmPackage}\n`);
    process.stdout.write(`\nNext steps:\n`);
    process.stdout.write(`  cd ${targetBaseName}\n`);
    if (options.noInstall) {
      process.stdout.write(`  ${options.packageManager} install\n`);
    }
    process.stdout.write(`  ${options.packageManager === "npm" ? "npm run dev" : `${options.packageManager} dev`}\n`);
  } catch (error) {
    logError(`Failed to create storefront: ${error.message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
