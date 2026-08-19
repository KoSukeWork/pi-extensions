var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// packages/pi-sync/src/command.ts
function setSyncSetupCompletions(names) {
  setupCompletionNames = [...new Set(names)].sort((left, right) => left.localeCompare(right));
}
function splitArgs(input) {
  return input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((arg) => arg.replace(/^['"]|['"]$/g, "")) ?? [];
}
function parseOptions(args) {
  const values = [];
  let yes = false;
  let force = false;
  let stale = false;
  let setup;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--yes" || arg === "-y") yes = true;
    else if (arg === "--force") force = true;
    else if (arg === "--stale") stale = true;
    else if (arg === "--setup") {
      const name = args[index + 1];
      if (!name || name.startsWith("-")) throw new Error("--setup requires a sync setup name.");
      if (setup !== void 0) throw new Error("--setup may be provided only once.");
      setup = name;
      index += 1;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown sync option: ${arg}`);
    } else values.push(arg);
  }
  return {
    yes,
    force,
    stale,
    silent: false,
    reload: true,
    auto: false,
    ...setup === void 0 ? {} : { setup },
    args: values
  };
}
function validateCommandOptions(command, options) {
  const setupAllowed = /* @__PURE__ */ new Set([
    "config",
    "files",
    "status",
    "diff",
    "doctor",
    "push",
    "pull",
    "sync",
    "history",
    "rollback"
  ]);
  if (options.setup && !setupAllowed.has(command)) {
    throw new Error(`--setup is not supported by /sync ${command}.`);
  }
  if (options.yes && !["push", "pull", "sync", "rollback", "migrate-state"].includes(command)) {
    throw new Error(`Confirmation/force options are not supported by /sync ${command}.`);
  }
  if (options.force && !["push", "pull", "sync", "rollback"].includes(command)) {
    throw new Error(`Confirmation/force options are not supported by /sync ${command}.`);
  }
  if (options.stale && command !== "unlock") {
    throw new Error(`--stale is not supported by /sync ${command}.`);
  }
  const expectedValues = command === "rollback" || command === "use" ? 1 : 0;
  if (options.args.length !== expectedValues) {
    if (command === "rollback")
      throw new Error("Usage: /sync rollback <snapshot-id> [--yes] [--setup <name>]");
    if (command === "use") throw new Error("Usage: /sync use <setup>");
    throw new Error(`Unexpected argument for /sync ${command}: ${options.args.join(" ")}`);
  }
}
function completeSyncArguments(argumentPrefix) {
  const prefix = argumentPrefix.trimStart();
  if (prefix === "") return [...SYNC_COMMAND_COMPLETIONS];
  const trailingSpace = /\s$/.test(prefix);
  const tokens = splitArgs(prefix);
  if (tokens.length === 0) return [...SYNC_COMMAND_COMPLETIONS];
  const [command] = tokens;
  if (tokens.length === 1 && !trailingSpace) {
    const matches2 = SYNC_COMMAND_COMPLETIONS.filter((item) => item.value.startsWith(command));
    return matches2.length > 0 ? [...matches2] : null;
  }
  const args = tokens.slice(1);
  if (command === "use") {
    if (args.length > 1 || trailingSpace && args.length > 0) return null;
    return completeSetupValue(prefix, trailingSpace ? "" : args[0] ?? "");
  }
  const setupFlagIndex = args.lastIndexOf("--setup");
  if (setupFlagIndex >= 0 && setupFlagIndex === args.length - (trailingSpace ? 1 : 2)) {
    const currentSetup = trailingSpace ? "" : args.at(-1) ?? "";
    if (!currentSetup.startsWith("-")) return completeSetupValue(prefix, currentSetup);
  }
  const flagCompletions = SYNC_FLAG_COMPLETIONS[command];
  if (!flagCompletions) return null;
  const completedArgs = trailingSpace ? args : args.slice(0, -1);
  const completedValues = completedArgs.filter((arg) => !arg.startsWith("-"));
  if (command === "rollback" ? completedValues.length > 1 : completedValues.length > 0) {
    return null;
  }
  const current = trailingSpace ? "" : args.at(-1) ?? "";
  if (current && !current.startsWith("-")) return null;
  const currentRaw = trailingSpace ? "" : prefix.match(/\S+$/)?.[0] ?? "";
  const completionPrefix = trailingSpace ? prefix : prefix.slice(0, prefix.length - currentRaw.length);
  const matches = flagCompletions.filter((item) => item.value.startsWith(current));
  return matches.length > 0 ? matches.map((item) => ({ ...item, value: `${completionPrefix}${item.value}` })) : null;
}
function completeSetupValue(prefix, current) {
  const currentRaw = current ? prefix.match(/\S+$/u)?.[0] ?? "" : "";
  const completionPrefix = currentRaw ? prefix.slice(0, prefix.length - currentRaw.length) : prefix;
  const matches = setupCompletionNames.filter((name) => name.startsWith(current));
  return matches.length > 0 ? matches.map((name) => ({
    value: `${completionPrefix}${name}`,
    label: name,
    description: "Sync setup"
  })) : null;
}
function syncMenuOptions() {
  return SYNC_COMMANDS.map(({ name, description }) => `${name} \u2014 ${description}`);
}
function syncCommandFromMenuOption(option) {
  return SYNC_COMMANDS.find(({ name, description }) => option === `${name} \u2014 ${description}`)?.name;
}
async function resolveSyncCommand(input, ctx) {
  const [subcommand, ...rest] = splitArgs(input);
  if (subcommand) return { subcommand, rest };
  if (!ctx.hasUI) {
    ctx.ui.notify(usage(), "info");
    return void 0;
  }
  const selectedOption = await ctx.ui.select("pi-sync", syncMenuOptions());
  const selected = selectedOption ? syncCommandFromMenuOption(selectedOption) : void 0;
  if (!selected) return void 0;
  if (selected !== "rollback") return { subcommand: selected, rest: [] };
  const target = (await ctx.ui.input("Rollback snapshot", "snapshot id"))?.trim();
  if (!target) {
    ctx.ui.notify("Rollback cancelled.", "info");
    return void 0;
  }
  return { subcommand: selected, rest: [target] };
}
function usage() {
  const commands = SYNC_COMMANDS.map(
    (command) => `${command.name}${"usageSuffix" in command ? command.usageSuffix : ""}`
  ).join(", ");
  return [
    "Usage: /sync <command>",
    `Commands: ${commands}`,
    "Settings: use /sync init or edit storage connections and sync setups in ~/.pi/agent/pi-sync.json (or the configured Pi agent directory). Version 1 and version 2 settings are unsupported and are never rewritten."
  ].join("\n");
}
var YES_FLAG_COMPLETIONS, SYNC_COMMANDS, SYNC_COMMAND_COMPLETIONS, setupCompletionNames, SETUP_FLAG_COMPLETION, SYNC_FLAG_COMPLETIONS;
var init_command = __esm({
  "packages/pi-sync/src/command.ts"() {
    "use strict";
    YES_FLAG_COMPLETIONS = [
      { value: "--yes", label: "--yes", description: "Skip confirmation prompts" },
      { value: "-y", label: "-y", description: "Skip confirmation prompts" }
    ];
    SYNC_COMMANDS = [
      { name: "help", description: "Show command usage" },
      { name: "use", description: "Switch the current sync setup", usageSuffix: " <setup>" },
      { name: "init", description: "Create local config template" },
      { name: "config", description: "Show resolved configuration" },
      { name: "files", description: "Choose included content" },
      { name: "status", description: "Show sync status" },
      { name: "diff", description: "Show local/remote diff" },
      { name: "doctor", description: "Check config, secrets, and lock state" },
      { name: "push", description: "Upload local settings" },
      { name: "pull", description: "Apply remote settings" },
      { name: "sync", description: "Push or pull as needed" },
      { name: "history", description: "Show recent remote snapshots" },
      { name: "rollback", description: "Apply a previous snapshot", usageSuffix: " <snapshot>" },
      { name: "migrate-state", description: "Move legacy state into pi-sync/" },
      { name: "unlock", description: "Remove a stale local lock", usageSuffix: " --stale" }
    ];
    SYNC_COMMAND_COMPLETIONS = SYNC_COMMANDS.map(
      ({ name, description }) => ({ value: name, label: name, description })
    );
    setupCompletionNames = [];
    SETUP_FLAG_COMPLETION = {
      value: "--setup",
      label: "--setup",
      description: "Address a sync setup without switching"
    };
    SYNC_FLAG_COMPLETIONS = {
      config: [SETUP_FLAG_COMPLETION],
      files: [SETUP_FLAG_COMPLETION],
      status: [SETUP_FLAG_COMPLETION],
      diff: [SETUP_FLAG_COMPLETION],
      doctor: [SETUP_FLAG_COMPLETION],
      push: [
        ...YES_FLAG_COMPLETIONS,
        { value: "--force", label: "--force", description: "Overwrite visible remote changes" },
        SETUP_FLAG_COMPLETION
      ],
      pull: [
        ...YES_FLAG_COMPLETIONS,
        { value: "--force", label: "--force", description: "Overwrite local changes" },
        SETUP_FLAG_COMPLETION
      ],
      sync: [
        ...YES_FLAG_COMPLETIONS,
        { value: "--force", label: "--force", description: "Resolve conflicts by forcing action" },
        SETUP_FLAG_COMPLETION
      ],
      history: [SETUP_FLAG_COMPLETION],
      rollback: [...YES_FLAG_COMPLETIONS, SETUP_FLAG_COMPLETION],
      "migrate-state": YES_FLAG_COMPLETIONS,
      unlock: [{ value: "--stale", label: "--stale", description: "Remove only a stale lock" }]
    };
  }
});

// packages/pi-sync/src/config-file.ts
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdirSync,
  realpath,
  realpathSync,
  rmdir,
  rmdirSync,
  stat,
  statSync,
  utimes,
  utimesSync
} from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import lockfile from "proper-lockfile";
function localConfigPath() {
  return path.join(getAgentDir(), CONFIG_FILE_NAME);
}
function legacyLocalConfigPath() {
  return path.join(getAgentDir(), LEGACY_CONFIG_FILE_NAME);
}
async function activeLocalConfigPath() {
  const canonicalPath = localConfigPath();
  const legacyPath = legacyLocalConfigPath();
  return withLocalConfigReadLockIfNeeded(async () => {
    if (await pathExists(canonicalPath)) return canonicalPath;
    return await pathExists(legacyPath) ? legacyPath : canonicalPath;
  });
}
function consumeLocalConfigMigrationNotice() {
  const configPath = localConfigPath();
  const notice = configMigrationNotices.get(configPath);
  configMigrationNotices.delete(configPath);
  return notice;
}
async function readMigratingLocalConfigDocument(validateForMigration) {
  return withLocalConfigReadLockIfNeeded(async () => {
    const configPath = await prepareLocalConfigPath(validateForMigration);
    const snapshot = await readConfigSnapshotIfExists(configPath);
    return snapshot ? { path: configPath, ...snapshot } : void 0;
  });
}
async function withLocalConfigReadLockIfNeeded(read) {
  if (await pathExists(localConfigPath()) || await pathExists(legacyLocalConfigPath())) {
    return withLocalConfigFileLock(read);
  }
  await afterMissingConfigReadProbeHook();
  if (await pathExists(configMutationLockPath())) return withLocalConfigFileLock(read);
  return read();
}
function updateLocalConfigDocument(defaultValue, update, validate, signal) {
  return withLocalConfigFileLock(async () => {
    signal?.throwIfAborted();
    const configPath = await prepareLocalConfigPath(validate);
    const snapshot = await readConfigSnapshotIfExists(configPath);
    const document = snapshot ? { path: configPath, ...snapshot } : void 0;
    const current = document ? structuredClone(document.parsed) : structuredClone(defaultValue);
    const next = update(current);
    validate(next);
    signal?.throwIfAborted();
    if (document && JSON.stringify(document.parsed) === JSON.stringify(next)) return next;
    if (document) await replaceLocalConfigDocumentUnlocked(document, next);
    else await installPrivateConfigExclusively(localConfigPath(), serializedConfig(next));
    return next;
  });
}
function createLocalConfigDocument(value) {
  return withLocalConfigFileLock(async () => {
    const bytes = serializedConfig(value);
    try {
      await installPrivateConfigExclusively(localConfigPath(), bytes);
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new Error("Pi-sync settings were created concurrently; reopen settings and retry.");
      }
      throw error;
    }
  });
}
async function replaceLocalConfigDocumentUnlocked(document, value) {
  const nextBytes = serializedConfig(value);
  const canonicalPath = localConfigPath();
  if (document.path !== canonicalPath) {
    if (!await configDocumentStillMatches(document)) throw settingsChangedError();
    let installed2;
    try {
      installed2 = await installPrivateConfigExclusively(canonicalPath, nextBytes);
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new Error("Canonical settings were created concurrently; no settings were replaced.");
      }
      throw error;
    }
    if (!await configDocumentStillMatches(document)) {
      await quarantineAndRemoveConfigIfMatchesUnlocked(canonicalPath, installed2, nextBytes);
      throw settingsChangedError();
    }
    return;
  }
  const quarantinePath = await claimCanonicalConfigDocument(document);
  let installed;
  try {
    installed = await installPrivateConfigExclusively(canonicalPath, nextBytes);
  } catch (error) {
    await restoreQuarantinedConfig(canonicalPath, quarantinePath);
    if (error.code === "EEXIST") {
      throw new Error("Canonical settings changed concurrently; no settings were replaced.");
    }
    throw error;
  }
  try {
    await afterReplacementInstalledHook();
    if (!await fileIdentityAndContentsMatch(quarantinePath, document.identity, document.bytes)) {
      throw settingsChangedError();
    }
    if (process.platform !== "win32") await fs.chmod(quarantinePath, 384);
  } catch (error) {
    await quarantineAndRemoveConfigIfMatchesUnlocked(canonicalPath, installed, nextBytes);
    await restoreQuarantinedConfig(canonicalPath, quarantinePath);
    throw error;
  }
  await fs.rm(quarantinePath).catch(() => void 0);
  await syncParentDirectory(canonicalPath).catch(() => void 0);
}
async function prepareLocalConfigPath(validateForMigration) {
  const canonicalPath = localConfigPath();
  const legacyPath = legacyLocalConfigPath();
  if (await pathExists(canonicalPath)) {
    const legacyStatus = await secureIgnoredLegacyIfPresent(legacyPath);
    if (legacyStatus !== "missing" && !legacyPresenceNoticed.has(canonicalPath)) {
      legacyPresenceNoticed.add(canonicalPath);
      recordConfigMigrationNotice(
        canonicalPath,
        legacyStatus === "private" ? `${LEGACY_CONFIG_FILE_NAME} legacy settings were ignored because ${CONFIG_FILE_NAME} takes precedence. Delete ${LEGACY_CONFIG_FILE_NAME} after confirming your settings.` : `${LEGACY_CONFIG_FILE_NAME} legacy settings were ignored because ${CONFIG_FILE_NAME} takes precedence, but pi-sync could not verify them as a private regular file. Secure or delete the legacy path after confirming your settings.`
      );
    }
    return canonicalPath;
  }
  const legacy = await readConfigSnapshotIfExists(legacyPath);
  if (!legacy) return canonicalPath;
  validateForMigration(legacy.parsed);
  let installedIdentity;
  try {
    installedIdentity = await installPrivateConfigExclusively(canonicalPath, legacy.bytes);
  } catch (error) {
    if (error.code === "EEXIST") {
      recordConfigMigrationNotice(
        canonicalPath,
        `${LEGACY_CONFIG_FILE_NAME} legacy settings were ignored because ${CONFIG_FILE_NAME} was created concurrently and takes precedence.`
      );
      return canonicalPath;
    }
    recordConfigMigrationNotice(
      canonicalPath,
      `Could not migrate ${LEGACY_CONFIG_FILE_NAME} to ${CONFIG_FILE_NAME}; the legacy settings were used for this session and were not changed.`
    );
    return legacyPath;
  }
  if (!await configSnapshotStillMatches(legacyPath, legacy)) {
    const removed = await quarantineAndRemoveConfigIfMatchesUnlocked(
      canonicalPath,
      installedIdentity,
      legacy.bytes
    );
    recordConfigMigrationNotice(
      canonicalPath,
      removed ? `${LEGACY_CONFIG_FILE_NAME} changed during migration; the stale ${CONFIG_FILE_NAME} copy was removed and the legacy settings were used for this session.` : `${LEGACY_CONFIG_FILE_NAME} changed during migration, but ${CONFIG_FILE_NAME} was replaced concurrently and takes precedence.`
    );
    return removed ? legacyPath : canonicalPath;
  }
  legacyPresenceNoticed.add(canonicalPath);
  recordConfigMigrationNotice(
    canonicalPath,
    `pi-sync settings migrated from ${LEGACY_CONFIG_FILE_NAME} to ${CONFIG_FILE_NAME}; the private legacy file was retained as a recovery copy and can be deleted after verification.`
  );
  return canonicalPath;
}
async function secureIgnoredLegacyIfPresent(filePath) {
  let pathStat;
  try {
    pathStat = await fs.lstat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return "missing";
    return "unsafe";
  }
  if (pathStat.isSymbolicLink() || !pathStat.isFile()) return "unsafe";
  let handle;
  try {
    handle = await fs.open(filePath, "r");
    const openedStat = await handle.stat();
    if (openedStat.dev !== pathStat.dev || openedStat.ino !== pathStat.ino) {
      return "unsafe";
    }
    if (process.platform !== "win32" && (openedStat.mode & 511) !== 384) {
      await handle.chmod(384);
    }
    return "private";
  } catch {
    return "unsafe";
  } finally {
    await handle?.close().catch(() => void 0);
  }
}
async function readConfigSnapshotIfExists(filePath) {
  let pathStat;
  try {
    pathStat = await fs.lstat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
  if (pathStat.isSymbolicLink()) {
    throw new Error(`Refusing to read symlinked pi-sync config: ${filePath}`);
  }
  if (!pathStat.isFile()) throw new Error(`pi-sync config is not a regular file: ${filePath}`);
  const handle = await fs.open(filePath, "r");
  try {
    const openedStat = await handle.stat();
    if (openedStat.dev !== pathStat.dev || openedStat.ino !== pathStat.ino) {
      throw new Error(`pi-sync config changed while opening: ${filePath}`);
    }
    if (process.platform !== "win32" && (openedStat.mode & 511) !== 384) {
      await handle.chmod(384);
    }
    const bytes = await handle.readFile();
    return {
      bytes,
      identity: { dev: openedStat.dev, ino: openedStat.ino },
      parsed: parseConfigObject(bytes, filePath)
    };
  } finally {
    await handle.close();
  }
}
function serializedConfig(value) {
  return Buffer.from(`${JSON.stringify(value, null, "	")}
`, "utf8");
}
function parseConfigObject(bytes, filePath) {
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new SyntaxError(`Invalid JSON in pi-sync config: ${filePath}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`pi-sync config must contain a JSON object: ${filePath}`);
  }
  return parsed;
}
async function installPrivateConfigExclusively(filePath, bytes) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.migrate`
  );
  let handle;
  try {
    handle = await fs.open(temporaryPath, "wx", 384);
    await handle.writeFile(bytes);
    if (process.platform !== "win32") await handle.chmod(384);
    await handle.sync();
    await handle.close();
    handle = void 0;
    await publishConfigFile(temporaryPath, filePath);
    const installed = await fs.lstat(filePath);
    let publishedHandle;
    let publicationError;
    try {
      if (installed.isSymbolicLink() || !installed.isFile()) {
        throw new Error(`Published pi-sync settings are not a regular file: ${filePath}`);
      }
      publishedHandle = await fs.open(filePath, "r+");
      const published = await publishedHandle.stat();
      if (published.dev !== installed.dev || published.ino !== installed.ino) {
        throw new Error(`Published pi-sync settings changed while opening: ${filePath}`);
      }
      if (process.platform !== "win32") await publishedHandle.chmod(384);
      await publishedHandle.sync();
      await syncParentDirectory(filePath);
    } catch (error) {
      publicationError = error;
    } finally {
      await publishedHandle?.close().catch(() => void 0);
    }
    if (publicationError) {
      await quarantineAndRemoveConfigIfMatchesUnlocked(
        filePath,
        { dev: installed.dev, ino: installed.ino },
        bytes
      );
      throw publicationError;
    }
    return { dev: installed.dev, ino: installed.ino };
  } finally {
    await handle?.close().catch(() => void 0);
    await fs.rm(temporaryPath, { force: true }).catch(() => void 0);
  }
}
async function configDocumentStillMatches(document) {
  return fileIdentityAndContentsMatch(document.path, document.identity, document.bytes);
}
async function claimCanonicalConfigDocument(document) {
  const quarantinePath = path.join(
    path.dirname(document.path),
    `.${path.basename(document.path)}.${randomUUID()}.schema-migration-source`
  );
  try {
    await fs.rename(document.path, quarantinePath);
    await syncParentDirectory(document.path);
  } catch (error) {
    await restoreQuarantinedConfig(document.path, quarantinePath);
    throw error;
  }
  if (!await fileIdentityAndContentsMatch(quarantinePath, document.identity, document.bytes)) {
    await restoreQuarantinedConfig(document.path, quarantinePath);
    throw settingsChangedError();
  }
  if (await pathExists(document.path)) {
    await restoreQuarantinedConfig(document.path, quarantinePath);
    throw new Error("Canonical settings changed concurrently; no settings were replaced.");
  }
  return quarantinePath;
}
function settingsChangedError() {
  return new Error("pi-sync settings changed during migration; no settings were replaced.");
}
async function configSnapshotStillMatches(filePath, snapshot) {
  return fileIdentityAndContentsMatch(filePath, snapshot.identity, snapshot.bytes);
}
async function quarantineAndRemoveConfigIfMatchesUnlocked(filePath, identity, expectedBytes) {
  const quarantinePath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.migration-retired`
  );
  try {
    await fs.rename(filePath, quarantinePath);
  } catch {
    return false;
  }
  await afterConfigQuarantinedHook();
  try {
    await syncParentDirectory(filePath);
  } catch {
    await restoreQuarantinedConfig(filePath, quarantinePath);
    return false;
  }
  const matches = await fileIdentityAndContentsMatch(quarantinePath, identity, expectedBytes);
  if (!matches) {
    await restoreQuarantinedConfig(filePath, quarantinePath);
    return false;
  }
  if (await pathExists(filePath)) {
    await fs.rm(quarantinePath, { force: true });
    await syncParentDirectory(filePath);
    return false;
  }
  await fs.rm(quarantinePath);
  await syncParentDirectory(filePath);
  return true;
}
async function fileIdentityAndContentsMatch(filePath, identity, expectedBytes) {
  try {
    const current = await fs.lstat(filePath);
    if (current.isSymbolicLink()) return false;
    if (current.dev !== identity.dev || current.ino !== identity.ino) return false;
    return (await fs.readFile(filePath)).equals(expectedBytes);
  } catch {
    return false;
  }
}
async function restoreQuarantinedConfig(filePath, quarantinePath) {
  try {
    await renameFileWithoutReplacement(quarantinePath, filePath);
    if (process.platform !== "win32") await fs.chmod(filePath, 384);
    await syncParentDirectory(filePath);
    return;
  } catch (error) {
    if (error.code !== "EEXIST") return;
  }
  try {
    if (process.platform !== "win32") await fs.chmod(quarantinePath, 384);
    await syncParentDirectory(filePath);
  } catch {
  }
}
function configMutationLockPath() {
  return `${localConfigPath()}.mutation-lock`;
}
async function withLocalConfigFileLock(run) {
  const configPath = localConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  let compromisedError;
  const release = await lockfile.lock(configPath, {
    fs: LOCKFILE_FS_ADAPTER,
    lockfilePath: configMutationLockPath(),
    realpath: false,
    stale: CONFIG_LOCK_STALE_MS,
    update: CONFIG_LOCK_UPDATE_MS,
    retries: { retries: 100, factor: 1.2, minTimeout: 10, maxTimeout: 100 },
    onCompromised: (error) => {
      compromisedError = error;
    }
  });
  try {
    const result = await run();
    if (compromisedError) throw compromisedError;
    return result;
  } finally {
    await release();
  }
}
async function syncParentDirectory(filePath) {
  if (process.platform === "win32") return;
  let handle;
  try {
    handle = await fs.open(path.dirname(filePath), "r");
    await handle.sync();
  } finally {
    await handle?.close().catch(() => void 0);
  }
}
async function publishFileWithoutReplacement(source, destination) {
  await beforeConfigPublicationHook();
  await renameFileWithoutReplacement(source, destination);
}
async function renameFileWithoutReplacement(source, destination) {
  if (await pathExists(destination)) {
    throw Object.assign(new Error(`Settings already exist: ${destination}`), { code: "EEXIST" });
  }
  await fs.rename(source, destination);
}
async function pathExists(filePath) {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
function recordConfigMigrationNotice(configPath, notice) {
  if (!configMigrationNotices.has(configPath)) configMigrationNotices.set(configPath, notice);
}
var CONFIG_FILE_NAME, LEGACY_CONFIG_FILE_NAME, configMigrationNotices, legacyPresenceNoticed, CONFIG_LOCK_STALE_MS, CONFIG_LOCK_UPDATE_MS, LOCKFILE_FS_ADAPTER, publishConfigFile, beforeConfigPublicationHook, afterMissingConfigReadProbeHook, afterReplacementInstalledHook, afterConfigQuarantinedHook;
var init_config_file = __esm({
  "packages/pi-sync/src/config-file.ts"() {
    "use strict";
    CONFIG_FILE_NAME = "pi-sync.json";
    LEGACY_CONFIG_FILE_NAME = "pi-sync.local.json";
    configMigrationNotices = /* @__PURE__ */ new Map();
    legacyPresenceNoticed = /* @__PURE__ */ new Set();
    CONFIG_LOCK_STALE_MS = 3e4;
    CONFIG_LOCK_UPDATE_MS = 1e4;
    LOCKFILE_FS_ADAPTER = {
      mkdir,
      mkdirSync,
      realpath,
      realpathSync,
      rmdir,
      rmdirSync,
      stat,
      statSync,
      utimes,
      utimesSync
    };
    publishConfigFile = publishFileWithoutReplacement;
    beforeConfigPublicationHook = async () => void 0;
    afterMissingConfigReadProbeHook = async () => void 0;
    afterReplacementInstalledHook = async () => void 0;
    afterConfigQuarantinedHook = async () => void 0;
  }
});

// packages/pi-sync/src/git-config.ts
function normalizeGitRemote(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return void 0;
  if (hasControlCharacter(normalized) || /\s/u.test(normalized) || normalized.startsWith("-") || normalized.includes("\\")) {
    throw new Error("Invalid pi-sync Git remote.");
  }
  if (!normalized.includes("://") && /^(?:[A-Za-z0-9._-]+@)?(?:\[[0-9A-Fa-f:]+\]|[A-Za-z0-9.-]+):(?!-)[^:].+$/u.test(normalized)) {
    return normalized;
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(normalized) && !normalized.includes("://")) {
    throw new Error("Invalid pi-sync Git remote: unsupported transport or remote-helper syntax.");
  }
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Invalid pi-sync Git remote: use an SSH or HTTPS remote.");
  }
  if (url.protocol !== "https:" && url.protocol !== "ssh:") {
    throw new Error("Invalid pi-sync Git remote: only SSH and HTTPS are supported.");
  }
  if (url.password || url.protocol === "https:" && url.username) {
    throw new Error("Invalid pi-sync Git remote: URL credentials or userinfo are not allowed.");
  }
  if (url.search || url.hash || !url.hostname || !url.pathname || url.pathname === "/") {
    throw new Error("Invalid pi-sync Git remote.");
  }
  return url.toString();
}
function normalizeGitRemoteIdentity(value) {
  const normalized = normalizeGitRemote(value);
  if (!normalized) return "";
  if (!normalized.includes("://")) {
    const match = /^(?<user>[A-Za-z0-9._-]+@)?(?<host>\[[0-9A-Fa-f:]+\]|[A-Za-z0-9.-]+):(?<path>.+)$/u.exec(
      normalized
    );
    if (!match?.groups) return normalized;
    const userAndHost = `${match.groups.user ?? ""}${match.groups.host.toLowerCase()}`;
    const remotePath = match.groups.path.replace(/\/+$/gu, "");
    return remotePath.startsWith("/") ? `scp-absolute://${userAndHost}${remotePath}` : `ssh://${userAndHost}/${remotePath}`;
  }
  const url = new URL(normalized);
  url.hostname = url.hostname.toLowerCase();
  if (url.protocol === "ssh:" && url.port === "22") url.port = "";
  url.pathname = url.pathname.replace(/\/+$/gu, "");
  if (url.protocol === "ssh:") {
    return `ssh://${url.username ? `${url.username}@` : ""}${url.host}${url.pathname}`;
  }
  return url.toString();
}
function normalizeGitBranch(value) {
  const branch = normalizeOptionalString(value) ?? DEFAULT_GIT_BRANCH;
  if (branch === "@" || branch.startsWith("-") || branch.startsWith("refs/") || branch.startsWith("/") || branch.endsWith("/") || branch.endsWith(".") || branch.includes("..") || branch.includes("@{") || branch.includes("\\") || hasControlCharacter(branch) || /[ ~^:?*[\]]/u.test(branch) || branch.split("/").some((segment) => !segment || segment.startsWith(".") || segment.endsWith(".lock"))) {
    throw new Error("Invalid pi-sync Git branch.");
  }
  return branch;
}
function normalizeGitDirectory(value) {
  const directory = trimSlashes(normalizeOptionalString(value) ?? DEFAULT_GIT_DIRECTORY);
  if (!directory || directory.startsWith("-") || directory.includes("\\") || hasControlCharacter(directory) || directory.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment === ".git")) {
    throw new Error("Invalid pi-sync Git directory.");
  }
  return directory;
}
function validateGitNamespace(value) {
  if (value.length > 256 || value === "." || value === ".." || value.includes("/") || value.includes("\\") || hasControlCharacter(value)) {
    throw new Error("Invalid pi-sync Git namespace.");
  }
}
function normalizeOptionalString(value) {
  if (value !== void 0 && typeof value !== "string") {
    throw new Error("Invalid pi-sync settings: expected a string.");
  }
  const normalized = value?.trim();
  return normalized || void 0;
}
function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/gu, "");
}
function hasControlCharacter(value) {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code >= 127 && code <= 159;
  });
}
var DEFAULT_GIT_BRANCH, DEFAULT_GIT_DIRECTORY;
var init_git_config = __esm({
  "packages/pi-sync/src/git-config.ts"() {
    "use strict";
    DEFAULT_GIT_BRANCH = "pi-sync";
    DEFAULT_GIT_DIRECTORY = "pi-sync";
  }
});

// packages/pi-sync/src/paths.ts
import path2 from "node:path";
function isDeniedPath(relativePath) {
  const normalized = toPosix(relativePath);
  const lower = normalized.toLowerCase();
  const segments = lower.split("/");
  const base = path2.posix.basename(lower);
  return segments.includes("node_modules") || segments.includes(".git") || segments.includes(".pisync") || segments.includes("pi-sync") || segments.includes(".pi-sync-state-migration.lock") || base === ".env" || base.startsWith(".env.") || base.endsWith(".env") || base.includes("secret") || base.includes("token") || base === "pi-sync.json" || base.startsWith("pi-sync.json.") || base.startsWith(".pi-sync.json.") || base === "pi-sync.local.json" || base.startsWith("pi-sync.local.json.") || base.startsWith(".pi-sync.local.json.");
}
function isPathInside(parent, child) {
  const relative = path2.relative(path2.resolve(parent), path2.resolve(child));
  return relative === "" || !relative.startsWith("..") && !path2.isAbsolute(relative);
}
function safeJoin(root, relativePath) {
  const target = path2.resolve(root, relativePath);
  assertWithinRoot(root, target, relativePath);
  return target;
}
function assertWithinRoot(root, target, label = target) {
  const resolvedRoot = path2.resolve(root);
  const resolvedTarget = path2.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path2.sep}`)) {
    throw new Error(`Unsafe path in snapshot: ${label}`);
  }
}
function encodeKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}
function posixJoin(...parts) {
  return parts.map((part) => trimSlashes2(part)).filter(Boolean).join("/");
}
function parentPaths(relativePath) {
  const results = [];
  let index = relativePath.lastIndexOf("/");
  while (index > 0) {
    results.push(relativePath.slice(0, index));
    index = relativePath.lastIndexOf("/", index - 1);
  }
  return results;
}
function toPosix(value) {
  return value.split(path2.sep).join("/");
}
function trimSlashes2(value) {
  return value.replace(/^\/+|\/+$/g, "");
}
var init_paths = __esm({
  "packages/pi-sync/src/paths.ts"() {
    "use strict";
  }
});

// packages/pi-sync/src/lock-policy.ts
var LOCK_GUARD_STALE_MS, LOCK_GUARD_UPDATE_MS;
var init_lock_policy = __esm({
  "packages/pi-sync/src/lock-policy.ts"() {
    "use strict";
    LOCK_GUARD_STALE_MS = 3e4;
    LOCK_GUARD_UPDATE_MS = 1e4;
  }
});

// packages/pi-sync/src/lockfile-fs.ts
import {
  mkdir as mkdir2,
  mkdirSync as mkdirSync2,
  realpath as realpath2,
  realpathSync as realpathSync2,
  rmdir as rmdir2,
  rmdirSync as rmdirSync2,
  stat as stat2,
  statSync as statSync2,
  utimes as utimes2,
  utimesSync as utimesSync2
} from "node:fs";
var LOCKFILE_FS_ADAPTER2;
var init_lockfile_fs = __esm({
  "packages/pi-sync/src/lockfile-fs.ts"() {
    "use strict";
    LOCKFILE_FS_ADAPTER2 = {
      mkdir: mkdir2,
      mkdirSync: mkdirSync2,
      realpath: realpath2,
      realpathSync: realpathSync2,
      rmdir: rmdir2,
      rmdirSync: rmdirSync2,
      stat: stat2,
      statSync: statSync2,
      utimes: utimes2,
      utimesSync: utimesSync2
    };
  }
});

// packages/pi-sync/src/state-directory.ts
import { lstatSync } from "node:fs";
import fs2 from "node:fs/promises";
import path3 from "node:path";
import { getAgentDir as getAgentDir2 } from "@earendil-works/pi-coding-agent";
import lockfile2 from "proper-lockfile";
function stateDir() {
  const roots = inspectStateRoots();
  if (roots.canonical) return canonicalStateDir();
  if (roots.legacy) return legacyStateDir();
  return canonicalStateDir();
}
function legacyStateDir() {
  return path3.join(getAgentDir2(), LEGACY_DIRECTORY_NAME);
}
function stateDirectoryMigrationNotice() {
  const roots = inspectStateRoots();
  if (!roots.legacy) return void 0;
  return "Legacy pi-sync state is still stored in .pisync. Close other Pi sessions, then run /sync migrate-state to move it to pi-sync/.";
}
async function withStateDirectoryAccess(fn) {
  const roots = inspectStateRoots();
  if (!roots.legacy) return fn();
  return runWithStateDirectoryGuard(await acquireSharedStateDirectoryGuard(), fn);
}
async function migrateLegacyStateDirectory() {
  const initial = inspectStateRoots();
  if (initial.canonical || !initial.legacy) return { status: "ready" };
  let guard;
  try {
    guard = await acquireStateDirectoryGuard();
  } catch (error) {
    if (!isLockHeldError(error)) throw error;
    return {
      status: "deferred",
      message: "pi-sync state migration was deferred because another state user is active. Close other Pi sessions and retry."
    };
  }
  return runWithStateDirectoryGuard(guard, async () => {
    const roots = inspectStateRoots();
    if (roots.canonical || !roots.legacy) return { status: "ready" };
    const legacyLock = path3.join(legacyStateDir(), "lock");
    const legacyGuardHeld = await lockfile2.check(legacyLock, {
      fs: LOCKFILE_FS_ADAPTER2,
      lockfilePath: `${legacyLock}.guard`,
      realpath: false,
      stale: LOCK_GUARD_STALE_MS
    });
    if (legacyGuardHeld || await pathExists2(legacyLock)) {
      return {
        status: "deferred",
        message: "pi-sync state migration was deferred because the legacy directory is busy. Close other Pi sessions, clear any confirmed stale sync lock, and retry."
      };
    }
    guard.throwIfCompromised();
    await fs2.rename(legacyStateDir(), canonicalStateDir());
    guard.throwIfCompromised();
    inspectStateRoots();
    return {
      status: "migrated",
      message: `Migrated pi-sync state from ${legacyStateDir()} to ${canonicalStateDir()}.`
    };
  });
}
async function acquireSharedStateDirectoryGuard() {
  const key = migrationLockPath();
  for (; ; ) {
    let shared = sharedStateDirectoryGuards.get(key);
    if (shared?.closing) {
      await shared.closing;
      continue;
    }
    if (!shared) {
      shared = { guard: acquireStateDirectoryGuard(), users: 0 };
      sharedStateDirectoryGuards.set(key, shared);
    }
    shared.users += 1;
    let guard;
    try {
      guard = await shared.guard;
    } catch (error) {
      if (sharedStateDirectoryGuards.get(key) === shared) {
        sharedStateDirectoryGuards.delete(key);
      }
      throw error;
    }
    let released = false;
    return {
      throwIfCompromised: guard.throwIfCompromised,
      release: async () => {
        if (released) return;
        released = true;
        shared.users -= 1;
        if (shared.users > 0) return;
        const closing = guard.release();
        shared.closing = closing;
        try {
          await closing;
        } finally {
          if (sharedStateDirectoryGuards.get(key) === shared) {
            sharedStateDirectoryGuards.delete(key);
          }
        }
      }
    };
  }
}
async function acquireStateDirectoryGuard() {
  let compromisedError;
  const release = await lockfile2.lock(getAgentDir2(), {
    fs: LOCKFILE_FS_ADAPTER2,
    lockfilePath: migrationLockPath(),
    realpath: false,
    stale: MIGRATION_LOCK_STALE_MS,
    update: MIGRATION_LOCK_UPDATE_MS,
    retries: { retries: 20, minTimeout: 10, maxTimeout: 50 },
    onCompromised: (error) => {
      compromisedError = error;
    }
  });
  return {
    release,
    throwIfCompromised: () => {
      if (compromisedError) throw compromisedError;
    }
  };
}
async function runWithStateDirectoryGuard(guard, fn) {
  let result;
  let failed = false;
  let failure;
  try {
    guard.throwIfCompromised();
    result = await fn();
    guard.throwIfCompromised();
  } catch (error) {
    failed = true;
    failure = error;
  }
  try {
    await guard.release();
  } catch (error) {
    if (!failed) {
      failed = true;
      failure = error;
    }
  }
  if (failed) throw failure;
  return result;
}
function isLockHeldError(error) {
  return error.code === "ELOCKED";
}
function canonicalStateDir() {
  return path3.join(getAgentDir2(), CANONICAL_DIRECTORY_NAME);
}
function migrationLockPath() {
  return path3.join(getAgentDir2(), MIGRATION_LOCK_NAME);
}
function inspectStateRoots() {
  const canonical = isDirectoryRoot(canonicalStateDir(), "canonical");
  const legacy = isDirectoryRoot(legacyStateDir(), "legacy");
  if (canonical && legacy) {
    throw new Error(
      `Both legacy ${legacyStateDir()} and canonical ${canonicalStateDir()} pi-sync state directories exist. Close all Pi sessions and reconcile the directories manually; pi-sync will not merge or delete either directory.`
    );
  }
  return { canonical, legacy };
}
function isDirectoryRoot(directory, label) {
  try {
    const entry = lstatSync(directory);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Refusing to use ${label} pi-sync state directory symbolic link: ${directory}`
      );
    }
    if (!entry.isDirectory()) {
      throw new Error(`${label} pi-sync state path is not a directory: ${directory}`);
    }
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function pathExists2(filePath) {
  try {
    await fs2.lstat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
var CANONICAL_DIRECTORY_NAME, LEGACY_DIRECTORY_NAME, MIGRATION_LOCK_NAME, MIGRATION_LOCK_STALE_MS, MIGRATION_LOCK_UPDATE_MS, sharedStateDirectoryGuards;
var init_state_directory = __esm({
  "packages/pi-sync/src/state-directory.ts"() {
    "use strict";
    init_lock_policy();
    init_lockfile_fs();
    CANONICAL_DIRECTORY_NAME = "pi-sync";
    LEGACY_DIRECTORY_NAME = ".pisync";
    MIGRATION_LOCK_NAME = ".pi-sync-state-migration.lock";
    MIGRATION_LOCK_STALE_MS = 3e4;
    MIGRATION_LOCK_UPDATE_MS = 1e4;
    sharedStateDirectoryGuards = /* @__PURE__ */ new Map();
  }
});

// packages/pi-sync/src/sync-policy.ts
import path4 from "node:path";
function normalizeSyncInclude(value) {
  if (!Array.isArray(value)) {
    throw new Error("Invalid pi-sync settings: sync.include must be an array.");
  }
  if (value.length > MAX_SYNC_INCLUDE_ITEMS) {
    throw new Error(
      `Invalid pi-sync settings: sync.include has too many items; limit: ${MAX_SYNC_INCLUDE_ITEMS}.`
    );
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  const pathRoot = { children: /* @__PURE__ */ new Map() };
  let totalBytes = 0;
  for (const item of value) {
    if (typeof item !== "string") {
      throw new Error("Invalid pi-sync settings: sync.include items must be strings.");
    }
    const itemBytes = Buffer.byteLength(item, "utf8");
    if (itemBytes > MAX_SYNC_INCLUDE_PATH_BYTES) {
      throw new Error(
        `Invalid pi-sync settings: sync.include item is too long; limit: ${MAX_SYNC_INCLUDE_PATH_BYTES} bytes.`
      );
    }
    totalBytes += itemBytes;
    if (totalBytes > MAX_SYNC_INCLUDE_TOTAL_BYTES) {
      throw new Error(
        `Invalid pi-sync settings: sync.include is too large; limit: ${MAX_SYNC_INCLUDE_TOTAL_BYTES} bytes.`
      );
    }
    const trimmed = item.trim();
    const builtIn = BUILT_IN_BY_LOWER.get(trimmed.toLowerCase());
    const normalized = builtIn ?? (trimmed.toLowerCase() === "sessions" ? "sessions" : trimmed);
    if (!builtIn && normalized !== "sessions") validateAgentRelativeInclude(normalized);
    const identity = normalized.toLowerCase();
    if (seen.has(identity)) {
      throw new Error(`Invalid pi-sync settings: duplicate sync.include item: ${item}`);
    }
    addIncludePath(pathRoot, identity, item);
    seen.add(identity);
    result.push(normalized);
  }
  return result;
}
function addIncludePath(root, identity, source) {
  let node = root;
  for (const segment of identity.split("/")) {
    if (node.selected !== void 0) throwOverlappingInclude(source);
    let child = node.children.get(segment);
    if (!child) {
      child = { children: /* @__PURE__ */ new Map() };
      node.children.set(segment, child);
    }
    node = child;
  }
  if (node.children.size > 0) throwOverlappingInclude(source);
  node.selected = identity;
}
function throwOverlappingInclude(item) {
  throw new Error(
    `Invalid pi-sync settings: overlapping sync.include items are ambiguous: ${item}`
  );
}
function validateAgentRelativeInclude(value) {
  const normalized = toPosix(value);
  const topLevel = normalized.split("/")[0]?.toLowerCase();
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || path4.posix.isAbsolute(normalized) || normalized.includes("\\") || path4.posix.normalize(normalized) !== normalized || // biome-ignore lint/suspicious/noControlCharactersInRegex: Include paths cannot contain controls.
  /[\u0000-\u001f\u007f-\u009f]/u.test(normalized)) {
    throw new Error(
      `Invalid pi-sync settings: sync.include item must be a safe agent-relative path: ${value}`
    );
  }
  if (isDeniedPath(normalized)) {
    throw new Error(`Invalid pi-sync settings: ${value} cannot be synced.`);
  }
  if (topLevel && RESERVED_TOP_LEVEL_NAMES.has(topLevel)) {
    throw new Error(
      `Invalid pi-sync settings: use the canonical ${topLevel} root instead of a nested sync.include path.`
    );
  }
}
function portableSnapshotSelection(value) {
  const selection = value;
  if (!selection || typeof selection !== "object" || Array.isArray(selection) || selection.version !== SNAPSHOT_SELECTION_VERSION || !Object.hasOwn(selection, "include") || Object.keys(selection).some((key) => key !== "version" && key !== "include")) {
    throw new Error("Invalid snapshot selection policy.");
  }
  return {
    version: SNAPSHOT_SELECTION_VERSION,
    include: normalizeSyncInclude(selection.include)
  };
}
function snapshotSelectionInclude(snapshot) {
  return snapshot.selection === void 0 ? void 0 : portableSnapshotSelection(snapshot.selection).include;
}
function selectionForSnapshot(include) {
  return { version: SNAPSHOT_SELECTION_VERSION, include: normalizeSyncInclude(include) };
}
function sameSyncInclude(left, right) {
  const normalizedLeft = normalizeSyncInclude(left);
  const normalizedRight = normalizeSyncInclude(right);
  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((item, index) => item === normalizedRight[index]);
}
function compareSyncInclude(local, remote) {
  const localInclude = normalizeSyncInclude(local);
  const remoteInclude = normalizeSyncInclude(remote);
  const localSet = new Set(localInclude);
  const remoteSet = new Set(remoteInclude);
  return {
    same: sameSyncInclude(localInclude, remoteInclude),
    remoteOnly: remoteInclude.filter((item) => !localSet.has(item)),
    localOnly: localInclude.filter((item) => !remoteSet.has(item))
  };
}
function inspectRemoteSelection(localInclude, snapshot) {
  const remoteInclude = snapshotSelectionInclude(snapshot);
  if (!remoteInclude) {
    return { kind: "legacy", discovered: discoverLegacySnapshotInclude(snapshot) };
  }
  const comparison = compareSyncInclude(localInclude, remoteInclude);
  return comparison.same ? { kind: "same", include: remoteInclude } : { kind: "different", include: remoteInclude, ...comparison };
}
function remoteSelectionMismatch(config, remoteInclude, configIdentity) {
  return new RemoteSelectionMismatchError(
    config.setupName,
    config.include,
    remoteInclude,
    configIdentity
  );
}
function formatRemoteSelectionMismatch(setupName, localInclude, remoteInclude) {
  const comparison = compareSyncInclude(localInclude, remoteInclude);
  const lines = [
    `Synced content differs for sync setup \u201C${stripTerminalControls(setupName)}\u201D.`,
    `Remote-only: ${comparison.remoteOnly.join(", ") || "none"}`,
    `This-device-only: ${comparison.localOnly.join(", ") || "none"}`
  ];
  if (comparison.remoteOnly.length === 0 && comparison.localOnly.length === 0) {
    lines.push(
      "Only ordering differs.",
      `Remote order: ${remoteInclude.join(", ") || "none"}`,
      `This device order: ${localInclude.join(", ") || "none"}`
    );
  }
  lines.push("Run /sync in TUI to review both content lists and choose what happens next.");
  return lines.join("\n");
}
function stripTerminalControls(value) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, "?");
}
function discoverLegacySnapshotInclude(snapshot) {
  const builtIns = /* @__PURE__ */ new Set();
  const custom = /* @__PURE__ */ new Set();
  let sessions = false;
  for (const file of snapshot.files) {
    const normalized = toPosix(file.path);
    if (!normalized || file.path.includes("\\") || normalized.length > 4096 || normalized.startsWith("../") || path4.posix.isAbsolute(normalized) || path4.posix.normalize(normalized) !== normalized || // biome-ignore lint/suspicious/noControlCharactersInRegex: Ignore unsafe legacy paths.
    /[\u0000-\u001f\u007f-\u009f]/u.test(normalized) || isDeniedPath(normalized)) {
      continue;
    }
    const [topLevel, ...rest] = normalized.split("/");
    if (!topLevel) continue;
    if (topLevel === "sessions" && rest.length > 0) {
      sessions = true;
      continue;
    }
    const builtIn = BUILT_IN_BY_LOWER.get(topLevel.toLowerCase());
    if (builtIn && (TOP_LEVEL_DIRS.has(builtIn) && rest.length > 0 || !TOP_LEVEL_DIRS.has(builtIn) && rest.length === 0)) {
      builtIns.add(builtIn);
      continue;
    }
    if (isSafeCustomIncludePath(topLevel)) custom.add(topLevel);
  }
  return [
    ...BUILT_IN_SYNC_ROOTS.filter((item) => builtIns.has(item)),
    ...[...custom].sort((left, right) => left.localeCompare(right)),
    ...sessions ? ["sessions"] : []
  ];
}
function syncIncludeSelection(value) {
  const include = normalizeSyncInclude(value);
  const builtIns = include.filter(
    (item) => BUILT_IN_BY_LOWER.has(item.toLowerCase())
  );
  const custom = include.filter(
    (item) => item !== "sessions" && !BUILT_IN_BY_LOWER.has(item.toLowerCase())
  );
  return { include, builtIns, custom, sessions: include.includes("sessions") };
}
function customIncludePathsByLower(value) {
  return new Map(
    syncIncludeSelection(value).custom.map((relativePath) => [
      relativePath.toLowerCase(),
      relativePath
    ])
  );
}
function includeFromSelectionConfig(config) {
  if (config.include !== void 0) return normalizeSyncInclude(config.include);
  return [
    ...normalizeSyncFiles(config.syncFiles),
    ...normalizeExtraFiles(config.extraFiles),
    ...config.syncSessions ? ["sessions"] : []
  ];
}
function isConfiguredSnapshotPath(relativePath, config, _legacyExtraFiles) {
  const normalized = toPosix(relativePath);
  const selection = syncIncludeSelection(includeFromSelectionConfig(config));
  if (normalized.startsWith("sessions/")) return selection.sessions;
  const lower = normalized.toLowerCase();
  if (!normalized.includes("/")) {
    const builtIn = BUILT_IN_BY_LOWER.get(lower);
    if (builtIn) return selection.builtIns.includes(builtIn) && !TOP_LEVEL_DIRS.has(builtIn);
  }
  const topLevel = normalized.slice(0, normalized.indexOf("/"));
  if (selection.builtIns.includes(topLevel) && TOP_LEVEL_DIRS.has(topLevel)) {
    return true;
  }
  return selection.custom.some((candidate) => {
    const candidateLower = candidate.toLowerCase();
    return lower === candidateLower || lower.startsWith(`${candidateLower}/`);
  });
}
function canonicalSnapshotPathForConfig(relativePath, includePaths) {
  const normalized = toPosix(relativePath);
  const lower = normalized.toLowerCase();
  return TOP_LEVEL_FILE_PATHS.get(lower) ?? includePaths.get(lower) ?? normalized;
}
function isPreservableUnmanagedSnapshotPath(relativePath) {
  const normalized = toPosix(relativePath);
  if (!normalized || isDeniedPath(normalized)) return false;
  if (normalized.startsWith("sessions/")) return normalized.endsWith(".jsonl");
  if (!normalized.includes("/")) {
    const lower = normalized.toLowerCase();
    return TOP_LEVEL_FILE_PATHS.has(lower) || !RESERVED_TOP_LEVEL_NAMES.has(lower);
  }
  return true;
}
function isSafeCustomIncludePath(relativePath) {
  try {
    validateAgentRelativeInclude(relativePath);
    return true;
  } catch {
    return false;
  }
}
function normalizeSyncFiles(value) {
  if (value === void 0) return [...DEFAULT_SYNC_INCLUDE];
  if (Array.isArray(value)) {
    return normalizeSyncInclude(value).filter(
      (item) => BUILT_IN_BY_LOWER.has(item.toLowerCase())
    );
  }
  throw new Error("Invalid pi-sync settings: expected an include array.");
}
function normalizeExtraFiles(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) => typeof item === "string" && isSafeCustomIncludePath(item)
  );
}
var BUILT_IN_SYNC_ROOTS, DEFAULT_SYNC_INCLUDE, SNAPSHOT_SELECTION_VERSION, MAX_SYNC_INCLUDE_ITEMS, MAX_SYNC_INCLUDE_PATH_BYTES, MAX_SYNC_INCLUDE_TOTAL_BYTES, BUILT_IN_BY_LOWER, TOP_LEVEL_FILE_PATHS, TOP_LEVEL_DIRS, RESERVED_TOP_LEVEL_NAMES, RemoteSelectionMismatchError;
var init_sync_policy = __esm({
  "packages/pi-sync/src/sync-policy.ts"() {
    "use strict";
    init_paths();
    BUILT_IN_SYNC_ROOTS = [
      "settings.json",
      "keybindings.json",
      "models.json",
      "AGENTS.md",
      "APPEND_SYSTEM.md",
      "skills",
      "prompts",
      "themes",
      "extensions"
    ];
    DEFAULT_SYNC_INCLUDE = [...BUILT_IN_SYNC_ROOTS];
    SNAPSHOT_SELECTION_VERSION = 1;
    MAX_SYNC_INCLUDE_ITEMS = 1024;
    MAX_SYNC_INCLUDE_PATH_BYTES = 4096;
    MAX_SYNC_INCLUDE_TOTAL_BYTES = 256 * 1024;
    BUILT_IN_BY_LOWER = new Map(
      BUILT_IN_SYNC_ROOTS.map((fileName) => [fileName.toLowerCase(), fileName])
    );
    TOP_LEVEL_FILE_PATHS = new Map(
      BUILT_IN_SYNC_ROOTS.filter((fileName) => fileName.includes(".")).map((fileName) => [
        fileName.toLowerCase(),
        fileName
      ])
    );
    TOP_LEVEL_DIRS = new Set(
      BUILT_IN_SYNC_ROOTS.filter((fileName) => !fileName.includes("."))
    );
    RESERVED_TOP_LEVEL_NAMES = /* @__PURE__ */ new Set([...BUILT_IN_BY_LOWER.keys(), "sessions"]);
    RemoteSelectionMismatchError = class extends Error {
      decision;
      setupName;
      localInclude;
      remoteInclude;
      constructor(setupName, localInclude, remoteInclude, configIdentity = JSON.stringify([setupName, normalizeSyncInclude(localInclude)])) {
        const local = normalizeSyncInclude(localInclude);
        const remote = normalizeSyncInclude(remoteInclude);
        super(formatRemoteSelectionMismatch(setupName, local, remote));
        this.name = "RemoteSelectionMismatchError";
        this.setupName = setupName;
        this.localInclude = local;
        this.remoteInclude = remote;
        this.decision = {
          setupName,
          configIdentity,
          localInclude: [...local],
          remoteInclude: [...remote]
        };
      }
    };
  }
});

// packages/pi-sync/src/webdav-config.ts
function normalizeWebDavIdentityUrl(value) {
  try {
    const url = new URL(value.trim());
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    url.pathname = `${url.pathname.replace(/\/+$/u, "")}/`;
    return url.toString();
  } catch {
    return value.trim();
  }
}
function normalizeWebDavUrl(value) {
  const normalized = normalizeOptionalString2(value);
  if (!normalized) return void 0;
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Invalid pi-sync WebDAV URL.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "Invalid pi-sync WebDAV URL: credentials, query, and fragment are not allowed."
    );
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]" || url.hostname === "::1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Invalid pi-sync WebDAV URL: HTTPS is required except for loopback.");
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/`;
  return url.toString();
}
function normalizeWebDavPath(value) {
  const normalized = trimSlashes3(normalizeOptionalString2(value) ?? DEFAULT_PATH);
  if (!normalized || normalized.includes("\\") || hasControlCharacter2(normalized) || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid pi-sync WebDAV path.");
  }
  return normalized;
}
function validateWebDavNamespace(value) {
  if (value === "." || value === ".." || value.includes("/") || value.includes("\\") || hasControlCharacter2(value)) {
    throw new Error("Invalid pi-sync WebDAV namespace.");
  }
}
function validateWebDavCredentials(username, password) {
  if (username.includes(":") || hasControlCharacter2(username) || password !== void 0 && hasControlCharacter2(password)) {
    throw new Error("Invalid pi-sync WebDAV credentials.");
  }
}
function normalizeOptionalString2(value) {
  const normalized = value?.trim();
  return normalized || void 0;
}
function trimSlashes3(value) {
  return value.replace(/^\/+|\/+$/gu, "");
}
function hasControlCharacter2(value) {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code >= 127 && code <= 159;
  });
}
var DEFAULT_PATH;
var init_webdav_config = __esm({
  "packages/pi-sync/src/webdav-config.ts"() {
    "use strict";
    DEFAULT_PATH = "pi-sync";
  }
});

// packages/pi-sync/src/config-errors.ts
function isMissingConfigError(error) {
  return error instanceof Error && (error.message.startsWith("Missing pi-sync settings.") || error.message === "No sync setups are configured.");
}
var init_config_errors = __esm({
  "packages/pi-sync/src/config-errors.ts"() {
    "use strict";
  }
});

// packages/pi-sync/src/config.ts
import { createHash, randomUUID as randomUUID2 } from "node:crypto";
import fs3 from "node:fs/promises";
import os from "node:os";
import path5 from "node:path";
import {
  getAgentDir as getAgentDir3
} from "@earendil-works/pi-coding-agent";
function sessionDirFromContext(ctx) {
  const manager = ctx.sessionManager;
  if (manager.usesDefaultSessionDir?.call(manager)) return void 0;
  return typeof manager.getSessionDir === "function" ? manager.getSessionDir.call(manager) : void 0;
}
async function loadConfig(setupName) {
  const settings = await requireSettings();
  const selectedName = setupName ?? settings.activeSyncSetup;
  if (!selectedName) throw new Error("No sync setups are configured.");
  validateConfigName(selectedName, "sync setup");
  const setup = ownObject(settings.syncSetups, selectedName);
  if (!setup)
    throw new Error(`Invalid pi-sync settings: sync setup \u201C${selectedName}\u201D was not found.`);
  const connectionName = setup.storage.connection;
  const connection = ownObject(
    settings.storageConnections,
    connectionName
  );
  if (!connection) {
    throw new Error(
      `Invalid pi-sync settings: sync setup \u201C${selectedName}\u201D references missing storage connection \u201C${connectionName}\u201D.`
    );
  }
  return resolveSyncConfig(selectedName, setup, connectionName, connection, settings.onSwitch);
}
async function loadPartialConfig(setupName) {
  const config = await loadConfig(setupName);
  return {
    setupName: config.setupName,
    ...storageReviewFromConfig(config),
    include: [...config.include],
    automatic: config.automatic,
    onSwitch: config.onSwitch
  };
}
function syncSetupStorageReview(setupName, setup, connectionName, connection) {
  return storageReviewFromConfig(
    resolveSyncConfig(setupName, setup, connectionName, connection, DEFAULT_ON_SWITCH)
  );
}
function syncSetupReviewIdentity(setupName, setup, connectionName, connection) {
  return syncConfigReviewIdentity(
    resolveSyncConfig(setupName, setup, connectionName, connection, DEFAULT_ON_SWITCH)
  );
}
function syncConfigReviewIdentity(config) {
  return JSON.stringify([
    config.setupName,
    config.connectionName,
    backendIdentityCoordinates(config),
    config.include,
    config.automatic
  ]);
}
function syncConfigReviewFingerprint(config) {
  return createHash("sha256").update(syncConfigReviewIdentity(config)).digest("hex");
}
function storageReviewFromConfig(config) {
  return {
    connectionName: config.connectionName,
    storageKind: config.backend.type,
    storagePath: config.storagePath,
    ...config.backend.type === "s3" ? { bucket: config.backend.destination.bucket } : config.backend.type === "git" ? { branch: config.backend.destination.branch } : {}
  };
}
async function configuredSyncSetupNames() {
  const settings = await readLocalConfigObject();
  return settings ? Object.keys(settings.syncSetups).sort((left, right) => left.localeCompare(right)) : [];
}
async function loadOnSwitch() {
  return (await requireSettings()).onSwitch;
}
function normalizeOnSwitch(value) {
  if (value === "ask-before-pull" || value === "pull-after-switch" || value === "switch-only") {
    return value;
  }
  throw new Error(
    'Invalid pi-sync settings: onSwitch must be "ask-before-pull", "pull-after-switch", or "switch-only".'
  );
}
function resolveSyncConfig(setupName, setup, connectionName, connection, onSwitch) {
  const storagePath = normalizeStoragePath(setup.storage.path);
  const namespace = storagePath.slice(storagePath.lastIndexOf("/") + 1);
  const include = normalizeSyncInclude(setup.sync.include);
  const common = {
    setupName,
    connectionName,
    storagePath,
    snapshotIdentity: namespace,
    include,
    automatic: setup.sync.automatic,
    onSwitch
  };
  if (connection.type === "git") {
    return {
      ...common,
      backend: {
        type: "git",
        profile: { kind: "git", remote: normalizeGitRemote(connection.remote) },
        destination: {
          branch: normalizeGitBranch(setup.storage.branch),
          directory: normalizeGitDirectory(storagePath),
          namespace
        }
      }
    };
  }
  if (connection.type === "webdav") {
    return {
      ...common,
      backend: {
        type: "webdav",
        profile: {
          kind: "webdav",
          url: normalizeWebDavUrl(connection.url),
          username: connection.credentials.username,
          password: connection.credentials.password
        },
        destination: { path: normalizeWebDavPath(storagePath), namespace }
      }
    };
  }
  return {
    ...common,
    backend: {
      type: "s3",
      profile: {
        kind: isCloudflareR2Endpoint(connection.endpoint) ? "r2" : "s3-compatible",
        endpoint: normalizeS3Endpoint(connection.endpoint),
        region: requiredString(connection.region, "S3 region"),
        accessKeyId: connection.credentials.accessKeyId,
        secretAccessKey: connection.credentials.secretAccessKey,
        sessionToken: optionalString(connection.credentials.sessionToken, "S3 session token")
      },
      destination: {
        bucket: normalizeS3Bucket(setup.storage.bucket),
        prefix: storagePath,
        namespace
      }
    }
  };
}
async function requireSettings() {
  const settings = await readLocalConfigObject();
  if (!settings) {
    throw new Error(`Missing pi-sync settings. Use /sync setup or create ${localConfigPath()}.`);
  }
  return settings;
}
function validateSettingsDocument(value) {
  if (value.version !== 3) {
    throw new Error(
      `Unsupported pi-sync settings: version 3 is required. Keep the existing file for recovery, then create a new version 3 ${path5.basename(localConfigPath())}; pi-sync will not migrate or overwrite old settings.`
    );
  }
  rejectLegacyFields(
    value,
    [
      "profiles",
      "targets",
      "activeTarget",
      "targetSwitchAction",
      "endpoint",
      "bucket",
      "region",
      "accessKeyId",
      "secretAccessKey",
      "sessionToken",
      "profile",
      "prefix",
      "autoSync",
      "syncFiles",
      "syncSessions",
      "extraFiles"
    ],
    "top level"
  );
  normalizeOnSwitch(value.onSwitch);
  const storageConnections = requireNamedObjectMap(
    value.storageConnections,
    "storageConnections",
    "storage connection"
  );
  const syncSetups = requireNamedObjectMap(value.syncSetups, "syncSetups", "sync setup");
  for (const name of Object.keys(storageConnections)) {
    validateStorageConnection(
      name,
      requireOwnObject(storageConnections, name, "storage connection")
    );
  }
  for (const name of Object.keys(syncSetups)) {
    validateSyncSetup(
      name,
      requireOwnObject(syncSetups, name, "sync setup"),
      storageConnections
    );
  }
  const names = Object.keys(syncSetups);
  const activeSyncSetup = optionalCanonicalReference(value.activeSyncSetup, "activeSyncSetup");
  if (names.length === 0) {
    if (activeSyncSetup !== void 0) {
      throw new Error("Invalid pi-sync settings: empty syncSetups cannot have activeSyncSetup.");
    }
  } else if (!activeSyncSetup || !Object.hasOwn(syncSetups, activeSyncSetup)) {
    throw new Error(
      "Invalid pi-sync settings: activeSyncSetup must reference an existing own-property sync setup."
    );
  }
  validateUniqueRemoteSyncSetups(syncSetups, storageConnections);
  return value;
}
function validateStorageConnection(name, value) {
  rejectLegacyFields(
    value,
    ["kind", "accessKeyId", "secretAccessKey", "sessionToken", "username", "password"],
    `storage connection \u201C${name}\u201D`
  );
  const type = requiredString(value.type, `storage connection \u201C${name}\u201D type`);
  if (type !== "s3" && type !== "git" && type !== "webdav") {
    throw new Error(`Invalid pi-sync settings: storage connection \u201C${name}\u201D has unsupported type.`);
  }
  const known = ["endpoint", "region", "remote", "url", "credentials"];
  const allowed = type === "s3" ? /* @__PURE__ */ new Set(["endpoint", "region", "credentials"]) : type === "git" ? /* @__PURE__ */ new Set(["remote"]) : /* @__PURE__ */ new Set(["url", "credentials"]);
  if (known.some((field) => Object.hasOwn(value, field) && !allowed.has(field))) {
    throw new Error(
      `Invalid pi-sync settings: ${type.toUpperCase()} storage connection \u201C${name}\u201D mixes backend fields.`
    );
  }
  if (type === "git") {
    if (!normalizeGitRemote(requiredString(value.remote, `Git remote for \u201C${name}\u201D`))) {
      throw new Error(`Invalid pi-sync settings: Git remote for \u201C${name}\u201D is required.`);
    }
    return;
  }
  const credentials = requireRecord(
    value.credentials,
    `credentials for storage connection \u201C${name}\u201D`
  );
  if (type === "webdav") {
    normalizeWebDavUrl(requiredString(value.url, `WebDAV URL for \u201C${name}\u201D`));
    const username = requiredString(credentials.username, `WebDAV username for \u201C${name}\u201D`);
    const password = requiredSecret(credentials.password, `WebDAV password for \u201C${name}\u201D`);
    if (["accessKeyId", "secretAccessKey", "sessionToken"].some(
      (field) => Object.hasOwn(credentials, field)
    )) {
      throw new Error(`Invalid pi-sync settings: WebDAV credentials for \u201C${name}\u201D mix fields.`);
    }
    validateWebDavCredentials(username, password);
    return;
  }
  normalizeS3Endpoint(requiredString(value.endpoint, `S3 endpoint for \u201C${name}\u201D`));
  requiredString(value.region, `S3 region for \u201C${name}\u201D`);
  requiredString(credentials.accessKeyId, `S3 access key id for \u201C${name}\u201D`);
  requiredSecret(credentials.secretAccessKey, `S3 secret access key for \u201C${name}\u201D`);
  optionalString(credentials.sessionToken, `S3 session token for \u201C${name}\u201D`);
  if (["username", "password"].some((field) => Object.hasOwn(credentials, field))) {
    throw new Error(`Invalid pi-sync settings: S3 credentials for \u201C${name}\u201D mix fields.`);
  }
}
function validateSyncSetup(name, value, connections) {
  rejectLegacyFields(
    value,
    [
      "profile",
      "bucket",
      "branch",
      "path",
      "prefix",
      "directory",
      "namespace",
      "autoSync",
      "syncFiles",
      "syncSessions",
      "extraFiles"
    ],
    `sync setup \u201C${name}\u201D`
  );
  const storage = requireRecord(value.storage, `storage for sync setup \u201C${name}\u201D`);
  const sync2 = requireRecord(value.sync, `sync policy for sync setup \u201C${name}\u201D`);
  rejectLegacyFields(
    storage,
    ["profile", "prefix", "directory", "namespace"],
    `storage for sync setup \u201C${name}\u201D`
  );
  rejectLegacyFields(
    sync2,
    ["autoSync", "syncFiles", "syncSessions", "extraFiles"],
    `sync policy for sync setup \u201C${name}\u201D`
  );
  const connectionName = requiredCanonicalReference(
    storage.connection,
    `storage connection reference for sync setup \u201C${name}\u201D`
  );
  validateConfigName(connectionName, "storage connection reference");
  const connection = ownObject(connections, connectionName);
  if (!connection) {
    throw new Error(
      `Invalid pi-sync settings: sync setup \u201C${name}\u201D references missing storage connection \u201C${connectionName}\u201D.`
    );
  }
  const type = connection.type;
  normalizeStoragePath(requiredString(storage.path, `storage path for sync setup \u201C${name}\u201D`));
  if (type === "s3") {
    normalizeS3Bucket(requiredString(storage.bucket, `S3 bucket for sync setup \u201C${name}\u201D`));
    if (Object.hasOwn(storage, "branch")) mixedSetupError("S3", name);
  } else if (type === "git") {
    normalizeGitBranch(requiredString(storage.branch, `Git branch for sync setup \u201C${name}\u201D`));
    if (Object.hasOwn(storage, "bucket")) mixedSetupError("Git", name);
  } else if (type === "webdav") {
    if (Object.hasOwn(storage, "bucket") || Object.hasOwn(storage, "branch")) {
      mixedSetupError("WebDAV", name);
    }
  }
  if (!Object.hasOwn(sync2, "include")) {
    throw new Error(`Invalid pi-sync settings: sync setup \u201C${name}\u201D is missing sync.include.`);
  }
  normalizeSyncInclude(sync2.include);
  if (typeof sync2.automatic !== "boolean") {
    throw new Error(
      `Invalid pi-sync settings: sync setup \u201C${name}\u201D sync.automatic must be boolean.`
    );
  }
}
function mixedSetupError(type, name) {
  throw new Error(`Invalid pi-sync settings: ${type} sync setup \u201C${name}\u201D mixes backend fields.`);
}
function validateUniqueRemoteSyncSetups(setups, connections) {
  const identities = /* @__PURE__ */ new Map();
  for (const name of Object.keys(setups)) {
    const setup = requireOwnObject(setups, name, "sync setup");
    const connection = requireOwnObject(
      connections,
      setup.storage.connection,
      "storage connection"
    );
    const identity = effectiveSyncSetupRemoteIdentity(setup, connection);
    const existing = identities.get(identity);
    if (existing) {
      throw new Error(
        `Invalid pi-sync settings: sync setups \u201C${existing}\u201D and \u201C${name}\u201D use the same normalized remote location.`
      );
    }
    identities.set(identity, name);
  }
}
function effectiveSyncSetupRemoteIdentity(setup, connection) {
  const storagePath = normalizeStoragePath(setup.storage.path);
  if (connection.type === "git") {
    return JSON.stringify([
      "git",
      normalizeGitRemoteIdentity(connection.remote),
      normalizeGitBranch(setup.storage.branch),
      normalizeGitDirectory(storagePath)
    ]);
  }
  if (connection.type === "webdav") {
    return JSON.stringify([
      "webdav",
      normalizeWebDavIdentityUrl(connection.url),
      connection.credentials.username.trim(),
      normalizeWebDavPath(storagePath)
    ]);
  }
  return JSON.stringify([
    "s3",
    normalizeEndpointIdentity(connection.endpoint),
    normalizeS3Bucket(setup.storage.bucket),
    storagePath
  ]);
}
function rejectLegacyFields(value, fields, context) {
  const field = fields.find((candidate) => Object.hasOwn(value, candidate));
  if (field) {
    throw new Error(
      `Invalid pi-sync settings: ${context} contains unsupported version 1/2 field \u201C${field}\u201D.`
    );
  }
}
function requireNamedObjectMap(value, field, itemLabel) {
  const result = requireRecord(value, field);
  for (const name of Object.keys(result)) validateConfigName(name, itemLabel);
  return result;
}
function requireOwnObject(value, key, label) {
  const item = ownObject(value, key);
  if (!item) throw new Error(`Invalid pi-sync settings: ${label} \u201C${key}\u201D must be an object.`);
  return item;
}
function ownObject(value, key) {
  if (!Object.hasOwn(value, key)) return void 0;
  const item = value[key];
  return item && typeof item === "object" && !Array.isArray(item) ? item : void 0;
}
function requireRecord(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid pi-sync settings: ${field} must be an object.`);
  }
  return value;
}
function validateConfigName(value, field) {
  if (!value.trim() || value !== value.trim() || value.length > 100 || value === "__proto__" || value === "prototype" || value === "constructor" || hasControlCharacter3(value)) {
    throw new Error(`Invalid pi-sync settings: invalid ${field} name.`);
  }
}
function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim() || hasControlCharacter3(value)) {
    throw new Error(`Invalid pi-sync settings: ${field} must be a non-empty string.`);
  }
  return value.trim();
}
function requiredCanonicalReference(value, field) {
  const normalized = requiredString(value, field);
  if (value !== normalized) {
    throw new Error(`Invalid pi-sync settings: ${field} must not have surrounding whitespace.`);
  }
  return normalized;
}
function optionalCanonicalReference(value, field) {
  const normalized = optionalString(value, field);
  if (normalized !== void 0 && value !== normalized) {
    throw new Error(`Invalid pi-sync settings: ${field} must not have surrounding whitespace.`);
  }
  return normalized;
}
function requiredSecret(value, field) {
  if (typeof value !== "string" || !value || hasControlCharacter3(value)) {
    throw new Error(`Invalid pi-sync settings: ${field} must be configured.`);
  }
  return value;
}
function optionalString(value, field) {
  if (value === void 0) return void 0;
  if (typeof value !== "string" || hasControlCharacter3(value)) {
    throw new Error(`Invalid pi-sync settings: ${field} must be a string.`);
  }
  return value.trim() || void 0;
}
function normalizeStoragePath(value) {
  const normalized = value.trim().replace(/^\/+|\/+$/gu, "");
  if (!normalized || normalized.length > 1024 || normalized.startsWith("-") || normalized.includes("\\") || hasControlCharacter3(normalized) || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid pi-sync settings: storage.path must be a safe relative path.");
  }
  return normalized;
}
function normalizeS3Endpoint(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Invalid pi-sync S3 endpoint.");
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback) || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid pi-sync S3 endpoint: HTTPS is required except for loopback.");
  }
  url.pathname = url.pathname.replace(/\/+$/gu, "");
  return url.toString().replace(/\/$/u, "");
}
function normalizeS3Bucket(value) {
  const bucket = requiredString(value, "S3 bucket");
  if (bucket.includes("/") || bucket.includes("\\") || bucket.startsWith("-")) {
    throw new Error("Invalid pi-sync S3 bucket.");
  }
  return bucket;
}
function normalizeEndpointIdentity(endpoint) {
  try {
    const url = new URL(endpoint.trim());
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/gu, "");
    return url.toString().replace(/\/$/u, "");
  } catch {
    return endpoint.trim();
  }
}
async function configuredSessionDir() {
  const settings = await readJsonIfExists(
    path5.join(agentDir(), "settings.json")
  );
  return settings?.sessionDir ? expandHome(settings.sessionDir) : void 0;
}
async function sessionDirForApply(ctx, snapshot) {
  const contextSessionDir = sessionDirFromContext(ctx);
  const localSessionDir = await configuredSessionDir();
  if (contextSessionDir && path5.resolve(contextSessionDir) !== path5.resolve(localSessionDir ?? "")) {
    return contextSessionDir;
  }
  return sessionDirFromSnapshot(snapshot) ?? contextSessionDir;
}
function sessionDirFromSnapshot(snapshot) {
  const settingsFile = snapshot.files.find((file) => file.path === "settings.json");
  if (!settingsFile) return void 0;
  try {
    const settings = JSON.parse(
      decodeBase64Strict(settingsFile.contentBase64, settingsFile.path).toString("utf8")
    );
    return settings.sessionDir ? expandHome(settings.sessionDir) : void 0;
  } catch {
    return void 0;
  }
}
function decodeBase64Strict(value, filePath) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error(`Invalid base64 content in snapshot file: ${filePath}`);
  }
  return Buffer.from(value, "base64");
}
async function readStateForConfig(config) {
  return await readJsonIfExists(statePathForConfig(config)) ?? {
    version: STATE_VERSION,
    profile: config.snapshotIdentity,
    lastFileHashes: {}
  };
}
async function writeStateForConfig(config, state) {
  await writeJson(statePathForConfig(config), state);
}
function statePathForConfig(config) {
  const identity = backendIdentityCoordinates(config);
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 16);
  return path5.join(stateDir(), "setups", `${config.backend.type}-${hash}.state.json`);
}
function backendIdentityCoordinates(config) {
  switch (config.backend.type) {
    case "s3":
      return JSON.stringify([
        "s3",
        normalizeEndpointIdentity(config.backend.profile.endpoint),
        config.backend.destination.bucket,
        config.storagePath
      ]);
    case "git":
      return JSON.stringify([
        "git",
        normalizeGitRemoteIdentity(config.backend.profile.remote),
        config.backend.destination.branch,
        config.storagePath
      ]);
    case "webdav":
      return JSON.stringify([
        "webdav",
        normalizeWebDavIdentityUrl(config.backend.profile.url),
        config.backend.profile.username,
        config.storagePath
      ]);
  }
}
function agentDir() {
  return getAgentDir3();
}
function expandHome(value) {
  return value === "~" || value.startsWith("~/") ? path5.join(os.homedir(), value.slice(2)) : value;
}
function localConfigTemplate() {
  return {
    version: 3,
    onSwitch: DEFAULT_ON_SWITCH,
    storageConnections: {},
    syncSetups: {}
  };
}
async function readLocalConfigDocument() {
  const document = await readMigratingLocalConfigDocument((settings) => {
    validateSettingsDocument(settings);
  });
  if (document) validateSettingsDocument(document.parsed);
  return document;
}
async function readLocalConfigObject() {
  return (await readLocalConfigDocument())?.parsed;
}
function updateLocalConfig(update, signal) {
  const operation = configUpdateQueue.then(() => {
    signal?.throwIfAborted();
    return performLocalConfigUpdate(update, signal);
  });
  configUpdateQueue = operation.then(
    () => void 0,
    () => void 0
  );
  return operation;
}
async function performLocalConfigUpdate(update, signal) {
  return updateLocalConfigDocument(localConfigTemplate(), update, validateSettingsDocument, signal);
}
function lockPath() {
  return path5.join(stateDir(), "lock");
}
async function ensureStateDir() {
  await fs3.mkdir(stateDir(), { recursive: true });
}
async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs3.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function writeJson(filePath, value) {
  await fs3.mkdir(path5.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${randomUUID2()}.tmp`;
  await fs3.writeFile(temp, `${JSON.stringify(value, null, "	")}
`, { mode: 384 });
  if (process.platform !== "win32") await fs3.chmod(temp, 384);
  await fs3.rename(temp, filePath);
}
function sessionTokenWarnings(config) {
  if (!isCloudflareR2Endpoint(config.endpoint) || !config.sessionToken) return [];
  return [
    "session token: configured for Cloudflare R2; if R2 rejects X-Amz-Security-Token, pi-sync retries once without it. R2 static access keys usually do not need a session token."
  ];
}
function syncSessionsWarnings(config) {
  if (!config.include.includes("sessions")) return [];
  return [
    "sessions: included; Pi session JSONL can contain prompts, tool output, file paths, images, and secrets. Sync sessions only to storage you trust."
  ];
}
function isCloudflareR2Endpoint(endpoint) {
  const value = endpoint?.trim();
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "r2.cloudflarestorage.com" || hostname.endsWith(".r2.cloudflarestorage.com");
  } catch {
    return false;
  }
}
function hasControlCharacter3(value) {
  return /[\u0000-\u001f\u007f-\u009f]/u.test(value);
}
var STATE_VERSION, DEFAULT_ON_SWITCH, configUpdateQueue;
var init_config = __esm({
  "packages/pi-sync/src/config.ts"() {
    "use strict";
    init_config_file();
    init_git_config();
    init_paths();
    init_state_directory();
    init_sync_policy();
    init_webdav_config();
    init_sync_policy();
    init_state_directory();
    init_config_errors();
    STATE_VERSION = 2;
    DEFAULT_ON_SWITCH = "ask-before-pull";
    configUpdateQueue = Promise.resolve();
  }
});

// packages/pi-sync/src/lock.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import fs4 from "node:fs/promises";
import lockfile3 from "proper-lockfile";
async function withLock(command, fn, options = {}) {
  await ensureStateDir();
  const lock = {
    id: randomUUID3(),
    pid: process.pid,
    command,
    startedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  let guard;
  let result;
  let failed = false;
  let failure;
  try {
    try {
      guard = await acquireGuard();
    } catch (error) {
      if (!isLockHeldError2(error)) throw error;
      throw await describeHeldLock();
    }
    let inspection = await inspectLock();
    if (inspection.status === "valid" && isStaleLock(inspection.lock)) {
      if (!options.reclaimStale) {
        throw new Error(
          `pi-sync lock is stale (pid ${inspection.lock.pid}). Run /sync unlock --stale, then retry.`
        );
      }
      guard.throwIfCompromised();
      const rechecked = await inspectLock();
      if (rechecked.status !== "valid" || rechecked.lock.id !== inspection.lock.id || !isStaleLock(rechecked.lock)) {
        throw new Error("pi-sync lock changed while preparing transaction recovery; retry.");
      }
      await fs4.rm(lockPath(), { force: true });
      inspection = { status: "missing" };
    }
    if (inspection.status === "valid") {
      throw new Error(
        `pi-sync is already running (${inspection.lock.command}, pid ${inspection.lock.pid}, started ${inspection.lock.startedAt}).`
      );
    }
    if (inspection.status === "unreadable") {
      throw new Error(
        "pi-sync lock metadata is unreadable. Run /sync unlock --stale after verifying no sync is running."
      );
    }
    await fs4.writeFile(lockPath(), JSON.stringify(lock, null, "	"), { flag: "wx" });
    guard.throwIfCompromised();
    result = await fn();
    guard.throwIfCompromised();
  } catch (error) {
    failed = true;
    failure = error;
  }
  try {
    const current = await readLock();
    if (current?.id === lock.id) await fs4.rm(lockPath(), { force: true });
  } catch (error) {
    if (!failed) {
      failed = true;
      failure = error;
    }
  }
  if (guard) {
    const releaseError = await releaseGuard(guard);
    if (releaseError && !failed) {
      failed = true;
      failure = releaseError;
    }
  }
  if (failed) throw failure;
  return result;
}
async function inspectLock() {
  try {
    const text = await fs4.readFile(lockPath(), "utf8");
    if (text.trim().length === 0) return { status: "unreadable" };
    const parsed = JSON.parse(text);
    return isLockFile(parsed) ? { status: "valid", lock: parsed } : { status: "unreadable" };
  } catch (error) {
    if (error.code === "ENOENT") return { status: "missing" };
    if (error instanceof SyntaxError) return { status: "unreadable" };
    throw error;
  }
}
async function readLock() {
  const inspection = await inspectLock();
  return inspection.status === "valid" ? inspection.lock : void 0;
}
function isLockGuardHeld() {
  return lockfile3.check(lockPath(), {
    fs: LOCKFILE_FS_ADAPTER2,
    lockfilePath: `${lockPath()}.guard`,
    realpath: false,
    stale: LOCK_GUARD_STALE_MS
  });
}
function isStaleLock(lock) {
  try {
    process.kill(lock.pid, 0);
    return false;
  } catch (error) {
    if (error.code === "ESRCH") return true;
    return Date.now() - Date.parse(lock.startedAt) > LOCK_STALE_MS;
  }
}
async function unlock(ctx, options) {
  throwIfAborted(options.signal);
  await ensureStateDir();
  throwIfAborted(options.signal);
  let guard;
  try {
    guard = await acquireGuard();
  } catch (error) {
    if (!isLockHeldError2(error)) throw error;
    ctx.ui.notify((await describeHeldLock()).message, "warning");
    return;
  }
  let failed = false;
  let failure;
  try {
    await unlockGuarded(ctx, options);
  } catch (error) {
    failed = true;
    failure = error;
  }
  const releaseError = await releaseGuard(guard);
  if (releaseError && !failed) {
    failed = true;
    failure = releaseError;
  }
  if (failed) throw failure;
}
async function unlockGuarded(ctx, options) {
  throwIfAborted(options.signal);
  let inspection = await inspectLock();
  throwIfAborted(options.signal);
  if (inspection.status === "missing") {
    ctx.ui.notify("No pi-sync lock is present.", "info");
    return;
  }
  if (inspection.status === "unreadable") {
    if (!options.stale) {
      ctx.ui.notify(
        "Pi-sync lock metadata is unreadable. Use /sync unlock --stale only after verifying no sync is running.",
        "warning"
      );
      return;
    }
    inspection = await inspectLock();
    throwIfAborted(options.signal);
    if (inspection.status === "unreadable") {
      throwIfAborted(options.signal);
      await fs4.rm(lockPath(), { force: true });
      if (!options.signal?.aborted) {
        ctx.ui.notify(
          "Removed unreadable pi-sync lock. No settings, files, sync state, or remote data were changed.",
          "info"
        );
      }
      return;
    }
    if (inspection.status === "missing") {
      ctx.ui.notify("No pi-sync lock is present.", "info");
      return;
    }
  }
  if (!isStaleLock(inspection.lock)) {
    ctx.ui.notify("Lock owner is still live; refusing to remove it.", "warning");
    return;
  }
  throwIfAborted(options.signal);
  await fs4.rm(lockPath(), { force: true });
  if (!options.signal?.aborted) {
    ctx.ui.notify(
      "Removed stale pi-sync lock. No settings, files, sync state, or remote data were changed.",
      "info"
    );
  }
}
function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
async function releaseGuard(guard) {
  try {
    await guard.release();
    return void 0;
  } catch (error) {
    return guard.isCompromised() ? void 0 : error;
  }
}
async function acquireGuard() {
  let compromisedError;
  const release = await lockfile3.lock(lockPath(), {
    fs: LOCKFILE_FS_ADAPTER2,
    lockfilePath: `${lockPath()}.guard`,
    realpath: false,
    stale: LOCK_GUARD_STALE_MS,
    update: LOCK_GUARD_UPDATE_MS,
    onCompromised: (error) => {
      compromisedError = error;
    }
  });
  return {
    release,
    throwIfCompromised: () => {
      if (compromisedError) throw compromisedError;
    },
    isCompromised: () => compromisedError !== void 0
  };
}
async function describeHeldLock() {
  const current = await readLock();
  if (current && isStaleLock(current)) {
    return new Error("pi-sync lock owner exited; retry shortly while the lock guard expires.");
  }
  if (current) {
    return new Error(
      `Pi-sync is currently running (${current.command}, pid ${current.pid}, started ${current.startedAt}).`
    );
  }
  return new Error(
    "Pi-sync is currently running (lock metadata is unreadable or still being written)."
  );
}
function isLockHeldError2(error) {
  return error.code === "ELOCKED";
}
function isLockFile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const lock = value;
  return typeof lock.id === "string" && lock.id.length > 0 && Number.isInteger(lock.pid) && (lock.pid ?? 0) > 0 && (lock.pid ?? 0) <= MAX_PROCESS_ID && typeof lock.command === "string" && lock.command.length > 0 && typeof lock.startedAt === "string" && Number.isFinite(Date.parse(lock.startedAt));
}
var LOCK_STALE_MS, MAX_PROCESS_ID;
var init_lock = __esm({
  "packages/pi-sync/src/lock.ts"() {
    "use strict";
    init_config();
    init_lock_policy();
    init_lockfile_fs();
    LOCK_STALE_MS = 30 * 60 * 1e3;
    MAX_PROCESS_ID = 2147483647;
  }
});

// packages/pi-sync/src/snapshot-paths.ts
import path6 from "node:path";
function expandHome2(value) {
  if (value === "~") return process.env.HOME ?? value;
  if (value.startsWith("~/")) return path6.join(process.env.HOME ?? "~", value.slice(2));
  return value;
}
function sessionStorageRoot(root, configuredSessionDir2) {
  return configuredSessionDir2 ? path6.resolve(expandHome2(configuredSessionDir2)) : path6.resolve(root, "sessions");
}
var init_snapshot_paths = __esm({
  "packages/pi-sync/src/snapshot-paths.ts"() {
    "use strict";
  }
});

// packages/pi-sync/src/snapshot-transaction.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import fs5 from "node:fs/promises";
import path7 from "node:path";
async function applySnapshotTransaction(plan, options = {}) {
  await recoverPendingSnapshotTransactions();
  const transaction = await prepareTransaction(plan, options.sessionDir);
  try {
    for (const target of plan.deletes) {
      await fs5.rm(target, { force: true, recursive: true });
    }
    for (const item of plan.writes) {
      await fs5.mkdir(path7.dirname(item.target), { recursive: true });
      await fs5.writeFile(item.target, item.content);
    }
    await fs5.rm(transaction.directory, { recursive: true, force: true });
  } catch (error) {
    try {
      await restoreTransaction(transaction.directory, transaction.journal);
    } catch (recoveryError) {
      throw new AggregateError(
        [error, recoveryError],
        `Snapshot apply failed and automatic recovery also failed. Transaction retained at ${transaction.directory}.`
      );
    }
    throw error;
  }
}
async function recoverSnapshotTransactionsOnStartup() {
  if (!(await pendingTransactionEntries()).some((entry) => entry.isDirectory())) return;
  await withLock("recovery", recoverPendingSnapshotTransactions, { reclaimStale: true });
}
async function recoverPendingSnapshotTransactions() {
  const directory = transactionRoot();
  const entries = await pendingTransactionEntries();
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    const transactionDirectory = path7.join(directory, entry.name);
    const journalPath = path7.join(transactionDirectory, "journal.json");
    let journal;
    try {
      journal = JSON.parse(await fs5.readFile(journalPath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") {
        await fs5.rm(transactionDirectory, { recursive: true, force: true });
        continue;
      }
      throw new Error(`Cannot recover malformed pi-sync transaction: ${journalPath}`, {
        cause: error
      });
    }
    await restoreTransaction(transactionDirectory, journal);
  }
}
async function pendingTransactionEntries() {
  try {
    return await fs5.readdir(transactionRoot(), { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
async function prepareTransaction(plan, sessionDir) {
  const root = path7.resolve(agentDir());
  const sessionRoot = sessionDir ? path7.resolve(sessionStorageRoot(root, sessionDir)) : void 0;
  const directory = path7.join(transactionRoot(), randomUUID4());
  const backupDirectory = path7.join(directory, "before");
  await fs5.mkdir(backupDirectory, { recursive: true, mode: 448 });
  const targets = [.../* @__PURE__ */ new Set([...plan.deletes, ...plan.writes.map((item) => item.target)])].sort();
  const entries = [];
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    if (!target) continue;
    assertAllowedTarget(root, sessionRoot, target);
    const backupName = `${index}`;
    const backupPath = path7.join(backupDirectory, backupName);
    try {
      const stat3 = await fs5.lstat(target);
      if (stat3.isSymbolicLink()) {
        entries.push({
          target,
          backupName,
          kind: "symlink",
          linkTarget: await fs5.readlink(target)
        });
      } else if (stat3.isDirectory()) {
        await fs5.cp(target, backupPath, {
          recursive: true,
          dereference: false,
          preserveTimestamps: true
        });
        entries.push({ target, backupName, kind: "directory" });
      } else if (stat3.isFile()) {
        await fs5.copyFile(target, backupPath);
        await fs5.chmod(backupPath, stat3.mode);
        entries.push({ target, backupName, kind: "file" });
      } else {
        throw new Error(`Unsupported existing snapshot target: ${target}`);
      }
    } catch (error) {
      const code = error.code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
      entries.push({ target, backupName, kind: "missing" });
    }
  }
  const journal = {
    version: JOURNAL_VERSION,
    root,
    sessionRoot,
    entries
  };
  await fs5.writeFile(
    path7.join(directory, "journal.json"),
    `${JSON.stringify(journal, null, "	")}
`,
    {
      mode: 384
    }
  );
  return { directory, journal };
}
async function restoreTransaction(directory, journal) {
  validateJournal(directory, journal);
  for (const entry of [...journal.entries].sort(
    (left, right) => right.target.length - left.target.length
  )) {
    await fs5.rm(entry.target, { recursive: true, force: true });
  }
  for (const entry of journal.entries) {
    if (entry.kind === "missing") continue;
    await fs5.mkdir(path7.dirname(entry.target), { recursive: true });
    const backupPath = path7.join(directory, "before", entry.backupName);
    assertWithinRoot(directory, backupPath);
    if (entry.kind === "file") await fs5.copyFile(backupPath, entry.target);
    else if (entry.kind === "directory") {
      await fs5.cp(backupPath, entry.target, {
        recursive: true,
        dereference: false,
        preserveTimestamps: true
      });
    } else if (entry.kind === "symlink" && entry.linkTarget !== void 0) {
      await fs5.symlink(entry.linkTarget, entry.target);
    }
  }
  await fs5.rm(directory, { recursive: true, force: true });
}
function validateJournal(directory, journal) {
  if (journal.version !== JOURNAL_VERSION || !Array.isArray(journal.entries)) {
    throw new Error(`Unsupported pi-sync transaction journal: ${directory}`);
  }
  const expectedRoot = path7.resolve(agentDir());
  if (path7.resolve(journal.root) !== expectedRoot) {
    throw new Error(`Transaction root no longer matches the Pi agent directory: ${directory}`);
  }
  for (const entry of journal.entries) {
    if (!entry || typeof entry.target !== "string" || typeof entry.backupName !== "string" || !/^\d+$/u.test(entry.backupName)) {
      throw new Error(`Invalid pi-sync transaction entry: ${directory}`);
    }
    assertAllowedTarget(journal.root, journal.sessionRoot, entry.target);
  }
}
function assertAllowedTarget(root, sessionRoot, target) {
  const resolved = path7.resolve(target);
  if (isPathInside(root, resolved)) {
    assertWithinRoot(root, resolved);
    return;
  }
  if (sessionRoot && isPathInside(sessionRoot, resolved)) {
    assertWithinRoot(sessionRoot, resolved);
    return;
  }
  throw new Error(`Transaction target is outside configured roots: ${target}`);
}
function transactionRoot() {
  return path7.join(stateDir(), "transactions");
}
var JOURNAL_VERSION;
var init_snapshot_transaction = __esm({
  "packages/pi-sync/src/snapshot-transaction.ts"() {
    "use strict";
    init_config();
    init_lock();
    init_paths();
    init_snapshot_paths();
    JOURNAL_VERSION = 1;
  }
});

// packages/pi-sync/src/sync-errors.ts
function isSyncDecisionRequiredError(error) {
  return error instanceof SyncDecisionRequiredError;
}
function errorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\u0000-\u001f\u007f-\u009f]/gu, "?");
}
var SetupPullRequiresUiError, SyncDecisionRequiredError;
var init_sync_errors = __esm({
  "packages/pi-sync/src/sync-errors.ts"() {
    "use strict";
    SetupPullRequiresUiError = class extends Error {
    };
    SyncDecisionRequiredError = class extends Error {
      decision;
      constructor(decision) {
        super(decision.directMessage);
        this.name = "SyncDecisionRequiredError";
        this.decision = decision;
      }
    };
  }
});

// packages/pi-sync/src/snapshot.ts
var snapshot_exports = {};
__export(snapshot_exports, {
  canonicalSnapshotPathForConfig: () => canonicalSnapshotPathForConfig,
  collectFiles: () => collectFiles,
  createSnapshot: () => createSnapshot,
  filterSnapshotForConfigPolicy: () => filterSnapshotForConfigPolicy,
  isConfiguredSnapshotPath: () => isConfiguredSnapshotPath,
  isDeniedPath: () => isDeniedPath,
  isSessionFilePath: () => isSessionFilePath,
  isSessionPath: () => isSessionPath,
  mergeRemotePreservedFiles: () => mergeRemotePreservedFiles,
  mergeRemoteSessionFiles: () => mergeRemoteSessionFiles,
  regenerateSnapshotIdentity: () => regenerateSnapshotIdentity,
  scanSnapshot: () => scanSnapshot,
  sessionSnapshotPathFromAbsolute: () => sessionSnapshotPathFromAbsolute,
  sessionStorageRoot: () => sessionStorageRoot,
  snapshotIncludesSessions: () => snapshotIncludesSessions,
  snapshotTarget: () => snapshotTarget,
  snapshotWithoutSessions: () => snapshotWithoutSessions
});
import { createHash as createHash2, randomUUID as randomUUID5 } from "node:crypto";
import fs6 from "node:fs/promises";
import os2 from "node:os";
import path8 from "node:path";
function selectTopLevelFileEntry(entries, fileName) {
  const exact = entries.find((entry) => entry.isFile() && entry.name === fileName);
  if (exact) return exact;
  const lower = fileName.toLowerCase();
  return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase() === lower).sort((left, right) => left.name.localeCompare(right.name))[0];
}
function sha256(value) {
  return createHash2("sha256").update(value).digest("hex");
}
function isSafeSnapshotPath(relativePath) {
  if (relativePath.includes("\\")) return false;
  const normalized = toPosix(relativePath);
  return Boolean(normalized) && normalized !== "." && normalized !== ".." && !normalized.startsWith("../") && !path8.posix.isAbsolute(normalized) && path8.posix.normalize(normalized) === normalized && !isDeniedPath(normalized);
}
function snapshotsMatch(left, right) {
  const leftHashes = new Map(left.files.map((file) => [file.path, file.sha256]));
  const rightHashes = new Map(right.files.map((file) => [file.path, file.sha256]));
  return left.syncSessions === right.syncSessions && sameOptionalInclude(snapshotSelectionInclude(left), snapshotSelectionInclude(right)) && leftHashes.size === rightHashes.size && [...leftHashes].every(([filePath, hash]) => rightHashes.get(filePath) === hash);
}
function snapshotId() {
  return `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-${randomUUID5().slice(0, 8)}`;
}
function regenerateSnapshotIdentity(snapshot) {
  return {
    ...snapshot,
    id: snapshotId(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    machine: os2.hostname()
  };
}
async function createSnapshot(profile, options = {}) {
  const include = effectiveInclude(options);
  const syncSessions = include.includes("sessions");
  const files = await collectFiles(agentDir(), {
    include,
    sessionDir: options.sessionDir ?? await configuredSessionDir()
  });
  return {
    version: VERSION,
    id: snapshotId(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    machine: os2.hostname(),
    profile,
    syncSessions,
    selection: selectionForSnapshot(include),
    files
  };
}
function effectiveInclude(options) {
  if (options.include) return options.include;
  return [
    ...normalizeSyncFiles(options.syncFiles),
    ...normalizeExtraFiles(options.extraFiles),
    ...options.syncSessions ? ["sessions"] : []
  ];
}
async function collectFiles(root, options = {}) {
  const results = [];
  const entries = await fs6.readdir(root, { withFileTypes: true });
  const selection = syncIncludeSelection(effectiveInclude(options));
  const selectedFiles = new Set(selection.builtIns);
  for (const entry of entries) {
    if (entry.isDirectory() && TOP_LEVEL_DIRS2.has(entry.name) && selectedFiles.has(entry.name)) {
      await collectDirectory(results, root, entry.name);
    }
  }
  for (const fileName of TOP_LEVEL_FILES) {
    if (!selectedFiles.has(fileName)) continue;
    const entry = selectTopLevelFileEntry(entries, fileName);
    if (entry) await addFile(results, root, entry.name, fileName);
  }
  for (const relativePath of selection.custom) {
    await collectIncludedPath(results, root, relativePath);
  }
  if (selection.sessions) {
    try {
      await collectDirectory(results, sessionStorageRoot(root, options.sessionDir), "", {
        sessionsOnly: true,
        virtualPrefix: "sessions"
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return results.sort((left, right) => left.path.localeCompare(right.path));
}
async function collectIncludedPath(results, root, relativePath) {
  const absolutePath = safeJoin(root, relativePath);
  try {
    const stat3 = await fs6.lstat(absolutePath);
    if (stat3.isFile()) await addFile(results, root, relativePath);
    else if (stat3.isDirectory()) await collectDirectory(results, root, relativePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (!relativePath.includes("/")) {
      const entries = await fs6.readdir(root, { withFileTypes: true });
      const entry = selectTopLevelFileEntry(entries, relativePath);
      if (entry) await addFile(results, root, entry.name, relativePath);
    }
  }
}
async function collectDirectory(results, root, relativeDirectory, options = {}) {
  const absoluteDirectory = path8.join(root, relativeDirectory);
  for (const entry of await fs6.readdir(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = relativeDirectory ? posixJoin(relativeDirectory, entry.name) : entry.name;
    const snapshotPath2 = options.virtualPrefix ? posixJoin(options.virtualPrefix, relativePath) : relativePath;
    if (isDeniedPath(snapshotPath2)) continue;
    if (entry.isDirectory()) {
      await collectDirectory(results, root, relativePath, options);
    } else if (entry.isFile() && (!options.sessionsOnly || isSessionFilePath(snapshotPath2))) {
      await addFile(results, root, relativePath, snapshotPath2);
    }
  }
}
async function addFile(results, root, relativePath, snapshotPath2 = relativePath) {
  if (!isSafeSnapshotPath(snapshotPath2)) return;
  const absolutePath = safeJoin(root, relativePath);
  const content = await fs6.readFile(absolutePath);
  results.push({
    path: snapshotPath2,
    contentBase64: content.toString("base64"),
    sha256: sha256(content)
  });
}
function isSessionPath(relativePath) {
  return toPosix(relativePath).startsWith("sessions/");
}
function isSessionFilePath(relativePath) {
  const normalized = toPosix(relativePath);
  return isSessionPath(normalized) && normalized.endsWith(".jsonl");
}
function sessionSnapshotPathFromAbsolute(sessionFile, configuredSessionDir2) {
  const relativePath = toPosix(
    path8.relative(sessionStorageRoot(agentDir(), configuredSessionDir2), sessionFile)
  );
  if (!relativePath || relativePath.startsWith("../") || path8.posix.isAbsolute(relativePath)) {
    return void 0;
  }
  const snapshotPath2 = posixJoin("sessions", relativePath);
  return isSessionFilePath(snapshotPath2) ? snapshotPath2 : void 0;
}
function snapshotTarget(root, relativePath, configuredSessionDir2) {
  if (isSessionPath(relativePath)) {
    return safeJoin(
      sessionStorageRoot(root, configuredSessionDir2),
      relativePath.slice("sessions/".length)
    );
  }
  return safeJoin(root, relativePath);
}
function snapshotIncludesSessions(snapshot) {
  return snapshot.syncSessions === true || snapshotSelectionInclude(snapshot)?.includes("sessions") === true || snapshot.files.some((file) => isSessionPath(file.path));
}
function filterSnapshotForConfigPolicy(snapshot, config, options = {}) {
  const include = includeFromSelectionConfig(config);
  const includePaths = customIncludePathsByLower(include);
  const filtered = {
    ...snapshot,
    syncSessions: include.includes("sessions") ? snapshot.syncSessions : false,
    selection: selectionForSnapshot(include),
    files: canonicalizeSnapshotFilesForConfig(snapshot.files, config, includePaths)
  };
  if (!options.regenerateId || snapshotsMatch(snapshot, filtered)) return filtered;
  return {
    ...filtered,
    id: snapshotId(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    machine: os2.hostname()
  };
}
function canonicalizeSnapshotFilesForConfig(files, config, includePaths) {
  const configuredFiles = [];
  const extraCandidates = /* @__PURE__ */ new Map();
  for (const file of files) {
    const normalized = toPosix(file.path);
    if (!isSafeSnapshotPath(file.path) || !isConfiguredSnapshotPath(normalized, config)) {
      continue;
    }
    if (normalized.includes("/")) {
      configuredFiles.push(normalized === file.path ? file : { ...file, path: normalized });
      continue;
    }
    const topLevelPath = canonicalSnapshotPathForConfig(normalized, includePaths);
    const candidate = {
      exact: normalized === topLevelPath,
      file: { ...file, path: topLevelPath },
      originalPath: normalized
    };
    const current = extraCandidates.get(topLevelPath.toLowerCase());
    if (!current || isPreferredExtraCandidate(candidate, current)) {
      extraCandidates.set(topLevelPath.toLowerCase(), candidate);
    }
  }
  return [
    ...configuredFiles,
    ...[...extraCandidates.values()].map((candidate) => candidate.file)
  ].sort((left, right) => left.path.localeCompare(right.path));
}
function isPreferredExtraCandidate(left, right) {
  if (left.exact !== right.exact) return left.exact;
  return left.originalPath.localeCompare(right.originalPath) < 0;
}
function snapshotWithoutSessions(snapshot) {
  const files = snapshot.files.filter((file) => !isSessionPath(file.path));
  const include = snapshotSelectionInclude(snapshot)?.filter((item) => item !== "sessions");
  if (files.length === snapshot.files.length && snapshot.syncSessions !== true && include?.length === snapshot.selection?.include.length) {
    return snapshot;
  }
  return {
    ...snapshot,
    id: snapshotId(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    machine: os2.hostname(),
    syncSessions: false,
    ...include ? { selection: selectionForSnapshot(include) } : {},
    files
  };
}
function scanSnapshot(snapshot) {
  const findings = [];
  for (const file of snapshot.files) {
    const content = Buffer.from(file.contentBase64, "base64");
    if (content.includes(0)) continue;
    const text = content.toString("utf8");
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(text)) {
        findings.push(file.path);
        break;
      }
    }
  }
  return findings;
}
function mergeRemotePreservedFiles(local, remote, config) {
  const localPathNames = new Set(local.files.map((file) => file.path.toLowerCase()));
  const preservedPathNames = /* @__PURE__ */ new Set();
  const preserved = remote.files.filter((file) => {
    const normalized = toPosix(file.path);
    const lower = normalized.toLowerCase();
    if (localPathNames.has(lower) || preservedPathNames.has(lower) || !isSafeSnapshotPath(file.path) || isConfiguredSnapshotPath(normalized, config) || !isPreservableUnmanagedSnapshotPath(normalized)) {
      return false;
    }
    preservedPathNames.add(lower);
    return true;
  });
  if (preserved.length === 0) return local;
  return {
    ...local,
    id: snapshotId(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    machine: os2.hostname(),
    syncSessions: snapshotIncludesSessions(local) || snapshotIncludesSessions(remote),
    files: [...local.files, ...preserved].sort(
      (left, right) => left.path.localeCompare(right.path)
    )
  };
}
function mergeRemoteSessionFiles(local, remote) {
  const remoteSessions = remote.files.filter((file) => {
    const normalized = toPosix(file.path);
    return isSessionFilePath(normalized) && isSafeSnapshotPath(file.path);
  });
  if (remoteSessions.length === 0 && !snapshotIncludesSessions(remote)) return local;
  const localInclude = snapshotSelectionInclude(local);
  return {
    ...local,
    id: snapshotId(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    machine: os2.hostname(),
    syncSessions: true,
    ...localInclude ? {
      selection: selectionForSnapshot(
        localInclude.includes("sessions") ? localInclude : [...localInclude, "sessions"]
      )
    } : {},
    files: [...local.files.filter((file) => !isSessionPath(file.path)), ...remoteSessions].sort(
      (left, right) => left.path.localeCompare(right.path)
    )
  };
}
function sameOptionalInclude(left, right) {
  if (!left || !right) return left === right;
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
var VERSION, TOP_LEVEL_FILES, TOP_LEVEL_DIRS2, SECRET_PATTERNS;
var init_snapshot = __esm({
  "packages/pi-sync/src/snapshot.ts"() {
    "use strict";
    init_config();
    init_paths();
    init_snapshot_paths();
    init_paths();
    init_snapshot_paths();
    init_sync_policy();
    init_sync_policy();
    VERSION = 1;
    TOP_LEVEL_FILES = DEFAULT_SYNC_INCLUDE.filter(
      (name) => name.includes(".")
    );
    TOP_LEVEL_DIRS2 = new Set(DEFAULT_SYNC_INCLUDE.filter((name) => !name.includes(".")));
    SECRET_PATTERNS = [
      /AWS_SECRET_ACCESS_KEY\s*[=:]\s*['"]?[A-Za-z0-9/+]{35,}/i,
      /(ANTHROPIC|OPENAI|GEMINI|GOOGLE|FIRECRAWL|GITHUB|CLOUDFLARE|R2|S3)_[A-Z0-9_]*(KEY|TOKEN|SECRET)\s*[=:]\s*['"]?[^\s'"]{12,}/i,
      /sk-ant-[A-Za-z0-9_-]{20,}/,
      /sk-[A-Za-z0-9]{20,}/,
      /gh[pousr]_[A-Za-z0-9_]{20,}/
    ];
  }
});

// packages/pi-sync/src/sync-state.ts
var sync_state_exports = {};
__export(sync_state_exports, {
  canPullRemoteSessionsOnFirstSync: () => canPullRemoteSessionsOnFirstSync,
  canPullRemoteSettingsOnFirstSync: () => canPullRemoteSettingsOnFirstSync,
  fileHashMap: () => fileHashMap,
  hasLocalChanges: () => hasLocalChanges,
  hasRemoteChanges: () => hasRemoteChanges,
  remoteChangedSinceState: () => remoteChangedSinceState,
  sameHashes: () => sameHashes,
  sessionHashMap: () => sessionHashMap,
  settingsHashMap: () => settingsHashMap,
  settingsHashMapFromState: () => settingsHashMapFromState,
  settingsHashesMatchState: () => settingsHashesMatchState,
  shouldRefreshSyncedState: () => shouldRefreshSyncedState,
  snapshotHashesMatchState: () => snapshotHashesMatchState,
  snapshotsMatch: () => snapshotsMatch2,
  syncPolicyChanged: () => syncPolicyChanged
});
function hasLocalChanges(local, state, config) {
  return !sameHashes(fileHashMap(local), stateHashMapForConfig(state, config));
}
function remoteChangedSinceState(head, state, config, sameRevision) {
  if (!head) return Boolean(state.lastAppliedSnapshot);
  if (head.snapshotId !== state.lastAppliedSnapshot) return true;
  if (state.lastRemoteRevision && !sameRevision(head.revision, state.lastRemoteRevision))
    return true;
  if (syncIncludeChanged(state, config)) return true;
  return includeFromSelectionConfig(config).includes("sessions") && !state.include?.includes("sessions") && head.syncSessions;
}
function hasRemoteChanges(remote, state, config, ignoredPaths = /* @__PURE__ */ new Set()) {
  if (remote.id === state.lastAppliedSnapshot && !syncPolicyChanged(state, config)) return false;
  return !snapshotHashesMatchState(
    filterSnapshotForConfigPolicy(remote, config),
    state,
    config,
    ignoredPaths
  );
}
function sameHashes(left, right) {
  const keys = /* @__PURE__ */ new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) if (left[key] !== right[key]) return false;
  return true;
}
function fileHashMap(snapshot) {
  return Object.fromEntries(snapshot.files.map((file) => [file.path, file.sha256]));
}
function stateHashMapForConfig(state, config) {
  const includePaths = customIncludePathsByLower(includeFromSelectionConfig(config));
  return Object.fromEntries(
    Object.entries(state.lastFileHashes).filter(([filePath]) => isConfiguredSnapshotPath(filePath, config)).map(([filePath, hash]) => [canonicalSnapshotPathForConfig(filePath, includePaths), hash])
  );
}
function snapshotHashesMatchState(snapshot, state, config, ignoredPaths = /* @__PURE__ */ new Set()) {
  return sameHashes(
    withoutHashPaths(fileHashMap(snapshot), ignoredPaths),
    withoutHashPaths(stateHashMapForConfig(state, config), ignoredPaths)
  );
}
function snapshotsMatch2(left, right) {
  return left.syncSessions === right.syncSessions && sameHashes(fileHashMap(left), fileHashMap(right));
}
function withoutHashPaths(hashes, ignoredPaths) {
  if (ignoredPaths.size === 0) return hashes;
  return Object.fromEntries(
    Object.entries(hashes).filter(([filePath]) => !ignoredPaths.has(toPosix(filePath)))
  );
}
function syncPolicyChanged(state, config) {
  return syncIncludeChanged(state, config);
}
function shouldRefreshSyncedState(remote, head, state, config, sameRevision) {
  return remote.id !== state.lastAppliedSnapshot || Boolean(
    head && (!state.lastRemoteRevision || !sameRevision(head.revision, state.lastRemoteRevision))
  ) || syncPolicyChanged(state, config);
}
function syncIncludeChanged(state, config) {
  const stored = state.include ? normalizeSyncInclude(state.include) : includeFromSelectionConfig(state);
  const current = includeFromSelectionConfig(config);
  return stored.length !== current.length || stored.some((item, index) => item !== current[index]);
}
function settingsHashMap(snapshot) {
  return Object.fromEntries(
    snapshot.files.filter((file) => !isSessionPath(file.path)).map((file) => [file.path, file.sha256])
  );
}
function sessionHashMap(snapshot) {
  return Object.fromEntries(
    snapshot.files.filter((file) => isSessionPath(file.path)).map((file) => [file.path, file.sha256])
  );
}
function settingsHashMapFromState(state) {
  return Object.fromEntries(
    Object.entries(state.lastFileHashes).filter(([filePath]) => !isSessionPath(filePath))
  );
}
function settingsHashesMatchState(remote, state) {
  return sameHashes(settingsHashMap(remote), settingsHashMapFromState(state));
}
function canPullRemoteSettingsOnFirstSync(local, remote) {
  const remoteSettings = settingsHashMap(remote);
  return Object.entries(settingsHashMap(local)).every(
    ([filePath, hash]) => remoteSettings[filePath] === hash
  );
}
function canPullRemoteSessionsOnFirstSync(local, remote) {
  const localSessions = sessionHashMap(local);
  const remoteSessions = sessionHashMap(remote);
  return Object.entries(localSessions).every(
    ([filePath, hash]) => remoteSessions[filePath] === hash
  );
}
var init_sync_state = __esm({
  "packages/pi-sync/src/sync-state.ts"() {
    "use strict";
    init_paths();
    init_snapshot();
    init_sync_policy();
  }
});

// packages/pi-sync/src/sync-format.ts
function formatDiff(local, remote) {
  const localMap = fileHashMap(local);
  const remoteMap = fileHashMap(remote);
  const allPaths = [.../* @__PURE__ */ new Set([...Object.keys(localMap), ...Object.keys(remoteMap)])].sort();
  const lines = [
    `local: ${local.files.length} files`,
    `remote: ${remote.id} (${remote.files.length} files)`,
    ""
  ];
  let changed = 0;
  for (const filePath of allPaths) {
    if (!localMap[filePath]) {
      lines.push(`Remote only: ${filePath}`);
      changed += 1;
    } else if (!remoteMap[filePath]) {
      lines.push(`Local only: ${filePath}`);
      changed += 1;
    } else if (localMap[filePath] !== remoteMap[filePath]) {
      lines.push(`Different: ${filePath}`);
      changed += 1;
    }
  }
  if (changed === 0) lines.push("No file differences.");
  return lines.join("\n");
}
function formatSnapshotOnlyDiff(title, snapshot) {
  return [`${title}: ${snapshot.id}`, ...snapshot.files.map((file) => `Add: ${file.path}`)].join(
    "\n"
  );
}
function formatPushSummary(config, destination, upload, head, preservedRemoteFileCount = 0, remote) {
  return [
    `Sync setup: ${safeTerminalText(config.setupName)}`,
    `Storage location: ${safeTerminalText(destination)}`,
    `Upload ${upload.files.length} files from ${safeTerminalText(agentDir())}.`,
    `Sessions: ${upload.syncSessions ? "included \u2014 may contain private conversations" : "not included"}`,
    head ? `Remote latest: ${head.snapshotId}` : "Remote latest: empty",
    "Publication effect: the backend's active head will reference the new immutable snapshot.",
    ...remote && inspectRemoteSelection(config.include, remote).kind === "different" ? [
      "Included-content policy effect: replace the differing remote selection with this setup's local selection."
    ] : [],
    formatPublicationPreview(remote, upload),
    preservedRemoteFileCount > 0 ? `Possible secrets in locally managed files were scanned before this prompt; ${preservedRemoteFileCount} preserved remote file(s) were not rescanned.` : "Possible secrets were scanned before this prompt."
  ].join("\n");
}
function formatApplyPreview(local, remote) {
  return formatDirectionalChanges(local, remote, {
    add: "Add locally",
    update: "Update locally",
    remove: "Remove locally"
  });
}
function formatPullSummary(config, destination, local, remote, protectedSessionCount) {
  return [
    `Sync setup: ${safeTerminalText(config.setupName)}`,
    `Storage location: ${safeTerminalText(destination)}`,
    `Snapshot: ${safeTerminalText(remote.id)}`,
    `Sessions: ${remote.syncSessions ? "included \u2014 may contain private conversations" : "not included"}`,
    `Protected live sessions: ${protectedSessionCount || "none"}`,
    formatApplyPreview(local, remote),
    "A local backup is created before these writes/deletes. The remote active snapshot is unchanged."
  ].join("\n");
}
function formatRollbackSummary(config, destination, local, remote, requestedSnapshot, protectedSessionCount) {
  return [
    `Sync setup: ${safeTerminalText(config.setupName)}`,
    `Storage location: ${safeTerminalText(destination)}`,
    `Snapshot: ${safeTerminalText(requestedSnapshot)}`,
    `Sessions: ${remote.syncSessions ? "included \u2014 may contain private conversations" : "not included"}`,
    `Protected live sessions: ${protectedSessionCount || "none"}`,
    formatApplyPreview(local, remote),
    "A local backup is created before applying; the backend's active head will change."
  ].join("\n");
}
function formatPublicationPreview(remote, upload) {
  if (!remote) {
    return ["Remote is empty.", ...upload.files.map((file) => `Add remotely: ${file.path}`)].join(
      "\n"
    );
  }
  return formatDirectionalChanges(remote, upload, {
    add: "Add remotely",
    update: "Update remotely",
    remove: "Remove remotely"
  });
}
function formatDirectionalChanges(before, after, labels) {
  const beforeMap = fileHashMap(before);
  const afterMap = fileHashMap(after);
  const paths = [.../* @__PURE__ */ new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)])].sort();
  const lines = [];
  for (const filePath of paths) {
    if (!beforeMap[filePath]) lines.push(`${labels.add}: ${filePath}`);
    else if (!afterMap[filePath]) lines.push(`${labels.remove}: ${filePath}`);
    else if (beforeMap[filePath] !== afterMap[filePath])
      lines.push(`${labels.update}: ${filePath}`);
  }
  if (lines.length === 0) lines.push("No file changes.");
  return lines.join("\n");
}
function countPreservedRemoteFiles(local, upload) {
  const localPaths = new Set(local.files.map((file) => file.path));
  return upload.files.filter((file) => !localPaths.has(file.path)).length;
}
function publicationCapabilityDescription(capability) {
  switch (capability) {
    case "lease-protected":
      return "lease-protected (exact expected-ref update)";
    case "atomic-conditional":
      return "atomic-conditional (verified atomic precondition)";
    case "conditional-required":
      return "conditional-required (read-only until atomic preconditions are verified)";
    case "read-check-write-verify":
      return "read-check-write-verify (visible races rejected; simultaneous unseen races remain possible)";
  }
}
function safeTerminalText(value) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, "?");
}
var init_sync_format = __esm({
  "packages/pi-sync/src/sync-format.ts"() {
    "use strict";
    init_config();
    init_sync_errors();
    init_sync_policy();
    init_sync_state();
  }
});

// packages/pi-sync/src/sync-attention.ts
import { truncateToWidth } from "@earendil-works/pi-tui";
function syncAttentionMatchesConfig(attention, config) {
  return attention.decision.setupName === config.setupName && attention.decision.configIdentity === syncConfigReviewFingerprint(config) && sameSyncInclude(attention.decision.localInclude, config.include);
}
function createSyncAttentionController() {
  let state;
  return {
    set(decision, origin) {
      state = { decision, origin, offered: false };
    },
    current() {
      return state;
    },
    markOffered() {
      if (!state || state.offered) return false;
      state = { ...state, offered: true };
      return true;
    },
    clear(ctx) {
      state = void 0;
      clearAttentionPresentation(ctx);
    },
    reset(ctx) {
      state = void 0;
      clearAttentionPresentation(ctx);
    },
    publish(ctx) {
      if (!state) {
        clearAttentionPresentation(ctx);
        return;
      }
      const presentation = attentionPresentation(state.decision);
      ctx.ui.setStatus(STATUS_KEY, presentation.status);
      if (ctx.mode !== "tui") return;
      ctx.ui.setWidget(WIDGET_KEY, (_tui, theme) => ({
        render(width) {
          const safeWidth = Math.max(1, width);
          return presentation.lines.map(
            (line, index) => truncateToWidth(theme.fg(index === 0 ? "warning" : "muted", line), safeWidth, "\u2026")
          );
        },
        invalidate() {
        }
      }));
    }
  };
}
function attentionPresentation(decision) {
  const setupName = safeTerminalText(decision.setupName);
  const comparison = compareSyncInclude(decision.localInclude, decision.remoteInclude);
  const difference = comparison.remoteOnly.length === 0 && comparison.localOnly.length === 0 ? "Only list order differs" : `Remote ${comparison.remoteOnly.length} \xB7 Device ${comparison.localOnly.length}`;
  return {
    status: "review needed",
    lines: [`Pi Sync needs review \xB7 ${setupName}`, difference, "No changes \xB7 Run /sync to review"]
  };
}
function clearAttentionPresentation(ctx) {
  ctx.ui.setStatus(STATUS_KEY, void 0);
  ctx.ui.setWidget(WIDGET_KEY, void 0);
}
var STATUS_KEY, WIDGET_KEY;
var init_sync_attention = __esm({
  "packages/pi-sync/src/sync-attention.ts"() {
    "use strict";
    init_config();
    init_sync_format();
    init_sync_policy();
    STATUS_KEY = "sync";
    WIDGET_KEY = "sync:attention";
  }
});

// packages/pi-sync/src/setup-switch.ts
var setup_switch_exports = {};
__export(setup_switch_exports, {
  SETUP_SWITCH_ACTION_OPTIONS: () => SETUP_SWITCH_ACTION_OPTIONS,
  SetupPullRequiresUiError: () => SetupPullRequiresUiError,
  saveOnSwitch: () => saveOnSwitch,
  setupSwitchActionFromLabel: () => setupSwitchActionFromLabel,
  setupSwitchActionLabel: () => setupSwitchActionLabel,
  useSyncSetup: () => useSyncSetup
});
function setupSwitchActionLabel(action) {
  return SETUP_SWITCH_ACTION_OPTIONS.find((option) => option.value === action)?.label ?? action;
}
function setupSwitchActionFromLabel(label) {
  return SETUP_SWITCH_ACTION_OPTIONS.find((option) => option.label === label)?.value;
}
async function saveOnSwitch(action, signal) {
  await updateLocalConfig((settings) => ({ ...settings, onSwitch: action }), signal);
}
async function useSyncSetup(ctx, name, pullCurrentSetup, expectedAction, signal, expectedSetupIdentity) {
  const normalized = name.trim();
  if (!normalized) throw new Error("Usage: /sync use <setup>");
  const loadedConfig = await loadConfig(normalized);
  const reviewedSetupIdentity = expectedSetupIdentity ?? syncConfigReviewIdentity(loadedConfig);
  throwIfAborted2(signal);
  const switchResult = {
    action: "ask-before-pull",
    switched: false
  };
  await updateLocalConfig((current) => {
    throwIfAborted2(signal);
    const setup = current.syncSetups[normalized];
    if (!setup) {
      throw new Error(`Sync setup \u201C${safeTerminalText(normalized)}\u201D no longer exists.`);
    }
    const connectionName = setup.storage.connection;
    const connection = current.storageConnections[connectionName];
    if (!connection || syncSetupReviewIdentity(normalized, setup, connectionName, connection) !== reviewedSetupIdentity) {
      throw new Error(
        `Sync setup \u201C${safeTerminalText(normalized)}\u201D changed while the switch preview was open; reopen it and review the current destination.`
      );
    }
    switchResult.action = normalizeOnSwitch(current.onSwitch);
    if (expectedAction !== void 0 && switchResult.action !== expectedAction) {
      throw new Error(
        "Setup-switch behavior changed while the preview was open; reopen it and retry."
      );
    }
    if (switchResult.action === "pull-after-switch" && !ctx.hasUI) {
      throw new SetupPullRequiresUiError(
        `Automatic setup pulls require interactive confirmation; sync setup \u201C${safeTerminalText(normalized)}\u201D was not switched. Use TUI or RPC mode.`
      );
    }
    if (current.activeSyncSetup === normalized) return current;
    switchResult.switched = true;
    return { ...current, activeSyncSetup: normalized };
  }, signal);
  throwIfAborted2(signal);
  if (!switchResult.switched) {
    ctx.ui.notify(`Sync setup \u201C${safeTerminalText(normalized)}\u201D is already current.`, "info");
    return { pullApplied: false };
  }
  setSyncSetupCompletions(await configuredSyncSetupNames());
  throwIfAborted2(signal);
  if (switchResult.action === "switch-only") {
    ctx.ui.notify(`Switched to \u201C${safeTerminalText(normalized)}\u201D. No files were pulled.`, "info");
    return { pullApplied: false };
  }
  if (switchResult.action === "ask-before-pull") {
    if (ctx.mode !== "tui") {
      ctx.ui.notify(
        `Switched to \u201C${safeTerminalText(normalized)}\u201D. No files were pulled because confirmation requires TUI mode; run /sync pull to apply this setup.`,
        "info"
      );
      return { pullApplied: false };
    }
    const confirmed = await ctx.ui.confirm(
      `Review a pull for sync setup \u201C${safeTerminalText(normalized)}\u201D now?`,
      "pi-sync will check the remote snapshot and show the exact local writes and deletions before applying anything.",
      { signal }
    );
    throwIfAborted2(signal);
    if (!confirmed) {
      ctx.ui.notify(
        `Switched to \u201C${safeTerminalText(normalized)}\u201D; files were not pulled.`,
        "info"
      );
      return { pullApplied: false };
    }
  }
  ctx.ui.notify(
    `Switched to \u201C${safeTerminalText(normalized)}\u201D. Checking remote files for a reviewed pull\u2026`,
    "info"
  );
  if (!pullCurrentSetup) {
    throw new Error(`Switched to \u201C${safeTerminalText(normalized)}\u201D, but pull is unavailable.`);
  }
  const pullOutcome = await pullCurrentSetup(normalized);
  throwIfAborted2(signal);
  if (pullOutcome === "cancelled") {
    ctx.ui.notify(
      `Pull cancelled; sync setup \u201C${safeTerminalText(normalized)}\u201D remains current and synced files were not changed.`,
      "info"
    );
  }
  return { pullApplied: pullOutcome === "applied" };
}
function throwIfAborted2(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
var SETUP_SWITCH_ACTION_OPTIONS;
var init_setup_switch = __esm({
  "packages/pi-sync/src/setup-switch.ts"() {
    "use strict";
    init_command();
    init_config();
    init_sync_errors();
    init_sync_format();
    init_sync_errors();
    SETUP_SWITCH_ACTION_OPTIONS = [
      { label: "Ask before pull", value: "ask-before-pull" },
      { label: "Start pull", value: "pull-after-switch" },
      { label: "Switch only", value: "switch-only" }
    ];
  }
});

// packages/pi-sync/src/s3-client.ts
import { createHash as createHash3, createHmac } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
function iso8601Basic(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}
function isCloudflareR2Endpoint2(endpoint) {
  const value = endpoint?.trim();
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "r2.cloudflarestorage.com" || hostname.endsWith(".r2.cloudflarestorage.com");
  } catch {
    return false;
  }
}
async function readBoundedText(response, limit, label) {
  return (await readBoundedBuffer(response, limit, label)).toString("utf8");
}
async function readBoundedBuffer(response, limit, label) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > limit) {
    throw new Error(`${label} exceeds the ${limit}-byte limit.`);
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => void 0);
        throw new Error(`${label} exceeds the ${limit}-byte limit.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}
async function signedHeaders(input) {
  const now = /* @__PURE__ */ new Date();
  const amzDate = iso8601Basic(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha2562(input.body ?? Buffer.alloc(0));
  const headers = {
    ...lowercaseKeys(input.extraHeaders),
    host: input.url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate
  };
  if (input.sessionToken) headers["x-amz-security-token"] = input.sessionToken;
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name]?.trim()}
`).join("");
  const canonicalRequest = [
    input.method,
    input.url.pathname,
    input.url.searchParams.toString(),
    canonicalHeaders,
    signedHeaderNames.join(";"),
    payloadHash
  ].join("\n");
  const scope = `${dateStamp}/${input.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha2562(Buffer.from(canonicalRequest))
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(Buffer.from(`AWS4${input.secretAccessKey}`), dateStamp), input.region), "s3"),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`
  };
}
function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}
function sha2562(value) {
  return createHash3("sha256").update(value).digest("hex");
}
function lowercaseKeys(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.toLowerCase(), item]));
}
function normalizeEtag(value) {
  return value ?? void 0;
}
function isSecurityTokenInvalidArgument(text) {
  return text.includes("<Code>InvalidArgument</Code>") && text.includes("<Message>X-Amz-Security-Token</Message>");
}
var MAX_JSON_RESPONSE_BYTES, MAX_SNAPSHOT_RESPONSE_BYTES, MAX_ERROR_RESPONSE_BYTES, DEFAULT_REQUEST_TIMEOUT_MS, S3ObjectAlreadyExistsError, S3Client;
var init_s3_client = __esm({
  "packages/pi-sync/src/s3-client.ts"() {
    "use strict";
    init_paths();
    MAX_JSON_RESPONSE_BYTES = 1024 * 1024;
    MAX_SNAPSHOT_RESPONSE_BYTES = 256 * 1024 * 1024;
    MAX_ERROR_RESPONSE_BYTES = 64 * 1024;
    DEFAULT_REQUEST_TIMEOUT_MS = 3e4;
    S3ObjectAlreadyExistsError = class extends Error {
      constructor(key) {
        super(`S3 object already exists: ${key}`);
        this.key = key;
        this.name = "S3ObjectAlreadyExistsError";
      }
      key;
    };
    S3Client = class {
      config;
      endpoint;
      signal;
      requestTimeoutMs;
      omitSessionTokenAfterRejection = false;
      constructor(config, signal, requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
        this.config = config;
        this.endpoint = new URL(config.profile.endpoint);
        this.signal = signal;
        this.requestTimeoutMs = requestTimeoutMs;
      }
      async getJson(key) {
        const maxAttempts = 3;
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const object = await this.request("GET", key);
          if (object.status === 404) return { missing: true };
          if (!object.ok) {
            throw new Error(`S3 GET failed (${object.status}): ${await this.readErrorText(object)}`);
          }
          const body = await readBoundedText(object, MAX_JSON_RESPONSE_BYTES, "S3 JSON response");
          if (body.length > 0) {
            return {
              value: JSON.parse(body),
              etag: normalizeEtag(object.headers.get("etag")),
              missing: false
            };
          }
          lastError = new Error(`S3 GET returned an empty body for ${key}`);
          if (attempt < maxAttempts) {
            await sleep(250 * attempt, void 0, { signal: this.signal });
          }
        }
        throw lastError;
      }
      async getBuffer(key) {
        const maxAttempts = 3;
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const object = await this.request("GET", key);
          if (object.status === 404) return { missing: true };
          if (!object.ok) {
            throw new Error(`S3 GET failed (${object.status}): ${await this.readErrorText(object)}`);
          }
          const buffer = await readBoundedBuffer(
            object,
            MAX_SNAPSHOT_RESPONSE_BYTES,
            "S3 snapshot response"
          );
          if (buffer.length > 0) {
            return { value: buffer, etag: normalizeEtag(object.headers.get("etag")), missing: false };
          }
          lastError = new Error(`S3 GET returned an empty body for ${key}`);
          if (attempt < maxAttempts) {
            await sleep(250 * attempt, void 0, { signal: this.signal });
          }
        }
        throw lastError;
      }
      async putJson(key, value) {
        const body = Buffer.from(JSON.stringify(value, null, "	"), "utf8");
        await this.putBuffer(key, body, "application/json");
      }
      async putBuffer(key, body, contentType, options = {}) {
        const headers = { "content-type": contentType };
        if (options.ifAbsent) headers["if-none-match"] = "*";
        const response = await this.request("PUT", key, body, headers);
        if (options.ifAbsent && response.status === 412) {
          throw new S3ObjectAlreadyExistsError(key);
        }
        if (!response.ok) {
          throw new Error(`S3 PUT failed (${response.status}): ${await this.readErrorText(response)}`);
        }
      }
      async request(method, key, body, extraHeaders = {}) {
        const url = new URL(this.endpoint.toString());
        url.pathname = posixJoin(url.pathname, this.config.destination.bucket, encodeKey(key));
        const send = async (sessionToken2) => {
          const transportSignal = this.transportSignal();
          const headers = await signedHeaders({
            method,
            url,
            body,
            extraHeaders,
            accessKeyId: this.config.profile.accessKeyId,
            secretAccessKey: this.config.profile.secretAccessKey,
            sessionToken: sessionToken2,
            region: this.config.profile.region
          });
          try {
            return await fetch(url, {
              method,
              headers,
              body: body ? new Uint8Array(body) : void 0,
              signal: transportSignal
            });
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") throw error;
            if (error instanceof Error && error.name === "TimeoutError") {
              throw new Error("S3 request timed out.", { cause: error });
            }
            throw new Error(`S3 request failed: ${this.redact(errorMessage2(error))}`, { cause: error });
          }
        };
        const sessionToken = this.omitSessionTokenAfterRejection ? void 0 : this.config.profile.sessionToken;
        const response = await send(sessionToken);
        if (!await this.shouldRetryWithoutSessionToken(response, sessionToken)) return response;
        const retry = await send(void 0);
        if (retry.ok || retry.status === 404) this.omitSessionTokenAfterRejection = true;
        return retry;
      }
      transportSignal() {
        const timeout = AbortSignal.timeout(this.requestTimeoutMs);
        return this.signal ? AbortSignal.any([this.signal, timeout]) : timeout;
      }
      async shouldRetryWithoutSessionToken(response, sessionToken) {
        if (!sessionToken || !isCloudflareR2Endpoint2(this.config.profile.endpoint) || response.ok || response.status !== 400) {
          return false;
        }
        return isSecurityTokenInvalidArgument(
          await readBoundedText(response.clone(), MAX_ERROR_RESPONSE_BYTES, "S3 error response")
        );
      }
      async readErrorText(response) {
        try {
          return this.redact(
            await readBoundedText(response, MAX_ERROR_RESPONSE_BYTES, "S3 error response")
          );
        } catch (error) {
          return this.redact(errorMessage2(error));
        }
      }
      redact(value) {
        let redacted = value;
        let endpointUsername;
        let endpointPassword;
        let endpointQueryValues = [];
        try {
          const endpoint = new URL(this.config.profile.endpoint);
          endpointUsername = endpoint.username;
          endpointPassword = endpoint.password;
          endpointQueryValues = [...endpoint.searchParams.values()];
        } catch {
        }
        for (const secret of [
          this.config.profile.accessKeyId,
          this.config.profile.secretAccessKey,
          this.config.profile.sessionToken,
          endpointUsername,
          endpointPassword,
          ...endpointQueryValues
        ]) {
          if (secret) redacted = redacted.replaceAll(secret, "[REDACTED]");
        }
        return redacted;
      }
    };
  }
});

// packages/pi-sync/src/snapshot-codec.ts
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { createGunzip, gzip } from "node:zlib";
async function encodeSnapshot(snapshot) {
  snapshotSelectionInclude(snapshot);
  return gzipAsync(Buffer.from(JSON.stringify(snapshot), "utf8"));
}
async function decodeSnapshot(buffer, options = {}) {
  throwIfAborted3(options.signal);
  const limit = options.maxOutputLength ?? MAX_DECOMPRESSED_SNAPSHOT_BYTES;
  const chunks = [];
  let total = 0;
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      total += chunk.byteLength;
      if (total > limit) {
        callback(new Error(`Decompressed snapshot exceeds the ${limit}-byte limit.`));
        return;
      }
      chunks.push(Buffer.from(chunk));
      callback();
    }
  });
  await pipeline(Readable.from([buffer]), createGunzip(), sink, { signal: options.signal });
  throwIfAborted3(options.signal);
  const parsed = JSON.parse(Buffer.concat(chunks, total).toString("utf8"));
  if (parsed.version !== VERSION2 || !Array.isArray(parsed.files)) {
    throw new Error("Unsupported snapshot format.");
  }
  snapshotSelectionInclude(parsed);
  return parsed;
}
function throwIfAborted3(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
var VERSION2, MAX_DECOMPRESSED_SNAPSHOT_BYTES, gzipAsync;
var init_snapshot_codec = __esm({
  "packages/pi-sync/src/snapshot-codec.ts"() {
    "use strict";
    init_sync_policy();
    VERSION2 = 1;
    MAX_DECOMPRESSED_SNAPSHOT_BYTES = 512 * 1024 * 1024;
    gzipAsync = promisify(gzip);
  }
});

// packages/pi-sync/src/sync-backend.ts
function expectedRemoteHead(head) {
  return head ? { kind: "revision", revision: head.revision } : { kind: "missing" };
}
var SyncBackendConflictError, SyncBackendPublicationOutcomeUnknownError;
var init_sync_backend = __esm({
  "packages/pi-sync/src/sync-backend.ts"() {
    "use strict";
    SyncBackendConflictError = class extends Error {
      code = "SYNC_BACKEND_CONFLICT";
      phase;
      currentHead;
      candidateMayHaveBeenActive;
      constructor(message, options = {}) {
        super(message, options);
        this.name = "SyncBackendConflictError";
        this.phase = options.phase ?? "before-commit";
        this.currentHead = options.currentHead;
        this.candidateMayHaveBeenActive = options.candidateMayHaveBeenActive ?? false;
      }
    };
    SyncBackendPublicationOutcomeUnknownError = class extends Error {
      code = "SYNC_BACKEND_PUBLICATION_OUTCOME_UNKNOWN";
      constructor(message, options) {
        super(message, options);
        this.name = "SyncBackendPublicationOutcomeUnknownError";
      }
    };
  }
});

// packages/pi-sync/src/s3-backend.ts
var s3_backend_exports = {};
__export(s3_backend_exports, {
  S3SyncBackend: () => S3SyncBackend,
  encodeKey: () => encodeKey,
  historyKey: () => historyKey,
  latestKey: () => latestKey,
  pointerFor: () => pointerFor,
  s3BackendIdentity: () => s3BackendIdentity,
  snapshotKey: () => snapshotKey,
  storageRoot: () => storageRoot
});
import { createHash as createHash4 } from "node:crypto";
function latestKey(config) {
  return posixJoin(storageRoot(config), "latest.json");
}
function historyKey(config) {
  return posixJoin(storageRoot(config), "history.json");
}
function snapshotKey(config, id) {
  requireSnapshotReference(id);
  return posixJoin(storageRoot(config), "snapshots", `${id}.json.gz`);
}
function storageRoot(config) {
  return config.destination.prefix;
}
function pointerFor(config, snapshot, checksum) {
  return {
    version: VERSION3,
    profile: config.destination.namespace,
    snapshot: snapshot.id,
    sha256: checksum,
    createdAt: snapshot.createdAt,
    machine: snapshot.machine,
    syncSessions: snapshot.syncSessions === true || snapshot.files.some((file) => file.path.startsWith("sessions/")),
    ...snapshot.selection === void 0 ? {} : { selection: snapshot.selection }
  };
}
function s3BackendIdentity(config) {
  const destination = JSON.stringify([
    secretFreeEndpoint(config.profile.endpoint),
    trimSlashes4(config.destination.bucket),
    trimSlashes4(config.destination.prefix)
  ]);
  return `s3:${sha2563(Buffer.from(destination))}`;
}
function s3Destination(config) {
  let host = secretFreeEndpoint(config.profile.endpoint);
  try {
    host = new URL(host).hostname;
  } catch {
    host = "invalid S3 endpoint";
  }
  return `${host} \xB7 ${config.destination.bucket}/${storageRoot(config)}`;
}
function secretFreeEndpoint(value) {
  const normalized = value.trim();
  try {
    const url = new URL(normalized);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return normalized.replace(/\/\/[^/@\s]+@/u, "//");
  }
}
function trimSlashes4(value) {
  return value.replace(/^\/+|\/+$/g, "");
}
function remoteHistoryEntry(pointer) {
  return {
    snapshotRef: pointer.snapshot,
    snapshotId: pointer.snapshot,
    createdAt: pointer.createdAt,
    machine: pointer.machine,
    syncSessions: pointer.syncSessions === true
  };
}
function remoteHead(pointer, identity, etag) {
  return {
    snapshotRef: pointer.snapshot,
    snapshotId: pointer.snapshot,
    revision: `s3:${sha2563(Buffer.from(canonicalJson([identity, etag ?? null, pointer])))}`,
    createdAt: pointer.createdAt,
    machine: pointer.machine,
    syncSessions: pointer.syncSessions === true,
    ...pointer.selection === void 0 ? {} : { selection: pointer.selection }
  };
}
function samePointer(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}
function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])])
  );
}
function matchesExpected(head, expected) {
  if (expected.kind === "missing") return head === void 0;
  return head?.revision === expected.revision;
}
function requirePointer(value, message, expectedProfile) {
  if (!value || value.version !== VERSION3 || value.profile !== expectedProfile || typeof value.snapshot !== "string" || !isSafeSnapshotReference(value.snapshot) || typeof value.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.sha256) || typeof value.createdAt !== "string" || !isSafeMetadata(value.createdAt, 64) || typeof value.machine !== "string" || !isSafeMetadata(value.machine, 256) || value.syncSessions !== void 0 && typeof value.syncSessions !== "boolean") {
    throw new Error(message);
  }
  if (value.selection !== void 0) portableSnapshotSelection(value.selection);
  return value;
}
function requireHistory(value, expectedProfile) {
  if (!value || value.version !== VERSION3 || !Array.isArray(value.snapshots)) {
    throw new Error("Remote history is malformed.");
  }
  const pointers = value.snapshots.map(
    (pointer) => requirePointer(pointer, "Remote history entry is malformed.", expectedProfile)
  );
  const references = /* @__PURE__ */ new Set();
  for (const pointer of pointers) {
    if (references.has(pointer.snapshot)) {
      throw new Error("Remote history contains duplicate snapshot references.");
    }
    references.add(pointer.snapshot);
  }
  return pointers;
}
function assertSnapshotIdentity(snapshot, expectedProfile) {
  if (snapshot.version !== VERSION3 || snapshot.profile !== expectedProfile || !isSafeSnapshotReference(snapshot.id) || !isSafeMetadata(snapshot.createdAt, 64) || !isSafeMetadata(snapshot.machine, 256) || !Array.isArray(snapshot.files)) {
    throw new Error("Invalid snapshot identity for S3 publication.");
  }
}
function validateSnapshotBundle(snapshot) {
  const paths = /* @__PURE__ */ new Set();
  for (const file of snapshot.files) {
    if (!file || typeof file.path !== "string" || typeof file.contentBase64 !== "string" || typeof file.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(file.sha256) || paths.has(file.path)) {
      throw new Error("Remote snapshot bundle is malformed.");
    }
    const content = Buffer.from(file.contentBase64, "base64");
    if (content.toString("base64") !== file.contentBase64 || sha2563(content) !== file.sha256) {
      throw new Error("Remote snapshot file checksum mismatch.");
    }
    paths.add(file.path);
  }
}
function assertSafeDestination(config) {
  for (const [label, value, allowEmpty] of [
    ["bucket", config.destination.bucket, false],
    ["prefix", config.destination.prefix, true],
    ["namespace", config.destination.namespace, false]
  ]) {
    if (!allowEmpty && value.length === 0 || value.includes("\\") || hasControlCharacter4(value) || value.split("/").some((segment) => segment === "." || segment === "..")) {
      throw new Error(`Invalid S3 storage location ${label}.`);
    }
  }
}
function requireSnapshotReference(reference) {
  if (!isSafeSnapshotReference(reference)) {
    throw new Error("Invalid S3 snapshot reference.");
  }
}
function isSafeSnapshotReference(reference) {
  return reference.length > 0 && reference.length <= 512 && reference !== "." && reference !== ".." && !reference.includes("/") && !reference.includes("\\") && !hasControlCharacter4(reference);
}
function isSafeMetadata(value, maxLength) {
  return value.length > 0 && value.length <= maxLength && !hasControlCharacter4(value);
}
function hasControlCharacter4(value) {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127;
  });
}
function throwIfAborted4(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
function sha2563(value) {
  return createHash4("sha256").update(value).digest("hex");
}
function errorMessage3(error) {
  return error instanceof Error ? error.message : String(error);
}
var VERSION3, POST_COMMIT_TIMEOUT_MS, S3SyncBackend;
var init_s3_backend = __esm({
  "packages/pi-sync/src/s3-backend.ts"() {
    "use strict";
    init_config();
    init_paths();
    init_s3_client();
    init_snapshot_codec();
    init_sync_backend();
    init_sync_policy();
    VERSION3 = 1;
    POST_COMMIT_TIMEOUT_MS = 3e4;
    S3SyncBackend = class {
      constructor(config, postCommitTimeoutMs = POST_COMMIT_TIMEOUT_MS) {
        this.config = config;
        this.postCommitTimeoutMs = postCommitTimeoutMs;
        assertSafeDestination(config);
        this.identity = s3BackendIdentity(config);
        this.destination = s3Destination(config);
      }
      config;
      postCommitTimeoutMs;
      identity;
      destination;
      capability = "read-check-write-verify";
      checksums = /* @__PURE__ */ new Map();
      sameRevision(left, right) {
        return left === right;
      }
      async readHead(signal) {
        const object = await new S3Client(this.config, signal).getJson(
          latestKey(this.config)
        );
        throwIfAborted4(signal);
        if (object.missing) return void 0;
        const pointer = requirePointer(
          object.value,
          "Remote latest pointer is malformed.",
          this.config.destination.namespace
        );
        this.registerChecksum(pointer.snapshot, pointer.sha256);
        return remoteHead(pointer, this.identity, object.etag);
      }
      async readSnapshot(reference, signal) {
        const expectedChecksum = this.checksums.get(reference) ?? await this.resolveChecksum(reference, signal);
        const object = await new S3Client(this.config, signal).getBuffer(
          snapshotKey(this.config, reference)
        );
        throwIfAborted4(signal);
        if (!object.value) throw new Error(`Snapshot not found: ${reference}`);
        if (expectedChecksum && sha2563(object.value) !== expectedChecksum) {
          throw new Error("Remote snapshot checksum mismatch.");
        }
        const snapshot = await decodeSnapshot(object.value, { signal });
        if (snapshot.id !== reference || snapshot.profile !== this.config.destination.namespace) {
          throw new Error("Remote snapshot identity mismatch.");
        }
        validateSnapshotBundle(snapshot);
        return snapshot;
      }
      async publishSnapshot(snapshot, expected, options = {}) {
        throwIfAborted4(options.signal);
        assertSnapshotIdentity(snapshot, this.config.destination.namespace);
        const stagedKey = snapshotKey(this.config, snapshot.id);
        const encoded = await encodeSnapshot(snapshot);
        throwIfAborted4(options.signal);
        const pointer = pointerFor(this.config, snapshot, sha2563(encoded));
        const cancellableClient = new S3Client(this.config, options.signal);
        try {
          await cancellableClient.putBuffer(stagedKey, encoded, "application/gzip", {
            ifAbsent: true
          });
        } catch (error) {
          if (!(error instanceof S3ObjectAlreadyExistsError)) throw error;
          const existing = await cancellableClient.getBuffer(stagedKey);
          if (!existing.value || sha2563(existing.value) !== pointer.sha256) {
            throw new SyncBackendConflictError(
              `Immutable snapshot id already exists with different content: ${snapshot.id}`
            );
          }
        }
        const currentObject = await cancellableClient.getJson(latestKey(this.config));
        throwIfAborted4(options.signal);
        let current;
        if (!currentObject.missing) {
          const currentPointer = requirePointer(
            currentObject.value,
            "Remote latest pointer is malformed.",
            this.config.destination.namespace
          );
          this.registerChecksum(currentPointer.snapshot, currentPointer.sha256);
          current = remoteHead(currentPointer, this.identity, currentObject.etag);
        }
        if (!matchesExpected(current, expected)) {
          throw new SyncBackendConflictError(
            "Remote changed while pushing. Run /sync pull first, then retry.",
            { currentHead: current }
          );
        }
        throwIfAborted4(options.signal);
        options.onCommit?.();
        const commitClient = new S3Client(this.config, AbortSignal.timeout(this.postCommitTimeoutMs));
        try {
          await commitClient.putJson(latestKey(this.config), pointer);
        } catch (error) {
          throw new SyncBackendPublicationOutcomeUnknownError(
            `Remote publication outcome is unknown: ${errorMessage3(error)}`,
            { cause: error }
          );
        }
        let verifiedObject;
        try {
          verifiedObject = await commitClient.getJson(latestKey(this.config));
        } catch (error) {
          throw new SyncBackendPublicationOutcomeUnknownError(
            `Remote snapshot may be active, but publication could not be verified: ${errorMessage3(error)}`,
            { cause: error }
          );
        }
        let verifiedPointer;
        try {
          verifiedPointer = requirePointer(
            verifiedObject.value,
            "Remote latest pointer is malformed after publication.",
            this.config.destination.namespace
          );
        } catch (error) {
          throw new SyncBackendPublicationOutcomeUnknownError(
            `Remote snapshot may be active, but publication verification was malformed: ${errorMessage3(error)}`,
            { cause: error }
          );
        }
        if (!samePointer(verifiedPointer, pointer)) {
          throw new SyncBackendConflictError(
            "Remote latest changed immediately after push. Run /sync status before continuing.",
            {
              phase: "after-commit",
              currentHead: remoteHead(verifiedPointer, this.identity, verifiedObject.etag),
              candidateMayHaveBeenActive: true
            }
          );
        }
        this.registerChecksum(verifiedPointer.snapshot, verifiedPointer.sha256);
        const head = remoteHead(verifiedPointer, this.identity, verifiedObject.etag);
        const warning = await this.updateHistorySafely(commitClient, pointer);
        return { head, warnings: warning ? [warning] : [] };
      }
      async listHistory(signal) {
        const object = await new S3Client(this.config, signal).getJson(historyKey(this.config));
        throwIfAborted4(signal);
        if (object.missing) return [];
        const pointers = requireHistory(object.value, this.config.destination.namespace);
        for (const pointer of pointers) {
          const known = this.checksums.get(pointer.snapshot);
          if (known && known !== pointer.sha256) {
            throw new Error("Remote history conflicts with an already observed snapshot checksum.");
          }
        }
        for (const pointer of pointers) this.registerChecksum(pointer.snapshot, pointer.sha256);
        return pointers.map(remoteHistoryEntry);
      }
      async diagnose(signal) {
        throwIfAborted4(signal);
        return [
          {
            key: "s3-config",
            level: "info",
            message: `s3 config: ok (${this.config.destination.bucket}/${storageRoot(this.config)})`
          },
          ...sessionTokenWarnings(this.config.profile).map((message) => ({
            key: "s3-session-token",
            level: "warning",
            message
          }))
        ];
      }
      async resolveChecksum(reference, signal) {
        await this.readHead(signal);
        const headChecksum = this.checksums.get(reference);
        if (headChecksum) return headChecksum;
        await this.listHistory(signal);
        return this.checksums.get(reference);
      }
      registerChecksum(reference, checksum) {
        const known = this.checksums.get(reference);
        if (known && known !== checksum) {
          throw new Error("Remote snapshot reference was rebound to a different checksum.");
        }
        this.checksums.set(reference, checksum);
      }
      async updateHistorySafely(client, pointer) {
        try {
          await this.updateHistory(client, pointer);
          return void 0;
        } catch (error) {
          return `Remote snapshot is active, but history could not be updated: ${errorMessage3(error)}. Run /sync doctor before relying on history.`;
        }
      }
      async updateHistory(client, pointer) {
        const object = await client.getJson(
          historyKey(this.config)
        );
        const snapshots = object.missing ? [] : requireHistory(object.value, this.config.destination.namespace);
        const next = [
          ...snapshots.filter((snapshot) => snapshot.snapshot !== pointer.snapshot),
          pointer
        ].slice(-100);
        await client.putJson(historyKey(this.config), { version: VERSION3, snapshots: next });
      }
    };
  }
});

// packages/pi-sync/src/webdav-client.ts
import { XMLParser } from "fast-xml-parser";
function assertSafeAuthenticatedUrl(url) {
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]" || url.hostname === "::1";
  if (url.username || url.password || url.search || url.hash || url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error(
      "Invalid WebDAV URL: HTTPS is required and embedded credentials, query, or fragment are not allowed."
    );
  }
}
function hasControlCharacter5(value) {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code >= 127 && code <= 159;
  });
}
function appendRemotePath(base, remotePath) {
  const url = new URL(base);
  const suffix = safeSegments(remotePath).map(encodeURIComponent).join("/");
  url.pathname = `${base.pathname.replace(/\/+$/u, "")}/${suffix}`;
  return url;
}
function safeSegments(value) {
  const segments = value.replace(/^\/+|\/+$/gu, "").split("/").filter(Boolean);
  if (segments.some(
    (segment) => segment === "." || segment === ".." || // biome-ignore lint/suspicious/noControlCharactersInRegex: Remote path segments cannot contain controls.
    /[\u0000-\u001f]/u.test(segment)
  )) {
    throw new Error("Invalid WebDAV remote path.");
  }
  return segments;
}
async function readBounded(response, limit, message) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > limit) {
    await response.body?.cancel();
    throw new Error(message);
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new Error(message);
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => void 0);
    throw error;
  }
  return Buffer.concat(chunks, total);
}
function parseEntry(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid WebDAV response entry.");
  const record = value;
  const href = typeof record.href === "string" ? record.href : void 0;
  if (!href) throw new Error("Invalid WebDAV response href.");
  const propstat = asArray(record.propstat).find((item) => {
    if (!item || typeof item !== "object") return false;
    return String(item.status ?? "").includes(" 200 ");
  });
  const prop = propstat?.prop;
  return {
    href,
    etag: typeof prop?.getetag === "string" ? prop.getetag : void 0,
    collection: !!prop?.resourcetype && typeof prop.resourcetype === "object" && Object.hasOwn(prop.resourcetype, "collection")
  };
}
function asArray(value) {
  if (value === void 0) return [];
  return Array.isArray(value) ? value : [value];
}
function headersObject(headers) {
  return Object.fromEntries(new Headers(headers).entries());
}
function safeUrl(url) {
  return `${url.protocol}//${url.host}${url.pathname}`;
}
function redactError(error, config) {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(redactText(message, config));
}
function redactText(value, config) {
  let result = value;
  for (const secret of [config.profile.username, config.profile.password, config.profile.url]) {
    if (!secret) continue;
    for (const variant of /* @__PURE__ */ new Set([secret, encodeURIComponent(secret)])) {
      result = result.replace(new RegExp(escapeRegExp(variant), "giu"), "[redacted]");
    }
  }
  return result.replace(/basic\s+[a-z0-9+/=]+/giu, "Basic [redacted]").replace(/\?[^\s]*/gu, "?[redacted]");
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
function throwIfAborted5(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
var JSON_LIMIT, ERROR_LIMIT, SNAPSHOT_LIMIT, XML_LIMIT, REQUEST_TIMEOUT_MS, MAX_REDIRECTS, WebDavHttpError, WebDavPreconditionError, WebDavClient;
var init_webdav_client = __esm({
  "packages/pi-sync/src/webdav-client.ts"() {
    "use strict";
    JSON_LIMIT = 1024 * 1024;
    ERROR_LIMIT = 64 * 1024;
    SNAPSHOT_LIMIT = 256 * 1024 * 1024;
    XML_LIMIT = 1024 * 1024;
    REQUEST_TIMEOUT_MS = 3e4;
    MAX_REDIRECTS = 3;
    WebDavHttpError = class extends Error {
      constructor(message, status2, options) {
        super(message, options);
        this.status = status2;
        this.name = "WebDavHttpError";
      }
      status;
    };
    WebDavPreconditionError = class extends WebDavHttpError {
      constructor(message = "WebDAV precondition failed.") {
        super(message, 412);
        this.name = "WebDavPreconditionError";
      }
    };
    WebDavClient = class {
      constructor(config, signal, timeoutMs = REQUEST_TIMEOUT_MS) {
        this.config = config;
        this.signal = signal;
        this.timeoutMs = timeoutMs;
        this.baseUrl = new URL(config.profile.url);
        assertSafeAuthenticatedUrl(this.baseUrl);
        if (!config.profile.username || !config.profile.password || config.profile.username.includes(":") || hasControlCharacter5(config.profile.username) || hasControlCharacter5(config.profile.password)) {
          throw new Error("Invalid WebDAV credentials.");
        }
        this.authorization = `Basic ${Buffer.from(`${config.profile.username}:${config.profile.password}`).toString("base64")}`;
      }
      config;
      signal;
      timeoutMs;
      baseUrl;
      authorization;
      async getBuffer(remotePath) {
        const response = await this.request(remotePath, { method: "GET" });
        if (response.status === 404) {
          await response.body?.cancel();
          return { missing: true };
        }
        await this.requireOk(response, "read");
        return {
          value: await readBounded(response, SNAPSHOT_LIMIT, "WebDAV response is too large"),
          etag: response.headers.get("etag") ?? void 0,
          missing: false
        };
      }
      async getJson(remotePath) {
        const response = await this.request(remotePath, { method: "GET" });
        if (response.status === 404) {
          await response.body?.cancel();
          return { missing: true };
        }
        await this.requireOk(response, "read");
        const bytes = await readBounded(response, JSON_LIMIT, "WebDAV JSON response is too large");
        try {
          return {
            value: JSON.parse(bytes.toString("utf8")),
            etag: response.headers.get("etag") ?? void 0,
            missing: false
          };
        } catch (error) {
          throw new Error("WebDAV JSON response is malformed.", { cause: error });
        }
      }
      async putBuffer(remotePath, body, contentType, options = {}) {
        const headers = { "content-type": contentType };
        if (options.ifAbsent) headers["if-none-match"] = "*";
        if (options.ifMatch) headers["if-match"] = options.ifMatch;
        const response = await this.request(remotePath, {
          method: "PUT",
          headers,
          body
        });
        if (response.status === 412) {
          await response.body?.cancel();
          throw new WebDavPreconditionError();
        }
        await this.requireOk(response, "write");
        await response.body?.cancel();
        return response.headers.get("etag") ?? void 0;
      }
      async putJson(remotePath, value, options = {}) {
        return this.putBuffer(
          remotePath,
          Buffer.from(JSON.stringify(value)),
          "application/json",
          options
        );
      }
      async makeCollection(remotePath) {
        const response = await this.request(remotePath, { method: "MKCOL" });
        if (response.status === 405) {
          await response.body?.cancel();
          return false;
        }
        await this.requireOk(response, "create collection");
        await response.body?.cancel();
        return true;
      }
      async ensureCollection(remotePath) {
        const segments = safeSegments(remotePath);
        for (let index = 1; index <= segments.length; index += 1) {
          await this.makeCollection(segments.slice(0, index).join("/"));
        }
      }
      async listCollection(remotePath) {
        const response = await this.request(remotePath, {
          method: "PROPFIND",
          headers: { depth: "1", "content-type": "application/xml; charset=utf-8" },
          body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:resourcetype/></d:prop></d:propfind>'
        });
        if (response.status === 404) {
          await response.body?.cancel();
          throw new WebDavHttpError("WebDAV collection is missing.", 404);
        }
        if (response.status !== 207) await this.requireOk(response, "list collection");
        const xml = (await readBounded(response, XML_LIMIT, "WebDAV directory response is too large")).toString("utf8");
        try {
          const parsed = new XMLParser({
            removeNSPrefix: true,
            ignoreAttributes: false,
            processEntities: false
          }).parse(xml);
          if (!parsed.multistatus || parsed.multistatus.response === void 0) {
            throw new Error("Missing DAV multistatus response.");
          }
          const responses = asArray(parsed.multistatus.response);
          return responses.map(parseEntry);
        } catch (error) {
          throw new Error("WebDAV directory response is malformed.", { cause: error });
        }
      }
      async delete(remotePath) {
        const response = await this.request(remotePath, { method: "DELETE" });
        if (response.status === 404) {
          await response.body?.cancel();
          return;
        }
        if (response.status === 207) {
          await response.body?.cancel();
          throw new WebDavHttpError("WebDAV probe cleanup returned a partial response.", 207);
        }
        await this.requireOk(response, "delete probe resource");
        await response.body?.cancel();
      }
      async request(remotePath, init) {
        throwIfAborted5(this.signal);
        let url = appendRemotePath(this.baseUrl, remotePath);
        for (let redirects = 0; ; redirects += 1) {
          const timeout = AbortSignal.timeout(this.timeoutMs);
          const signal = this.signal ? AbortSignal.any([this.signal, timeout]) : timeout;
          let response;
          try {
            response = await fetch(url, {
              ...init,
              headers: {
                accept: "*/*",
                authorization: this.authorization,
                ...headersObject(init.headers)
              },
              redirect: "manual",
              signal
            });
          } catch (error) {
            throwIfAborted5(this.signal);
            throw new Error(
              `WebDAV ${String(init.method ?? "GET")} request failed for ${redactText(safeUrl(url), this.config)}.`,
              {
                cause: redactError(error, this.config)
              }
            );
          }
          if (![301, 302, 303, 307, 308].includes(response.status)) return response;
          await response.body?.cancel();
          const method = String(init.method ?? "GET").toUpperCase();
          if ([301, 302, 303].includes(response.status) && method !== "GET" && method !== "HEAD") {
            throw new Error(
              `WebDAV refused an ambiguous HTTP ${response.status} redirect for ${method}; configure the canonical collection URL or require HTTP 307/308.`
            );
          }
          if (redirects >= MAX_REDIRECTS) throw new Error("WebDAV redirect limit exceeded.");
          const location = response.headers.get("location");
          if (!location) throw new Error("WebDAV redirect is missing Location.");
          const next = new URL(location, url);
          if (next.origin !== this.baseUrl.origin) {
            throw new Error("WebDAV refused a cross-origin authenticated redirect.");
          }
          url = next;
        }
      }
      async requireOk(response, action) {
        if (response.ok) return;
        const body = (await readBounded(response, ERROR_LIMIT, "WebDAV error body is too large")).toString("utf8").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").trim();
        const detail = body ? `: ${redactText(body, this.config)}` : "";
        throw new WebDavHttpError(
          `WebDAV ${action} failed with HTTP ${response.status}${detail}`,
          response.status
        );
      }
    };
  }
});

// packages/pi-sync/src/webdav-backend.ts
var webdav_backend_exports = {};
__export(webdav_backend_exports, {
  WebDavSyncBackend: () => WebDavSyncBackend,
  historyPath: () => historyPath,
  latestPath: () => latestPath,
  rootPath: () => rootPath,
  snapshotPath: () => snapshotPath,
  snapshotsPath: () => snapshotsPath,
  webDavBackendIdentity: () => webDavBackendIdentity
});
import { createHash as createHash5, randomUUID as randomUUID6 } from "node:crypto";
function rootPath(config) {
  return config.destination.path;
}
function latestPath(config) {
  return joinRemote(rootPath(config), "latest.json");
}
function historyPath(config) {
  return joinRemote(rootPath(config), "history.json");
}
function snapshotsPath(config) {
  return joinRemote(rootPath(config), "snapshots");
}
function snapshotPath(config, reference) {
  requireSnapshotReference2(reference);
  return joinRemote(snapshotsPath(config), `${reference}.json.gz`);
}
function webDavBackendIdentity(config) {
  return `webdav:${sha2564(
    Buffer.from(JSON.stringify([secretFreeUrl(config.profile.url), config.destination.path]))
  )}`;
}
function webDavStorageLocation(config) {
  const url = new URL(secretFreeUrl(config.profile.url));
  return `${url.host} \xB7 ${rootPath(config)}`;
}
function pointerFor2(config, snapshot, checksum) {
  return {
    version: VERSION4,
    profile: config.destination.namespace,
    snapshot: snapshot.id,
    sha256: checksum,
    createdAt: snapshot.createdAt,
    machine: snapshot.machine,
    syncSessions: snapshot.syncSessions === true || snapshot.files.some((file) => file.path.startsWith("sessions/")),
    ...snapshot.selection === void 0 ? {} : { selection: snapshot.selection }
  };
}
function remoteHead2(pointer, identity, etag) {
  return {
    snapshotRef: pointer.snapshot,
    snapshotId: pointer.snapshot,
    revision: encodeRevision(identity, etag, pointer),
    createdAt: pointer.createdAt,
    machine: pointer.machine,
    syncSessions: pointer.syncSessions === true,
    ...pointer.selection === void 0 ? {} : { selection: pointer.selection }
  };
}
function encodeRevision(identity, etag, pointer) {
  return `webdav-v1:${Buffer.from(JSON.stringify({ identity, etag: etag ?? null, pointer: sha2564(Buffer.from(canonicalJson2(pointer))) })).toString("base64url")}`;
}
function decodeRevision(value, identity) {
  try {
    if (!value.startsWith("webdav-v1:")) return void 0;
    const parsed = JSON.parse(Buffer.from(value.slice(10), "base64url").toString("utf8"));
    if (parsed.identity !== identity || typeof parsed.etag !== "string") return void 0;
    return strongEtag(parsed.etag);
  } catch {
    return void 0;
  }
}
function publicationCondition(current, expected, identity) {
  if (expected.kind === "missing") return { ifAbsent: true };
  const etag = decodeRevision(expected.revision, identity) ?? strongEtag(current.etag);
  if (!etag) throw new SyncBackendConflictError("WebDAV head has no usable strong ETag.");
  return { ifMatch: etag };
}
async function expectPrecondition(operation, header) {
  try {
    await operation;
  } catch (error) {
    if (error instanceof WebDavPreconditionError) return;
    throw error;
  }
  throw new Error(`WebDAV server ignored ${header}; publication is read-only for safety.`);
}
function requireStrongEtag(value, resource) {
  const etag = strongEtag(value);
  if (!etag) throw new Error(`WebDAV ${resource} has no strong ETag.`);
  return etag;
}
function strongEtag(value) {
  return value && !value.startsWith("W/") && /^"[^"\r\n]+"$/u.test(value) ? value : void 0;
}
function requirePointer2(value, expectedProfile) {
  if (!value || value.version !== VERSION4 || value.profile !== expectedProfile || !isSafeReference(value.snapshot) || !/^[0-9a-f]{64}$/u.test(value.sha256) || !isSafeMetadata2(value.createdAt, 64) || !isSafeMetadata2(value.machine, 256) || value.syncSessions !== void 0 && typeof value.syncSessions !== "boolean") {
    throw new Error("Remote latest pointer is malformed.");
  }
  if (value.selection !== void 0) portableSnapshotSelection(value.selection);
  return value;
}
function requireHistory2(value, expectedProfile) {
  if (!value || value.version !== VERSION4 || !Array.isArray(value.snapshots)) {
    throw new Error("Remote history is malformed.");
  }
  const pointers = value.snapshots.map((item) => requirePointer2(item, expectedProfile));
  if (new Set(pointers.map((item) => item.snapshot)).size !== pointers.length) {
    throw new Error("Remote history contains duplicate snapshot references.");
  }
  return pointers;
}
function remoteHistoryEntry2(pointer) {
  return {
    snapshotRef: pointer.snapshot,
    snapshotId: pointer.snapshot,
    createdAt: pointer.createdAt,
    machine: pointer.machine,
    syncSessions: pointer.syncSessions === true
  };
}
function assertSnapshotIdentity2(snapshot, namespace) {
  if (snapshot.version !== VERSION4 || snapshot.profile !== namespace || !isSafeReference(snapshot.id) || !isSafeMetadata2(snapshot.createdAt, 64) || !isSafeMetadata2(snapshot.machine, 256) || !Array.isArray(snapshot.files)) {
    throw new Error("Invalid snapshot identity for WebDAV publication.");
  }
}
function validateSnapshotBundle2(snapshot) {
  const paths = /* @__PURE__ */ new Set();
  for (const file of snapshot.files) {
    if (!file || !isSafeSnapshotPath2(file.path) || paths.has(file.path) || typeof file.contentBase64 !== "string" || typeof file.sha256 !== "string") {
      throw new Error("Remote snapshot bundle is malformed.");
    }
    const content = Buffer.from(file.contentBase64, "base64");
    if (content.toString("base64") !== file.contentBase64 || sha2564(content) !== file.sha256) {
      throw new Error("Remote snapshot bundle is malformed.");
    }
    paths.add(file.path);
  }
}
function isSafeSnapshotPath2(value) {
  if (typeof value !== "string" || !value || value.length > 4096 || value.includes("\\")) {
    return false;
  }
  if ([...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code >= 127 && code <= 159;
  })) {
    return false;
  }
  return value.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}
function assertSafeDestination2(config) {
  const url = new URL(config.profile.url);
  if (url.username || url.password || url.search || url.hash)
    throw new Error("Invalid WebDAV URL.");
  for (const value of [config.destination.path, config.destination.namespace]) {
    if (!value || value.includes("\\") || [...value].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code >= 127 && code <= 159;
    }) || value.split("/").some((part) => part === "." || part === "..")) {
      throw new Error("Invalid WebDAV storage location.");
    }
  }
}
function isSafeMetadata2(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && ![...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code >= 127 && code <= 159;
  });
}
function requireSnapshotReference2(reference) {
  if (!isSafeReference(reference)) throw new Error("Invalid WebDAV snapshot reference.");
}
function isSafeReference(value) {
  return !!value && value.length <= 512 && // biome-ignore lint/suspicious/noControlCharactersInRegex: Remote references cannot contain terminal controls.
  !/[\\/\u0000-\u001f\u007f-\u009f]/u.test(value) && value !== "." && value !== "..";
}
function matchesExpected2(head, expected) {
  return expected.kind === "missing" ? head === void 0 : head?.revision === expected.revision;
}
function samePointer2(left, right) {
  return canonicalJson2(left) === canonicalJson2(right);
}
function canonicalJson2(value) {
  if (Array.isArray(value))
    return JSON.stringify(value.map((item) => JSON.parse(canonicalJson2(item))));
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, JSON.parse(canonicalJson2(value[key]))])
    )
  );
}
function joinRemote(...parts) {
  return parts.flatMap((part) => part.split("/")).filter(Boolean).join("/");
}
function secretFreeUrl(value) {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}
function sha2564(value) {
  return createHash5("sha256").update(value).digest("hex");
}
function throwIfAborted6(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
function errorMessage4(error) {
  if (error instanceof WebDavHttpError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
var VERSION4, POST_COMMIT_TIMEOUT_MS2, WebDavSyncBackend;
var init_webdav_backend = __esm({
  "packages/pi-sync/src/webdav-backend.ts"() {
    "use strict";
    init_snapshot_codec();
    init_sync_backend();
    init_sync_policy();
    init_webdav_client();
    VERSION4 = 1;
    POST_COMMIT_TIMEOUT_MS2 = 3e4;
    WebDavSyncBackend = class {
      constructor(config, postCommitTimeoutMs = POST_COMMIT_TIMEOUT_MS2) {
        this.config = config;
        this.postCommitTimeoutMs = postCommitTimeoutMs;
        assertSafeDestination2(config);
        this.identity = webDavBackendIdentity(config);
        this.destination = webDavStorageLocation(config);
      }
      config;
      postCommitTimeoutMs;
      identity;
      destination;
      conditionalVerified = false;
      checksums = /* @__PURE__ */ new Map();
      capabilityCheck;
      get capability() {
        return this.conditionalVerified ? "atomic-conditional" : "conditional-required";
      }
      sameRevision(left, right) {
        return left === right;
      }
      async readHead(signal) {
        const object = await new WebDavClient(this.config, signal).getJson(
          latestPath(this.config)
        );
        throwIfAborted6(signal);
        if (object.missing) return void 0;
        const pointer = requirePointer2(object.value, this.config.destination.namespace);
        this.registerChecksum(pointer.snapshot, pointer.sha256);
        return remoteHead2(pointer, this.identity, object.etag);
      }
      async readSnapshot(reference, signal) {
        requireSnapshotReference2(reference);
        const expectedChecksum = this.checksums.get(reference) ?? await this.resolveChecksum(reference, signal);
        const object = await new WebDavClient(this.config, signal).getBuffer(
          snapshotPath(this.config, reference)
        );
        throwIfAborted6(signal);
        if (!object.value) throw new Error(`Snapshot not found: ${reference}`);
        if (!expectedChecksum || sha2564(object.value) !== expectedChecksum) {
          throw new Error("Remote snapshot checksum mismatch.");
        }
        const snapshot = await decodeSnapshot(object.value, { signal });
        if (snapshot.id !== reference || snapshot.profile !== this.config.destination.namespace) {
          throw new Error("Remote snapshot identity mismatch.");
        }
        validateSnapshotBundle2(snapshot);
        return snapshot;
      }
      async publishSnapshot(snapshot, expected, options = {}) {
        throwIfAborted6(options.signal);
        assertSnapshotIdentity2(snapshot, this.config.destination.namespace);
        await this.ensureAtomicConditions(options.signal);
        throwIfAborted6(options.signal);
        const client = new WebDavClient(this.config, options.signal);
        await client.ensureCollection(snapshotsPath(this.config));
        const encoded = await encodeSnapshot(snapshot);
        throwIfAborted6(options.signal);
        const pointer = pointerFor2(this.config, snapshot, sha2564(encoded));
        const stagedPath = snapshotPath(this.config, snapshot.id);
        try {
          await client.putBuffer(stagedPath, encoded, "application/gzip", { ifAbsent: true });
        } catch (error) {
          if (!(error instanceof WebDavPreconditionError)) throw error;
          const existing = await client.getBuffer(stagedPath);
          if (!existing.value || sha2564(existing.value) !== pointer.sha256) {
            throw new SyncBackendConflictError(
              `Immutable snapshot id already exists with different content: ${snapshot.id}`
            );
          }
        }
        const currentObject = await client.getJson(latestPath(this.config));
        throwIfAborted6(options.signal);
        const current = currentObject.missing ? void 0 : remoteHead2(
          requirePointer2(currentObject.value, this.config.destination.namespace),
          this.identity,
          currentObject.etag
        );
        if (!matchesExpected2(current, expected)) {
          throw new SyncBackendConflictError(
            "Remote changed while pushing. Run /sync pull first, then retry.",
            {
              currentHead: current
            }
          );
        }
        const condition = publicationCondition(currentObject, expected, this.identity);
        throwIfAborted6(options.signal);
        options.onCommit?.();
        const commitClient = new WebDavClient(
          this.config,
          AbortSignal.timeout(this.postCommitTimeoutMs),
          this.postCommitTimeoutMs
        );
        try {
          await commitClient.putJson(latestPath(this.config), pointer, condition);
        } catch (error) {
          if (error instanceof WebDavPreconditionError) {
            const latest = await this.readHeadAfterCommit(commitClient).catch(() => void 0);
            throw new SyncBackendConflictError("Remote changed while publishing the WebDAV pointer.", {
              currentHead: latest
            });
          }
          throw new SyncBackendPublicationOutcomeUnknownError(
            `Remote publication outcome is unknown: ${errorMessage4(error)}`,
            { cause: error }
          );
        }
        let verifiedObject;
        try {
          verifiedObject = await commitClient.getJson(latestPath(this.config));
        } catch (error) {
          throw new SyncBackendPublicationOutcomeUnknownError(
            `Remote snapshot may be active, but publication could not be verified: ${errorMessage4(error)}`,
            { cause: error }
          );
        }
        let verified;
        try {
          verified = requirePointer2(verifiedObject.value, this.config.destination.namespace);
        } catch (error) {
          throw new SyncBackendPublicationOutcomeUnknownError(
            `Remote snapshot may be active, but publication verification was malformed: ${errorMessage4(error)}`,
            { cause: error }
          );
        }
        if (!samePointer2(pointer, verified)) {
          throw new SyncBackendConflictError(
            "Remote latest changed immediately after push. Run /sync status before continuing.",
            {
              phase: "after-commit",
              currentHead: remoteHead2(verified, this.identity, verifiedObject.etag),
              candidateMayHaveBeenActive: true
            }
          );
        }
        if (!strongEtag(verifiedObject.etag)) {
          throw new SyncBackendPublicationOutcomeUnknownError(
            "Remote snapshot is active, but the WebDAV server returned no strong ETag."
          );
        }
        this.registerChecksum(verified.snapshot, verified.sha256);
        const head = remoteHead2(verified, this.identity, verifiedObject.etag);
        const warning = await this.updateHistorySafely(commitClient, pointer);
        return { head, warnings: warning ? [warning] : [] };
      }
      async listHistory(signal) {
        const object = await new WebDavClient(this.config, signal).getJson(historyPath(this.config));
        throwIfAborted6(signal);
        if (object.missing) return [];
        const pointers = requireHistory2(object.value, this.config.destination.namespace);
        for (const pointer of pointers) this.registerChecksum(pointer.snapshot, pointer.sha256);
        return pointers.map(remoteHistoryEntry2);
      }
      async diagnose(signal) {
        const diagnostics = [
          {
            key: "webdav-url",
            level: "info",
            message: `webdav URL/TLS/auth: configured (${webDavStorageLocation(this.config)})`
          }
        ];
        try {
          await this.runCapabilityProbe(signal);
          diagnostics.push(
            { key: "webdav-collection", level: "info", message: "webdav collection read/write: ok" },
            {
              key: "webdav-conditional",
              level: "info",
              message: "webdav conditional publication: atomic-conditional (verified)"
            },
            { key: "webdav-cleanup", level: "info", message: "webdav probe cleanup: ok" }
          );
        } catch (error) {
          this.capabilityCheck = void 0;
          this.conditionalVerified = false;
          if (error instanceof Error && error.name === "AbortError") throw error;
          diagnostics.push({
            key: "webdav-probe",
            level: "error",
            message: `webdav publication is read-only until diagnostics pass: ${errorMessage4(error)}`
          });
          return diagnostics;
        }
        try {
          diagnostics.push({
            key: "webdav-history",
            level: "info",
            message: await this.reconcileActiveHistory(signal)
          });
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
          diagnostics.push({
            key: "webdav-history",
            level: "error",
            message: `webdav history repair failed: ${errorMessage4(error)}`
          });
        }
        return diagnostics;
      }
      ensureAtomicConditions(signal) {
        if (this.capabilityCheck) return this.capabilityCheck;
        this.conditionalVerified = false;
        const check = this.runCapabilityProbe(signal).finally(() => {
          if (this.capabilityCheck === check) this.capabilityCheck = void 0;
        });
        this.capabilityCheck = check;
        return check;
      }
      async runCapabilityProbe(signal) {
        throwIfAborted6(signal);
        const probeCollection = `${rootPath(this.config)}/.pi-sync-probes/${randomUUID6()}`;
        const probe = `${probeCollection}/conditional.txt`;
        const client = new WebDavClient(this.config, signal);
        let created = false;
        let operationError;
        try {
          created = true;
          await client.ensureCollection(probeCollection);
          await client.listCollection(probeCollection);
          await client.putBuffer(probe, Buffer.from("first"), "text/plain", { ifAbsent: true });
          const read = await client.getBuffer(probe);
          const etag = strongEtag(read.etag);
          if (!read.value || !etag) {
            throw new Error("WebDAV server did not return a strong ETag for the capability probe.");
          }
          await expectPrecondition(
            client.putBuffer(probe, Buffer.from("replace"), "text/plain", { ifAbsent: true }),
            "If-None-Match"
          );
          await expectPrecondition(
            client.putBuffer(probe, Buffer.from("replace"), "text/plain", {
              ifMatch: '"pi-sync-deliberately-stale"'
            }),
            "If-Match"
          );
          const unchanged = await client.getBuffer(probe);
          if (!unchanged.value?.equals(Buffer.from("first"))) {
            throw new Error("WebDAV server changed a probe despite a failed precondition.");
          }
          await client.putBuffer(probe, Buffer.from("second"), "text/plain", { ifMatch: etag });
          const changed = await client.getBuffer(probe);
          const changedEtag = strongEtag(changed.etag);
          if (!changed.value?.equals(Buffer.from("second")) || !changedEtag || changedEtag === etag) {
            throw new Error(
              "WebDAV server did not rotate its strong ETag after changing the capability probe."
            );
          }
        } catch (error) {
          operationError = error;
        }
        if (created) {
          try {
            await new WebDavClient(this.config, void 0).delete(probeCollection);
          } catch (cleanupError) {
            const operationDetail = operationError ? `WebDAV probe failed: ${errorMessage4(operationError)}; ` : "";
            throw new Error(
              `${operationDetail}probe cleanup also failed; remove ${probeCollection}: ${errorMessage4(cleanupError)}`,
              { cause: operationError ?? cleanupError }
            );
          }
        }
        if (operationError) throw operationError;
        this.conditionalVerified = true;
      }
      async resolveChecksum(reference, signal) {
        await this.readHead(signal);
        if (this.checksums.has(reference)) return this.checksums.get(reference);
        await this.listHistory(signal);
        return this.checksums.get(reference);
      }
      registerChecksum(reference, checksum) {
        const known = this.checksums.get(reference);
        if (known && known !== checksum) {
          throw new Error("Remote snapshot reference was rebound to a different checksum.");
        }
        this.checksums.set(reference, checksum);
      }
      async readHeadAfterCommit(client) {
        const object = await client.getJson(latestPath(this.config));
        if (object.missing) return void 0;
        return remoteHead2(
          requirePointer2(object.value, this.config.destination.namespace),
          this.identity,
          object.etag
        );
      }
      async reconcileActiveHistory(signal) {
        const client = new WebDavClient(this.config, signal);
        const object = await client.getJson(latestPath(this.config));
        throwIfAborted6(signal);
        if (object.missing) return "webdav history: no active snapshot";
        const pointer = requirePointer2(object.value, this.config.destination.namespace);
        this.registerChecksum(pointer.snapshot, pointer.sha256);
        const repaired = await this.ensureHistoryPointer(client, pointer);
        return repaired ? "webdav history: repaired active snapshot entry" : "webdav history: active snapshot entry present";
      }
      async ensureHistoryPointer(client, pointer) {
        const object = await client.getJson(
          historyPath(this.config)
        );
        const snapshots = object.missing ? [] : requireHistory2(object.value, this.config.destination.namespace);
        const existing = snapshots.find((entry) => entry.snapshot === pointer.snapshot);
        if (existing) {
          if (!samePointer2(existing, pointer)) {
            throw new Error("Remote history rebound an immutable snapshot reference.");
          }
          return false;
        }
        const next = [...snapshots, pointer].slice(-100);
        const condition = object.missing ? { ifAbsent: true } : { ifMatch: requireStrongEtag(object.etag, "history") };
        await client.putJson(
          historyPath(this.config),
          { version: VERSION4, snapshots: next },
          condition
        );
        return true;
      }
      async updateHistorySafely(client, pointer) {
        try {
          await this.ensureHistoryPointer(client, pointer);
          return void 0;
        } catch (error) {
          return `Remote snapshot is active, but history could not be updated: ${errorMessage4(error)}. Run /sync doctor before relying on history.`;
        }
      }
    };
  }
});

// packages/pi-sync/src/git-runner.ts
import { spawn } from "node:child_process";
import process2 from "node:process";
async function runGit(args, options = {}) {
  throwIfAborted7(options.signal);
  const hooksPath = process2.platform === "win32" ? "NUL" : "/dev/null";
  const protocolArgs = [
    "-c",
    `core.hooksPath=${hooksPath}`,
    "-c",
    "gc.auto=0",
    "-c",
    "maintenance.auto=false",
    "-c",
    "protocol.allow=never",
    "-c",
    "protocol.https.allow=always",
    "-c",
    "protocol.ssh.allow=always"
  ];
  if (options.allowFileProtocol) protocolArgs.push("-c", "protocol.file.allow=always");
  const commandArgs = [
    ...options.gitDir ? [`--git-dir=${options.gitDir}`] : [],
    ...protocolArgs,
    ...args
  ];
  const inheritedEnvironment = Object.fromEntries(
    Object.entries(process2.env).filter(
      ([key]) => !key.startsWith("GIT_") && key !== "PAGER" && key !== "EDITOR" && key !== "VISUAL" && key !== "SSH_ASKPASS" && key !== "SSH_ASKPASS_REQUIRE"
    )
  );
  const allowedGitOverrides = /* @__PURE__ */ new Set([
    "GIT_INDEX_FILE",
    "GIT_AUTHOR_NAME",
    "GIT_AUTHOR_EMAIL",
    "GIT_AUTHOR_DATE",
    "GIT_COMMITTER_NAME",
    "GIT_COMMITTER_EMAIL",
    "GIT_COMMITTER_DATE"
  ]);
  const suppliedEnvironment = Object.fromEntries(
    Object.entries(options.env ?? {}).filter(
      ([key]) => !key.startsWith("GIT_") || allowedGitOverrides.has(key)
    )
  );
  const env = {
    ...inheritedEnvironment,
    ...suppliedEnvironment,
    LC_ALL: "C",
    LANG: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "Never",
    GIT_PAGER: "cat",
    PAGER: "cat",
    GIT_EDITOR: "true",
    EDITOR: "true",
    VISUAL: "true",
    GIT_ASKPASS: "",
    SSH_ASKPASS: "",
    SSH_ASKPASS_REQUIRE: "never",
    GIT_SSH_COMMAND: "ssh -oBatchMode=yes"
  };
  const child = spawn("git", commandArgs, {
    cwd: options.cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    detached: process2.platform !== "win32",
    windowsHide: true
  });
  const stdout = [];
  const stderr = [];
  let total = 0;
  let settled = false;
  let terminationError;
  let escalationTimer;
  const limit = options.maxOutputBytes ?? DEFAULT_OUTPUT_LIMIT;
  const terminate = (error) => {
    if (settled || terminationError) return;
    terminationError = error;
    if (child.pid && process2.platform !== "win32") {
      try {
        process2.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    } else {
      child.kill("SIGTERM");
      if (child.pid && process2.platform === "win32") {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true
        });
        killer.on("error", () => void 0);
        killer.unref();
      }
    }
    escalationTimer = setTimeout(() => {
      if (settled) return;
      if (child.pid && process2.platform !== "win32") {
        try {
          process2.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      } else {
        child.kill("SIGKILL");
      }
    }, 2e3);
  };
  const collect = (target) => (chunk) => {
    total += chunk.byteLength;
    if (total > limit) {
      terminate(new Error(`Git output exceeds the ${limit}-byte limit.`));
      return;
    }
    target.push(Buffer.from(chunk));
  };
  child.stdout.on("data", collect(stdout));
  child.stderr.on("data", collect(stderr));
  child.stdin.on("error", () => void 0);
  child.stdin.end(options.input);
  const onAbort = () => terminate(
    options.signal?.reason instanceof Error ? options.signal.reason : new DOMException("The operation was aborted", "AbortError")
  );
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(
    () => terminate(
      new Error(`Git command timed out after ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms.`)
    ),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        settled = true;
        if (escalationTimer) clearTimeout(escalationTimer);
        const stdoutBuffer = Buffer.concat(stdout);
        const stderrBuffer = Buffer.concat(stderr);
        if (terminationError) {
          reject(terminationError);
          return;
        }
        if (code !== 0) {
          const stderrText = stderrBuffer.toString("utf8").trim();
          reject(
            new GitCommandError(
              stderrText || `Git exited with status ${code ?? "unknown"}.`,
              code,
              stderrText
            )
          );
          return;
        }
        resolve({ stdout: stdoutBuffer, stderr: stderrBuffer });
      });
    });
  } finally {
    clearTimeout(timer);
    if (escalationTimer) clearTimeout(escalationTimer);
    options.signal?.removeEventListener("abort", onAbort);
  }
  return result;
}
function parseGitBlobBatch(output, expectedCount, maxContentBytes) {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) {
    throw new Error("Invalid Git batch object count.");
  }
  if (!Number.isSafeInteger(maxContentBytes) || maxContentBytes < 0) {
    throw new Error("Invalid Git batch content limit.");
  }
  const blobs = [];
  let offset = 0;
  let contentBytes = 0;
  for (let index = 0; index < expectedCount; index += 1) {
    const headerEnd = output.indexOf(10, offset);
    if (headerEnd < 0) throw new Error("Git cat-file batch response is truncated.");
    const header = output.subarray(offset, headerEnd).toString("utf8");
    if (header.endsWith(" missing")) throw new Error("Git cat-file batch object is missing.");
    const match = /^(?<object>[0-9a-f]{40}) blob (?<size>0|[1-9][0-9]*)$/u.exec(header);
    if (!match?.groups) throw new Error("Git cat-file batch response is malformed.");
    const size = Number(match.groups.size);
    if (!Number.isSafeInteger(size)) throw new Error("Git cat-file batch size is malformed.");
    contentBytes += size;
    if (contentBytes > maxContentBytes) {
      throw new Error(`Git cat-file batch content exceeds the ${maxContentBytes}-byte limit.`);
    }
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (contentEnd >= output.length) throw new Error("Git cat-file batch response is truncated.");
    if (output[contentEnd] !== 10) {
      throw new Error("Git cat-file batch response is malformed.");
    }
    blobs.push(Buffer.from(output.subarray(contentStart, contentEnd)));
    offset = contentEnd + 1;
  }
  if (offset !== output.length) throw new Error("Git cat-file batch response has trailing data.");
  return blobs;
}
async function readGitBlobs(objects, options) {
  if (objects.length === 0) return [];
  if (!Number.isSafeInteger(options.maxOutputBytes) || options.maxOutputBytes < 0) {
    throw new Error("Invalid Git batch output limit.");
  }
  if (objects.some((object) => !/^[0-9a-f]{40}$/u.test(object))) {
    throw new Error("Invalid Git blob object id.");
  }
  const protocolOverhead = objects.length * 96;
  if (!Number.isSafeInteger(protocolOverhead + options.maxOutputBytes)) {
    throw new Error("Invalid Git batch output limit.");
  }
  const result = await runGit(["cat-file", "--batch"], {
    ...options,
    input: `${objects.join("\n")}
`,
    maxOutputBytes: options.maxOutputBytes + protocolOverhead
  });
  return parseGitBlobBatch(result.stdout, objects.length, options.maxOutputBytes);
}
function throwIfAborted7(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
var DEFAULT_TIMEOUT_MS, DEFAULT_OUTPUT_LIMIT, GitCommandError;
var init_git_runner = __esm({
  "packages/pi-sync/src/git-runner.ts"() {
    "use strict";
    DEFAULT_TIMEOUT_MS = 3e4;
    DEFAULT_OUTPUT_LIMIT = 1024 * 1024;
    GitCommandError = class extends Error {
      constructor(message, exitCode, stderr, options) {
        super(message, options);
        this.exitCode = exitCode;
        this.stderr = stderr;
        this.name = "GitCommandError";
      }
      exitCode;
      stderr;
      code = "GIT_COMMAND_FAILED";
    };
  }
});

// packages/pi-sync/src/git-storage.ts
import { createHash as createHash6 } from "node:crypto";
function isGitPayloadSizeAllowed(size) {
  return Number.isSafeInteger(size) && size >= 0 && size <= MAX_GIT_PAYLOAD_BYTES;
}
function requireGitManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Git publication manifest is malformed.");
  }
  const manifest = value;
  if (manifest.version === 1) {
    throw new Error(
      "Git publication uses the unsupported pre-release gzip format; recreate this pi-sync-owned test branch."
    );
  }
  if (manifest.version !== GIT_MANIFEST_VERSION || manifest.snapshotVersion !== SNAPSHOT_VERSION || typeof manifest.snapshotId !== "string" || manifest.snapshotId.length > 512 || !/^[A-Za-z0-9._-]+$/u.test(manifest.snapshotId) || typeof manifest.createdAt !== "string" || manifest.createdAt.length > 64 || hasControlCharacter6(manifest.createdAt) || Number.isNaN(Date.parse(manifest.createdAt)) || typeof manifest.machine !== "string" || manifest.machine.length > 256 || hasControlCharacter6(manifest.machine) || typeof manifest.profile !== "string" || manifest.profile.length === 0 || manifest.profile.length > 256 || hasControlCharacter6(manifest.profile) || typeof manifest.syncSessions !== "boolean" || manifest.snapshotSyncSessions !== void 0 && typeof manifest.snapshotSyncSessions !== "boolean" || !Array.isArray(manifest.files) || !hasExactKeys(manifest, [
    "version",
    "snapshotVersion",
    "snapshotId",
    "createdAt",
    "machine",
    "profile",
    "syncSessions",
    ...manifest.snapshotSyncSessions === void 0 ? [] : ["snapshotSyncSessions"],
    ...manifest.selection === void 0 ? [] : ["selection"],
    "files"
  ])) {
    throw new Error("Git publication manifest is malformed.");
  }
  if (manifest.selection !== void 0) portableSnapshotSelection(manifest.selection);
  let total = 0;
  const paths = /* @__PURE__ */ new Set();
  for (const rawFile of manifest.files) {
    if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
      throw new Error("Git publication manifest file is malformed.");
    }
    const file = rawFile;
    if (!hasExactKeys(file, ["path", "sha256", "size"]) || !isSafeSnapshotPath3(file.path) || typeof file.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(file.sha256) || typeof file.size !== "number" || !isGitPayloadSizeAllowed(file.size) || paths.has(file.path)) {
      throw new Error("Git publication manifest file is malformed.");
    }
    total += file.size;
    if (!Number.isSafeInteger(total) || total > MAX_GIT_SNAPSHOT_BYTES) {
      throw new Error(`Git snapshot content exceeds the ${MAX_GIT_SNAPSHOT_BYTES}-byte limit.`);
    }
    paths.add(file.path);
  }
  assertNoPathConflicts([...paths]);
  return manifest;
}
function validateGitSnapshot(snapshot, manifest, namespace) {
  const prepared = prepareGitSnapshot(snapshot, namespace);
  const syncSessions = snapshot.syncSessions === true || snapshot.files.some((file) => file.path.startsWith("sessions/"));
  if (snapshot.id !== manifest.snapshotId || snapshot.createdAt !== manifest.createdAt || snapshot.machine !== manifest.machine || snapshot.profile !== manifest.profile || snapshot.syncSessions !== manifest.snapshotSyncSessions || syncSessions !== manifest.syncSessions || !sameOptionalInclude2(
    snapshotSelectionInclude(snapshot),
    manifest.selection === void 0 ? void 0 : portableSnapshotSelection(manifest.selection).include
  ) || prepared.length !== manifest.files.length || prepared.some((file, index) => {
    const expected = manifest.files[index];
    return !expected || file.path !== expected.path || file.sha256 !== expected.sha256 || file.size !== expected.size;
  })) {
    throw new Error("Git snapshot identity does not match its publication manifest.");
  }
}
function prepareGitSnapshot(snapshot, namespace) {
  snapshotSelectionInclude(snapshot);
  if (snapshot.version !== SNAPSHOT_VERSION || typeof snapshot.id !== "string" || !snapshot.id || snapshot.id.length > 512 || !/^[A-Za-z0-9._-]+$/u.test(snapshot.id) || snapshot.profile !== namespace || !Array.isArray(snapshot.files) || typeof snapshot.createdAt !== "string" || !snapshot.createdAt || snapshot.createdAt.length > 64 || hasControlCharacter6(snapshot.createdAt) || Number.isNaN(Date.parse(snapshot.createdAt)) || typeof snapshot.machine !== "string" || snapshot.machine.length > 256 || hasControlCharacter6(snapshot.machine)) {
    throw new Error("Invalid Git snapshot publication.");
  }
  const paths = /* @__PURE__ */ new Set();
  const prepared = [];
  let total = 0;
  for (const file of snapshot.files) {
    if (!isSafeSnapshotPath3(file.path) || typeof file.contentBase64 !== "string" || typeof file.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(file.sha256) || paths.has(file.path)) {
      throw new Error("Invalid Git snapshot file.");
    }
    const content = Buffer.from(file.contentBase64, "base64");
    if (content.toString("base64") !== file.contentBase64 || sha2565(content) !== file.sha256) {
      throw new Error("Git snapshot file checksum mismatch.");
    }
    if (!isGitPayloadSizeAllowed(content.byteLength)) {
      throw new Error(
        `Git snapshot file exceeds GitHub's ${MAX_GIT_PAYLOAD_BYTES}-byte regular-Git limit: ${file.path}`
      );
    }
    total += content.byteLength;
    if (!Number.isSafeInteger(total) || total > MAX_GIT_SNAPSHOT_BYTES) {
      throw new Error(`Git snapshot content exceeds the ${MAX_GIT_SNAPSHOT_BYTES}-byte limit.`);
    }
    paths.add(file.path);
    prepared.push({ path: file.path, sha256: file.sha256, size: content.byteLength, content });
  }
  assertNoPathConflicts([...paths]);
  return prepared;
}
function parseGitTree(output) {
  if (output.byteLength === 0) return [];
  if (output.at(-1) !== 0) throw new Error("Git publication tree response is malformed.");
  return output.subarray(0, -1).toString("utf8").split("\0").map((line) => {
    const match = /^(?<mode>[0-9]{6}) (?<type>blob|tree|commit) (?<object>[0-9a-f]{40})\t(?<path>.+)$/u.exec(
      line
    );
    if (!match?.groups || hasControlCharacter6(match.groups.path)) {
      throw new Error("Git publication tree response is malformed.");
    }
    return {
      mode: match.groups.mode,
      type: match.groups.type,
      object: match.groups.object,
      path: match.groups.path
    };
  });
}
function validateGitPublicationTree(entries, manifest, manifestPath, filePath) {
  const byPath = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (byPath.has(entry.path)) throw new Error("Git publication tree contains duplicate paths.");
    byPath.set(entry.path, entry);
  }
  const expectedPaths = [manifestPath, ...manifest.files.map((file) => filePath(file.path))];
  if (entries.length !== expectedPaths.length || expectedPaths.some((path12) => !byPath.has(path12))) {
    throw new Error("Git publication tree has missing or extra files.");
  }
  for (const expectedPath of expectedPaths) {
    const entry = byPath.get(expectedPath);
    if (entry?.mode !== "100644" || entry.type !== "blob") {
      throw new Error(`Git publication tree contains a non-regular file: ${expectedPath}`);
    }
  }
  return manifest.files.map((file) => byPath.get(filePath(file.path)));
}
function sameOptionalInclude2(left, right) {
  if (!left || !right) return left === right;
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
function isSafeSnapshotPath3(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 4096 && !value.startsWith("/") && !value.includes("\\") && !hasControlCharacter6(value) && value.split("/").every(
    (segment) => segment && segment !== "." && segment !== ".." && segment.toLowerCase() !== ".git"
  );
}
function hasExactKeys(value, expected) {
  const keys = Object.keys(value).sort();
  const expectedKeys = [...expected].sort();
  return keys.length === expectedKeys.length && keys.every((key, index) => key === expectedKeys[index]);
}
function assertNoPathConflicts(paths) {
  const sorted = [...paths].sort();
  for (let index = 1; index < sorted.length; index += 1) {
    const parent = sorted[index - 1];
    const child = sorted[index];
    if (parent && child?.startsWith(`${parent}/`)) {
      throw new Error(`Git snapshot file path conflict: ${parent} and ${child}`);
    }
  }
}
function sha2565(value) {
  return createHash6("sha256").update(value).digest("hex");
}
function hasControlCharacter6(value) {
  return /[\u0000-\u001f\u007f-\u009f]/u.test(value);
}
var GIT_MANIFEST_VERSION, MAX_GIT_MANIFEST_BYTES, MAX_GIT_TREE_OUTPUT_BYTES, MAX_GIT_PAYLOAD_BYTES, MAX_GIT_SNAPSHOT_BYTES, SNAPSHOT_VERSION;
var init_git_storage = __esm({
  "packages/pi-sync/src/git-storage.ts"() {
    "use strict";
    init_sync_policy();
    GIT_MANIFEST_VERSION = 2;
    MAX_GIT_MANIFEST_BYTES = 1024 * 1024;
    MAX_GIT_TREE_OUTPUT_BYTES = 16 * 1024 * 1024;
    MAX_GIT_PAYLOAD_BYTES = 100 * 1024 * 1024;
    MAX_GIT_SNAPSHOT_BYTES = 512 * 1024 * 1024;
    SNAPSHOT_VERSION = 1;
  }
});

// packages/pi-sync/src/git-backend.ts
var git_backend_exports = {};
__export(git_backend_exports, {
  GitSyncBackend: () => GitSyncBackend,
  gitBackendIdentity: () => gitBackendIdentity,
  isSupportedGitVersion: () => isSupportedGitVersion
});
import { createHash as createHash7, randomUUID as randomUUID7 } from "node:crypto";
import fs7 from "node:fs/promises";
import path9 from "node:path";
function gitBackendIdentity(config) {
  let remoteIdentity;
  try {
    remoteIdentity = normalizeGitRemoteIdentity(config.profile.remote);
  } catch {
    remoteIdentity = config.profile.remote;
  }
  const canonical = JSON.stringify([
    remoteIdentity,
    config.destination.branch,
    config.destination.directory
  ]);
  return `git:${sha2566(Buffer.from(canonical))}`;
}
function gitDestination(config) {
  let host = "Git remote";
  const remote = config.profile.remote;
  if (remote.includes("://")) {
    try {
      host = new URL(remote).host;
    } catch {
      host = "Git remote";
    }
  } else {
    const match = /^(?:[^@]+@)?(?<host>\[[^\]]+\]|[^:]+):/u.exec(remote);
    if (match?.groups?.host) host = match.groups.host;
  }
  return `${host} \xB7 ${config.destination.branch}:${config.destination.directory}`;
}
function remoteHead3(sha, manifest, identity) {
  return {
    snapshotRef: sha,
    snapshotId: manifest.snapshotId,
    revision: `${identity}:${sha}`,
    createdAt: manifest.createdAt,
    machine: manifest.machine,
    syncSessions: manifest.syncSessions,
    ...manifest.selection === void 0 ? {} : { selection: manifest.selection }
  };
}
function matchesExpected3(current, expected, identity) {
  if (expected.kind === "missing") return current === void 0;
  try {
    return current === decodeRevision2(expected.revision, identity);
  } catch {
    return false;
  }
}
function decodeRevision2(revision, identity) {
  const prefix = `${identity}:`;
  const sha = revision.startsWith(prefix) ? revision.slice(prefix.length) : "";
  if (!/^[0-9a-f]{40}$/u.test(sha)) throw new Error("Invalid Git remote revision.");
  return sha;
}
function isCommitSha(value) {
  return /^[0-9a-f]{40}$/u.test(value);
}
function requireCommitSha(value) {
  if (/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error("Unsupported Git SHA-256 repository; pi-sync currently requires SHA-1 refs.");
  }
  if (!/^[0-9a-f]{40}$/u.test(value)) throw new Error("Invalid Git publication reference.");
}
function isSupportedGitVersion(value) {
  const match = /git version (\d+)\.(\d+)/u.exec(value);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 2 || major === 2 && minor >= 30;
}
function assertGitDestination(config) {
  try {
    if (normalizeGitBranch(config.destination.branch) !== config.destination.branch || normalizeGitDirectory(config.destination.directory) !== config.destination.directory) {
      throw new Error("Git storage location is not normalized.");
    }
    validateGitNamespace(config.destination.namespace);
  } catch (error) {
    throw new Error("Invalid Git storage location.", { cause: error });
  }
}
function assertProductionRemote(remote) {
  let normalized;
  try {
    normalized = normalizeGitRemote(remote);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid Git remote.", {
      cause: error
    });
  }
  if (!normalized || normalized !== remote)
    throw new Error("Invalid or non-normalized Git remote.");
}
async function withGitCacheMutation(cacheDir, run, signal) {
  const previous = gitCacheMutationQueues.get(cacheDir) ?? Promise.resolve();
  const operation = previous.catch(() => void 0).then(() => {
    throwIfAborted8(signal);
    return run();
  });
  const tail = operation.then(
    () => void 0,
    () => void 0
  );
  gitCacheMutationQueues.set(cacheDir, tail);
  void tail.then(() => {
    if (gitCacheMutationQueues.get(cacheDir) === tail) gitCacheMutationQueues.delete(cacheDir);
  });
  if (!signal) return operation;
  throwIfAborted8(signal);
  let rejectAbort;
  const aborted = new Promise((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort?.(abortReason(signal));
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
  try {
    return await Promise.race([operation, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
async function assertNotSymlink(target, label) {
  try {
    const stat3 = await fs7.lstat(target);
    if (stat3.isSymbolicLink()) throw new Error(`Refusing symlinked ${label}.`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
function redactGitError(value, remote, cacheDir) {
  return value.replaceAll(remote, "<git-remote>").replaceAll(cacheDir, "<git-cache>").replace(/https:\/\/[^/@\s]+@/gu, "https://<credentials>@").replace(/\b(password|token|authorization)=\S+/giu, "$1=<redacted>").replace(/\bBearer\s+\S+/giu, "Bearer <redacted>").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").trim().slice(0, 4096);
}
function sha2566(value) {
  return createHash7("sha256").update(value).digest("hex");
}
function abortReason(signal) {
  return signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
function throwIfAborted8(signal) {
  if (signal?.aborted) throw abortReason(signal);
}
var COMMAND_TIMEOUT_MS, POST_COMMIT_TIMEOUT_MS3, gitCacheMutationQueues, GitSyncBackend;
var init_git_backend = __esm({
  "packages/pi-sync/src/git-backend.ts"() {
    "use strict";
    init_git_config();
    init_git_runner();
    init_git_storage();
    init_paths();
    init_state_directory();
    init_sync_backend();
    COMMAND_TIMEOUT_MS = 3e4;
    POST_COMMIT_TIMEOUT_MS3 = 45e3;
    gitCacheMutationQueues = /* @__PURE__ */ new Map();
    GitSyncBackend = class {
      constructor(config, options = {}) {
        this.config = config;
        assertGitDestination(config);
        this.allowLocalRemotes = options.allowLocalRemotes === true;
        if (!this.allowLocalRemotes) assertProductionRemote(config.profile.remote);
        this.identity = gitBackendIdentity(config);
        this.destination = gitDestination(config);
        this.cacheRoot = options.cacheRoot ?? path9.join(stateDir(), "git");
        this.cacheDir = path9.join(this.cacheRoot, this.identity.slice("git:".length), "repository.git");
        this.commandTimeoutMs = options.commandTimeoutMs ?? COMMAND_TIMEOUT_MS;
        this.postCommitTimeoutMs = options.postCommitTimeoutMs ?? POST_COMMIT_TIMEOUT_MS3;
        this.afterPushForTest = options.afterPushForTest;
        this.afterLsRemoteForTest = options.afterLsRemoteForTest;
        this.afterPayloadWriteForTest = options.afterPayloadWriteForTest;
      }
      config;
      identity;
      destination;
      capability = "lease-protected";
      cacheRoot;
      cacheDir;
      allowLocalRemotes;
      commandTimeoutMs;
      postCommitTimeoutMs;
      afterPushForTest;
      afterLsRemoteForTest;
      afterPayloadWriteForTest;
      cacheReady;
      sameRevision(left, right) {
        return decodeRevision2(left, this.identity) === decodeRevision2(right, this.identity);
      }
      async readHead(signal) {
        const sha = await this.fetchRemoteHead(signal);
        if (!sha) return void 0;
        const { manifest } = await this.readPublication(sha, signal);
        return remoteHead3(sha, manifest, this.identity);
      }
      async readSnapshot(reference, signal) {
        const head = await this.fetchRemoteHead(signal);
        if (!head) throw new Error(`Git snapshot publication was not found: ${reference}`);
        const commit = await this.resolveSnapshotReference(reference, head, signal);
        try {
          await this.git(["cat-file", "-e", `${commit}^{commit}`], { signal });
          await this.git(["merge-base", "--is-ancestor", commit, head], { signal });
        } catch (error) {
          throw new Error(`Git snapshot publication was not found: ${reference}`, { cause: error });
        }
        const { manifest, payloadEntries } = await this.readPublication(commit, signal);
        let blobs;
        try {
          blobs = await readGitBlobs(
            payloadEntries.map((entry) => entry.object),
            {
              gitDir: this.cacheDir,
              signal,
              timeoutMs: this.commandTimeoutMs,
              allowFileProtocol: this.allowLocalRemotes,
              maxOutputBytes: manifest.files.reduce((total, file) => total + file.size, 0)
            }
          );
        } catch (error) {
          if (error instanceof Error && /exceeds/u.test(error.message)) {
            throw new Error("Git snapshot file content exceeds its manifest size.", { cause: error });
          }
          throw this.redactedError(error);
        }
        throwIfAborted8(signal);
        const files = manifest.files.map((file, index) => {
          const content = blobs[index];
          if (!content || content.byteLength !== file.size || sha2566(content) !== file.sha256) {
            throw new Error(`Git snapshot file checksum or size mismatch: ${file.path}`);
          }
          return { path: file.path, contentBase64: content.toString("base64"), sha256: file.sha256 };
        });
        const snapshot = {
          version: manifest.snapshotVersion,
          id: manifest.snapshotId,
          createdAt: manifest.createdAt,
          machine: manifest.machine,
          profile: manifest.profile,
          ...manifest.snapshotSyncSessions === void 0 ? {} : { syncSessions: manifest.snapshotSyncSessions },
          ...manifest.selection === void 0 ? {} : { selection: manifest.selection },
          files
        };
        validateGitSnapshot(snapshot, manifest, this.config.destination.namespace);
        return snapshot;
      }
      async publishSnapshot(snapshot, expected, options = {}) {
        throwIfAborted8(options.signal);
        const files = prepareGitSnapshot(snapshot, this.config.destination.namespace);
        const observed = await this.fetchRemoteHead(options.signal);
        if (!matchesExpected3(observed, expected, this.identity)) {
          throw new SyncBackendConflictError(
            "Git remote changed while preparing publication. Run /sync status and retry.",
            { currentHead: observed ? await this.headForSha(observed, options.signal) : void 0 }
          );
        }
        throwIfAborted8(options.signal);
        const manifest = {
          version: GIT_MANIFEST_VERSION,
          snapshotVersion: snapshot.version,
          snapshotId: snapshot.id,
          createdAt: snapshot.createdAt,
          machine: snapshot.machine,
          profile: snapshot.profile,
          syncSessions: snapshot.syncSessions === true || snapshot.files.some((file) => file.path.startsWith("sessions/")),
          ...snapshot.syncSessions === void 0 ? {} : { snapshotSyncSessions: snapshot.syncSessions },
          ...snapshot.selection === void 0 ? {} : { selection: snapshot.selection },
          files: files.map(({ path: filePath, sha256: fileSha, size }) => ({
            path: filePath,
            sha256: fileSha,
            size
          }))
        };
        let candidate;
        try {
          candidate = await this.createCommit(snapshot, files, manifest, observed, options.signal);
        } catch (error) {
          throw this.redactedError(error);
        }
        throwIfAborted8(options.signal);
        options.onCommit?.();
        const ref = this.remoteRef();
        const lease = `--force-with-lease=${ref}:${observed ?? ""}`;
        let pushError;
        try {
          await this.git(
            [
              "push",
              "--porcelain",
              "--no-verify",
              lease,
              this.config.profile.remote,
              `${candidate}:${ref}`
            ],
            { timeoutMs: this.postCommitTimeoutMs }
          );
          await this.afterPushForTest?.();
        } catch (error) {
          pushError = error;
        }
        let current;
        try {
          current = await this.fetchRemoteHead(AbortSignal.timeout(this.postCommitTimeoutMs));
        } catch (error) {
          throw new SyncBackendPublicationOutcomeUnknownError(
            `Git publication outcome is unknown: ${this.safeError(pushError ?? error)}`,
            { cause: pushError ?? error }
          );
        }
        if (current !== candidate) {
          if (pushError && current === observed) {
            throw new Error(
              `Git publication failed without updating the owned branch: ${this.safeError(pushError)}`,
              {
                cause: pushError
              }
            );
          }
          throw new SyncBackendConflictError(
            pushError ? `Git publication lease was rejected: ${this.safeError(pushError)}` : "Git remote changed immediately after publication.",
            {
              phase: "after-commit",
              currentHead: current ? await this.headForSha(current) : void 0,
              candidateMayHaveBeenActive: true,
              cause: pushError instanceof Error ? pushError : void 0
            }
          );
        }
        const head = await this.headForSha(candidate);
        return { head, warnings: [] };
      }
      async listHistory(signal) {
        const sha = await this.fetchRemoteHead(signal);
        if (!sha) return [];
        const result = await this.git(
          ["rev-list", "--first-parent", "--reverse", "--max-count=100", sha],
          { signal }
        );
        const commits = result.stdout.toString("utf8").trim().split("\n").filter(Boolean);
        const entries = [];
        for (const commit of commits) {
          const { manifest } = await this.readPublication(commit, signal);
          entries.push({
            snapshotRef: commit,
            snapshotId: manifest.snapshotId,
            createdAt: manifest.createdAt,
            machine: manifest.machine,
            syncSessions: manifest.syncSessions
          });
        }
        return entries;
      }
      async diagnose(signal) {
        const diagnostics = [];
        try {
          const version = await runGit(["--version"], {
            signal,
            timeoutMs: this.commandTimeoutMs
          });
          const versionText = version.stdout.toString("utf8").trim();
          const supported = isSupportedGitVersion(versionText);
          diagnostics.push({
            key: "git-version",
            level: supported ? "info" : "error",
            message: supported ? versionText : `${versionText || "unknown Git version"}; pi-sync requires Git 2.30 or newer`
          });
        } catch (error) {
          return [{ key: "git-version", level: "error", message: this.safeError(error) }];
        }
        try {
          const head = await this.readHead(signal);
          if (head) await this.readSnapshot(head.snapshotRef, signal);
          diagnostics.push({
            key: "git-remote",
            level: "info",
            message: head ? `git remote: reachable; owned branch ${this.config.destination.branch} is valid` : `git remote: reachable; owned branch ${this.config.destination.branch} is not created yet`
          });
          diagnostics.push({
            key: "git-cache",
            level: "info",
            message: "git cache: private bare repository is healthy"
          });
        } catch (error) {
          diagnostics.push({
            key: "git-remote",
            level: "error",
            message: `git remote: ${this.safeError(error)}`
          });
        }
        return diagnostics;
      }
      async resolveSnapshotReference(reference, head, signal) {
        if (isCommitSha(reference) || /^[0-9a-f]{64}$/u.test(reference)) {
          requireCommitSha(reference);
          return reference;
        }
        if (!reference || reference.length > 512 || !/^[A-Za-z0-9._-]+$/u.test(reference)) {
          throw new Error("Invalid Git publication reference.");
        }
        const result = await this.git(["rev-list", "--first-parent", "--max-count=100", head], {
          signal
        });
        const commits = result.stdout.toString("utf8").trim().split("\n").filter(Boolean);
        const matches = [];
        for (const commit of commits) {
          const { manifest } = await this.readPublication(commit, signal);
          if (manifest.snapshotId === reference) matches.push(commit);
        }
        if (matches.length === 0) {
          throw new Error(`Git snapshot publication was not found: ${reference}`);
        }
        if (matches.length > 1) {
          throw new Error(
            `Git snapshot id is ambiguous; use a commit reference from /sync history: ${reference}`
          );
        }
        return matches[0];
      }
      async headForSha(sha, signal) {
        const { manifest } = await this.readPublication(sha, signal);
        return remoteHead3(sha, manifest, this.identity);
      }
      async fetchRemoteHead(signal) {
        await this.ensureCache(signal);
        const result = await this.git(
          ["ls-remote", "--refs", this.config.profile.remote, this.remoteRef()],
          { signal }
        );
        const line = result.stdout.toString("utf8").trim();
        if (!line) return void 0;
        const [sha, ref, ...extra] = line.split(/\s+/u);
        if (extra.length > 0 || ref !== this.remoteRef() || !sha) {
          throw new Error("Git remote returned a malformed owned-ref response.");
        }
        requireCommitSha(sha);
        await this.afterLsRemoteForTest?.();
        return withGitCacheMutation(
          this.cacheDir,
          async () => {
            const localRef = `refs/pisync/fetch/${process.pid}-${randomUUID7()}`;
            try {
              await this.git(
                [
                  "fetch",
                  "--no-tags",
                  "--force",
                  this.config.profile.remote,
                  `${this.remoteRef()}:${localRef}`
                ],
                { signal }
              );
              const fetched = (await this.git(["rev-parse", "--verify", localRef], { signal })).stdout.toString("utf8").trim();
              requireCommitSha(fetched);
              return fetched;
            } finally {
              await this.git(["update-ref", "-d", localRef], { timeoutMs: 5e3 }).catch(
                () => void 0
              );
            }
          },
          signal
        );
      }
      async readManifest(commit, signal) {
        requireCommitSha(commit);
        const bytes = await this.showFile(commit, this.manifestPath(), signal, MAX_GIT_MANIFEST_BYTES);
        let parsed;
        try {
          parsed = JSON.parse(bytes.toString("utf8"));
        } catch (error) {
          throw new Error("Git publication manifest is malformed.", { cause: error });
        }
        return requireGitManifest(parsed);
      }
      showFile(commit, filePath, signal, maxOutputBytes) {
        return this.git(["show", `${commit}:${filePath}`], { signal, maxOutputBytes }).then(
          (result) => result.stdout
        );
      }
      async createCommit(snapshot, files, manifest, parent, signal) {
        const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}
`, "utf8");
        if (manifestBytes.byteLength > MAX_GIT_MANIFEST_BYTES) {
          throw new Error(`Git publication manifest exceeds the ${MAX_GIT_MANIFEST_BYTES}-byte limit.`);
        }
        await this.ensureCache(signal);
        const temporaryDirectory = await fs7.mkdtemp(path9.join(path9.dirname(this.cacheDir), ".index-"));
        const indexPath = path9.join(temporaryDirectory, "index");
        const payloadDirectory = path9.join(temporaryDirectory, "payloads");
        const env = { GIT_INDEX_FILE: indexPath };
        try {
          await fs7.mkdir(payloadDirectory, { mode: 448 });
          const uniqueFiles = [...new Map(files.map((file) => [file.sha256, file])).values()].sort(
            (left, right) => left.sha256.localeCompare(right.sha256)
          );
          for (const file of uniqueFiles) {
            throwIfAborted8(signal);
            await fs7.writeFile(path9.join(payloadDirectory, file.sha256), file.content, {
              flag: "wx",
              mode: 384
            });
          }
          await this.afterPayloadWriteForTest?.();
          throwIfAborted8(signal);
          const hashed = await this.git(["hash-object", "-w", "--no-filters", "--stdin-paths"], {
            cwd: payloadDirectory,
            input: uniqueFiles.map((file) => file.sha256).join("\n") + (uniqueFiles.length ? "\n" : ""),
            signal,
            maxOutputBytes: Math.max(1024, uniqueFiles.length * 64)
          });
          const objectIds = hashed.stdout.toString("utf8").trim().split("\n").filter(Boolean);
          if (objectIds.length !== uniqueFiles.length || objectIds.some((id) => !isCommitSha(id))) {
            throw new Error("Git hash-object returned a malformed payload response.");
          }
          const objectsBySha256 = new Map(
            uniqueFiles.map((file, index) => [file.sha256, objectIds[index]])
          );
          const manifestBlob = (await this.git(["hash-object", "-w", "--stdin"], { input: manifestBytes, signal })).stdout.toString("utf8").trim();
          if (!isCommitSha(manifestBlob)) throw new Error("Git returned an invalid manifest blob id.");
          await this.git(["read-tree", "--empty"], { env, signal });
          const indexLines = [
            `100644 ${manifestBlob}	${this.manifestPath()}`,
            ...files.map((file) => {
              const object = objectsBySha256.get(file.sha256);
              if (!object) throw new Error("Git payload object is missing after hashing.");
              return `100644 ${object}	${this.filePath(file.path)}`;
            })
          ];
          await this.git(["update-index", "-z", "--index-info"], {
            env,
            signal,
            input: Buffer.from(`${indexLines.join("\0")}\0`, "utf8")
          });
          const tree = (await this.git(["write-tree"], { env, signal })).stdout.toString("utf8").trim();
          const date = Number.isNaN(Date.parse(snapshot.createdAt)) ? (/* @__PURE__ */ new Date()).toISOString() : snapshot.createdAt;
          const commit = await this.git(
            ["commit-tree", tree, ...parent ? ["-p", parent] : [], "-F", "-"],
            {
              signal,
              input: `pi-sync snapshot ${snapshot.id}
`,
              env: {
                GIT_AUTHOR_NAME: "pi-sync",
                GIT_AUTHOR_EMAIL: "pi-sync@localhost",
                GIT_COMMITTER_NAME: "pi-sync",
                GIT_COMMITTER_EMAIL: "pi-sync@localhost",
                GIT_AUTHOR_DATE: date,
                GIT_COMMITTER_DATE: date
              }
            }
          );
          const sha = commit.stdout.toString("utf8").trim();
          requireCommitSha(sha);
          return sha;
        } finally {
          await fs7.rm(temporaryDirectory, { recursive: true, force: true });
        }
      }
      ensureCache(signal) {
        if (!this.cacheReady) {
          const operation = withGitCacheMutation(
            this.cacheDir,
            () => this.initializeCache(signal),
            signal
          );
          const wrapped = operation.catch((error) => {
            if (this.cacheReady === wrapped) this.cacheReady = void 0;
            throw this.redactedError(error);
          });
          this.cacheReady = wrapped;
        }
        return this.cacheReady;
      }
      async initializeCache(signal) {
        const version = await runGit(["--version"], {
          signal,
          timeoutMs: this.commandTimeoutMs
        });
        const versionText = version.stdout.toString("utf8").trim();
        if (!isSupportedGitVersion(versionText)) {
          throw new Error(
            `${versionText || "Unknown Git version"}; pi-sync requires Git 2.30 or newer.`
          );
        }
        const parent = path9.dirname(this.cacheDir);
        const cacheParent = path9.dirname(this.cacheRoot);
        await assertNotSymlink(cacheParent, "Git cache parent");
        await assertNotSymlink(this.cacheRoot, "Git cache root");
        await fs7.mkdir(this.cacheRoot, { recursive: true, mode: 448 });
        await assertNotSymlink(cacheParent, "Git cache parent");
        await assertNotSymlink(this.cacheRoot, "Git cache root");
        await assertNotSymlink(parent, "Git cache identity directory");
        await fs7.mkdir(parent, { recursive: true, mode: 448 });
        await assertNotSymlink(parent, "Git cache identity directory");
        let recreate = false;
        try {
          const stat3 = await fs7.lstat(this.cacheDir);
          if (stat3.isSymbolicLink()) throw new Error("Refusing symlinked Git cache.");
          if (!stat3.isDirectory()) recreate = true;
          else {
            try {
              recreate = !await this.cacheUsesSha1(signal);
            } catch {
              recreate = true;
            }
          }
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        if (recreate) await fs7.rm(this.cacheDir, { recursive: true, force: true });
        try {
          await fs7.access(this.cacheDir);
        } catch {
          try {
            await runGit(["init", "--bare", "--object-format=sha1", this.cacheDir], {
              signal,
              timeoutMs: this.commandTimeoutMs,
              allowFileProtocol: this.allowLocalRemotes
            });
          } catch (initError) {
            const concurrent = await this.cacheUsesSha1(signal).catch(() => false);
            if (!concurrent) throw initError;
          }
        }
        if (process.platform !== "win32") await fs7.chmod(parent, 448);
      }
      async cacheUsesSha1(signal) {
        const result = await this.git(["rev-parse", "--is-bare-repository", "--show-object-format"], {
          signal
        });
        return result.stdout.toString("utf8").trim() === "true\nsha1";
      }
      git(args, options = {}) {
        return runGit(args, {
          gitDir: this.cacheDir,
          allowFileProtocol: this.allowLocalRemotes,
          timeoutMs: options.timeoutMs ?? this.commandTimeoutMs,
          ...options
        }).catch((error) => {
          throw this.redactedError(error);
        });
      }
      remoteRef() {
        return `refs/heads/${this.config.destination.branch}`;
      }
      publicationPath() {
        return this.config.destination.directory;
      }
      manifestPath() {
        return posixJoin(this.publicationPath(), "manifest.json");
      }
      filePath(filePath) {
        return posixJoin(this.publicationPath(), "files", filePath);
      }
      async readPublication(commit, signal) {
        const manifest = await this.readManifest(commit, signal);
        const entries = await this.readPublicationTree(commit, signal);
        const payloadEntries = validateGitPublicationTree(
          entries,
          manifest,
          this.manifestPath(),
          (filePath) => this.filePath(filePath)
        );
        return { manifest, payloadEntries };
      }
      async readPublicationTree(commit, signal) {
        const result = await this.git(["ls-tree", "-r", "-z", commit], {
          signal,
          maxOutputBytes: MAX_GIT_TREE_OUTPUT_BYTES
        });
        return parseGitTree(result.stdout);
      }
      redactedError(error) {
        if (error instanceof Error && error.name === "AbortError") return error;
        return new Error(this.safeError(error));
      }
      safeError(error) {
        const raw = error instanceof GitCommandError ? error.stderr || error.message : error instanceof Error ? error.message : String(error);
        return redactGitError(raw, this.config.profile.remote, this.cacheDir);
      }
    };
  }
});

// packages/pi-sync/src/backend-factory.ts
var createSyncBackend;
var init_backend_factory = __esm({
  "packages/pi-sync/src/backend-factory.ts"() {
    "use strict";
    createSyncBackend = async (config) => {
      switch (config.backend.type) {
        case "s3": {
          const { S3SyncBackend: S3SyncBackend2 } = await Promise.resolve().then(() => (init_s3_backend(), s3_backend_exports));
          return new S3SyncBackend2(config.backend);
        }
        case "webdav": {
          const { WebDavSyncBackend: WebDavSyncBackend2 } = await Promise.resolve().then(() => (init_webdav_backend(), webdav_backend_exports));
          return new WebDavSyncBackend2(config.backend);
        }
        case "git": {
          const { GitSyncBackend: GitSyncBackend2 } = await Promise.resolve().then(() => (init_git_backend(), git_backend_exports));
          return new GitSyncBackend2(config.backend);
        }
      }
    };
  }
});

// packages/pi-sync/src/remote-snapshot.ts
async function readSnapshotForHead(backend, head, signal) {
  const snapshot = await backend.readSnapshot(head.snapshotRef, signal);
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
  }
  if (snapshot.id !== head.snapshotId) {
    throw new Error(
      `Remote head ${head.snapshotId} resolved to unexpected snapshot ${snapshot.id}.`
    );
  }
  if (head.selection) {
    const snapshotInclude = snapshotSelectionInclude(snapshot);
    if (!snapshotInclude || !sameSyncInclude(head.selection.include, snapshotInclude)) {
      throw new Error("Remote head selection does not match its immutable snapshot.");
    }
  }
  return snapshot;
}
function requireCompatibleRemoteSelection(config, snapshot) {
  const state = inspectRemoteSelection(config.include, snapshot);
  if (state.kind === "different") {
    throw remoteSelectionMismatch(config, state.include, syncConfigReviewFingerprint(config));
  }
}
function formatRemoteSelectionStatus(state) {
  if (!state) return "remote included content: unavailable (remote is empty)";
  if (state.kind === "same") return "remote included content: matches this setup";
  if (state.kind === "legacy") {
    return `remote included content: unavailable in legacy snapshot (${state.discovered.length} path${state.discovered.length === 1 ? "" : "s"} discovered, partial)`;
  }
  return [
    "remote included content: differs from this setup",
    `remote-only selection: ${safeList(state.remoteOnly)}`,
    `local-only selection: ${safeList(state.localOnly)}`
  ].join("\n");
}
function safeList(values) {
  return values.length > 0 ? values.map(safeTerminalText).join(", ") : "none";
}
var init_remote_snapshot = __esm({
  "packages/pi-sync/src/remote-snapshot.ts"() {
    "use strict";
    init_config();
    init_sync_format();
    init_sync_policy();
  }
});

// packages/pi-sync/src/snapshot-apply.ts
import { createHash as createHash8 } from "node:crypto";
import fs8 from "node:fs/promises";
import path10 from "node:path";
function sha2567(value) {
  return createHash8("sha256").update(value).digest("hex");
}
function fileHashMap2(snapshot) {
  return Object.fromEntries(snapshot.files.map((file) => [file.path, file.sha256]));
}
async function applySnapshot(snapshot, protectedRelativePaths = /* @__PURE__ */ new Set(), options = {}) {
  const root = agentDir();
  const { sessionDir } = options;
  await recoverPendingSnapshotTransactions();
  const current = await createSnapshot(snapshot.profile, {
    ...options,
    ...options.include === void 0 ? { syncSessions: snapshotIncludesSessions(snapshot) } : {},
    sessionDir
  });
  const plan = await addTopLevelCaseVariantDeletes(
    root,
    protectSnapshotApplyPlan(
      root,
      preflightSnapshotApply(root, snapshot, current, { sessionDir }),
      protectedRelativePaths,
      sessionDir
    ),
    snapshot
  );
  await preflightSnapshotMutations(root, plan, sessionDir);
  await applySnapshotTransaction(plan, { sessionDir });
  return appliedFileHashMap(snapshot, current, protectedRelativePaths);
}
function preflightSnapshotApply(root, snapshot, current, options = {}) {
  const seenPaths = /* @__PURE__ */ new Set();
  const remotePaths = /* @__PURE__ */ new Set();
  const writes = [];
  const deletes = [];
  for (const file of snapshot.files) {
    const normalized = toPosix(file.path);
    if (!isSafeSnapshotPath4(file.path)) {
      throw new Error(`Unsafe path in snapshot: ${file.path}`);
    }
    if (isSessionPath(normalized) && !isSessionFilePath(normalized)) {
      throw new Error(`Unsafe session path in snapshot: ${file.path}`);
    }
    if (seenPaths.has(normalized)) throw new Error(`Duplicate path in snapshot: ${normalized}`);
    seenPaths.add(normalized);
    remotePaths.add(normalized);
    const target = snapshotTarget(root, normalized, options.sessionDir);
    const content = decodeBase64Strict2(file.contentBase64, normalized);
    if (sha2567(content) !== file.sha256)
      throw new Error(`Checksum mismatch in snapshot file: ${normalized}`);
    writes.push({ target, content });
  }
  const deletePaths = /* @__PURE__ */ new Set();
  for (const file of current.files) {
    const normalized = toPosix(file.path);
    if (!remotePaths.has(normalized)) {
      deletePaths.add(snapshotTarget(root, normalized, options.sessionDir));
    }
    for (const remotePath of parentPaths(normalized)) {
      if (remotePaths.has(remotePath)) {
        deletePaths.add(snapshotTarget(root, remotePath, options.sessionDir));
      }
    }
  }
  deletes.push(...deletePaths);
  return { writes, deletes };
}
function protectSnapshotApplyPlan(root, plan, protectedRelativePaths, sessionDir) {
  if (protectedRelativePaths.size === 0) return plan;
  const protectedTargets = new Set(
    [...protectedRelativePaths].map(
      (relativePath) => snapshotTarget(root, relativePath, sessionDir)
    )
  );
  return {
    writes: plan.writes.filter((item) => !protectedTargets.has(item.target)),
    deletes: plan.deletes.filter((target) => !protectedTargets.has(target))
  };
}
async function addTopLevelCaseVariantDeletes(root, plan, snapshot) {
  const topLevelPaths = /* @__PURE__ */ new Map();
  for (const file of snapshot.files) {
    const normalized = toPosix(file.path);
    if (!normalized.includes("/") && isSafeSnapshotPath4(file.path)) {
      topLevelPaths.set(normalized.toLowerCase(), normalized);
    }
  }
  if (topLevelPaths.size === 0) return plan;
  let entries;
  try {
    entries = await fs8.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return plan;
    throw error;
  }
  const deletes = new Set(plan.deletes);
  for (const entry of entries) {
    const canonicalPath = topLevelPaths.get(entry.name.toLowerCase());
    if (canonicalPath && entry.name !== canonicalPath && (entry.isFile() || entry.isSymbolicLink())) {
      deletes.add(safeJoin(root, entry.name));
    }
  }
  return { ...plan, deletes: [...deletes] };
}
function appliedFileHashMap(snapshot, current, protectedRelativePaths) {
  const hashes = fileHashMap2(snapshot);
  if (protectedRelativePaths.size === 0) return hashes;
  const currentHashes = fileHashMap2(current);
  for (const relativePath of protectedRelativePaths) {
    const normalized = toPosix(relativePath);
    if (currentHashes[normalized]) {
      hashes[normalized] = currentHashes[normalized];
    } else {
      delete hashes[normalized];
    }
  }
  return hashes;
}
function isSafeSnapshotPath4(relativePath) {
  if (relativePath.includes("\\")) return false;
  const normalized = toPosix(relativePath);
  return Boolean(normalized) && normalized !== "." && normalized !== ".." && !normalized.startsWith("../") && !path10.posix.isAbsolute(normalized) && path10.posix.normalize(normalized) === normalized && !isDeniedPath(normalized);
}
function decodeBase64Strict2(value, filePath) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error(`Invalid base64 content in snapshot file: ${filePath}`);
  }
  return Buffer.from(value, "base64");
}
async function preflightSnapshotMutations(root, plan, sessionDir) {
  const deletePaths = new Set(plan.deletes);
  for (const target of plan.deletes) {
    await assertNoSymlinkParents(rootForTarget(root, target, sessionDir), target);
  }
  for (const item of plan.writes) {
    await prepareSnapshotWrite(
      rootForTarget(root, item.target, sessionDir),
      item.target,
      deletePaths
    );
  }
}
function rootForTarget(root, target, sessionDir) {
  const sessionRoot = sessionDir ? sessionStorageRoot(root, sessionDir) : void 0;
  if (sessionRoot && isPathInside(sessionRoot, target)) return sessionRoot;
  return root;
}
async function prepareSnapshotWrite(root, target, deletePaths) {
  const parentWillBeReplaced = await ensureSafeDirectory(root, path10.dirname(target), deletePaths);
  if (parentWillBeReplaced) return;
  try {
    const stat3 = await fs8.lstat(target);
    if (stat3.isSymbolicLink())
      throw new Error(`Refusing to overwrite symlink during snapshot apply: ${target}`);
    if (stat3.isDirectory() && !deletePaths.has(target)) {
      throw new Error(`Refusing to overwrite directory during snapshot apply: ${target}`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
async function ensureSafeDirectory(root, directory, deletePaths) {
  assertWithinRoot(root, directory);
  const rootPath2 = path10.resolve(root);
  const relative = path10.relative(rootPath2, path10.resolve(directory));
  let current = rootPath2;
  for (const part of relative.split(path10.sep).filter(Boolean)) {
    current = path10.join(current, part);
    try {
      const stat3 = await fs8.lstat(current);
      if (stat3.isSymbolicLink())
        throw new Error(`Refusing to follow symlink during snapshot apply: ${current}`);
      if (!stat3.isDirectory()) {
        if (deletePaths.has(current)) return true;
        throw new Error(`Snapshot path parent is not a directory: ${current}`);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await fs8.mkdir(current);
    }
  }
  return false;
}
async function assertNoSymlinkParents(root, target) {
  assertWithinRoot(root, target);
  const rootPath2 = path10.resolve(root);
  const relative = path10.relative(rootPath2, path10.resolve(target));
  let current = rootPath2;
  const parts = relative.split(path10.sep).filter(Boolean);
  for (const part of parts.slice(0, -1)) {
    current = path10.join(current, part);
    try {
      const stat3 = await fs8.lstat(current);
      if (stat3.isSymbolicLink())
        throw new Error(`Refusing to follow symlink during snapshot apply: ${current}`);
      if (!stat3.isDirectory())
        throw new Error(`Snapshot path parent is not a directory: ${current}`);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
  }
}
var init_snapshot_apply = __esm({
  "packages/pi-sync/src/snapshot-apply.ts"() {
    "use strict";
    init_config();
    init_paths();
    init_snapshot();
    init_snapshot_transaction();
  }
});

// packages/pi-sync/src/sync-decision.ts
function createSyncDecision(options) {
  const { config, state, local, remote, kind } = options;
  const policyChanged = Boolean(state.lastAppliedSnapshot) && syncPolicyChanged(state, config);
  const previousInclude = includeFromSelectionConfig(state);
  const currentInclude = [...config.include];
  const causes = {
    localChanged: options.localChanged,
    remoteChanged: options.remoteChanged,
    policyChanged
  };
  const causeLines = kind === "first-sync-settings-diverged" ? ["This machine and the remote have different Pi settings on first sync."] : kind === "first-sync-sessions-diverged" ? ["Pi settings match, but local and remote sessions differ on first sync."] : kind === "remote-empty" ? ["The remote storage location is empty."] : [
    ...causes.localChanged ? ["Local content changed since the last sync."] : [],
    ...causes.remoteChanged ? ["Remote content changed since the last sync."] : [],
    ...causes.policyChanged ? ["Included content changed since the last sync."] : []
  ];
  const comparison = remote ? formatDiff(local, remote) : formatSnapshotOnlyDiff("Remote is empty. Local push would upload", local);
  const review = [
    `Sync setup: ${safeTerminalText(config.setupName)}`,
    "",
    "Why a decision is required:",
    ...causeLines,
    ...policyChanged ? [
      "",
      `Previously included: ${safeList2(previousInclude)}`,
      `Currently included: ${safeList2(currentInclude)}`
    ] : [],
    "",
    "Observed differences:",
    ...comparison.split("\n").map(safeTerminalText)
  ].join("\n");
  return new SyncDecisionRequiredError({
    kind,
    setupName: config.setupName,
    configIdentity: syncConfigReviewIdentity(config),
    causes,
    ...policyChanged ? { previousInclude: [...previousInclude] } : {},
    currentInclude,
    review,
    directions: kind === "remote-empty" ? ["push"] : ["push", "pull"],
    directMessage: options.directMessage
  });
}
function safeList2(values) {
  return values.length > 0 ? values.map(safeTerminalText).join(", ") : "none";
}
var init_sync_decision = __esm({
  "packages/pi-sync/src/sync-decision.ts"() {
    "use strict";
    init_config();
    init_sync_errors();
    init_sync_format();
    init_sync_policy();
    init_sync_state();
    init_sync_errors();
  }
});

// packages/pi-sync/src/sync-operations.ts
var sync_operations_exports = {};
__export(sync_operations_exports, {
  PublicationStatePersistenceError: () => PublicationStatePersistenceError,
  RollbackPublicationError: () => RollbackPublicationError,
  backupLocal: () => backupLocal,
  diff: () => diff,
  doctor: () => doctor,
  history: () => history,
  pull: () => pull,
  push: () => push,
  rollback: () => rollback,
  status: () => status,
  syncBoth: () => syncBoth
});
import fs9 from "node:fs/promises";
import path11 from "node:path";
function backendFor(config, factory) {
  return factory(config);
}
async function status(ctx, options, factory = createSyncBackend) {
  const config = await loadConfig(options.setup);
  throwIfAborted9(options.signal);
  ctx.ui.setStatus(STATUS_KEY2, `checking ${config.setupName}`);
  const backend = await backendFor(config, factory);
  const local = await createSnapshot(
    config.snapshotIdentity,
    snapshotOptionsForContext(ctx, config)
  );
  throwIfAborted9(options.signal);
  const state = await readStateForConfig(config);
  throwIfAborted9(options.signal);
  const head = await backend.readHead(options.signal);
  throwIfAborted9(options.signal);
  const selectionState = head ? inspectRemoteSelection(config.include, { selection: head.selection, files: [] }) : void 0;
  const localChanged = hasLocalChanges(local, state, config);
  const remoteText = head ? `remote: ${head.snapshotId} from ${head.machine} at ${head.createdAt}` : "remote: empty";
  const remoteChanged = remoteChangedSinceState(
    head,
    state,
    config,
    (left, right) => backend.sameRevision(left, right)
  );
  const warnings = syncSessionsWarnings(config);
  ctx.ui.setStatus(STATUS_KEY2, void 0);
  ctx.ui.notify(
    [
      `sync setup: ${config.setupName}`,
      `storage connection: ${config.connectionName}`,
      `storage location: ${safeTerminalText(backend.destination)}`,
      `publication safety: ${publicationCapabilityDescription(backend.capability)}`,
      `included content: ${config.include.join(", ") || "none"}`,
      `sessions: ${config.include.includes("sessions") ? "included" : "excluded"}`,
      remoteText,
      formatRemoteSelectionStatus(selectionState),
      `local files: ${local.files.length}`,
      `local changed since last sync: ${localChanged ? "yes" : "no"}`,
      `remote changed since last sync: ${remoteChanged ? "yes" : "no"}`,
      ...warnings
    ].join("\n"),
    localChanged || remoteChanged || selectionState?.kind === "different" || warnings.length > 0 ? "warning" : "info"
  );
}
async function diff(ctx, options, factory = createSyncBackend) {
  const config = await loadConfig(options.setup);
  throwIfAborted9(options.signal);
  ctx.ui.setStatus(STATUS_KEY2, `checking ${config.setupName}`);
  const backend = await backendFor(config, factory);
  const local = await createSnapshot(
    config.snapshotIdentity,
    snapshotOptionsForContext(ctx, config)
  );
  throwIfAborted9(options.signal);
  const { snapshot: remote, selectionState } = await readRemoteSnapshot(
    backend,
    config,
    options.signal,
    { allowSelectionDifference: true }
  );
  throwIfAborted9(options.signal);
  ctx.ui.setStatus(STATUS_KEY2, void 0);
  const warnings = syncSessionsWarnings(config);
  const header = [
    `sync setup: ${config.setupName}`,
    `storage connection: ${config.connectionName}`,
    `storage location: ${safeTerminalText(backend.destination)}`,
    `included content: ${config.include.join(", ") || "none"}`,
    `sessions: ${config.include.includes("sessions") ? "included" : "excluded"}`,
    formatRemoteSelectionStatus(selectionState),
    ...warnings
  ].join("\n");
  const level = warnings.length > 0 || selectionState?.kind === "different" ? "warning" : "info";
  if (!remote) {
    ctx.ui.notify(
      `${header}

${formatSnapshotOnlyDiff("Remote is empty. Local push would upload", local)}`,
      level
    );
    return;
  }
  ctx.ui.notify(`${header}

${formatDiff(local, remote)}`, level);
}
async function doctor(ctx, options, factory = createSyncBackend) {
  const messages = [];
  let level = "info";
  let snapshotOptions = {};
  let profile = DEFAULT_PROFILE;
  let backend;
  let backendSummary = [];
  try {
    const config = await loadConfig(options.setup);
    throwIfAborted9(options.signal);
    backend = await backendFor(config, factory);
    profile = config.snapshotIdentity;
    snapshotOptions = snapshotOptionsForContext(ctx, config);
    messages.push(
      `config: ok (sync setup ${config.setupName})`,
      `included content: ${config.include.join(", ") || "none"}`,
      `sessions: ${config.include.includes("sessions") ? "included" : "excluded"}`
    );
    backendSummary = [
      `storage location: ${safeTerminalText(backend.destination)}`,
      `publication safety: ${publicationCapabilityDescription(backend.capability)}`
    ];
    const warnings = syncSessionsWarnings(config);
    if (warnings.length > 0) {
      level = "warning";
      messages.push(...warnings);
    }
  } catch (error) {
    throwIfAborted9(options.signal);
    level = "warning";
    messages.push(`config: ${errorMessage(error)}`);
  }
  const local = await createSnapshot(profile, snapshotOptions);
  throwIfAborted9(options.signal);
  const secrets = scanSnapshot(local);
  if (secrets.length > 0) {
    level = "warning";
    messages.push("secret scan: possible secrets found:");
    messages.push(...secrets.map((secret) => `- ${secret}`));
  } else {
    messages.push(`secret scan: ok (${local.files.length} files checked)`);
  }
  const lock = await inspectLock();
  throwIfAborted9(options.signal);
  if (lock.status === "valid" && isStaleLock(lock.lock)) {
    level = "warning";
    messages.push(
      `lock: stale (pid ${lock.lock.pid}); run /sync unlock after verifying no sync is running`
    );
  } else if (lock.status === "valid") {
    messages.push(`lock: held by pid ${lock.lock.pid} since ${lock.lock.startedAt}`);
  } else if (lock.status === "unreadable") {
    level = "warning";
    messages.push(
      "lock: unreadable; use /sync unlock --stale only after verifying no sync is running"
    );
  } else if (await isLockGuardHeld()) {
    throwIfAborted9(options.signal);
    level = "warning";
    messages.push("lock: guard active while metadata is missing or still being initialized");
  } else {
    messages.push("lock: free");
  }
  if (backend) {
    messages.push(...backendSummary);
    const diagnostics = await backend.diagnose(options.signal);
    throwIfAborted9(options.signal);
    for (const diagnostic of diagnostics) {
      messages.push(diagnostic.message);
      if (diagnostic.level !== "info") level = "warning";
    }
  }
  ctx.ui.notify(messages.join("\n"), level);
}
async function push(ctx, options, input, factory = createSyncBackend) {
  const config = input?.config ?? await loadConfig(options.setup);
  throwIfAborted9(options.signal);
  ctx.ui.setStatus(STATUS_KEY2, `pushing ${config.setupName}`);
  const backend = input?.backend ?? await backendFor(config, factory);
  const state = input?.state ?? await readStateForConfig(config);
  throwIfAborted9(options.signal);
  const local = input?.local ?? await createSnapshot(config.snapshotIdentity, snapshotOptionsForContext(ctx, config));
  throwIfAborted9(options.signal);
  let head = await backend.readHead(options.signal);
  let remoteForUpload = await readRemoteSnapshotForUpload(
    backend,
    config,
    head,
    state,
    options.signal
  );
  if (!options.force && !remoteForUpload && head?.selection && inspectRemoteSelection(config.include, { selection: head.selection, files: [] }).kind === "different") {
    remoteForUpload = await readSnapshotForHead(backend, head, options.signal);
  }
  if (remoteForUpload && !options.force) {
    requireCompatibleRemoteSelection(config, remoteForUpload);
  }
  if (remoteChangedSinceState(
    head,
    state,
    config,
    (left, right) => backend.sameRevision(left, right)
  ) && !options.force) {
    const remoteForConflict = remoteForUpload ? filterSnapshotForConfigPolicy(remoteForUpload, config) : void 0;
    if (!remoteForConflict || !snapshotHashesMatchState(remoteForConflict, state, config)) {
      throw createSyncDecision({
        kind: head ? "remote-or-policy-changed" : "remote-empty",
        config,
        state,
        local,
        remote: remoteForConflict,
        localChanged: hasLocalChanges(local, state, config),
        remoteChanged: true,
        directMessage: "Remote or sync policy changed since last sync. Run /sync pull first or /sync push --force."
      });
    }
  }
  let upload = await snapshotForUpload(
    backend,
    config,
    local,
    head,
    remoteForUpload,
    options.signal
  );
  const secrets = scanSnapshot(local);
  if (secrets.length > 0) {
    throw new Error(
      `Refusing to push possible secrets:
${secrets.map((s) => `- ${s}`).join("\n")}`
    );
  }
  if (!await confirmPush(ctx, options, config, backend, local, upload, head, remoteForUpload)) {
    return "cancelled";
  }
  if (options.force) {
    const refreshedHead = await backend.readHead(options.signal);
    if (!sameRemoteHead(backend, head, refreshedHead)) {
      head = refreshedHead;
      remoteForUpload = head ? await backend.readSnapshot(head.snapshotRef, options.signal) : void 0;
      upload = await snapshotForUpload(
        backend,
        config,
        local,
        head,
        remoteForUpload,
        options.signal
      );
      if (!await confirmPush(
        ctx,
        options,
        config,
        backend,
        local,
        upload,
        head,
        remoteForUpload,
        "Remote changed during review. Push the refreshed plan?"
      )) {
        return "cancelled";
      }
    }
  }
  const result = await backend.publishSnapshot(upload, expectedRemoteHead(head), {
    signal: options.signal,
    onCommit: options.onCommit
  });
  try {
    await writeStateForConfig(config, {
      version: VERSION5,
      profile: config.snapshotIdentity,
      lastAppliedSnapshot: result.head.snapshotId,
      lastRemoteRevision: result.head.revision,
      lastFileHashes: fileHashMap(local),
      include: [...config.include]
    });
  } catch (error) {
    throw new PublicationStatePersistenceError(result.head, error);
  }
  if (options.signal?.aborted) return;
  ctx.ui.setStatus(STATUS_KEY2, void 0);
  if (!options.silent) {
    ctx.ui.notify(
      [
        `Pushed ${upload.files.length} files from sync setup \u201C${config.setupName}\u201D as ${result.head.snapshotId}.`,
        ...result.warnings
      ].filter(Boolean).join("\n"),
      result.warnings.length > 0 ? "warning" : "info"
    );
  }
  return "applied";
}
async function pull(ctx, options, factory = createSyncBackend) {
  const config = await loadConfig(options.setup);
  throwIfAborted9(options.signal);
  ctx.ui.setStatus(STATUS_KEY2, `pulling ${config.setupName}`);
  const backend = await backendFor(config, factory);
  const state = await readStateForConfig(config);
  throwIfAborted9(options.signal);
  const local = await createSnapshot(
    config.snapshotIdentity,
    snapshotOptionsForContext(ctx, config)
  );
  throwIfAborted9(options.signal);
  const { head, snapshot: remote } = await readRemoteSnapshot(backend, config, options.signal);
  throwIfAborted9(options.signal);
  const localChanged = hasLocalChanges(local, state, config);
  if (!remote) {
    throw createSyncDecision({
      kind: "remote-empty",
      config,
      state,
      local,
      localChanged,
      remoteChanged: false,
      directMessage: "Remote is empty. Run /sync push from a configured machine first."
    });
  }
  const remoteChanged = hasRemoteChanges(remote, state, config, protectedSessionPaths(ctx));
  if (localChanged && remoteChanged && state.lastAppliedSnapshot && !options.force) {
    throw createSyncDecision({
      kind: "both-changed",
      config,
      state,
      local,
      remote,
      localChanged,
      remoteChanged,
      directMessage: "Both local and remote changed since last sync. Run /sync diff, then choose /sync pull --force or /sync push --force."
    });
  }
  if (!options.yes && !await ctx.ui.confirm(
    snapshotIncludesSessions(remote) ? "Pull pi settings and sessions?" : "Pull pi settings?",
    formatPullSummary(
      config,
      backend.destination,
      local,
      remote,
      protectedSessionPaths(ctx).size
    )
  )) {
    ctx.ui.setStatus(STATUS_KEY2, void 0);
    ctx.ui.notify("Pull cancelled.", "info");
    return "cancelled";
  }
  throwIfAborted9(options.signal);
  const backup = await backupLocal(
    config.snapshotIdentity,
    snapshotOptionsForContext(ctx, config),
    options.signal
  );
  const applySessionDir = await sessionDirForApply(ctx, remote);
  throwIfAborted9(options.signal);
  options.onCommit?.();
  const lastFileHashes = await applySnapshot(remote, protectedSessionPaths(ctx), {
    include: config.include,
    sessionDir: applySessionDir
  });
  await writeStateForConfig(config, {
    version: VERSION5,
    profile: config.snapshotIdentity,
    lastAppliedSnapshot: remote.id,
    lastRemoteRevision: head?.revision,
    lastFileHashes,
    include: [...config.include]
  });
  if (options.signal?.aborted) return "applied";
  ctx.ui.setStatus(STATUS_KEY2, void 0);
  if (!options.silent) {
    ctx.ui.notify(
      `Pulled ${remote.files.length} files from ${remote.id}. Backup: ${backup}`,
      "info"
    );
  } else if (options.auto && config.include.includes("sessions") && snapshotIncludesSessions(remote)) {
    ctx.ui.notify(
      "Pulled Pi sessions after startup selected the current session. Restart Pi or resume a pulled session to use newly synced conversations.",
      "warning"
    );
  }
  if (options.reload) await maybeReload(ctx, options.signal);
  return "applied";
}
async function syncBoth(ctx, options, factory = createSyncBackend) {
  const config = await loadConfig(options.setup);
  throwIfAborted9(options.signal);
  const backend = await backendFor(config, factory);
  const state = await readStateForConfig(config);
  throwIfAborted9(options.signal);
  const local = await createSnapshot(
    config.snapshotIdentity,
    snapshotOptionsForContext(ctx, config)
  );
  throwIfAborted9(options.signal);
  if (config.include.length === 0) {
    if (!options.silent) {
      ctx.ui.notify(
        `Sync setup \u201C${config.setupName}\u201D includes no files. Choose included content in /sync Settings before syncing.`,
        "warning"
      );
    }
    return;
  }
  const { head, snapshot: remote } = await readRemoteSnapshot(backend, config, options.signal);
  throwIfAborted9(options.signal);
  const localChanged = hasLocalChanges(local, state, config);
  const remoteChanged = remote ? hasRemoteChanges(remote, state, config, protectedSessionPaths(ctx)) : false;
  const firstSync = !state.lastAppliedSnapshot;
  if (firstSync && remote && remote.files.length > 0 && local.files.length > 0) {
    if (!canPullRemoteSettingsOnFirstSync(local, remote)) {
      throw createSyncDecision({
        kind: "first-sync-settings-diverged",
        config,
        state,
        local,
        remote,
        localChanged: true,
        remoteChanged: true,
        directMessage: "Remote settings exist and this machine has different local Pi settings. Run /sync diff, then manually choose /sync pull or /sync push."
      });
    }
    if (!sameHashes(fileHashMap(local), fileHashMap(remote))) {
      if (!canPullRemoteSessionsOnFirstSync(local, remote)) {
        throw createSyncDecision({
          kind: "first-sync-sessions-diverged",
          config,
          state,
          local,
          remote,
          localChanged: true,
          remoteChanged: true,
          directMessage: "Remote settings match, but local and remote Pi sessions differ. Run /sync diff, then manually choose /sync pull or /sync push."
        });
      }
      await pull(ctx, options, factory);
      return;
    }
    await writeStateForConfig(config, {
      version: VERSION5,
      profile: config.snapshotIdentity,
      lastAppliedSnapshot: remote.id,
      lastRemoteRevision: head?.revision,
      lastFileHashes: fileHashMap(remote),
      include: [...config.include]
    });
    if (!options.silent)
      ctx.ui.notify("pi-sync state initialized; local settings already match remote.", "info");
    return;
  }
  if (localChanged && remoteChanged && remote && snapshotsMatch2(local, remote)) {
    await writeStateForConfig(config, {
      version: VERSION5,
      profile: config.snapshotIdentity,
      lastAppliedSnapshot: remote.id,
      lastRemoteRevision: head?.revision,
      lastFileHashes: fileHashMap(remote),
      include: [...config.include]
    });
    if (!options.silent) ctx.ui.notify("pi-sync is already up to date.", "info");
    return;
  }
  if (localChanged && remoteChanged && state.lastAppliedSnapshot) {
    throw createSyncDecision({
      kind: "both-changed",
      config,
      state,
      local,
      remote,
      localChanged,
      remoteChanged,
      directMessage: "Both local and remote changed. Run /sync diff and resolve with push --force or pull --force."
    });
  }
  if (remoteChanged) {
    await pull(ctx, options, factory);
    return;
  }
  if (localChanged || !remote) {
    await push(ctx, options, void 0, factory);
    return;
  }
  if (shouldRefreshSyncedState(
    remote,
    head,
    state,
    config,
    (left, right) => backend.sameRevision(left, right)
  )) {
    await writeStateForConfig(config, {
      version: VERSION5,
      profile: config.snapshotIdentity,
      lastAppliedSnapshot: remote.id,
      lastRemoteRevision: head?.revision,
      lastFileHashes: fileHashMap(remote),
      include: [...config.include]
    });
  }
  if (!options.silent) ctx.ui.notify("pi-sync is already up to date.", "info");
}
async function history(ctx, options, factory = createSyncBackend) {
  const config = await loadConfig(options.setup);
  throwIfAborted9(options.signal);
  const backend = await backendFor(config, factory);
  const snapshots = (await backend.listHistory(options.signal)).slice(-20).reverse();
  throwIfAborted9(options.signal);
  if (snapshots.length === 0) {
    ctx.ui.notify("No remote pi-sync history found.", "info");
    return;
  }
  const currentSnapshot = snapshots[0]?.snapshotId;
  if (ctx.mode === "tui") {
    const labels = snapshots.map(
      (item, index2) => `${index2 + 1}. ${item.createdAt} \xB7 ${safeTerminalText(item.machine)} \xB7 ${item.snapshotId}${item.snapshotId === currentSnapshot ? " (current)" : ""}${item.syncSessions ? " \xB7 sessions" : ""}`
    );
    const selected = await ctx.ui.select(
      `History for sync setup \u201C${safeTerminalText(config.setupName)}\u201D

Choose a snapshot to preview rollback.`,
      [...labels, "Back"]
    );
    if (!selected || selected === "Back") return;
    throwIfAborted9(options.signal);
    const index = labels.indexOf(selected);
    const snapshot = snapshots[index];
    if (!snapshot) return;
    await withLock(
      "rollback",
      () => rollback(ctx, { ...options, args: [snapshot.snapshotRef], yes: false }, factory, {
        backendIdentity: backend.identity,
        setup: config.setupName
      })
    );
    return;
  }
  ctx.ui.notify(
    snapshots.map((item) => `${item.snapshotRef} ${item.createdAt} ${safeTerminalText(item.machine)}`).join("\n"),
    "info"
  );
}
async function rollback(ctx, options, factory = createSyncBackend, expectedSelection) {
  const target = options.args[0];
  if (!target) throw new Error("Usage: /sync rollback <snapshot-id> [--yes]");
  const config = await loadConfig(options.setup);
  throwIfAborted9(options.signal);
  const backend = await backendFor(config, factory);
  if (expectedSelection && (backend.identity !== expectedSelection.backendIdentity || config.setupName !== expectedSelection.setup)) {
    throw new Error(
      "Sync setup or storage location changed while history was open; reopen history and retry."
    );
  }
  const decoded = await backend.readSnapshot(target, options.signal);
  const selected = filterSnapshotForConfigPolicy(
    config.include.includes("sessions") ? decoded : snapshotWithoutSessions(decoded),
    config
  );
  const remote = regenerateSnapshotIdentity(selected);
  const local = await createSnapshot(
    config.snapshotIdentity,
    snapshotOptionsForContext(ctx, config)
  );
  const expectedHead = await backend.readHead(options.signal);
  throwIfAborted9(options.signal);
  if (!options.yes && !await ctx.ui.confirm(
    snapshotIncludesSessions(remote) ? "Rollback pi settings and sessions?" : "Rollback pi settings?",
    formatRollbackSummary(
      config,
      backend.destination,
      local,
      remote,
      target,
      protectedSessionPaths(ctx).size
    )
  )) {
    ctx.ui.notify("Rollback cancelled.", "info");
    return;
  }
  throwIfAborted9(options.signal);
  const backup = await backupLocal(
    config.snapshotIdentity,
    snapshotOptionsForContext(ctx, config),
    options.signal
  );
  const applySessionDir = await sessionDirForApply(ctx, remote);
  throwIfAborted9(options.signal);
  options.onCommit?.();
  const lastFileHashes = await applySnapshot(remote, protectedSessionPaths(ctx), {
    include: config.include,
    sessionDir: applySessionDir
  });
  let result;
  try {
    const completionSignal = AbortSignal.timeout(POST_LOCAL_COMMIT_TIMEOUT_MS);
    const upload = await snapshotForUpload(
      backend,
      config,
      remote,
      expectedHead,
      void 0,
      completionSignal,
      { ignoreUnreadableRemote: true }
    );
    result = await backend.publishSnapshot(upload, expectedRemoteHead(expectedHead), {
      signal: completionSignal
    });
  } catch (error) {
    throw new RollbackPublicationError(backup, error);
  }
  try {
    await writeStateForConfig(config, {
      version: VERSION5,
      profile: config.snapshotIdentity,
      lastAppliedSnapshot: result.head.snapshotId,
      lastRemoteRevision: result.head.revision,
      lastFileHashes,
      include: [...config.include]
    });
  } catch (error) {
    throw new PublicationStatePersistenceError(result.head, error, backup);
  }
  if (options.signal?.aborted) return;
  ctx.ui.notify(
    [
      `Rolled back sync setup \u201C${config.setupName}\u201D to ${target}; latest: ${result.head.snapshotId}. Backup: ${backup}`,
      ...result.warnings
    ].filter(Boolean).join("\n"),
    result.warnings.length > 0 ? "warning" : "info"
  );
  await maybeReload(ctx, options.signal);
}
function protectedSessionPaths(ctx) {
  const getSessionFile = ctx.sessionManager.getSessionFile;
  if (typeof getSessionFile !== "function") return /* @__PURE__ */ new Set();
  const sessionFile = getSessionFile.call(ctx.sessionManager);
  const snapshotPath2 = sessionFile ? sessionSnapshotPathFromAbsolute(sessionFile, sessionDirFromContext2(ctx)) : void 0;
  return snapshotPath2 ? /* @__PURE__ */ new Set([snapshotPath2]) : /* @__PURE__ */ new Set();
}
function snapshotOptionsForContext(ctx, config) {
  return {
    include: config.include,
    sessionDir: sessionDirFromContext2(ctx)
  };
}
function sessionDirFromContext2(ctx) {
  const manager = ctx.sessionManager;
  const usesDefaultSessionDir = manager.usesDefaultSessionDir;
  if (typeof usesDefaultSessionDir === "function" && usesDefaultSessionDir.call(manager)) {
    return void 0;
  }
  const getSessionDir = manager.getSessionDir;
  return typeof getSessionDir === "function" ? getSessionDir.call(manager) : void 0;
}
async function maybeReload(ctx, signal) {
  if (signal?.aborted || !("reload" in ctx)) return;
  if (ctx.hasUI && await ctx.ui.confirm(
    "Reload Pi resources now?",
    "This reloads extensions, skills, prompts, themes, and context files."
  )) {
    if (signal?.aborted) return;
    await ctx.reload();
  }
}
async function readRemoteSnapshotForUpload(backend, config, head, state, signal) {
  if (!head || head.snapshotId === state.lastAppliedSnapshot && !syncPolicyChanged(state, config) && (!state.lastRemoteRevision || backend.sameRevision(head.revision, state.lastRemoteRevision))) {
    return void 0;
  }
  return backend.readSnapshot(head.snapshotRef, signal);
}
async function snapshotForUpload(backend, config, local, head, remote, signal, options = {}) {
  if (!head) return local;
  let snapshot = remote;
  if (!snapshot) {
    try {
      snapshot = await backend.readSnapshot(head.snapshotRef, signal);
    } catch (error) {
      if (options.ignoreUnreadableRemote) return local;
      throw error;
    }
  }
  return mergeRemotePreservedFiles(local, snapshot, config);
}
async function readRemoteSnapshot(backend, config, signal, options = {}) {
  const head = await backend.readHead(signal);
  if (!head) return { head: void 0, snapshot: void 0, selectionState: void 0 };
  const snapshot = await readSnapshotForHead(backend, head, signal);
  const selectionState = inspectRemoteSelection(config.include, snapshot);
  if (!options.allowSelectionDifference && selectionState.kind === "different") {
    const configIdentity = syncConfigReviewFingerprint(config);
    throw remoteSelectionMismatch(config, selectionState.include, configIdentity);
  }
  return {
    head,
    snapshot: filterSnapshotForConfigPolicy(snapshot, config),
    selectionState
  };
}
async function confirmPush(ctx, options, config, backend, local, upload, head, remote, title = snapshotIncludesSessions(upload) ? "Push pi settings and sessions?" : "Push pi settings?") {
  throwIfAborted9(options.signal);
  if (options.yes) return true;
  const confirmed = await ctx.ui.confirm(
    title,
    formatPushSummary(
      config,
      backend.destination,
      upload,
      head,
      countPreservedRemoteFiles(local, upload),
      remote
    )
  );
  throwIfAborted9(options.signal);
  if (confirmed) return true;
  ctx.ui.setStatus(STATUS_KEY2, void 0);
  ctx.ui.notify("Push cancelled.", "info");
  return false;
}
function throwIfAborted9(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
function sameRemoteHead(backend, left, right) {
  if (!left || !right) return left === right;
  return backend.sameRevision(left.revision, right.revision);
}
async function backupLocal(profile, options = {}, signal) {
  throwIfAborted9(signal);
  const snapshot = await createSnapshot(profile, options);
  throwIfAborted9(signal);
  const backupDirectory = path11.join(stateDir(), "backups");
  await fs9.mkdir(backupDirectory, { recursive: true });
  throwIfAborted9(signal);
  const backupPath = path11.join(backupDirectory, `${snapshot.id}.json.gz`);
  const encoded = await encodeSnapshot(snapshot);
  throwIfAborted9(signal);
  await fs9.writeFile(backupPath, encoded, { signal });
  return backupPath;
}
var STATUS_KEY2, VERSION5, DEFAULT_PROFILE, POST_LOCAL_COMMIT_TIMEOUT_MS, PublicationStatePersistenceError, RollbackPublicationError;
var init_sync_operations = __esm({
  "packages/pi-sync/src/sync-operations.ts"() {
    "use strict";
    init_backend_factory();
    init_config();
    init_lock();
    init_remote_snapshot();
    init_snapshot();
    init_snapshot_apply();
    init_snapshot_codec();
    init_sync_backend();
    init_sync_decision();
    init_sync_format();
    init_sync_policy();
    init_sync_state();
    STATUS_KEY2 = "sync";
    VERSION5 = 1;
    DEFAULT_PROFILE = "default";
    POST_LOCAL_COMMIT_TIMEOUT_MS = 3e4;
    PublicationStatePersistenceError = class extends Error {
      head;
      backupPath;
      constructor(head, cause, backupPath) {
        super(
          `Remote publication ${head.snapshotId} is active, but local sync state could not be saved${backupPath ? `; local backup: ${backupPath}` : ""}: ${errorMessage(cause)}`,
          { cause }
        );
        this.name = "PublicationStatePersistenceError";
        this.head = head;
        this.backupPath = backupPath;
      }
    };
    RollbackPublicationError = class extends Error {
      backupPath;
      constructor(backupPath, cause) {
        super(
          `Rollback applied locally with backup ${backupPath}, but remote publication failed: ${errorMessage(cause)}`,
          { cause }
        );
        this.name = "RollbackPublicationError";
        this.backupPath = backupPath;
      }
    };
  }
});

// packages/pi-sync/src/manager-helpers.ts
async function requiredExistingBucket(ctx, example, signal) {
  const value = await ctx.ui.input("Existing bucket", `Example: ${example}`, { signal });
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
  }
  if (value === void 0) return void 0;
  const normalized = value.trim();
  if (!normalized) {
    ctx.ui.notify("Enter the name of an existing R2/S3 bucket, or cancel setup.", "warning");
    return void 0;
  }
  return normalized;
}
async function requiredInput(ctx, title, placeholder, signal) {
  const value = await ctx.ui.input(title, placeholder, { signal });
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
  }
  if (value === void 0) return void 0;
  const normalized = value.trim() || placeholder;
  return normalized.includes("<") || normalized.includes(">") ? void 0 : normalized;
}
function ownRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function safeTerminalText2(value) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, "?");
}
function errorMessage5(error) {
  return error instanceof Error ? error.message : String(error);
}
var init_manager_helpers = __esm({
  "packages/pi-sync/src/manager-helpers.ts"() {
    "use strict";
    init_config();
  }
});

// packages/pi-sync/src/cancellable-operation.ts
import {
  BorderedLoader
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth as truncateToWidth2 } from "@earendil-works/pi-tui";
import { runCustomInteraction } from "@narumitw/pi-tui-kit";
async function runCancellableOperation(ctx, message, route, runRoute, options = {}) {
  const {
    commitAware = false,
    cancelledMessage = "Check cancelled; no settings or files were changed.",
    target,
    signal
  } = options;
  if (ctx.mode !== "tui") {
    return await runRoute(route, signal, void 0, target) ?? { kind: "failed" };
  }
  let commitStarted = false;
  let routeResult;
  const interaction = await runCustomInteraction(ctx, {
    signal,
    isCurrent: () => !signal?.aborted,
    create: ({ tui, theme, keybindings, signal: interactionSignal, complete }) => {
      const loader = new BorderedLoader(tui, theme, message, { cancellable: false });
      const cancelHint = `${keybindingText(keybindings, "tui.select.cancel", "esc")} cancel`;
      const operation = runRoute(
        route,
        interactionSignal,
        commitAware ? () => commitStarted = true : void 0,
        target
      ).then(
        (result) => {
          routeResult = result;
          complete({});
        },
        (error) => complete({ error })
      );
      return {
        render(width) {
          const safeWidth = Math.max(1, width);
          const lines = loader.render(safeWidth);
          const bottomBorder = lines.at(-1);
          return [
            ...lines.slice(0, -1),
            truncateToWidth2(theme.fg("dim", cancelHint), safeWidth, ""),
            ...bottomBorder === void 0 ? [] : [bottomBorder]
          ];
        },
        invalidate: () => loader.invalidate(),
        handleInput(data) {
          if (!keybindings.matches(data, "tui.select.cancel")) return;
          if (commitStarted) {
            ctx.ui.notify(
              "Applying or publishing has started and cannot be cancelled safely.",
              "warning"
            );
            return;
          }
          complete({ cancelled: true });
        },
        dispose: () => loader.dispose(),
        waitForPending: () => operation
      };
    }
  });
  if (interaction.kind === "error") throw interaction.error;
  if (interaction.kind !== "completed") return { kind: "closed" };
  if (interaction.value.cancelled) {
    if (cancelledMessage) ctx.ui.notify(cancelledMessage, "info");
    return { kind: "cancelled" };
  }
  if (interaction.value.error) throw interaction.value.error;
  return routeResult ?? { kind: "failed" };
}
function keybindingText(keybindings, binding, fallback) {
  const keys = keybindings.getKeys(binding).map(String).map((key) => {
    if (key === "return") return "enter";
    if (key === "escape") return "esc";
    return safeTerminalText2(key);
  }).filter(Boolean);
  return keys.join("/") || fallback;
}
var init_cancellable_operation = __esm({
  "packages/pi-sync/src/cancellable-operation.ts"() {
    "use strict";
    init_manager_helpers();
  }
});

// packages/pi-sync/src/settings-management.ts
async function saveNewV3Settings(input, signal) {
  validateConfigName(input.setupName, "sync setup");
  validateConfigName(input.connectionName, "storage connection");
  const settings = {
    version: 3,
    activeSyncSetup: input.setupName,
    onSwitch: "ask-before-pull",
    storageConnections: { [input.connectionName]: structuredClone(input.connection) },
    syncSetups: {
      [input.setupName]: {
        ...structuredClone(input.setup),
        storage: { ...input.setup.storage, connection: input.connectionName }
      }
    }
  };
  await updateLocalConfig((current) => {
    if (Object.keys(current.storageConnections).length || Object.keys(current.syncSetups).length) {
      throw new Error(`Settings already exist: ${localConfigPath()}`);
    }
    return settings;
  }, signal);
  return settings;
}
async function addStorageConnection(name, connection, signal) {
  validateConfigName(name, "storage connection");
  await updateSettings((settings) => {
    if (Object.hasOwn(settings.storageConnections, name)) {
      throw new Error(`Storage connection already exists: ${name}`);
    }
    return {
      ...settings,
      storageConnections: {
        ...settings.storageConnections,
        [name]: structuredClone(connection)
      }
    };
  }, signal);
}
async function updateStorageConnection(name, update, expectedSetups, signal) {
  validateConfigName(name, "storage connection");
  await updateSettings((settings) => {
    const connection = settings.storageConnections[name];
    if (!connection) throw new Error(`Storage connection not found: ${name}`);
    const currentSetups = referencingSetupNames(settings.syncSetups, name);
    if (expectedSetups && !sameNames(currentSetups, expectedSetups)) {
      throw new Error(
        `Storage connection \u201C${name}\u201D usage changed while it was open; reopen it and review the affected sync setups.`
      );
    }
    const nextConnection = update(structuredClone(connection));
    const nextConnections = { ...settings.storageConnections, [name]: nextConnection };
    assertUniqueLocations(settings.syncSetups, nextConnections);
    return { ...settings, storageConnections: nextConnections };
  }, signal);
}
async function addSyncSetup(name, setup, signal) {
  validateConfigName(name, "sync setup");
  await updateSettings((settings) => {
    if (Object.hasOwn(settings.syncSetups, name))
      throw new Error(`Sync setup already exists: ${name}`);
    if (!Object.hasOwn(settings.storageConnections, setup.storage.connection)) {
      throw new Error(`Storage connection not found: ${setup.storage.connection}`);
    }
    const nextSetups = { ...settings.syncSetups, [name]: structuredClone(setup) };
    assertUniqueLocations(nextSetups, settings.storageConnections);
    return {
      ...settings,
      syncSetups: nextSetups,
      ...settings.activeSyncSetup ? {} : { activeSyncSetup: name }
    };
  }, signal);
}
async function updateSyncSetup(name, update, options = {}) {
  validateConfigName(name, "sync setup");
  await updateSettings((settings) => {
    const setup = settings.syncSetups[name];
    if (!setup) throw new Error(`Sync setup not found: ${name}`);
    if (options.expectedInclude && !sameNames(normalizeSyncInclude(setup.sync.include), options.expectedInclude)) {
      throw new SyncSetupReviewChangedError(
        `Sync setup \u201C${name}\u201D included content changed while it was open; reopen it and review the current selection.`
      );
    }
    if (options.expectedStorage) {
      const connectionName = setup.storage.connection;
      const connection = settings.storageConnections[connectionName];
      if (!connection || !sameStorageReview(
        syncSetupStorageReview(name, setup, connectionName, connection),
        options.expectedStorage
      )) {
        throw new SyncSetupReviewChangedError(
          `Sync setup \u201C${name}\u201D storage changed while it was open; reopen it and review the current storage location.`
        );
      }
    }
    const nextSetup = update(structuredClone(setup));
    if (!Object.hasOwn(settings.storageConnections, nextSetup.storage.connection)) {
      throw new Error(`Storage connection not found: ${nextSetup.storage.connection}`);
    }
    const nextSetups = { ...settings.syncSetups, [name]: nextSetup };
    assertUniqueLocations(nextSetups, settings.storageConnections);
    return { ...settings, syncSetups: nextSetups };
  }, options.signal);
}
async function removeSyncSetup(name, signal) {
  validateConfigName(name, "sync setup");
  await updateSettings((settings) => {
    if (!Object.hasOwn(settings.syncSetups, name)) throw new Error(`Sync setup not found: ${name}`);
    const isCurrent = settings.activeSyncSetup === name;
    if (isCurrent && Object.keys(settings.syncSetups).length > 1) {
      throw new Error("Switch to another sync setup before removing the current setup.");
    }
    const syncSetups = { ...settings.syncSetups };
    delete syncSetups[name];
    const next = { ...settings, syncSetups };
    if (isCurrent) delete next.activeSyncSetup;
    return next;
  }, signal);
}
async function removeStorageConnection(name, signal) {
  validateConfigName(name, "storage connection");
  await updateSettings((settings) => {
    const referenced = referencingSetupNames(settings.syncSetups, name)[0];
    if (referenced) {
      throw new Error(`Storage connection \u201C${name}\u201D is used by sync setup \u201C${referenced}\u201D.`);
    }
    if (!Object.hasOwn(settings.storageConnections, name)) {
      throw new Error(`Storage connection not found: ${name}`);
    }
    const storageConnections = { ...settings.storageConnections };
    delete storageConnections[name];
    return { ...settings, storageConnections };
  }, signal);
}
async function updateSettings(update, signal) {
  return updateLocalConfig((settings) => {
    if (settings.version !== 3) {
      throw new Error("Storage connections and sync setups require version 3 pi-sync settings.");
    }
    return update(settings);
  }, signal);
}
function referencingSetupNames(setups, connection) {
  return Object.entries(setups).filter(([, setup]) => setup.storage.connection === connection).map(([name]) => name).sort((left, right) => left.localeCompare(right));
}
function assertUniqueLocations(setups, connections) {
  const identities = /* @__PURE__ */ new Map();
  for (const [name, setup] of Object.entries(setups)) {
    const connection = connections[setup.storage.connection];
    if (!connection) throw new Error(`Storage connection not found: ${setup.storage.connection}`);
    const identity = effectiveSyncSetupRemoteIdentity(setup, connection);
    const previous = identities.get(identity);
    if (previous) {
      throw new Error(`Sync setup \u201C${name}\u201D duplicates the storage location of \u201C${previous}\u201D.`);
    }
    identities.set(identity, name);
  }
}
function sameNames(left, right) {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}
function sameStorageReview(left, right) {
  return left.connectionName === right.connectionName && left.storageKind === right.storageKind && left.storagePath === right.storagePath && left.bucket === right.bucket && left.branch === right.branch;
}
var SyncSetupReviewChangedError;
var init_settings_management = __esm({
  "packages/pi-sync/src/settings-management.ts"() {
    "use strict";
    init_config();
    SyncSetupReviewChangedError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "SyncSetupReviewChangedError";
      }
    };
  }
});

// packages/pi-sync/src/git-ui.ts
async function showGitSetup(ctx, targetName, signal) {
  const profileName = await requiredInput(ctx, "Name this Git storage connection", "git", signal);
  if (!profileName) return false;
  const remoteInput = await requiredInput(
    ctx,
    "Git SSH or HTTPS remote",
    "git@github.com:owner/private-pi-sync.git",
    signal
  );
  if (!remoteInput) return false;
  const destination = await promptGitDestination(ctx, targetName, signal);
  if (!destination) return false;
  const automatic = await ctx.ui.select(
    "Automatic sync for this setup",
    ["Enable automatic sync", "Keep automatic sync off", "Cancel"],
    { signal }
  );
  throwIfAborted10(signal);
  if (!automatic || automatic === "Cancel") return false;
  let remote;
  try {
    remote = normalizeGitRemote(remoteInput);
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    return false;
  }
  if (!remote) return false;
  const choice = await ctx.ui.select(
    [
      "Review Git sync setup",
      "",
      `Sync setup: ${safeTerminalText2(targetName)}`,
      `Storage connection: ${safeTerminalText2(profileName)} (Git)`,
      `Remote: ${safeGitRemote(remote)}`,
      `Owned branch: ${safeTerminalText2(destination.branch)}`,
      `Storage location: ${safeTerminalText2(destination.directory)}`,
      `Included content: ${DEFAULT_SYNC_INCLUDE.length} built-in groups \xB7 Sessions: Off`,
      `Automatic sync: ${automatic === "Enable automatic sync" ? "On" : "Off"}`,
      "Authentication: existing non-interactive Git/SSH credentials; no credentials are stored by pi-sync.",
      "The remote repository must already exist. The owned branch may be created on first push."
    ].join("\n"),
    ["Save setup", "Cancel"],
    { signal }
  );
  throwIfAborted10(signal);
  if (choice !== "Save setup") return false;
  await saveNewV3Settings(
    {
      setupName: targetName,
      connectionName: profileName,
      connection: { type: "git", remote },
      setup: {
        storage: {
          connection: profileName,
          branch: destination.branch,
          path: destination.directory
        },
        sync: {
          include: [...DEFAULT_SYNC_INCLUDE],
          automatic: automatic === "Enable automatic sync"
        }
      }
    },
    signal
  );
  if (signal?.aborted) return true;
  ctx.ui.notify(
    `Saved Git sync setup \u201C${safeTerminalText2(targetName)}\u201D. Run /sync doctor.`,
    "info"
  );
  return true;
}
async function showAddGitStorageProfile(ctx, signal) {
  const name = await requiredInput(ctx, "Name this Git storage connection", "git", signal);
  if (!name) return false;
  const remoteInput = await requiredInput(
    ctx,
    "Git SSH or HTTPS remote",
    "git@github.com:owner/private-pi-sync.git",
    signal
  );
  if (!remoteInput) return false;
  let remote;
  try {
    remote = normalizeGitRemote(remoteInput);
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    return false;
  }
  if (!remote) return false;
  const choice = await ctx.ui.select(
    `Review storage connection

Name: ${safeTerminalText2(name)}
Type: Git
Remote: ${safeGitRemote(remote)}
Credentials: existing Git/SSH authentication (not stored)
Adding a connection does not contact the remote or start syncing.`,
    ["Add storage connection", "Cancel"],
    { signal }
  );
  throwIfAborted10(signal);
  if (choice !== "Add storage connection") return false;
  await addStorageConnection(name, { type: "git", remote }, signal);
  if (signal?.aborted) return true;
  ctx.ui.notify(`Added storage connection \u201C${safeTerminalText2(name)}\u201D.`, "info");
  return true;
}
async function showEditGitStorageProfile(ctx, name, profile, signal, affectedSetups) {
  const remoteInput = await requiredInput(
    ctx,
    "Git SSH or HTTPS remote",
    typeof profile.remote === "string" ? profile.remote : "git@github.com:owner/private-pi-sync.git",
    signal
  );
  if (!remoteInput) return false;
  let remote;
  try {
    remote = normalizeGitRemote(remoteInput);
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    return false;
  }
  if (!remote) return false;
  const choice = await ctx.ui.select(
    `Review storage connection

Storage connection: ${safeTerminalText2(name)}
Remote: ${safeGitRemote(String(profile.remote ?? "missing"))} \u2192 ${safeGitRemote(remote)}
Affected sync setups: ${affectedSetups && affectedSetups.length > 0 ? affectedSetups.map(safeTerminalText2).join(", ") : "None"}
Saving changes future storage access for every affected setup; it does not move or delete remote history.`,
    ["Save storage connection", "Cancel"],
    { signal }
  );
  throwIfAborted10(signal);
  if (choice !== "Save storage connection") return false;
  await updateStorageConnection(
    name,
    (current) => {
      if (current.type !== "git") throw new Error("Storage connection type changed; reopen it.");
      return { ...current, remote };
    },
    affectedSetups,
    signal
  );
  if (signal?.aborted) return true;
  ctx.ui.notify(`Saved storage connection \u201C${safeTerminalText2(name)}\u201D.`, "info");
  return true;
}
async function showAddGitTarget(ctx, name, profile, signal) {
  const destination = await promptGitDestination(ctx, name, signal);
  if (!destination) return false;
  const preset = await ctx.ui.select(
    "Choose included content",
    ["Recommended Pi settings", "Minimal settings", "Cancel"],
    { signal }
  );
  throwIfAborted10(signal);
  if (!preset || preset === "Cancel") return false;
  const syncFiles = preset === "Minimal settings" ? ["settings.json", "AGENTS.md"] : [...DEFAULT_SYNC_INCLUDE];
  const automatic = await ctx.ui.select(
    "Automatic sync for this setup",
    ["Enable automatic sync", "Keep automatic sync off", "Cancel"],
    { signal }
  );
  throwIfAborted10(signal);
  if (!automatic || automatic === "Cancel") return false;
  const choice = await ctx.ui.select(
    `Review Git sync setup

Sync setup: ${safeTerminalText2(name)}
Storage connection: ${safeTerminalText2(profile)}
Owned branch: ${safeTerminalText2(destination.branch)}
Storage location: ${safeTerminalText2(destination.directory)}
Included content: ${syncFiles.length} built-in groups \xB7 Sessions: Off
Automatic sync: ${automatic === "Enable automatic sync" ? "On" : "Off"}`,
    ["Add sync setup", "Cancel"],
    { signal }
  );
  throwIfAborted10(signal);
  if (choice !== "Add sync setup") return false;
  await addSyncSetup(
    name,
    {
      storage: {
        connection: profile,
        branch: destination.branch,
        path: destination.directory
      },
      sync: {
        include: syncFiles,
        automatic: automatic === "Enable automatic sync"
      }
    },
    signal
  );
  if (signal?.aborted) return true;
  ctx.ui.notify(`Added sync setup \u201C${safeTerminalText2(name)}\u201D.`, "info");
  return true;
}
async function showEditGitTarget(ctx, partial, signal) {
  const targetName = partial.setupName;
  const destination = await promptGitDestination(ctx, targetName, signal, partial);
  if (!destination) return false;
  if (destination.directory !== partial.storagePath && destination.branch === partial.branch) {
    ctx.ui.notify(
      "Changing a Git storage path requires a new Git branch so the existing branch remains readable.",
      "warning"
    );
    return false;
  }
  const choice = await ctx.ui.select(
    `Review sync setup \u201C${safeTerminalText2(targetName)}\u201D

Branch: ${safeTerminalText2(partial.branch ?? "pi-sync")} \u2192 ${safeTerminalText2(destination.branch)}
Storage path: ${safeTerminalText2(partial.storagePath)} \u2192 ${safeTerminalText2(destination.directory)}
Saving changes the future storage location only; it does not move or delete remote history.`,
    ["Save sync setup", "Cancel"],
    { signal }
  );
  throwIfAborted10(signal);
  if (choice !== "Save sync setup") return false;
  await updateSyncSetup(
    targetName,
    (setup) => {
      if (typeof setup.storage.branch !== "string") {
        throw new Error("Sync setup storage type changed; reopen it.");
      }
      return {
        ...setup,
        storage: {
          ...setup.storage,
          branch: destination.branch,
          path: destination.directory
        }
      };
    },
    { expectedStorage: partial, signal }
  );
  if (signal?.aborted) return true;
  ctx.ui.notify(`Saved sync setup \u201C${safeTerminalText2(targetName)}\u201D.`, "info");
  return true;
}
async function promptGitDestination(ctx, targetName, signal, current = {}) {
  const branchInput = await requiredInput(
    ctx,
    "Owned Git branch",
    current.branch ?? `pi-sync/${targetName}`,
    signal
  );
  if (!branchInput) return void 0;
  const pathInput = await requiredInput(
    ctx,
    "Git storage path",
    current.storagePath ?? `pi-sync/${targetName}`,
    signal
  );
  if (!pathInput) return void 0;
  try {
    const branch = normalizeGitBranch(branchInput);
    const directory = normalizeGitDirectory(pathInput);
    const namespace = directory.slice(directory.lastIndexOf("/") + 1);
    return { branch, directory, namespace };
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    return void 0;
  }
}
function throwIfAborted10(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
function safeGitRemote(remote) {
  try {
    const url = new URL(remote);
    return safeTerminalText2(`${url.protocol}//${url.host}${url.pathname}`);
  } catch {
    return safeTerminalText2(remote);
  }
}
var init_git_ui = __esm({
  "packages/pi-sync/src/git-ui.ts"() {
    "use strict";
    init_git_config();
    init_manager_helpers();
    init_settings_management();
    init_sync_policy();
  }
});

// packages/pi-sync/src/remote-selection-ui.ts
var remote_selection_ui_exports = {};
__export(remote_selection_ui_exports, {
  showRemoteSelectionReview: () => showRemoteSelectionReview
});
import { defineMenu, runMenu } from "@narumitw/pi-tui-kit";
async function showRemoteSelectionReview(ctx, setupName, signal, factory = createSyncBackend, options = {}) {
  try {
    let decision = options.decision;
    if (!decision) {
      const inspected = await inspectConfiguredRemoteSelection(ctx, setupName, signal, factory);
      if (!inspected || signal?.aborted) return { kind: "stale" };
      if (inspected.kind === "empty") {
        ctx.ui.notify("Remote storage has no snapshot or synced-content list yet.", "info");
        return { kind: "back" };
      }
      if (inspected.state.kind === "same") {
        ctx.ui.notify("Remote synced content already matches this sync setup.", "info");
        return { kind: "back" };
      }
      if (inspected.state.kind === "legacy") {
        if (ctx.mode !== "tui") {
          ctx.ui.notify(formatLegacySummary(inspected.config, inspected.state.discovered), "info");
          return { kind: "back" };
        }
        await showLegacyDiscovery(ctx, inspected.config, inspected.state.discovered, signal);
        return signal?.aborted ? { kind: "stale" } : { kind: "back" };
      }
      decision = decisionFromState(inspected.config, inspected.state);
    }
    if (ctx.mode !== "tui") {
      ctx.ui.notify(formatRemoteSelectionSummary(decision), "warning");
      return { kind: "back" };
    }
    let currentDecision = decision;
    for (; ; ) {
      if (signal?.aborted) return { kind: "stale" };
      const result = await showSelectionDifference(
        ctx,
        currentDecision,
        options.origin ?? "settings",
        options.runRoute,
        signal,
        factory,
        options
      );
      if (result.kind !== "refresh") return result;
      const refreshed = await runWithOptionalStateAccess(
        options,
        () => inspectConfiguredRemoteSelection(ctx, currentDecision.setupName, signal, factory)
      );
      if (!refreshed || signal?.aborted) return { kind: "stale" };
      if (refreshed.kind === "empty") {
        ctx.ui.notify("Remote storage no longer has a snapshot or synced-content list.", "warning");
        return { kind: "back" };
      }
      if (refreshed.state.kind !== "different") {
        ctx.ui.notify(
          refreshed.state.kind === "same" ? "Remote synced content now matches this sync setup." : "The refreshed legacy snapshot has no authoritative synced-content list.",
          "info"
        );
        options.onSelectionResolved?.();
        return { kind: "done" };
      }
      currentDecision = decisionFromState(refreshed.config, refreshed.state);
    }
  } catch (error) {
    if (signal?.aborted) return { kind: "stale" };
    ctx.ui.notify(`Could not review synced content: ${errorMessage(error)}`, "error");
    return { kind: "back" };
  } finally {
    ctx.ui.setStatus(STATUS_KEY3, void 0);
  }
}
async function showSelectionDifference(ctx, initialDecision, origin, runRoute, sessionSignal, factory, options) {
  let flowState = { decision: initialDecision, saved: false };
  let continuationReview;
  let nextResult;
  let refreshRequested = false;
  const route = origin === "settings" ? "sync" : origin;
  const menu = defineMenu({
    start: "choice",
    screens: {
      choice: ({ state }) => ({
        kind: "actions",
        title: "Synced content differs",
        lines: selectionSummaryLines(state.decision),
        items: [
          {
            id: "review",
            label: "Review all paths (recommended)",
            description: "Compare exact remote-only, device-only, and ordered lists.",
            to: "review"
          },
          {
            id: "adopt",
            label: "Use remote content list",
            description: "Save the reviewed list on this device without pulling files.",
            action: "adopt"
          },
          {
            id: "keep",
            label: "Keep this device's content list and update remote\u2026",
            description: "Open the existing exact force-push preview without skipping confirmation.",
            action: "keep"
          },
          { id: "cancel", label: options.cancelLabel ?? "Cancel", action: "cancel" }
        ],
        hint: "back"
      }),
      review: ({ state }) => ({
        kind: "review",
        title: `Review synced content \xB7 ${safeTerminalText(state.decision.setupName)}`,
        content: formatSelectionDifference(state.decision),
        format: { kind: "text" },
        viewportSize: "adaptive",
        hint: "back"
      }),
      saved: ({ state }) => ({
        kind: "actions",
        title: "Remote content list saved",
        lines: [
          `Sync setup: ${safeTerminalText(state.decision.setupName)}`,
          "Only the included-content setting was saved.",
          "No files were pulled and sync state was not changed."
        ],
        items: [
          ...runRoute ? [
            {
              id: "continue",
              label: continueLabel(origin),
              description: "Start a fresh check and exact preview for this sync setup.",
              action: "continue"
            }
          ] : [],
          { id: "done", label: "Done", action: "done" }
        ],
        hint: "close"
      })
    },
    actions: {
      adopt: async ({ state, signal: actionSignal }) => {
        const signal = combineSignals(sessionSignal, actionSignal);
        try {
          const currentConfig = await loadConfig(state.decision.setupName);
          if (signal.aborted) return { kind: "close" };
          assertLocalSelectionCurrent(currentConfig, state.decision);
          if (!currentConfig.include.includes("sessions") && state.decision.remoteInclude.includes("sessions")) {
            const acknowledged = await ctx.ui.confirm(
              "Use a content list that includes session conversations?",
              "Session JSONL may contain prompts, tool output, file paths, images, and secrets. This saves the list only; it does not pull files.",
              { signal }
            );
            if (signal.aborted) return { kind: "close" };
            if (!acknowledged) return { kind: "stay" };
          }
          const review = await runWithOptionalStateAccess(options, async () => {
            const loaded = await loadAdoptionReview(state.decision, signal, factory);
            if (signal.aborted) throw signal.reason;
            await revalidateAndAdopt(loaded, state.decision, signal);
            return loaded;
          });
          if (signal.aborted) return { kind: "close" };
          options.onSelectionResolved?.();
          continuationReview = {
            ...review.storageReview,
            setupName: state.decision.setupName,
            include: [...state.decision.remoteInclude],
            automatic: review.config.automatic,
            onSwitch: review.config.onSwitch
          };
          flowState = { decision: state.decision, saved: true };
          return { kind: "to", screen: "saved" };
        } catch (error) {
          if (signal.aborted) return { kind: "close" };
          if (isStaleReviewError(error)) {
            ctx.ui.notify(`${errorMessage(error)} Refreshing the comparison.`, "warning");
            refreshRequested = true;
            return { kind: "close" };
          }
          ctx.ui.notify(`Could not save the remote content list: ${errorMessage(error)}`, "error");
          return { kind: "stay" };
        }
      },
      keep: async ({ state, signal: actionSignal }) => {
        if (!runRoute) {
          ctx.ui.notify("The reviewed update-remote route is unavailable.", "error");
          return { kind: "stay" };
        }
        const signal = combineSignals(sessionSignal, actionSignal);
        try {
          const latest = await loadConfig(state.decision.setupName);
          if (signal.aborted) return { kind: "close" };
          assertLocalSelectionCurrent(latest, state.decision);
          const result = await runCancellableOperation(
            ctx,
            "Preparing this device's push preview\u2026",
            "push --force",
            runRoute,
            {
              commitAware: true,
              cancelledMessage: "Push preparation cancelled; no remote files were changed.",
              target: state.decision.setupName,
              signal
            }
          );
          return handleNestedRouteResult(result, "push");
        } catch (error) {
          if (signal.aborted) return { kind: "close" };
          if (isStaleReviewError(error)) {
            ctx.ui.notify(`${errorMessage(error)} Refreshing the comparison.`, "warning");
            refreshRequested = true;
            return { kind: "close" };
          }
          ctx.ui.notify(`Could not prepare the remote update: ${errorMessage(error)}`, "error");
          return { kind: "stay" };
        }
      },
      continue: async ({ state, signal: actionSignal }) => {
        if (!runRoute || !continuationReview) return { kind: "stay" };
        const signal = combineSignals(sessionSignal, actionSignal);
        try {
          const latest = await loadPartialConfig(state.decision.setupName);
          if (signal.aborted) return { kind: "close" };
          if (!sameContinuationReview(latest, continuationReview)) {
            throw new StaleRemoteSelectionReviewError(
              `Sync setup \u201C${safeTerminalText(state.decision.setupName)}\u201D changed after the remote content list was saved.`
            );
          }
          const result = await runCancellableOperation(
            ctx,
            continueBusyLabel(origin),
            route,
            runRoute,
            {
              commitAware: true,
              cancelledMessage: continuationCancelledMessage(route),
              target: state.decision.setupName,
              signal
            }
          );
          return handleNestedRouteResult(result, route);
        } catch (error) {
          if (signal.aborted) return { kind: "close" };
          ctx.ui.notify(`Could not continue: ${errorMessage(error)}`, "error");
          return { kind: "stay" };
        }
      },
      cancel: async () => ({ kind: "back" }),
      done: async () => {
        nextResult = { kind: "done" };
        return { kind: "close" };
      }
    }
  });
  function handleNestedRouteResult(result, nestedRoute) {
    if (result.kind === "completed" && result.outcome === "applied") {
      options.onSelectionResolved?.();
    }
    if (result.kind === "closed") {
      nextResult = { kind: "closed" };
      return { kind: "close" };
    }
    if (result.kind === "cancelled" || result.kind === "completed" && result.outcome === "cancelled" || result.kind === "failed") {
      return { kind: "stay" };
    }
    nextResult = { kind: "route-result", result, route: nestedRoute };
    return { kind: "close" };
  }
  const menuResult = await runMenu(ctx, menu, {
    getState: () => flowState,
    signal: sessionSignal,
    isCurrent: () => !sessionSignal?.aborted,
    onError: (_menuCtx, error) => ctx.ui.notify(errorMessage(error), "error")
  });
  if (sessionSignal?.aborted || menuResult.kind === "stale") return { kind: "stale" };
  if (refreshRequested) return { kind: "refresh" };
  if (nextResult) return nextResult;
  if (menuResult.kind === "closed") {
    return menuResult.reason === "back" ? { kind: "back" } : { kind: "closed" };
  }
  return { kind: "closed" };
}
async function loadAdoptionReview(decision, signal, factory) {
  const config = await loadConfig(decision.setupName);
  throwIfAborted11(signal);
  assertLocalSelectionCurrent(config, decision);
  const partial = await loadPartialConfig(decision.setupName);
  throwIfAborted11(signal);
  if (!sameSyncInclude(partial.include, decision.localInclude)) {
    throw new StaleRemoteSelectionReviewError(
      `Sync setup \u201C${safeTerminalText(decision.setupName)}\u201D changed while the comparison was open.`
    );
  }
  const backend = await factory(config);
  throwIfAborted11(signal);
  const reviewedHead = await backend.readHead(signal);
  throwIfAborted11(signal);
  if (!reviewedHead) {
    throw new StaleRemoteSelectionReviewError(
      "Remote storage changed while the comparison was open."
    );
  }
  const snapshot = await readSnapshotForHead(backend, reviewedHead, signal);
  throwIfAborted11(signal);
  const state = inspectRemoteSelection(config.include, snapshot);
  if (state.kind !== "different" || !sameSyncInclude(state.include, decision.remoteInclude)) {
    throw new StaleRemoteSelectionReviewError(
      "Remote synced content changed while the comparison was open."
    );
  }
  return { config, storageReview: partial, backend, reviewedHead };
}
async function revalidateAndAdopt(review, decision, signal) {
  const currentHead = await review.backend.readHead(signal);
  throwIfAborted11(signal);
  if (!currentHead || !review.backend.sameRevision(review.reviewedHead.revision, currentHead.revision)) {
    throw new StaleRemoteSelectionReviewError(
      "Remote storage changed while the comparison was open."
    );
  }
  const currentSnapshot = await readSnapshotForHead(review.backend, currentHead, signal);
  throwIfAborted11(signal);
  const currentState = inspectRemoteSelection(review.config.include, currentSnapshot);
  if (currentState.kind !== "different" || !sameSyncInclude(currentState.include, decision.remoteInclude)) {
    throw new StaleRemoteSelectionReviewError(
      "Remote synced content changed while the comparison was open."
    );
  }
  await updateSyncSetup(
    decision.setupName,
    (setup) => ({
      ...setup,
      sync: { ...setup.sync, include: [...decision.remoteInclude] }
    }),
    {
      expectedStorage: review.storageReview,
      expectedInclude: decision.localInclude,
      signal
    }
  );
}
async function inspectConfiguredRemoteSelection(ctx, setupName, signal, factory) {
  const config = await loadConfig(setupName);
  if (signal?.aborted) return void 0;
  ctx.ui.setStatus(STATUS_KEY3, `checking synced content for ${safeTerminalText(config.setupName)}`);
  const backend = await factory(config);
  if (signal?.aborted) return void 0;
  const head = await backend.readHead(signal);
  if (signal?.aborted) return void 0;
  if (!head) return { kind: "empty", config };
  const snapshot = await readSnapshotForHead(backend, head, signal);
  if (signal?.aborted) return void 0;
  return {
    kind: "selection",
    config,
    state: inspectRemoteSelection(config.include, snapshot)
  };
}
async function showLegacyDiscovery(ctx, config, discovered, signal) {
  const menu = defineMenu({
    start: "choice",
    screens: {
      choice: () => ({
        kind: "actions",
        title: `Compare synced content \xB7 ${safeTerminalText(config.setupName)}`,
        lines: [
          "This legacy snapshot has no portable synced-content list.",
          "Discovered paths are partial and read-only; preserved files may not have been selected."
        ],
        items: [
          { id: "review", label: "Review discovered paths", to: "review" },
          { id: "back", label: "Back", action: "back" }
        ],
        hint: "close"
      }),
      review: () => ({
        kind: "review",
        title: "Partial discovery from legacy snapshot",
        content: [
          "Partial discovery only \u2014 not an authoritative selection.",
          "",
          ...discovered.length > 0 ? discovered.map((item) => `Discovered: ${safeTerminalText(item)}`) : ["No safe paths were discovered."],
          "",
          "Use Add custom path\u2026 in the local Included Content editor if needed."
        ].join("\n"),
        format: { kind: "text" },
        viewportSize: "adaptive",
        hint: "back"
      })
    },
    actions: { back: async () => ({ kind: "close" }) }
  });
  await runMenu(ctx, menu, {
    getState: () => void 0,
    signal,
    isCurrent: () => !signal?.aborted
  });
}
function selectionSummaryLines(decision) {
  const comparison = compareSyncInclude(decision.localInclude, decision.remoteInclude);
  return [
    `Sync setup: ${safeTerminalText(decision.setupName)}`,
    "Nothing changed. Review both lists before choosing what happens next.",
    ...comparison.remoteOnly.length === 0 && comparison.localOnly.length === 0 ? ["Only the ordering differs; membership is the same."] : [
      `Remote-only paths: ${comparison.remoteOnly.length} \xB7 Device-only paths: ${comparison.localOnly.length}`
    ]
  ];
}
function formatSelectionDifference(decision) {
  const comparison = compareSyncInclude(decision.localInclude, decision.remoteInclude);
  return [
    ...comparison.remoteOnly.length === 0 && comparison.localOnly.length === 0 ? ["Only ordering differs; both lists contain the same paths.", ""] : [],
    "Remote-only paths:",
    ...comparison.remoteOnly.length > 0 ? comparison.remoteOnly.map((item) => `+ ${safeTerminalText(item)}`) : ["(none)"],
    "",
    "Device-only paths:",
    ...comparison.localOnly.length > 0 ? comparison.localOnly.map((item) => `- ${safeTerminalText(item)}`) : ["(none)"],
    "",
    "Remote ordered list:",
    ...decision.remoteInclude.length > 0 ? decision.remoteInclude.map((item, index) => `${index + 1}. ${safeTerminalText(item)}`) : ["(none)"],
    "",
    "This device's ordered list:",
    ...decision.localInclude.length > 0 ? decision.localInclude.map((item, index) => `${index + 1}. ${safeTerminalText(item)}`) : ["(none)"],
    "",
    "Using the remote list saves settings only and does not pull files."
  ].join("\n");
}
function formatRemoteSelectionSummary(decision) {
  const comparison = compareSyncInclude(decision.localInclude, decision.remoteInclude);
  return [
    `Synced content for \u201C${safeTerminalText(decision.setupName)}\u201D differs from this device.`,
    `Remote-only: ${safeList3(comparison.remoteOnly)}`,
    `Device-only: ${safeList3(comparison.localOnly)}`,
    ...comparison.remoteOnly.length === 0 && comparison.localOnly.length === 0 ? [
      "Only ordering differs.",
      `Remote order: ${safeList3(decision.remoteInclude)}`,
      `Device order: ${safeList3(decision.localInclude)}`
    ] : [],
    "Run /sync in TUI to choose a content list; RPC review is read-only."
  ].join("\n");
}
function formatLegacySummary(config, discovered) {
  return `Remote snapshot for \u201C${safeTerminalText(config.setupName)}\u201D has no portable synced-content list; ${discovered.length} safe path${discovered.length === 1 ? " was" : "s were"} discovered, but the result is partial and read-only.`;
}
function decisionFromState(config, state) {
  return {
    setupName: config.setupName,
    configIdentity: syncConfigReviewFingerprint(config),
    localInclude: [...config.include],
    remoteInclude: [...state.include]
  };
}
function assertLocalSelectionCurrent(config, decision) {
  if (syncConfigReviewFingerprint(config) === decision.configIdentity && sameSyncInclude(config.include, decision.localInclude)) {
    return;
  }
  throw new StaleRemoteSelectionReviewError(
    `Sync setup \u201C${safeTerminalText(config.setupName)}\u201D changed while the comparison was open.`
  );
}
function sameContinuationReview(left, right) {
  return left.setupName === right.setupName && left.connectionName === right.connectionName && left.storageKind === right.storageKind && left.storagePath === right.storagePath && left.bucket === right.bucket && left.branch === right.branch && sameSyncInclude(left.include, right.include);
}
function continueLabel(origin) {
  if (origin === "pull") return "Continue Pull now\u2026";
  if (origin === "push") return "Continue Push now\u2026";
  return "Continue Sync now\u2026";
}
function continueBusyLabel(origin) {
  if (origin === "pull") return "Checking remote changes\u2026";
  if (origin === "push") return "Preparing push preview\u2026";
  return "Checking current sync setup\u2026";
}
function continuationCancelledMessage(route) {
  if (route === "pull") return "Pull check cancelled; no local files were changed.";
  if (route === "push") return "Push preparation cancelled; no remote files were changed.";
  return "Sync check cancelled; no settings or files were changed.";
}
function safeList3(values) {
  return values.length > 0 ? values.map(safeTerminalText).join(", ") : "none";
}
function isStaleReviewError(error) {
  return error instanceof StaleRemoteSelectionReviewError || error instanceof SyncSetupReviewChangedError;
}
function runWithOptionalStateAccess(options, task) {
  return options.withStateAccess ? options.withStateAccess(task) : task();
}
function combineSignals(sessionSignal, actionSignal) {
  return sessionSignal ? AbortSignal.any([sessionSignal, actionSignal]) : actionSignal;
}
function throwIfAborted11(signal) {
  if (!signal.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
var STATUS_KEY3, StaleRemoteSelectionReviewError;
var init_remote_selection_ui = __esm({
  "packages/pi-sync/src/remote-selection-ui.ts"() {
    "use strict";
    init_backend_factory();
    init_cancellable_operation();
    init_config();
    init_remote_snapshot();
    init_settings_management();
    init_sync_format();
    init_sync_policy();
    STATUS_KEY3 = "sync";
    StaleRemoteSelectionReviewError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "StaleRemoteSelectionReviewError";
      }
    };
  }
});

// packages/pi-sync/src/sync-resolution-ui.ts
import { defineMenu as defineMenu2, runMenu as runMenu2 } from "@narumitw/pi-tui-kit";
async function showSyncResolution(ctx, initialDecision, runRoute, sessionSignal) {
  let currentDecision = initialDecision;
  let resolvedDirection;
  let chainedResult;
  const menu = defineMenu2({
    start: "resolve",
    screens: {
      resolve: ({ state }) => ({
        kind: "actions",
        title: resolutionTitle(state),
        lines: resolutionLines(state),
        items: [
          { id: "review", label: "Review differences (recommended)", to: "review" },
          ...state.directions.includes("push") ? [
            {
              id: "push",
              label: pushLabel(state),
              description: "Review an exact push before replacing the remote version.",
              action: "push"
            }
          ] : [],
          ...state.directions.includes("pull") ? [
            {
              id: "pull",
              label: pullLabel(state),
              description: "Review exact local changes and create a backup before applying.",
              action: "pull"
            }
          ] : [],
          { id: "back", label: "Back", action: "back" }
        ],
        hint: "back"
      }),
      review: ({ state }) => ({
        kind: "review",
        title: `Review differences \xB7 ${safeTerminalText(state.setupName)}`,
        content: state.review,
        format: { kind: "text" },
        viewportSize: "adaptive",
        hint: "back"
      })
    },
    actions: {
      push: ({ state, signal }) => resolveDirection("push", state, signal),
      pull: ({ state, signal }) => resolveDirection("pull", state, signal),
      back: async () => ({ kind: "back" })
    }
  });
  async function resolveDirection(direction, decision, actionSignal) {
    const signal = sessionSignal ? AbortSignal.any([sessionSignal, actionSignal]) : actionSignal;
    const config = await loadConfig(decision.setupName);
    if (signal.aborted) return { kind: "close" };
    if (syncConfigReviewIdentity(config) !== decision.configIdentity) {
      throw new Error(
        `Sync setup \u201C${safeTerminalText(decision.setupName)}\u201D changed while conflict resolution was open; return to the sync manager and retry.`
      );
    }
    const result2 = await runCancellableOperation(
      ctx,
      direction === "push" ? "Preparing local-wins push preview\u2026" : "Preparing remote-wins pull preview\u2026",
      `${direction} --force`,
      runRoute,
      {
        commitAware: true,
        cancelledMessage: direction === "push" ? "Push preparation cancelled; no remote files were changed." : "Pull check cancelled; no local files were changed.",
        target: decision.setupName,
        signal
      }
    );
    if (result2.kind === "decision-required") {
      currentDecision = result2.decision;
      return { kind: "stay" };
    }
    if (result2.kind === "remote-selection-required") {
      chainedResult = { result: result2, route: direction };
      return { kind: "close" };
    }
    if (result2.kind === "completed") {
      if (result2.outcome === "cancelled") return { kind: "stay" };
      resolvedDirection = direction;
      return { kind: "close" };
    }
    return result2.kind === "closed" ? { kind: "close" } : { kind: "stay" };
  }
  const result = await runMenu2(ctx, menu, {
    getState: () => currentDecision,
    signal: sessionSignal,
    isCurrent: () => !sessionSignal?.aborted,
    onError: (_menuCtx, error) => ctx.ui.notify(errorMessage(error), "error")
  });
  if (sessionSignal?.aborted || result.kind === "stale") return { kind: "stale" };
  if (chainedResult) return { kind: "route-result", ...chainedResult };
  if (resolvedDirection) return { kind: "resolved", direction: resolvedDirection };
  if (result.kind === "closed") {
    return result.reason === "back" ? { kind: "back" } : { kind: "closed" };
  }
  return { kind: "closed" };
}
function resolutionTitle(decision) {
  return decision.kind === "remote-empty" ? "Remote is empty" : "Resolve sync conflict";
}
function resolutionLines(decision) {
  return [
    `Sync setup: ${safeTerminalText(decision.setupName)}`,
    ...causeSummary(decision),
    "No files have been changed by this failed operation."
  ];
}
function causeSummary(decision) {
  if (decision.kind === "first-sync-settings-diverged") {
    return ["This machine and the remote have different Pi settings on first sync."];
  }
  if (decision.kind === "first-sync-sessions-diverged") {
    return ["Pi settings match, but local and remote sessions differ on first sync."];
  }
  if (decision.kind === "remote-empty") return ["The remote storage location has no snapshot."];
  return [
    ...decision.causes.localChanged ? ["Local content changed since the last sync."] : [],
    ...decision.causes.remoteChanged ? ["Remote content changed since the last sync."] : [],
    ...decision.causes.policyChanged ? ["Included content changed since the last sync."] : []
  ];
}
function pushLabel(decision) {
  if (decision.kind === "remote-empty") return "Push local content\u2026";
  if (decision.kind.startsWith("first-sync-")) return "Use local as initial source\u2026";
  return "Keep local content and replace remote\u2026";
}
function pullLabel(decision) {
  return decision.kind.startsWith("first-sync-") ? "Use remote as initial source\u2026" : "Use remote content and replace local\u2026";
}
var init_sync_resolution_ui = __esm({
  "packages/pi-sync/src/sync-resolution-ui.ts"() {
    "use strict";
    init_cancellable_operation();
    init_config();
    init_sync_format();
  }
});

// packages/pi-sync/src/manager-result-dispatcher.ts
var manager_result_dispatcher_exports = {};
__export(manager_result_dispatcher_exports, {
  dispatchManagerResult: () => dispatchManagerResult
});
async function dispatchManagerResult(ctx, initialResult, origin, runRoute, signal, options = {}) {
  let result = initialResult;
  let currentRoute = origin;
  let resolving = false;
  for (let transition = 0; transition < MAX_DECISION_TRANSITIONS; transition += 1) {
    if (signal?.aborted) return { kind: "close" };
    if (result.kind === "remote-selection-required") {
      resolving = true;
      const resolution = await showRemoteSelectionReview(
        ctx,
        result.decision.setupName,
        signal,
        void 0,
        {
          decision: result.decision,
          origin: currentRoute,
          runRoute,
          cancelLabel: options.cancelLabel,
          onSelectionResolved: options.onSelectionResolved,
          withStateAccess: options.withStateAccess
        }
      );
      if (resolution.kind === "route-result") {
        result = resolution.result;
        currentRoute = resolution.route;
        continue;
      }
      return resolution.kind === "closed" || resolution.kind === "stale" ? { kind: "close" } : { kind: "stay" };
    }
    if (result.kind === "decision-required") {
      resolving = true;
      const resolution = await showSyncResolution(ctx, result.decision, runRoute, signal);
      if (resolution.kind === "route-result") {
        result = resolution.result;
        currentRoute = resolution.route;
        continue;
      }
      if (resolution.kind === "resolved") {
        return { kind: "close", appliedRoute: resolution.direction };
      }
      return resolution.kind === "closed" || resolution.kind === "stale" ? { kind: "close" } : { kind: "stay" };
    }
    if (result.kind === "closed") return { kind: "close" };
    if (result.kind === "completed") {
      const appliedRoute = result.outcome === "applied" ? currentRoute : void 0;
      if (resolving || origin === "pull" && result.outcome === "applied") {
        return { kind: "close", ...appliedRoute ? { appliedRoute } : {} };
      }
      return { kind: "stay", ...appliedRoute ? { appliedRoute } : {} };
    }
    return { kind: "stay" };
  }
  ctx.ui.notify(
    "Sync resolution stopped after too many state changes. Start /sync again to review fresh state.",
    "warning"
  );
  return { kind: "stay" };
}
var MAX_DECISION_TRANSITIONS;
var init_manager_result_dispatcher = __esm({
  "packages/pi-sync/src/manager-result-dispatcher.ts"() {
    "use strict";
    init_remote_selection_ui();
    init_sync_resolution_ui();
    MAX_DECISION_TRANSITIONS = 32;
  }
});

// packages/pi-sync/src/manager-attention.ts
function attentionMainMenuItems(manager) {
  if (!manager.attention) return [];
  const disabled = manager.attentionReviewDisabled === true;
  return [
    {
      id: "review-attention",
      label: "Review synced content (recommended)",
      action: "review-attention",
      ...disabled ? {
        disabled: true,
        disabledReason: "Finish or recover the active operation first."
      } : {}
    }
  ];
}
function blockedSyncMenuItem(label, manager) {
  if (label !== "Sync now (recommended)" || !manager.attentionBlocksSync) return void 0;
  return {
    id: "sync",
    label,
    description: "Review first.",
    action: "sync",
    disabled: true,
    disabledReason: "Review synced content first."
  };
}
async function showManagerAttention(ctx, attention, runRoute, signal, onSelectionResolved) {
  const { showRemoteSelectionReview: showRemoteSelectionReview2 } = await Promise.resolve().then(() => (init_remote_selection_ui(), remote_selection_ui_exports));
  if (signal?.aborted) return "close";
  const review = await showRemoteSelectionReview2(
    ctx,
    attention.decision.setupName,
    signal,
    void 0,
    {
      decision: attention.decision,
      origin: attention.origin,
      runRoute,
      onSelectionResolved
    }
  );
  if (review.kind === "route-result") {
    const disposition = await dispatchManagerResult(
      ctx,
      review.result,
      review.route,
      runRoute,
      signal,
      { onSelectionResolved }
    );
    return disposition.kind;
  }
  return review.kind === "closed" || review.kind === "stale" ? "close" : "stay";
}
var init_manager_attention = __esm({
  "packages/pi-sync/src/manager-attention.ts"() {
    "use strict";
    init_manager_result_dispatcher();
  }
});

// packages/pi-sync/src/operation-availability.ts
async function inspectOperationAvailability(dependencies = DEFAULT_INSPECTION_DEPENDENCIES) {
  try {
    const metadata = await dependencies.inspectMetadata();
    const guardHeld = await dependencies.inspectGuard();
    return classifyOperationAvailability(metadata, guardHeld);
  } catch (error) {
    return { kind: "inspection-error", message: errorMessage5(error) };
  }
}
function classifyOperationAvailability(metadata, guardHeld) {
  if (metadata.status === "valid" && !isStaleLock(metadata.lock)) {
    return { kind: "live", lock: metadata.lock };
  }
  if (guardHeld) {
    return {
      kind: "busy",
      metadata: metadata.status,
      ...metadata.status === "valid" ? { lock: metadata.lock } : {}
    };
  }
  if (metadata.status === "valid") {
    return { kind: "recoverable-stale", lock: metadata.lock };
  }
  if (metadata.status === "unreadable") return { kind: "recoverable-unreadable" };
  return { kind: "free" };
}
function operationBlocksChanges(availability) {
  return availability.kind !== "free";
}
function operationCanRecover(availability) {
  return availability.kind === "recoverable-stale" || availability.kind === "recoverable-unreadable";
}
var DEFAULT_INSPECTION_DEPENDENCIES;
var init_operation_availability = __esm({
  "packages/pi-sync/src/operation-availability.ts"() {
    "use strict";
    init_lock();
    init_manager_helpers();
    DEFAULT_INSPECTION_DEPENDENCIES = {
      inspectMetadata: inspectLock,
      inspectGuard: isLockGuardHeld
    };
  }
});

// packages/pi-sync/src/manager-recovery.ts
import { runConfirmation } from "@narumitw/pi-tui-kit";
async function recoverSyncAccess(ctx, manager, runRoute, sessionSignal, actionSignal) {
  const operation = manager.operation;
  if (!operation || !operationCanRecover(operation)) {
    ctx.ui.notify(
      "Operation status changed. Refresh the manager before retrying recovery.",
      "warning"
    );
    return "stay";
  }
  const signal = sessionSignal ? AbortSignal.any([sessionSignal, actionSignal]) : actionSignal;
  if (signal.aborted) return "close";
  const unreadable = operation.kind === "recoverable-unreadable";
  const details = unreadable ? "Pi-sync cannot verify who owns the unreadable lock. Close other Pi sessions that may be syncing before continuing." : `The recorded ${safeTerminalText2(operation.lock.command)} operation (pid ${operation.lock.pid}) appears to have stopped. Close other Pi sessions that may still be syncing before continuing.`;
  const confirmation = await runConfirmation(ctx, {
    title: "Restore sync access?",
    message: [
      details,
      "",
      "This removes only the local operation lock.",
      "It does not change settings, local files, sync state, or remote data."
    ].join("\n"),
    confirmLabel: "Remove local lock and continue",
    cancelLabel: "Cancel",
    signal,
    isCurrent: () => !signal.aborted,
    onError: (_currentCtx, error) => {
      ctx.ui.notify(
        `Recovery confirmation failed: ${safeTerminalText2(errorMessage5(error))}`,
        "error"
      );
    }
  });
  if (confirmation.kind === "stale") return "close";
  if (confirmation.kind === "closed") {
    if (confirmation.reason === "close") return "close";
    if (!signal.aborted) {
      ctx.ui.notify("Recovery cancelled; the local operation lock was not changed.", "info");
    }
    return "stay";
  }
  if (confirmation.kind !== "confirmed") return "stay";
  if (signal.aborted) return "close";
  await runRoute(unreadable ? "unlock --stale" : "unlock", signal);
  if (signal.aborted) return "close";
  const latest = await inspectOperationAvailability();
  if (signal.aborted) return "close";
  return latest.kind === "free" ? "restored" : "stay";
}
var init_manager_recovery = __esm({
  "packages/pi-sync/src/manager-recovery.ts"() {
    "use strict";
    init_manager_helpers();
    init_operation_availability();
  }
});

// packages/pi-sync/src/sync-setups-ui.ts
import { defineMenu as defineMenu3, runMenu as runMenu3 } from "@narumitw/pi-tui-kit";
async function countValidSyncSetups(setups, signal) {
  let count = 0;
  for (const name of Object.keys(setups ?? {})) {
    throwIfAborted12(signal);
    let valid = false;
    try {
      await loadConfig(name);
      valid = true;
    } catch {
    }
    throwIfAborted12(signal);
    if (valid) count += 1;
  }
  return count;
}
function throwIfAborted12(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
async function showSyncSetups(ctx, actions, signal) {
  let selectedName;
  let exit = false;
  const nameById = /* @__PURE__ */ new Map();
  const menu = defineMenu3({
    start: "list",
    screens: {
      list: ({ state }) => {
        nameById.clear();
        const names = Object.keys(state.setups).sort((left, right) => left.localeCompare(right));
        return {
          kind: "actions",
          title: "Sync setups",
          items: [
            { id: "add", label: "Add sync setup", action: "add" },
            ...names.map((name, index) => {
              const id = `setup:${index}`;
              nameById.set(id, name);
              return {
                id,
                label: `${safeTerminalText2(name)}${name === state.active ? " (current)" : ""}`,
                action: "select"
              };
            })
          ],
          hint: "back"
        };
      },
      detail: ({ state }) => ({
        kind: "actions",
        title: state.selected ? `Sync setup \u201C${safeTerminalText2(state.selected.name)}\u201D` : "Sync setup",
        lines: state.selected?.detail ?? ["This sync setup no longer exists."],
        items: state.selected ? [
          ...!state.selected.name || state.selected.name === state.active || !state.selected.valid ? [] : [
            {
              id: "make-current",
              label: "Make current\u2026",
              action: "make-current"
            }
          ],
          { id: "edit", label: "Edit sync setup\u2026", action: "edit" },
          ...state.selected.removeUnavailable ? [] : [
            {
              id: "remove",
              label: "Remove sync setup\u2026",
              action: "remove"
            }
          ],
          { id: "back", label: "Back", action: "back" }
        ] : [{ id: "back", label: "Back", action: "back" }],
        hint: "back"
      })
    },
    actions: {
      add: async () => {
        try {
          await actions.add(signal);
        } catch (error) {
          if (!signal?.aborted) {
            ctx.ui.notify(
              `Sync setup was not added: ${menuErrorMessage(error)} Retry from Add sync setup.`,
              "error"
            );
          }
        }
        return { kind: "stay" };
      },
      select: async ({ itemId }) => {
        selectedName = nameById.get(itemId);
        return selectedName ? { kind: "to", screen: "detail" } : { kind: "rejected" };
      },
      "make-current": async () => {
        if (!selectedName) return { kind: "rejected" };
        try {
          exit = await actions.makeCurrent(selectedName, signal) === "exit";
          return exit ? { kind: "close" } : { kind: "stay" };
        } catch (error) {
          notifySetupChangeError(ctx, selectedName, error, signal);
          return { kind: "stay" };
        }
      },
      edit: async () => {
        if (!selectedName) return { kind: "rejected" };
        try {
          await actions.edit(selectedName, signal);
        } catch (error) {
          notifySetupChangeError(ctx, selectedName, error, signal);
        }
        return { kind: "stay" };
      },
      remove: async () => {
        if (!selectedName) return { kind: "rejected" };
        const name = selectedName;
        try {
          await actions.remove(name, signal);
          selectedName = void 0;
          return { kind: "back" };
        } catch (error) {
          notifySetupChangeError(ctx, name, error, signal);
          return { kind: "stay" };
        }
      },
      back: async () => {
        selectedName = void 0;
        return { kind: "back" };
      }
    }
  });
  await runMenu3(ctx, menu, {
    getState: async () => loadSetupMenuState(selectedName, signal),
    signal,
    isCurrent: () => !signal?.aborted
  });
  return exit ? "exit" : void 0;
}
async function loadSetupMenuState(selectedName, signal) {
  const raw = await readLocalConfigObject();
  throwIfAborted12(signal);
  const setups = ownRecord(raw?.syncSetups) ?? {};
  const active = typeof raw?.activeSyncSetup === "string" ? raw.activeSyncSetup : void 0;
  if (!selectedName || !ownRecord(setups[selectedName])) return { setups, active };
  const setupCount = Object.keys(setups).length;
  const isCurrent = selectedName === active;
  let detail;
  let valid = true;
  try {
    const config = await loadConfig(selectedName);
    throwIfAborted12(signal);
    const selection = syncIncludeSelection(config.include);
    detail = [
      `Status: ${isCurrent ? "Current" : "Not current"}`,
      `Storage connection: ${safeTerminalText2(config.connectionName)}`,
      `Endpoint: ${storageEndpoint(config)}`,
      `Storage location: ${storageLocation(config)}`,
      `Included content: ${selection.builtIns.length} built-in groups \xB7 ${selection.custom.length} extra paths`,
      `Sessions: ${selection.sessions ? "On \u2014 privacy-sensitive" : "Off"}`,
      `Automatic sync: ${config.automatic ? "On" : "Off"}`
    ];
  } catch (error) {
    valid = false;
    detail = [
      `Status: Invalid${isCurrent ? " current setup" : ""}`,
      `Reason: ${menuErrorMessage(error)}`,
      "Make current and sync are unavailable until this setup is repaired."
    ];
  }
  const removeUnavailable = isCurrent && setupCount > 1;
  if (removeUnavailable) detail.push("Remove unavailable: switch to another setup first.");
  return {
    setups,
    active,
    selected: { name: selectedName, detail, valid, removeUnavailable }
  };
}
function notifySetupChangeError(ctx, name, error, signal) {
  if (signal?.aborted) return;
  ctx.ui.notify(
    `Sync setup \u201C${safeTerminalText2(name)}\u201D was not changed: ${menuErrorMessage(error)} Reopen it and retry.`,
    "error"
  );
}
function menuErrorMessage(error) {
  return safeTerminalText2(errorMessage5(error));
}
function storageEndpoint(config) {
  switch (config.backend.type) {
    case "s3":
      return safeTerminalText2(config.backend.profile.endpoint);
    case "git":
      return safeTerminalText2(config.backend.profile.remote);
    case "webdav":
      return safeTerminalText2(config.backend.profile.url);
  }
}
function storageLocation(config) {
  switch (config.backend.type) {
    case "s3":
      return safeTerminalText2(`${config.backend.destination.bucket}/${config.storagePath}`);
    case "git":
      return safeTerminalText2(`Git \xB7 ${config.backend.destination.branch}:${config.storagePath}`);
    case "webdav":
      return safeTerminalText2(`WebDAV \xB7 ${config.storagePath}`);
  }
}
var init_sync_setups_ui = __esm({
  "packages/pi-sync/src/sync-setups-ui.ts"() {
    "use strict";
    init_config();
    init_manager_helpers();
    init_sync_policy();
  }
});

// packages/pi-sync/src/manager-state.ts
import { truncateToWidth as truncateToWidth3 } from "@earendil-works/pi-tui";
async function describeManagerState(signal, attention, inspectOperation = inspectOperationAvailability) {
  let raw;
  try {
    raw = await readLocalConfigObject();
  } catch (error) {
    return {
      title: [
        "Manage sync",
        "",
        "Settings file needs repair. Automatic sync and settings writes are paused.",
        `Error: ${safeTerminalText2(errorMessage5(error))}`,
        `File: ${safeTerminalText2(await activeLocalConfigPath())}`,
        "",
        "Repair the JSON file, then reopen /sync."
      ].join("\n"),
      actions: ["Help"]
    };
  }
  if (!raw) {
    return {
      title: ["Manage sync", "", "Not set up.", "", "What do you want to do?"].join("\n"),
      actions: ["Set up sync", "Help"]
    };
  }
  const configuredTargets = ownRecord(raw.syncSetups);
  if (raw.version === 3 && configuredTargets && Object.keys(configuredTargets).length === 0) {
    return {
      title: [
        "Manage sync",
        "",
        "No sync setups are configured.",
        "Add a sync setup using an existing storage connection.",
        "",
        "What do you want to do?"
      ].join("\n"),
      actions: ["Sync setups\u2026", "Storage connections\u2026", "Help"]
    };
  }
  try {
    const config = await loadConfig();
    const operation = await inspectOperation();
    const changesBlocked = operationBlocksChanges(operation);
    const selection = syncIncludeSelection(config.include);
    let currentAttention;
    if (attention) {
      try {
        const attentionConfig = attention.decision.setupName === config.setupName ? config : await loadConfig(attention.decision.setupName);
        if (syncAttentionMatchesConfig(attention, attentionConfig)) currentAttention = attention;
      } catch {
        currentAttention = void 0;
      }
      if (signal?.aborted) throw signal.reason;
    }
    const attentionComparison = currentAttention ? compareSyncInclude(
      currentAttention.decision.localInclude,
      currentAttention.decision.remoteInclude
    ) : void 0;
    const noSyncedContent = config.include.length === 0;
    const syncState = changesBlocked ? void 0 : await readStateForConfig(config).catch(() => void 0);
    const lastAppliedSnapshot = changesBlocked ? "Unavailable while operations are locked" : syncState?.lastAppliedSnapshot ? safeTerminalText2(syncState.lastAppliedSnapshot) : syncState ? "Never synced" : "Unavailable";
    const canSwitch = await countValidSyncSetups(configuredTargets, signal) > 1;
    const mainActions = MAIN_MENU_ACTIONS.filter(
      (action) => action !== "Switch sync setup" || canSwitch
    );
    const ordinaryTitle = [
      "Manage sync",
      "",
      `Current sync setup: ${safeTerminalText2(config.setupName)}`,
      `Storage: ${backendStorageDescription(config)}`,
      `Included: ${selection.builtIns.length} built-in group${selection.builtIns.length === 1 ? "" : "s"} \xB7 ${selection.custom.length} extra path${selection.custom.length === 1 ? "" : "s"} \xB7 Sessions ${selection.sessions ? "on" : "off"}`,
      `Automatic sync: ${config.automatic ? "On" : "Off"}`,
      `Last applied: ${lastAppliedSnapshot}`,
      ...currentAttention ? [
        currentAttention.decision.setupName === config.setupName ? "Sync status: Review needed" : `Sync status: Review needed for setup ${safeTerminalText2(currentAttention.decision.setupName)}`,
        attentionComparison?.remoteOnly.length === 0 && attentionComparison.localOnly.length === 0 ? "Only the synced-content order differs." : `Remote-only paths: ${attentionComparison?.remoteOnly.length ?? 0} \xB7 Device-only paths: ${attentionComparison?.localOnly.length ?? 0}`,
        "Nothing has been changed."
      ] : ["Remote status: Not checked"],
      ...noSyncedContent ? [
        "",
        "No included content is selected. Choose included content in Settings before syncing."
      ] : [],
      "",
      "What do you want to do?"
    ];
    return {
      title: (changesBlocked ? ["Manage sync", ...operationStatusLines(operation)] : ordinaryTitle).join("\n"),
      actions: operationActions(operation, noSyncedContent, canSwitch, mainActions),
      operation,
      ...currentAttention ? {
        attention: currentAttention,
        attentionBlocksSync: currentAttention.decision.setupName === config.setupName,
        attentionReviewDisabled: changesBlocked
      } : {}
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      title: [
        "Manage sync",
        "",
        "Settings need attention. Automatic sync is paused.",
        `Current sync setup: ${safeTerminalText2(typeof raw.activeSyncSetup === "string" ? raw.activeSyncSetup : "none")}`,
        `Error: ${safeTerminalText2(errorMessage5(error))}`,
        `File: ${safeTerminalText2(await activeLocalConfigPath())}`,
        "",
        "What do you want to do?"
      ].join("\n"),
      actions: ["Sync setups\u2026", "Storage connections\u2026", "History & recovery\u2026", "Help"]
    };
  }
}
function operationActions(operation, noSyncedContent, canSwitch, mainActions) {
  if (operationCanRecover(operation)) {
    return [
      "Restore sync access\u2026 (recommended)",
      "Status & changes",
      "History & recovery\u2026",
      "Help"
    ];
  }
  if (operation.kind !== "free") {
    return ["Refresh operation status", "Status & changes", "History & recovery\u2026", "Help"];
  }
  return noSyncedContent ? ["Settings", ...canSwitch ? ["Switch sync setup"] : [], "Status & changes", "More\u2026"] : mainActions;
}
function operationStatusLines(operation) {
  switch (operation.kind) {
    case "free":
      return [];
    case "live": {
      const command = truncateToWidth3(safeTerminalText2(operation.lock.command), 16, "\u2026");
      return [
        `Running: ${command} (pid ${operation.lock.pid}). Wait, then refresh; Settings and More return.`
      ];
    }
    case "busy":
      return [
        "Pi-sync may be starting or finishing. Wait, then refresh; Settings and More remain unavailable."
      ];
    case "recoverable-stale":
      return [
        "Sync paused: old lock remains. Close other Pi sessions then restore; Settings and More return."
      ];
    case "recoverable-unreadable":
      return [
        "Sync paused: owner unknown. Close other Pi sessions then restore; Settings and More return."
      ];
    case "inspection-error":
      return [
        "Lock check failed. Fix path access, then refresh; Settings and More remain unavailable."
      ];
  }
}
function backendStorageDescription(config) {
  const connection = safeTerminalText2(config.connectionName);
  switch (config.backend.type) {
    case "s3": {
      const type = config.backend.profile.kind === "r2" || isCloudflareR2Endpoint(config.backend.profile.endpoint) ? "Cloudflare R2" : "S3-compatible";
      return `${type} \xB7 ${connection} \xB7 ${safeTerminalText2(config.backend.destination.bucket)}`;
    }
    case "webdav":
      return `WebDAV \xB7 ${connection} \xB7 ${safeTerminalText2(config.backend.destination.path)}`;
    case "git":
      return `Git \xB7 ${connection} \xB7 ${safeTerminalText2(config.backend.destination.branch)}`;
  }
}
var MAIN_MENU_ACTIONS;
var init_manager_state = __esm({
  "packages/pi-sync/src/manager-state.ts"() {
    "use strict";
    init_config();
    init_manager_helpers();
    init_operation_availability();
    init_sync_attention();
    init_sync_policy();
    init_sync_setups_ui();
    MAIN_MENU_ACTIONS = [
      "Sync now (recommended)",
      "Switch sync setup",
      "Status & changes",
      "Settings",
      "More\u2026"
    ];
  }
});

// packages/pi-sync/src/secret-input.ts
import {
  CURSOR_MARKER,
  decodeKittyPrintable,
  Text,
  truncateToWidth as truncateToWidth4
} from "@earendil-works/pi-tui";
import { runCustomInteraction as runCustomInteraction2 } from "@narumitw/pi-tui-kit";
async function promptSecret(ctx, title, options = { required: true }) {
  if (ctx.mode !== "tui" || options.signal?.aborted) return void 0;
  const result = await runCustomInteraction2(ctx, {
    signal: options.signal,
    isCurrent: () => !options.signal?.aborted,
    create: ({ tui, theme, keybindings, complete }) => {
      const heading = new Text("", 0, 0);
      const hint = new Text("", 0, 0);
      const submitKey = keybindingText2(keybindings, "tui.input.submit", "enter");
      const cancelKey = keybindingText2(keybindings, "tui.select.cancel", "esc");
      const applyTheme = () => {
        heading.setText(theme.fg("accent", theme.bold(title)));
        hint.setText(theme.fg("dim", `${submitKey} save \u2022 ${cancelKey} cancel \u2022 Input is hidden`));
      };
      applyTheme();
      const input = new MaskedInput(keybindings);
      const component = {
        get focused() {
          return input.focused;
        },
        set focused(focused) {
          input.focused = focused;
        },
        render(width) {
          const safeWidth = Math.max(1, width);
          return [
            ...heading.render(safeWidth),
            ...input.render(safeWidth),
            ...hint.render(safeWidth)
          ].map((line) => truncateToWidth4(line, safeWidth));
        },
        invalidate() {
          applyTheme();
          heading.invalidate();
          input.invalidate();
          hint.invalidate();
        },
        handleInput(data) {
          if (keybindings.matches(data, "tui.select.cancel")) complete(void 0);
          else if (keybindings.matches(data, "tui.input.submit")) complete(input.getValue());
          else input.handleInput(data);
          tui.requestRender();
        },
        dispose() {
          input.clear();
        }
      };
      return component;
    }
  });
  if (result.kind === "error") throw result.error;
  if (result.kind !== "completed" || result.value === void 0) return void 0;
  const value = result.value;
  if (options.required !== false && value.length === 0) {
    ctx.ui.notify(`${title} is required.`, "warning");
    return void 0;
  }
  return value;
}
function keybindingText2(keybindings, binding, fallback) {
  const keys = keybindings.getKeys(binding).map(String).map((key) => {
    if (key === "return") return "enter";
    if (key === "escape") return "esc";
    return hasControlCharacter7(key) ? "" : key;
  }).filter(Boolean);
  return keys.join("/") || fallback;
}
function hasControlCharacter7(value) {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code >= 127 && code <= 159;
  });
}
var MASK, MaskedInput;
var init_secret_input = __esm({
  "packages/pi-sync/src/secret-input.ts"() {
    "use strict";
    MASK = "\u2022";
    MaskedInput = class {
      constructor(keybindings) {
        this.keybindings = keybindings;
      }
      keybindings;
      focused = false;
      value = [];
      cursor = 0;
      paste = "";
      pasting = false;
      getValue() {
        return this.value.join("");
      }
      handleInput(data) {
        if (data.includes("\x1B[200~")) {
          this.pasting = true;
          this.paste = "";
          data = data.replace("\x1B[200~", "");
        }
        if (this.pasting) {
          this.paste += data;
          const end = this.paste.indexOf("\x1B[201~");
          if (end < 0) return;
          const pasted = this.paste.slice(0, end).replace(/[\r\n]/gu, "").replace(/\t/gu, "    ");
          this.insert(pasted);
          const remaining = this.paste.slice(end + 6);
          this.paste = "";
          this.pasting = false;
          if (remaining) this.handleInput(remaining);
          return;
        }
        if (this.keybindings.matches(data, "tui.editor.deleteCharBackward")) {
          if (this.cursor > 0) this.value.splice(--this.cursor, 1);
          return;
        }
        if (this.keybindings.matches(data, "tui.editor.deleteCharForward")) {
          if (this.cursor < this.value.length) this.value.splice(this.cursor, 1);
          return;
        }
        if (this.keybindings.matches(data, "tui.editor.cursorLeft")) {
          this.cursor = Math.max(0, this.cursor - 1);
          return;
        }
        if (this.keybindings.matches(data, "tui.editor.cursorRight")) {
          this.cursor = Math.min(this.value.length, this.cursor + 1);
          return;
        }
        if (this.keybindings.matches(data, "tui.editor.cursorLineStart")) {
          this.cursor = 0;
          return;
        }
        if (this.keybindings.matches(data, "tui.editor.cursorLineEnd")) {
          this.cursor = this.value.length;
          return;
        }
        if (this.keybindings.matches(data, "tui.editor.deleteToLineStart")) {
          this.value.splice(0, this.cursor);
          this.cursor = 0;
          return;
        }
        if (this.keybindings.matches(data, "tui.editor.deleteToLineEnd")) {
          this.value.splice(this.cursor);
          return;
        }
        const printable = decodeKittyPrintable(data) ?? data;
        if (!hasControlCharacter7(printable)) this.insert(printable);
      }
      render(width) {
        const prompt = "> ";
        const available = width - prompt.length;
        if (available <= 0) return [truncateToWidth4(prompt, Math.max(1, width))];
        const contentWidth = Math.max(0, available - 1);
        let start = 0;
        if (this.value.length > contentWidth) {
          start = Math.max(
            0,
            Math.min(this.cursor - Math.floor(contentWidth / 2), this.value.length - contentWidth)
          );
        }
        const end = Math.min(this.value.length, start + contentWidth);
        const visibleCursor = Math.max(0, Math.min(this.cursor - start, end - start));
        const masks = Array.from({ length: end - start }, () => MASK);
        const before = masks.slice(0, visibleCursor).join("");
        const atCursor = visibleCursor < masks.length ? MASK : " ";
        const after = masks.slice(visibleCursor + (visibleCursor < masks.length ? 1 : 0)).join("");
        const marker = this.focused ? CURSOR_MARKER : "";
        const line = `${prompt}${before}${marker}\x1B[7m${atCursor}\x1B[27m${after}`;
        return [truncateToWidth4(line, width, "")];
      }
      invalidate() {
      }
      clear() {
        this.value.fill("");
        this.value = [];
        this.paste = "";
        this.cursor = 0;
        this.pasting = false;
      }
      insert(value) {
        const characters = Array.from(value);
        this.value.splice(this.cursor, 0, ...characters);
        this.cursor += characters.length;
      }
    };
  }
});

// packages/pi-sync/src/s3-credentials-ui.ts
async function chooseS3CredentialUpdate(ctx, profile, signal) {
  const hasStored = typeof profile.accessKeyId === "string" && typeof profile.secretAccessKey === "string";
  if (hasStored) {
    const action = await ctx.ui.select(
      "Credentials",
      ["Keep current credentials", "Change credential source", "Cancel"],
      { signal }
    );
    throwIfAborted13(signal);
    if (!action || action === "Cancel") return void 0;
    if (action === "Keep current credentials") {
      return { profileFields: {}, summary: "Unchanged (values hidden)", ready: true };
    }
  }
  const selected = await chooseS3Credentials(ctx, signal);
  return selected ? { ...selected, replace: true } : void 0;
}
function applyS3CredentialUpdate(profile, credentials) {
  const next = { ...profile };
  if (credentials.replace) {
    delete next.accessKeyId;
    delete next.secretAccessKey;
    delete next.sessionToken;
  }
  return { ...next, ...credentials.profileFields };
}
async function chooseS3Credentials(ctx, signal) {
  const choice = await ctx.ui.select(
    "Credentials\n\nCredentials are stored in the private pi-sync settings file. Secret values are masked during input and never shown afterward.",
    ["Store credentials privately", "Cancel"],
    { signal }
  );
  throwIfAborted13(signal);
  if (choice !== "Store credentials privately") return void 0;
  const accessKeyId = await requiredCredentialInput(ctx, "Access key ID", "access-key-id", signal);
  if (!accessKeyId) return void 0;
  const secretAccessKey = await promptSecret(ctx, "Secret access key", { signal });
  throwIfAborted13(signal);
  if (secretAccessKey === void 0) return void 0;
  return {
    profileFields: { accessKeyId, secretAccessKey },
    summary: "Stored privately (values hidden)",
    ready: true
  };
}
async function requiredCredentialInput(ctx, title, placeholder, signal) {
  const value = await ctx.ui.input(title, placeholder, { signal });
  throwIfAborted13(signal);
  if (value === void 0) return void 0;
  const normalized = value.trim();
  if (!normalized) {
    ctx.ui.notify(`${title} is required.`, "warning");
    return void 0;
  }
  return normalized.includes("<") || normalized.includes(">") ? void 0 : normalized;
}
function throwIfAborted13(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
var init_s3_credentials_ui = __esm({
  "packages/pi-sync/src/s3-credentials-ui.ts"() {
    "use strict";
    init_secret_input();
  }
});

// packages/pi-sync/src/settings-ui.ts
import { defineMenu as defineMenu4, runMenu as runMenu4 } from "@narumitw/pi-tui-kit";
async function showSyncSettings(ctx, runRoute, signal) {
  if (ctx.mode !== "tui") {
    ctx.ui.notify(`Edit pi-sync settings manually: ${safeTerminalText(localConfigPath())}`, "info");
    return;
  }
  const initial = await loadConfig();
  if (signal?.aborted) return;
  const setupName = initial.setupName;
  const menu = defineMenu4({
    start: "settings",
    screens: {
      settings: ({ state }) => ({
        kind: "settings",
        title: "Pi Sync Settings",
        lines: [
          `Sync setup: ${safeTerminalText(state.setupName)} \xB7 Storage connection: ${safeTerminalText(state.connectionName)}`
        ],
        items: [
          {
            id: "automatic",
            label: "Automatic sync",
            description: "Run conservative synchronization at session startup and shutdown.",
            currentValue: state.automatic ? "On" : "Off",
            values: ["On", "Off"],
            action: "automatic"
          },
          {
            id: "onSwitch",
            label: "After switching setup",
            description: "Ask before a reviewed pull, start a reviewed pull, or switch without checking remote files.",
            currentValue: setupSwitchActionLabel(state.onSwitch),
            values: SETUP_SWITCH_ACTION_OPTIONS.map(({ label }) => label),
            action: "on-switch"
          },
          {
            id: "include",
            label: "Included content",
            description: `${state.include.length} selected path${state.include.length === 1 ? "" : "s"}. Opens the reviewed content-selection draft.`,
            currentValue: "Open editor",
            action: "include"
          },
          {
            id: "remoteInclude",
            label: "Compare synced content",
            description: "Review this device and remote content lists before choosing either one.",
            currentValue: "Review",
            action: "remote-include"
          }
        ]
      })
    },
    actions: {
      automatic: async ({ value, signal: actionSignal }) => {
        const automatic = value === "On";
        const mutationSignal = signal ? AbortSignal.any([signal, actionSignal]) : actionSignal;
        try {
          const latest = await loadConfig(setupName);
          if (mutationSignal.aborted) return { kind: "rejected" };
          if (latest.automatic === automatic) return { kind: "stay" };
          await updateSyncSetup(
            setupName,
            (setup) => ({ ...setup, sync: { ...setup.sync, automatic } }),
            { signal: mutationSignal }
          );
          if (mutationSignal.aborted) return { kind: "rejected" };
          ctx.ui.notify(
            `Automatic sync ${automatic ? "enabled" : "disabled"} for \u201C${safeTerminalText(setupName)}\u201D.`,
            "info"
          );
          return { kind: "stay" };
        } catch (error) {
          if (!mutationSignal.aborted) notifySaveFailure(ctx, error);
          return { kind: "rejected" };
        }
      },
      "on-switch": async ({ value, signal: actionSignal }) => {
        const action = value ? setupSwitchActionFromLabel(value) : void 0;
        if (!action) return { kind: "rejected" };
        const mutationSignal = signal ? AbortSignal.any([signal, actionSignal]) : actionSignal;
        try {
          const latest = await loadConfig(setupName);
          if (mutationSignal.aborted) return { kind: "rejected" };
          if (latest.onSwitch === action) return { kind: "stay" };
          await saveOnSwitch(action, mutationSignal);
          if (mutationSignal.aborted) return { kind: "rejected" };
          ctx.ui.notify(`After switching setup: ${value}.`, "info");
          return { kind: "stay" };
        } catch (error) {
          if (!mutationSignal.aborted) notifySaveFailure(ctx, error);
          return { kind: "rejected" };
        }
      },
      include: async ({ signal: actionSignal }) => {
        const editorSignal = signal ? AbortSignal.any([signal, actionSignal]) : actionSignal;
        await runRoute("files", editorSignal, void 0, setupName);
        return editorSignal.aborted ? { kind: "rejected" } : { kind: "stay" };
      },
      "remote-include": async ({ signal: actionSignal }) => {
        const reviewSignal = signal ? AbortSignal.any([signal, actionSignal]) : actionSignal;
        const { showRemoteSelectionReview: showRemoteSelectionReview2 } = await Promise.resolve().then(() => (init_remote_selection_ui(), remote_selection_ui_exports));
        if (reviewSignal.aborted) return { kind: "rejected" };
        const review = await showRemoteSelectionReview2(ctx, setupName, reviewSignal, void 0, {
          origin: "settings",
          runRoute
        });
        if (reviewSignal.aborted) return { kind: "rejected" };
        if (review.kind === "route-result") {
          const disposition = await dispatchManagerResult(
            ctx,
            review.result,
            review.route,
            runRoute,
            reviewSignal
          );
          return disposition.kind === "close" ? { kind: "close" } : { kind: "stay" };
        }
        return review.kind === "closed" || review.kind === "stale" ? { kind: "close" } : { kind: "stay" };
      }
    }
  });
  await runMenu4(ctx, menu, {
    getState: () => loadConfig(setupName),
    signal,
    isCurrent: () => !signal?.aborted
  });
}
function notifySaveFailure(ctx, error) {
  ctx.ui.notify(
    `Pi Sync settings save failed: ${error instanceof Error ? error.message : String(error)}`,
    "error"
  );
}
var init_settings_ui = __esm({
  "packages/pi-sync/src/settings-ui.ts"() {
    "use strict";
    init_config();
    init_manager_result_dispatcher();
    init_settings_management();
    init_setup_switch();
    init_sync_format();
  }
});

// packages/pi-sync/src/webdav-ui.ts
async function showWebDavSetup(ctx, targetName, signal) {
  const url = await requiredInput2(
    ctx,
    "WebDAV collection URL",
    "https://cloud.example.com/remote.php/dav/files/user",
    signal
  );
  if (!url) return false;
  const username = await requiredInput2(ctx, "WebDAV username", "user", signal);
  if (!username) return false;
  const password = await awaitActive(signal, promptSecret(ctx, "WebDAV password", { signal }));
  if (password === void 0) return false;
  const location = await chooseDestination(ctx, targetName, signal);
  if (!location) return false;
  const connection = validateConnection(ctx, url, username, password);
  const destination = validateDestination(ctx, location.path);
  if (!connection || !destination) return false;
  const content = await chooseContent(ctx, signal);
  if (!content) return false;
  const automatic = await select(
    ctx,
    "Automatic sync for this setup",
    ["Enable automatic sync", "Keep automatic sync off", "Cancel"],
    signal
  );
  if (!automatic || automatic === "Cancel") return false;
  const sessions = await chooseSessions(ctx, signal);
  if (sessions === void 0) return false;
  const profileName = "webdav";
  const review = await select(
    ctx,
    [
      "Review WebDAV setup",
      "",
      `Sync setup: ${safe(targetName)}`,
      `Storage connection: ${profileName} (WebDAV)`,
      `URL: ${displayUrl(connection.url)}`,
      `Storage location: ${safe(destination.path)}`,
      "Username: stored in the private settings file (value hidden)",
      "Password: configured (value hidden)",
      `Conditional writes: /sync doctor verifies atomic If-Match and If-None-Match support before publication.`,
      `Included content: ${content.length} built-in groups \xB7 Sessions: ${sessions ? "On \u2014 privacy warning acknowledged" : "Off"}`,
      `Automatic sync: ${automatic === "Enable automatic sync" ? "On" : "Off"}`
    ].join("\n"),
    ["Save setup", "Cancel"],
    signal
  );
  if (review !== "Save setup") return false;
  throwIfAborted14(signal);
  await awaitActive(
    signal,
    saveNewV3Settings(
      {
        setupName: targetName,
        connectionName: profileName,
        connection: {
          type: "webdav",
          url: connection.url,
          credentials: { username: connection.username, password: connection.password ?? "" }
        },
        setup: {
          storage: { connection: profileName, path: destination.path },
          sync: {
            include: [...content, ...sessions ? ["sessions"] : []],
            automatic: automatic === "Enable automatic sync"
          }
        }
      },
      signal
    )
  );
  ctx.ui.notify(`Sync setup \u201C${safe(targetName)}\u201D is ready. Use Sync now when ready.`, "info");
  return true;
}
async function showAddWebDavTarget(ctx, name, profile, signal) {
  const location = await chooseDestination(ctx, name, signal);
  if (!location) return false;
  const destination = validateDestination(ctx, location.path);
  if (!destination) return false;
  const content = await chooseContent(ctx, signal);
  if (!content) return false;
  const review = await select(
    ctx,
    `Review WebDAV sync setup

Sync setup: ${safe(name)}
Storage connection: ${safe(profile)}
Storage location: ${safe(destination.path)}
Included content: ${content.length} built-in groups \xB7 Sessions: Off
Adding this setup does not sync or modify remote data.`,
    ["Add sync setup", "Cancel"],
    signal
  );
  if (review !== "Add sync setup") return false;
  throwIfAborted14(signal);
  await awaitActive(
    signal,
    addSyncSetup(
      name,
      {
        storage: { connection: profile, path: destination.path },
        sync: { include: content, automatic: true }
      },
      signal
    )
  );
  ctx.ui.notify(`Added sync setup \u201C${safe(name)}\u201D.`, "info");
  return true;
}
async function showEditWebDavTarget(ctx, partial, signal) {
  const remotePath = await requiredInput2(ctx, "WebDAV storage path", partial.storagePath, signal);
  if (!remotePath) return false;
  const destination = validateDestination(ctx, remotePath);
  if (!destination) return false;
  const review = await select(
    ctx,
    `Review sync setup \u201C${safe(partial.setupName)}\u201D

Storage path: ${safe(partial.storagePath)} \u2192 ${safe(destination.path)}
Saving changes the future storage location only; it does not move or delete remote data.`,
    ["Save sync setup", "Cancel"],
    signal
  );
  if (review !== "Save sync setup") return false;
  throwIfAborted14(signal);
  await awaitActive(
    signal,
    updateSyncSetup(
      partial.setupName,
      (setup) => ({
        ...setup,
        storage: { ...setup.storage, path: destination.path }
      }),
      { expectedStorage: partial, signal }
    )
  );
  ctx.ui.notify(`Saved sync setup \u201C${safe(partial.setupName)}\u201D.`, "info");
  return true;
}
async function showAddWebDavStorageProfile(ctx, signal) {
  const name = await requiredInput2(ctx, "Name this storage connection", "webdav", signal);
  if (!name) return false;
  const url = await requiredInput2(
    ctx,
    "WebDAV collection URL",
    "https://cloud.example.com/dav",
    signal
  );
  if (!url) return false;
  const username = await requiredInput2(ctx, "WebDAV username", "user", signal);
  if (!username) return false;
  const password = await awaitActive(signal, promptSecret(ctx, "WebDAV password", { signal }));
  if (password === void 0) return false;
  const connection = validateConnection(ctx, url, username, password);
  if (!connection) return false;
  const review = await select(
    ctx,
    `Review storage connection

Name: ${safe(name)}
Type: WebDAV
URL: ${displayUrl(connection.url)}
Username: stored privately (value hidden)
Password: configured (value hidden)
Adding a connection does not contact the server or start syncing.`,
    ["Add storage connection", "Cancel"],
    signal
  );
  if (review !== "Add storage connection") return false;
  throwIfAborted14(signal);
  await awaitActive(
    signal,
    addStorageConnection(
      name,
      {
        type: "webdav",
        url: connection.url,
        credentials: { username: connection.username, password: connection.password ?? "" }
      },
      signal
    )
  );
  ctx.ui.notify(`Added storage connection \u201C${safe(name)}\u201D.`, "info");
  return true;
}
async function showEditWebDavStorageProfile(ctx, name, profile, signal, affectedSetups) {
  const url = await requiredInput2(
    ctx,
    "WebDAV collection URL",
    String(profile.url ?? "https://cloud.example.com/dav"),
    signal
  );
  if (!url) return false;
  const username = await requiredInput2(
    ctx,
    "WebDAV username",
    String(profile.username ?? "user"),
    signal
  );
  if (!username) return false;
  let password;
  let replacePassword = false;
  if (typeof profile.password === "string" && profile.password.length > 0) {
    const passwordAction = await select(
      ctx,
      "WebDAV password",
      ["Keep current password", "Replace password", "Cancel"],
      signal
    );
    if (!passwordAction || passwordAction === "Cancel") return false;
    replacePassword = passwordAction === "Replace password";
  } else {
    replacePassword = true;
  }
  if (replacePassword) {
    password = await awaitActive(signal, promptSecret(ctx, "New WebDAV password", { signal }));
    if (password === void 0) return false;
  }
  const connection = validateConnection(ctx, url, username, password);
  if (!connection) return false;
  const review = await select(
    ctx,
    `Review storage connection

Storage connection: ${safe(name)}
URL: ${displayUrl(String(profile.url ?? "https://invalid.invalid"))} \u2192 ${displayUrl(connection.url)}
Username: stored privately (value hidden)
Password: ${replacePassword ? "will be replaced" : "unchanged"} (value hidden)
Affected sync setups: ${affectedSetups && affectedSetups.length > 0 ? affectedSetups.map(safe).join(", ") : "None"}
Saving changes future storage access for every affected setup; it does not move remote data.`,
    ["Save storage connection", "Cancel"],
    signal
  );
  if (review !== "Save storage connection") return false;
  throwIfAborted14(signal);
  await awaitActive(
    signal,
    updateStorageConnection(
      name,
      (current) => {
        if (current.type !== "webdav") {
          throw new Error("Storage connection type changed; reopen it.");
        }
        return {
          ...current,
          url: connection.url,
          credentials: {
            ...current.credentials,
            username: connection.username,
            password: replacePassword ? connection.password ?? current.credentials.password : current.credentials.password
          }
        };
      },
      affectedSetups,
      signal
    )
  );
  ctx.ui.notify(`Saved storage connection \u201C${safe(name)}\u201D.`, "info");
  return true;
}
async function chooseDestination(ctx, targetName, signal) {
  const remotePath = await requiredInput2(
    ctx,
    "WebDAV storage path",
    `pi-sync/${targetName}`,
    signal
  );
  return remotePath ? validateDestination(ctx, remotePath) : void 0;
}
async function chooseContent(ctx, signal) {
  const choice = await select(
    ctx,
    "Choose an initial sync preset",
    ["Recommended Pi settings", "Minimal settings", "Cancel"],
    signal
  );
  if (!choice || choice === "Cancel") return void 0;
  return choice === "Minimal settings" ? ["settings.json", "AGENTS.md"] : [...DEFAULT_SYNC_INCLUDE];
}
async function chooseSessions(ctx, signal) {
  const choice = await select(
    ctx,
    "Session conversations\n\nSessions can contain prompts, tool output, paths, screenshots, and secrets.",
    ["Keep sessions off (recommended)", "Include session conversations", "Cancel"],
    signal
  );
  if (!choice || choice === "Cancel") return void 0;
  if (choice !== "Include session conversations") return false;
  return confirm(
    ctx,
    "Include session conversations?",
    "I understand that session JSONL can contain prompts, tool output, paths, screenshots, and secrets.",
    signal
  );
}
async function requiredInput2(ctx, title, placeholder, signal) {
  const value = await awaitActive(signal, ctx.ui.input(title, placeholder, { signal }));
  if (value === void 0) return void 0;
  const trimmed = value.trim();
  if (!trimmed) {
    ctx.ui.notify(`${title} is required.`, "warning");
    return void 0;
  }
  return trimmed;
}
async function select(ctx, title, options, signal) {
  return awaitActive(signal, ctx.ui.select(title, options, { signal }));
}
async function confirm(ctx, title, message, signal) {
  return awaitActive(signal, ctx.ui.confirm(title, message, { signal }));
}
async function awaitActive(signal, operation) {
  const result = await operation;
  throwIfAborted14(signal);
  return result;
}
function throwIfAborted14(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
function validateConnection(ctx, url, username, password) {
  try {
    const normalizedUrl = normalizeWebDavUrl(url);
    if (!normalizedUrl) throw new Error("WebDAV URL is required.");
    validateWebDavCredentials(username, password);
    return {
      url: normalizedUrl,
      username: username.trim(),
      ...password === void 0 ? {} : { password }
    };
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    return void 0;
  }
}
function validateDestination(ctx, path12, namespace) {
  try {
    const basePath = normalizeWebDavPath(path12);
    const normalizedPath = namespace ? normalizeWebDavPath(`${basePath}/${namespace.trim()}`) : basePath;
    const resolvedNamespace = normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);
    validateWebDavNamespace(resolvedNamespace);
    return { path: normalizedPath, namespace: resolvedNamespace };
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    return void 0;
  }
}
function displayUrl(value) {
  try {
    return `${new URL(value).origin}/\u2026`;
  } catch {
    return "invalid URL (value hidden)";
  }
}
function safe(value) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, "\uFFFD");
}
var init_webdav_ui = __esm({
  "packages/pi-sync/src/webdav-ui.ts"() {
    "use strict";
    init_secret_input();
    init_settings_management();
    init_sync_policy();
    init_webdav_config();
  }
});

// packages/pi-sync/src/storage-connections-ui.ts
import { defineMenu as defineMenu5, runMenu as runMenu5 } from "@narumitw/pi-tui-kit";
async function showStorageConnections(ctx, signal) {
  let selectedName;
  const nameById = /* @__PURE__ */ new Map();
  const menu = defineMenu5({
    start: "list",
    screens: {
      list: ({ state }) => {
        nameById.clear();
        const names = Object.keys(state.profiles).sort((left, right) => left.localeCompare(right));
        return {
          kind: "actions",
          title: "Storage connections",
          lines: state.version3 ? [] : ["Create version 3 settings before managing storage connections."],
          items: state.version3 ? [
            { id: "add", label: "Add storage connection", action: "add" },
            ...names.map((name, index) => {
              const id = `connection:${index}`;
              nameById.set(id, name);
              return {
                id,
                label: safeTerminalText2(name),
                action: "select"
              };
            })
          ] : [],
          hint: "back"
        };
      },
      detail: ({ state }) => ({
        kind: "actions",
        title: state.selected ? `Storage connection \u201C${safeTerminalText2(state.selected.name)}\u201D` : "Storage connection",
        lines: state.selected?.lines ?? ["This storage connection no longer exists."],
        items: state.selected ? [
          { id: "edit", label: "Edit storage connection\u2026", action: "edit" },
          ...state.selected.usedBy.length === 0 ? [
            {
              id: "remove",
              label: "Remove storage connection\u2026",
              action: "remove"
            }
          ] : [],
          { id: "back", label: "Back", action: "back" }
        ] : [{ id: "back", label: "Back", action: "back" }],
        hint: "back"
      })
    },
    actions: {
      add: async () => {
        try {
          await showAddStorageConnection(ctx, signal);
        } catch (error) {
          if (!signal?.aborted) {
            ctx.ui.notify(
              `Storage connection was not added: ${safeTerminalText2(errorMessage5(error))} Retry from Add storage connection.`,
              "error"
            );
          }
        }
        return { kind: "stay" };
      },
      select: async ({ itemId }) => {
        selectedName = nameById.get(itemId);
        return selectedName ? { kind: "to", screen: "detail" } : { kind: "rejected" };
      },
      edit: async ({ state }) => {
        if (!state.selected || state.selected.name !== selectedName) return { kind: "rejected" };
        try {
          await editStorageConnection(
            ctx,
            state.selected.name,
            state.selected.profile,
            state.selected.usedBy,
            signal
          );
        } catch (error) {
          notifyConnectionError(ctx, state.selected.name, error, signal);
        }
        return { kind: "stay" };
      },
      remove: async ({ state }) => {
        if (!state.selected || state.selected.name !== selectedName) return { kind: "rejected" };
        const name = state.selected.name;
        const confirmed = await ctx.ui.confirm(
          "Remove storage connection?",
          `Remove local storage connection \u201C${safeTerminalText2(name)}\u201D? Remote data and history are not deleted.`,
          { signal }
        );
        if (!confirmed || signal?.aborted) return { kind: "rejected" };
        try {
          await removeStorageConnection(name, signal);
          ctx.ui.notify(`Removed storage connection \u201C${safeTerminalText2(name)}\u201D.`, "info");
          selectedName = void 0;
          return { kind: "back" };
        } catch (error) {
          notifyConnectionError(ctx, name, error, signal);
          return { kind: "stay" };
        }
      },
      back: async () => {
        selectedName = void 0;
        return { kind: "back" };
      }
    }
  });
  await runMenu5(ctx, menu, {
    getState: () => loadStorageMenuState(selectedName, signal),
    signal,
    isCurrent: () => !signal?.aborted
  });
}
async function loadStorageMenuState(selectedName, signal) {
  const raw = await readLocalConfigObject();
  if (signal?.aborted) throw signal.reason;
  const profiles = ownRecord(raw?.storageConnections) ?? {};
  const profile = selectedName ? ownRecord(profiles[selectedName]) : void 0;
  if (!selectedName || !profile) {
    return { version3: raw?.version === 3, profiles, selected: void 0 };
  }
  const usedBy = referencingSetups(raw, selectedName);
  return {
    version3: raw?.version === 3,
    profiles,
    selected: {
      name: selectedName,
      profile,
      usedBy,
      lines: [
        `Type: ${connectionType(profile)}`,
        `Endpoint: ${connectionEndpoint(profile)}`,
        `Credentials: ${credentialSource(profile)}`,
        `Used by: ${usedBy.length > 0 ? usedBy.map(safeTerminalText2).join(", ") : "No sync setups"}`,
        ...usedBy.length > 0 ? ["Remove unavailable: edit or remove the listed sync setups first."] : []
      ]
    }
  };
}
function notifyConnectionError(ctx, name, error, signal) {
  if (signal?.aborted) return;
  ctx.ui.notify(
    `Storage connection \u201C${safeTerminalText2(name)}\u201D was not changed: ${safeTerminalText2(errorMessage5(error))} Reopen it and retry.`,
    "error"
  );
}
async function editStorageConnection(ctx, name, profile, usedBy, signal) {
  if (ctx.mode !== "tui") {
    ctx.ui.notify(
      "Editing storage connections requires TUI mode for safe credential handling. Edit the private version 3 settings file instead.",
      "warning"
    );
    return;
  }
  if (profile.type === "webdav") {
    await showEditWebDavStorageProfile(
      ctx,
      name,
      { ...profile, kind: "webdav", ...ownRecord(profile.credentials) ?? {} },
      signal,
      usedBy
    );
    return;
  }
  if (profile.type === "git") {
    await showEditGitStorageProfile(ctx, name, { ...profile, kind: "git" }, signal, usedBy);
    return;
  }
  const endpoint = await requiredInput(
    ctx,
    "Endpoint",
    String(profile.endpoint ?? "https://s3.example.com"),
    signal
  );
  if (!endpoint || signal?.aborted) return;
  const region = await requiredInput(ctx, "Region", String(profile.region ?? "auto"), signal);
  if (!region || signal?.aborted) return;
  const storedCredentials = ownRecord(profile.credentials) ?? {};
  const credentials = await chooseS3CredentialUpdate(
    ctx,
    { ...profile, ...storedCredentials },
    signal
  );
  if (!credentials || signal?.aborted) return;
  const save = await ctx.ui.select(
    [
      "Review storage connection",
      "",
      `Storage connection: ${safeTerminalText2(name)}`,
      `Endpoint: ${safeTerminalText2(String(profile.endpoint ?? "missing"))} \u2192 ${safeTerminalText2(endpoint)}`,
      `Region: ${safeTerminalText2(String(profile.region ?? "auto"))} \u2192 ${safeTerminalText2(region)}`,
      `Credentials: ${safeTerminalText2(credentials.summary)}`,
      `Affected sync setups: ${usedBy.length > 0 ? usedBy.map(safeTerminalText2).join(", ") : "None"}`,
      "Saving changes future storage access for every affected setup; it does not move remote data."
    ].join("\n"),
    ["Save storage connection", "Cancel"],
    { signal }
  );
  if (save !== "Save storage connection" || signal?.aborted) return;
  await updateStorageConnection(
    name,
    (current) => {
      if (current.type !== "s3") {
        throw new Error("Storage connection type changed; reopen it.");
      }
      return {
        ...current,
        endpoint,
        region,
        credentials: applyS3CredentialUpdate(
          current.credentials,
          credentials
        )
      };
    },
    usedBy,
    signal
  );
  if (signal?.aborted) return;
  ctx.ui.notify(`Saved storage connection \u201C${safeTerminalText2(name)}\u201D.`, "info");
}
async function showAddStorageConnection(ctx, signal) {
  if (ctx.mode !== "tui") {
    ctx.ui.notify(
      "Adding storage connections requires TUI mode for safe credential handling. Edit the private version 3 settings file instead.",
      "warning"
    );
    return false;
  }
  const preset = await ctx.ui.select(
    "Storage type",
    ["Cloudflare R2", "Other S3-compatible storage", "WebDAV", "Git", "Cancel"],
    { signal }
  );
  if (signal?.aborted || !preset || preset === "Cancel") return false;
  if (preset === "WebDAV") return showAddWebDavStorageProfile(ctx, signal);
  if (preset === "Git") return showAddGitStorageProfile(ctx, signal);
  const name = await requiredInput(
    ctx,
    "Name this storage connection",
    preset === "Cloudflare R2" ? "r2" : "s3",
    signal
  );
  if (!name || signal?.aborted) return false;
  const endpoint = await requiredInput(
    ctx,
    "Endpoint",
    preset === "Cloudflare R2" ? "https://<account-id>.r2.cloudflarestorage.com" : "https://s3.example.com",
    signal
  );
  if (!endpoint || signal?.aborted) return false;
  const region = preset === "Cloudflare R2" ? "auto" : await requiredInput(ctx, "Region", "us-east-1", signal);
  if (!region || signal?.aborted) return false;
  const credentials = await chooseS3Credentials(ctx, signal);
  if (!credentials || signal?.aborted) return false;
  const save = await ctx.ui.select(
    [
      "Review storage connection",
      "",
      `Name: ${safeTerminalText2(name)}`,
      `Type: ${preset}`,
      `Endpoint: ${safeTerminalText2(endpoint)}`,
      `Region: ${safeTerminalText2(region)}`,
      `Credentials: ${safeTerminalText2(credentials.summary)}`,
      "Adding a connection does not contact remote storage or start syncing."
    ].join("\n"),
    ["Add storage connection", "Cancel"],
    { signal }
  );
  if (save !== "Add storage connection" || signal?.aborted) return false;
  await addStorageConnection(
    name,
    {
      type: "s3",
      endpoint,
      region,
      credentials: {
        accessKeyId: credentials.profileFields.accessKeyId ?? "",
        secretAccessKey: credentials.profileFields.secretAccessKey ?? ""
      }
    },
    signal
  );
  if (signal?.aborted) return true;
  ctx.ui.notify(`Added storage connection \u201C${safeTerminalText2(name)}\u201D.`, "info");
  return true;
}
function referencingSetups(raw, connection) {
  return Object.entries(ownRecord(raw?.syncSetups) ?? {}).filter(([, value]) => ownRecord(ownRecord(value)?.storage)?.connection === connection).map(([name]) => name).sort((left, right) => left.localeCompare(right));
}
function connectionType(profile) {
  if (profile.type === "git") return "Git";
  if (profile.type === "webdav") return "WebDAV";
  if (profile.type === "s3" && typeof profile.endpoint === "string" && isCloudflareR2Endpoint(profile.endpoint)) {
    return "Cloudflare R2";
  }
  return "S3-compatible";
}
function connectionEndpoint(profile) {
  const value = profile.type === "git" ? profile.remote : profile.type === "webdav" ? profile.url : profile.endpoint;
  if (typeof value !== "string" || value.length === 0) return "Missing";
  if (profile.type === "git") return safeTerminalText2(value);
  try {
    return safeTerminalText2(new URL(value).host);
  } catch {
    return "Invalid";
  }
}
function credentialSource(profile) {
  if (profile.type === "git") return "Git credential helper or SSH configuration";
  const credentials = ownRecord(profile.credentials);
  if (profile.type === "webdav") return credentials?.password ? "Settings file" : "Missing";
  if (credentials?.accessKeyId && credentials.secretAccessKey) return "Settings file";
  return "Missing";
}
var init_storage_connections_ui = __esm({
  "packages/pi-sync/src/storage-connections-ui.ts"() {
    "use strict";
    init_config();
    init_git_ui();
    init_manager_helpers();
    init_s3_credentials_ui();
    init_settings_management();
    init_webdav_ui();
  }
});

// packages/pi-sync/src/manager-ui.ts
var manager_ui_exports = {};
__export(manager_ui_exports, {
  showSetupWizard: () => showSetupWizard,
  showSyncManager: () => showSyncManager
});
import { defineMenu as defineMenu6, runMenu as runMenu6 } from "@narumitw/pi-tui-kit";
async function showSyncManager(ctx, runRoute, sessionSignal, options = {}) {
  if (!ctx.hasUI) {
    await runRoute("help");
    return;
  }
  const menu = defineMenu6({
    start: "main",
    screens: {
      main: ({ state }) => {
        const attentionItems = attentionMainMenuItems(state.manager);
        const managerItems = state.manager.actions.map(
          (label) => blockedSyncMenuItem(label, state.manager) ?? syncMainMenuItem(label)
        );
        const operationFirst = state.manager.operation !== void 0 && state.manager.operation.kind !== "free";
        return {
          kind: "actions",
          title: "Manage sync",
          lines: state.manager.title.split("\n").slice(1),
          items: operationFirst ? [...managerItems, ...attentionItems] : [...attentionItems, ...managerItems],
          hint: "close"
        };
      },
      more: () => ({
        kind: "actions",
        title: "More options",
        items: [
          { id: "pull", label: "Pull from remote\u2026", action: "pull" },
          { id: "push", label: "Push to remote\u2026", action: "push" },
          { id: "setups", label: "Sync setups\u2026", action: "setups" },
          {
            id: "connections",
            label: "Storage connections\u2026",
            action: "connections"
          },
          { id: "recovery", label: "History & recovery\u2026", to: "recovery" },
          { id: "help", label: "Help", action: "help" },
          { id: "back", label: "Back", action: "back" }
        ],
        hint: "back"
      }),
      recovery: ({ state }) => ({
        kind: "actions",
        title: "History & recovery",
        items: [
          { id: "history", label: "Browse history", action: "history" },
          { id: "doctor", label: "Check setup", action: "doctor" },
          ...state.manager.operation && operationCanRecover(state.manager.operation) ? [{ id: "unlock", label: "Recover stale operation", action: "unlock" }] : [],
          { id: "back", label: "Back", action: "back" }
        ],
        hint: "back"
      })
    },
    actions: {
      "review-attention": async () => {
        const attention = options.getAttention?.();
        if (!attention) return { kind: "stay" };
        const disposition = await showManagerAttention(
          ctx,
          attention,
          runRoute,
          sessionSignal,
          () => options.onSelectionResolved?.(attention)
        );
        return { kind: disposition };
      },
      sync: async () => {
        const pendingAttention = options.getAttention?.();
        if (pendingAttention) {
          const activeConfig = await loadConfig();
          if (sessionSignal?.aborted) return { kind: "close" };
          if (pendingAttention.decision.setupName === activeConfig.setupName) {
            ctx.ui.notify("Review synced content before starting Sync now.", "warning");
            return { kind: "stay" };
          }
        }
        const result = await runCancellableOperation(
          ctx,
          "Checking current sync setup\u2026",
          "sync",
          runRoute,
          {
            commitAware: true,
            signal: sessionSignal
          }
        );
        const disposition = await dispatchManagerResult(
          ctx,
          result,
          "sync",
          runRoute,
          sessionSignal
        );
        return disposition.kind === "close" ? { kind: "close" } : { kind: "stay" };
      },
      switch: async () => {
        const result = await showSetupSwitcher(ctx, runRoute, void 0, sessionSignal);
        return result === "pull-attempted" || result === "closed" ? { kind: "close" } : { kind: "stay" };
      },
      diff: async () => {
        const result = await runCancellableOperation(
          ctx,
          "Checking current sync setup\u2026",
          "diff",
          runRoute,
          { signal: sessionSignal }
        );
        return result.kind === "closed" ? { kind: "close" } : { kind: "stay" };
      },
      settings: async () => {
        await showSyncSettings(ctx, runRoute, sessionSignal);
        return { kind: "stay" };
      },
      pull: async () => {
        const result = await runCancellableOperation(
          ctx,
          "Checking remote changes\u2026",
          "pull",
          runRoute,
          {
            commitAware: true,
            cancelledMessage: "Pull check cancelled; no local files were changed.",
            signal: sessionSignal
          }
        );
        const disposition = await dispatchManagerResult(
          ctx,
          result,
          "pull",
          runRoute,
          sessionSignal
        );
        return disposition.kind === "close" ? { kind: "close" } : { kind: "stay" };
      },
      push: async () => {
        const result = await runCancellableOperation(
          ctx,
          "Preparing push preview\u2026",
          "push",
          runRoute,
          {
            commitAware: true,
            cancelledMessage: "Push preparation cancelled; no remote files were changed.",
            signal: sessionSignal
          }
        );
        const disposition = await dispatchManagerResult(
          ctx,
          result,
          "push",
          runRoute,
          sessionSignal
        );
        return disposition.kind === "close" ? { kind: "close" } : { kind: "stay" };
      },
      setups: async () => {
        const result = await showSyncSetupManager(ctx, runRoute, sessionSignal);
        return result === "exit" ? { kind: "close" } : { kind: "stay" };
      },
      connections: async () => {
        await showStorageConnections(ctx, sessionSignal);
        return { kind: "stay" };
      },
      history: async () => {
        await runRoute("history");
        return { kind: "stay" };
      },
      doctor: async () => {
        await runRoute("doctor");
        return { kind: "stay" };
      },
      unlock: async ({ state, signal: actionSignal }) => {
        const result = await recoverSyncAccess(
          ctx,
          state.manager,
          runRoute,
          sessionSignal,
          actionSignal
        );
        if (result === "close") return { kind: "close" };
        return result === "restored" ? { kind: "to", screen: "main" } : { kind: "stay" };
      },
      recover: async ({ state, signal: actionSignal }) => {
        const result = await recoverSyncAccess(
          ctx,
          state.manager,
          runRoute,
          sessionSignal,
          actionSignal
        );
        return { kind: result === "close" ? "close" : "stay" };
      },
      refresh: async () => ({ kind: "stay" }),
      help: async () => {
        await runRoute("help");
        return { kind: "close" };
      },
      init: async () => {
        await runRoute("init");
        return { kind: "stay" };
      },
      back: async () => ({ kind: "back" })
    }
  });
  await runMenu6(ctx, menu, {
    getState: async () => {
      const pendingAttention = options.getAttention?.();
      const manager = await describeManagerState(sessionSignal, pendingAttention);
      if (pendingAttention && options.getAttention?.() === pendingAttention && !manager.attention) {
        options.onSelectionResolved?.(pendingAttention);
      }
      return { manager };
    },
    signal: sessionSignal,
    isCurrent: () => !sessionSignal?.aborted
  });
}
function syncMainMenuItem(label) {
  if (label === "More\u2026") return { id: "more", label, to: "more" };
  if (label === "History & recovery\u2026") return { id: "recovery", label, to: "recovery" };
  const actions = /* @__PURE__ */ new Map([
    ["Sync now (recommended)", "sync"],
    ["Switch sync setup", "switch"],
    ["Status & changes", "diff"],
    ["Settings", "settings"],
    ["Restore sync access\u2026 (recommended)", "recover"],
    ["Refresh operation status", "refresh"],
    ["Sync setups\u2026", "setups"],
    ["Storage connections\u2026", "connections"],
    ["Help", "help"],
    ["Set up sync", "init"],
    ["Use existing settings", "init"]
  ]);
  return { id: actions.get(label) ?? "help", label, action: actions.get(label) ?? "help" };
}
async function showSetupWizard(ctx, signal) {
  if (ctx.mode !== "tui") {
    ctx.ui.notify(
      `Guided sync setup requires TUI mode for masked credential input. Create version 3 settings in ${safeTerminalText2(localConfigPath())}.`,
      "warning"
    );
    return false;
  }
  const preset = await ctx.ui.select(
    "Set up sync\n\nWhere will Pi settings be stored?",
    ["Cloudflare R2", "Other S3-compatible storage", "WebDAV", "Git", "Cancel"],
    { signal }
  );
  if (signal?.aborted || !preset || preset === "Cancel") return false;
  const targetName = await chooseInitialTargetName(ctx, signal);
  if (!targetName) return false;
  if (preset === "WebDAV") {
    const saved = await showWebDavSetup(ctx, targetName, signal);
    if (signal?.aborted) return false;
    if (saved) await refreshTargetCompletions();
    return saved;
  }
  if (preset === "Git") {
    const saved = await showGitSetup(ctx, targetName, signal);
    if (signal?.aborted) return false;
    if (saved) await refreshTargetCompletions();
    return saved;
  }
  const endpoint = await requiredInput(
    ctx,
    preset === "Cloudflare R2" ? "Cloudflare R2 endpoint" : "S3-compatible endpoint",
    preset === "Cloudflare R2" ? "https://<account-id>.r2.cloudflarestorage.com" : "https://s3.example.com",
    signal
  );
  if (!endpoint) return false;
  let region = "auto";
  if (preset !== "Cloudflare R2") {
    const selectedRegion = await requiredInput(ctx, "Storage region", "us-east-1", signal);
    if (!selectedRegion) return false;
    region = selectedRegion;
  }
  const location = await chooseInitialRemoteLocation(ctx, preset, targetName, signal);
  if (!location) return false;
  const { connectionName, bucket, path: storagePath } = location;
  const credentials = await chooseS3Credentials(ctx, signal);
  if (!credentials) return false;
  const contentChoice = await ctx.ui.select(
    "Choose an initial sync preset",
    ["Recommended Pi settings", "Minimal settings", "Cancel"],
    { signal }
  );
  if (signal?.aborted || !contentChoice || contentChoice === "Cancel") return false;
  const syncFiles = contentChoice === "Minimal settings" ? ["settings.json", "AGENTS.md"] : [...DEFAULT_SYNC_INCLUDE];
  const automaticChoice = await ctx.ui.select(
    "Automatic sync for this setup",
    ["Enable automatic sync", "Keep automatic sync off", "Cancel"],
    { signal }
  );
  if (signal?.aborted || !automaticChoice || automaticChoice === "Cancel") return false;
  const sessionChoice = await ctx.ui.select(
    "Session conversations\n\nSessions can contain prompts, tool output, paths, screenshots, and secrets.",
    ["Keep sessions off (recommended)", "Include session conversations", "Cancel"],
    { signal }
  );
  if (signal?.aborted || !sessionChoice || sessionChoice === "Cancel") return false;
  const syncSessions = sessionChoice === "Include session conversations";
  if (syncSessions && !await ctx.ui.confirm(
    "Include session conversations?",
    "I understand that session JSONL can contain prompts, tool output, paths, screenshots, and secrets.",
    { signal }
  )) {
    return false;
  }
  const autoSync2 = automaticChoice === "Enable automatic sync";
  const choice = await ctx.ui.select(
    [
      "Review sync setup",
      "",
      `Sync setup: ${safeTerminalText2(targetName)}`,
      `Storage connection: ${safeTerminalText2(connectionName)} (${preset})`,
      `Endpoint: ${safeTerminalText2(endpoint)}`,
      `Bucket: ${safeTerminalText2(bucket)}`,
      `Storage location: ${safeTerminalText2(storagePath)}`,
      "Bucket must already exist. pi-sync will not create it.",
      `Included content: ${syncFiles.length} built-in groups \xB7 Sessions: ${syncSessions ? "On \u2014 privacy warning acknowledged" : "Off"}`,
      `Automatic sync: ${autoSync2 ? "On" : "Off"}`,
      `Credentials: ${safeTerminalText2(credentials.summary)}`
    ].join("\n"),
    ["Save sync setup", "Cancel"],
    { signal }
  );
  if (signal?.aborted || choice !== "Save sync setup") return false;
  await saveNewV3Settings(
    {
      setupName: targetName,
      connectionName,
      connection: {
        type: "s3",
        endpoint,
        region,
        credentials: {
          accessKeyId: credentials.profileFields.accessKeyId ?? "",
          secretAccessKey: credentials.profileFields.secretAccessKey ?? ""
        }
      },
      setup: {
        storage: { connection: connectionName, bucket, path: storagePath },
        sync: {
          include: [...syncFiles, ...syncSessions ? ["sessions"] : []],
          automatic: autoSync2
        }
      }
    },
    signal
  );
  if (signal?.aborted) return false;
  await refreshTargetCompletions();
  if (signal?.aborted) return true;
  ctx.ui.notify(
    credentials.ready ? `Sync setup \u201C${safeTerminalText2(targetName)}\u201D is ready. Use Sync now when ready.` : `Saved sync setup \u201C${safeTerminalText2(targetName)}\u201D; add credentials before syncing.`,
    "info"
  );
  return true;
}
async function selectSetupForSwitch(ctx, raw, targets, active, signal) {
  let selectedName;
  const nameById = /* @__PURE__ */ new Map();
  const profiles = ownRecord(raw.storageConnections);
  const menu = defineMenu6({
    start: "setups",
    screens: {
      setups: () => ({
        kind: "actions",
        title: "Switch sync setup",
        lines: [`Current sync setup: ${safeTerminalText2(active ?? "none")}`],
        items: Object.keys(targets).sort((left, right) => left.localeCompare(right)).map((candidate, index) => {
          const target = ownRecord(targets[candidate]);
          const storage = ownRecord(target?.storage);
          const profileName = typeof storage?.connection === "string" ? storage.connection : void 0;
          const profile = profileName && profiles ? ownRecord(profiles[profileName]) : void 0;
          const location = profile ? profile.type === "git" ? `${String(storage?.branch ?? "missing branch")}:${String(storage?.path ?? "missing path")}` : profile.type === "s3" ? `${String(storage?.bucket ?? "missing bucket")}/${String(storage?.path ?? "missing path")}` : String(storage?.path ?? "missing path") : `invalid: missing connection ${profileName ?? "reference"}`;
          const id = `setup:${index}`;
          nameById.set(id, candidate);
          return {
            id,
            label: `${safeTerminalText2(candidate)}${candidate === active ? " (current)" : ""}`,
            description: `${safeTerminalText2(profileName ?? "unknown")} \xB7 ${safeTerminalText2(location)}`,
            action: "select"
          };
        }),
        hint: "close"
      })
    },
    actions: {
      select: async ({ itemId }) => {
        selectedName = nameById.get(itemId);
        return { kind: "close" };
      }
    }
  });
  await runMenu6(ctx, menu, {
    getState: () => void 0,
    signal,
    isCurrent: () => !signal?.aborted
  });
  return selectedName;
}
async function showSetupSwitcher(ctx, runRoute, selectedName, signal) {
  const raw = await readLocalConfigObject();
  if (signal?.aborted) return false;
  if (raw?.version !== 3) {
    ctx.ui.notify("Add a second sync setup before switching setups.", "info");
    return false;
  }
  const targets = ownRecord(raw.syncSetups);
  if (!targets) {
    ctx.ui.notify("No sync setups are configured.", "warning");
    return false;
  }
  const active = typeof raw.activeSyncSetup === "string" ? raw.activeSyncSetup : void 0;
  let name = selectedName;
  if (!name) {
    name = await selectSetupForSwitch(ctx, raw, targets, active, signal);
    if (!name) return false;
  }
  if (!name || !Object.hasOwn(targets, name)) {
    ctx.ui.notify(
      `Sync setup \u201C${safeTerminalText2(name ?? "unknown")}\u201D no longer exists.`,
      "warning"
    );
    return false;
  }
  if (name === active) {
    ctx.ui.notify(`Sync setup \u201C${safeTerminalText2(name)}\u201D is already current.`, "info");
    return false;
  }
  let config;
  try {
    config = await loadConfig(name);
    if (signal?.aborted) return false;
  } catch (error) {
    ctx.ui.notify(
      `Cannot use sync setup \u201C${safeTerminalText2(name)}\u201D: ${safeTerminalText2(errorMessage5(error))}`,
      "error"
    );
    return false;
  }
  const onSwitch = await loadOnSwitch();
  if (signal?.aborted) return false;
  const switchEffect = onSwitch === "ask-before-pull" ? "After switching, pi-sync will ask whether to review a pull for this setup." : onSwitch === "pull-after-switch" ? "After switching, pi-sync will check this setup and show exact changes before applying them." : "After switching, pi-sync will not pull or modify synced files.";
  const confirmed = await ctx.ui.confirm(
    "Switch sync setup?",
    [
      `From: ${safeTerminalText2(active ?? "none")}`,
      `To: ${safeTerminalText2(name)}`,
      `Storage: ${backendStorageDescription(config)}`,
      `Included content: ${config.include.length} paths`,
      `Automatic sync: ${config.automatic ? "On" : "Off"} \xB7 Sessions: ${config.include.includes("sessions") ? "On" : "Off"}`,
      "",
      switchEffect
    ].join("\n"),
    { signal }
  );
  if (signal?.aborted || !confirmed) return false;
  try {
    let pullClosed = false;
    const result = await useSyncSetup(
      ctx,
      name,
      async (selectedTarget) => {
        const pullResult = await runCancellableOperation(
          ctx,
          `Pulling sync setup \u201C${safeTerminalText2(name)}\u201D\u2026`,
          "pull",
          runRoute,
          {
            commitAware: true,
            cancelledMessage: null,
            target: selectedTarget,
            signal
          }
        );
        const disposition = await dispatchManagerResult(ctx, pullResult, "pull", runRoute, signal);
        if (pullResult.kind === "closed" || pullResult.kind.endsWith("required")) {
          pullClosed = disposition.kind === "close";
        }
        if (disposition.appliedRoute === "pull") return "applied";
        if (pullResult.kind === "completed") return pullResult.outcome;
        return pullResult.kind === "cancelled" ? "cancelled" : void 0;
      },
      onSwitch,
      signal,
      syncConfigReviewIdentity(config)
    );
    if (pullClosed) return "closed";
    return result.pullApplied ? "pull-attempted" : "switched";
  } catch (error) {
    if (signal?.aborted) return false;
    ctx.ui.notify(
      `Sync setup \u201C${safeTerminalText2(name)}\u201D was not switched: ${safeTerminalText2(errorMessage5(error))}`,
      "error"
    );
    return false;
  }
}
async function showSyncSetupManager(ctx, runRoute, signal) {
  return showSyncSetups(
    ctx,
    {
      add: async (setupSignal) => {
        await showAddTarget(ctx, setupSignal);
      },
      edit: async (name, setupSignal) => {
        await showEditTarget(ctx, name, setupSignal);
      },
      makeCurrent: async (name, setupSignal) => {
        const result = await showSetupSwitcher(ctx, runRoute, name, setupSignal);
        return result === "pull-attempted" || result === "closed" ? "exit" : void 0;
      },
      remove: async (name, setupSignal) => {
        await showRemoveTarget(ctx, name, setupSignal);
      }
    },
    signal
  );
}
async function showAddTarget(ctx, signal) {
  let raw = await readLocalConfigObject();
  if (signal?.aborted) return;
  if (!raw) return void ctx.ui.notify("Set up the first sync setup before adding another.", "info");
  if (raw.version !== 3) {
    ctx.ui.notify(
      "Version 1 and version 2 settings are unsupported and are never migrated.",
      "error"
    );
    return;
  }
  let profiles = ownRecord(raw.storageConnections) ?? {};
  const name = await requiredInput(ctx, "Name the new sync setup", "work", signal);
  if (!name) return;
  const createConnection = "Add a new storage connection\u2026";
  let profile = await ctx.ui.select(
    "Choose a storage connection",
    [...Object.keys(profiles).sort(), createConnection, "Cancel"],
    { signal }
  );
  if (!profile || profile === "Cancel") return;
  if (profile === createConnection) {
    const previousNames = new Set(Object.keys(profiles));
    if (!await showAddStorageConnection(ctx, signal)) return;
    if (signal?.aborted) return;
    raw = await readLocalConfigObject() ?? raw;
    if (signal?.aborted) return;
    profiles = ownRecord(raw.storageConnections) ?? {};
    profile = Object.keys(profiles).find((candidate) => !previousNames.has(candidate));
    if (!profile) return;
  }
  const storageKind = ownRecord(profiles[profile])?.type;
  if (storageKind === "webdav") {
    const saved = await showAddWebDavTarget(ctx, name, profile, signal);
    if (signal?.aborted) return;
    if (saved) await refreshTargetCompletions();
    return;
  }
  if (storageKind === "git") {
    const saved = await showAddGitTarget(ctx, name, profile, signal);
    if (signal?.aborted) return;
    if (saved) await refreshTargetCompletions();
    return;
  }
  const location = await chooseAdditionalRemoteLocation(ctx, raw, profile, name, signal);
  if (!location) return;
  const { bucket, path: storagePath } = location;
  const preset = await ctx.ui.select(
    "Choose included content",
    ["Recommended Pi settings", "Minimal settings", "Cancel"],
    { signal }
  );
  if (!preset || preset === "Cancel") return;
  const syncFiles = preset === "Minimal settings" ? ["settings.json", "AGENTS.md"] : [...DEFAULT_SYNC_INCLUDE];
  const overlapsExistingTarget = Object.values(ownRecord(raw.syncSetups) ?? {}).some((value) => {
    const existing = ownRecord(value);
    const sync2 = ownRecord(existing?.sync);
    const selected = syncIncludeSelection(
      Array.isArray(sync2?.include) ? sync2.include : []
    ).builtIns;
    return selected.some((item) => syncFiles.includes(item));
  });
  const choice = await ctx.ui.select(
    [
      "Review new sync setup",
      "",
      `Sync setup: ${safeTerminalText2(name)}`,
      `Storage connection: ${safeTerminalText2(profile)}`,
      `Bucket: ${safeTerminalText2(bucket)}`,
      `Storage location: ${safeTerminalText2(storagePath)}`,
      "Bucket must already exist. pi-sync will not create it.",
      `Included content: ${syncFiles.length} built-in groups \xB7 Sessions: Off`,
      ...overlapsExistingTarget ? [
        "Warning: this setup shares local content with another setup; only the current setup syncs automatically."
      ] : [],
      "Adding this setup does not sync or modify remote data."
    ].join("\n"),
    ["Add sync setup", "Cancel"],
    { signal }
  );
  if (signal?.aborted || choice !== "Add sync setup") return;
  await addSyncSetup(
    name,
    {
      storage: { connection: profile, bucket, path: storagePath },
      sync: { include: syncFiles, automatic: true }
    },
    signal
  );
  if (signal?.aborted) return;
  await refreshTargetCompletions();
  ctx.ui.notify(`Added sync setup \u201C${safeTerminalText2(name)}\u201D.`, "info");
}
async function showEditTarget(ctx, name, signal) {
  const partial = await loadPartialConfig(name);
  if (signal?.aborted) return;
  if (!partial.setupName) {
    ctx.ui.notify("Create version 3 settings before editing a named sync setup.", "info");
    return;
  }
  if (partial.storageKind === "webdav") {
    await showEditWebDavTarget(ctx, partial, signal);
    return;
  }
  if (partial.storageKind === "git") {
    await showEditGitTarget(ctx, partial, signal);
    return;
  }
  const bucket = await requiredInput(ctx, "Bucket", partial.bucket ?? "pi-sync", signal);
  if (!bucket) return;
  const storagePath = await requiredInput(ctx, "Storage path", partial.storagePath, signal);
  if (!storagePath) return;
  const normalizedPath = storagePath.replace(/^\/+|\/+$/gu, "");
  const choice = await ctx.ui.select(
    [
      `Review sync setup \u201C${safeTerminalText2(partial.setupName)}\u201D`,
      "",
      `Bucket: ${safeTerminalText2(partial.bucket ?? "missing")} \u2192 ${safeTerminalText2(bucket)}`,
      `Storage path: ${safeTerminalText2(partial.storagePath ?? "missing")} \u2192 ${safeTerminalText2(normalizedPath)}`,
      "Saving changes the future storage location only; it does not move or delete remote data."
    ].join("\n"),
    ["Save sync setup", "Cancel"],
    { signal }
  );
  if (signal?.aborted || choice !== "Save sync setup") return;
  await updateSyncSetup(
    partial.setupName,
    (setup) => {
      if (typeof setup.storage.bucket !== "string") {
        throw new Error("Sync setup storage type changed; reopen it.");
      }
      return {
        ...setup,
        storage: { ...setup.storage, bucket, path: normalizedPath }
      };
    },
    { expectedStorage: partial, signal }
  );
  if (signal?.aborted) return;
  ctx.ui.notify(`Saved sync setup \u201C${safeTerminalText2(partial.setupName)}\u201D.`, "info");
}
async function showRemoveTarget(ctx, name, signal) {
  const confirmed = await ctx.ui.confirm(
    "Remove sync setup?",
    `Remove local sync setup \u201C${safeTerminalText2(name)}\u201D? Remote data and history are not deleted.`,
    { signal }
  );
  if (signal?.aborted || !confirmed) return;
  await removeSyncSetup(name, signal);
  if (signal?.aborted) return;
  await refreshTargetCompletions();
  ctx.ui.notify(
    `Removed sync setup \u201C${safeTerminalText2(name)}\u201D; remote data was not deleted.`,
    "info"
  );
}
async function refreshTargetCompletions() {
  setSyncSetupCompletions(await configuredSyncSetupNames());
}
async function chooseInitialTargetName(ctx, signal) {
  const purpose = await ctx.ui.select(
    "What will this sync setup be used for?",
    ["Personal / Home", "Work", "Custom", "Cancel"],
    { signal }
  );
  if (!purpose || purpose === "Cancel") return void 0;
  if (purpose === "Personal / Home") return "home";
  if (purpose === "Work") return "work";
  return requiredInput(ctx, "Name this sync setup", "default", signal);
}
async function chooseInitialRemoteLocation(ctx, preset, setupName, signal) {
  const connectionName = preset === "Cloudflare R2" ? "r2" : "s3";
  const suggested = {
    connectionName,
    bucket: "pi-sync",
    path: `pi-sync/${setupName}`
  };
  if (preset === "Cloudflare R2") {
    const choice2 = await ctx.ui.select(
      [
        "Choose storage location",
        "",
        `Suggested storage connection: ${connectionName}`,
        `Suggested bucket: ${suggested.bucket}`,
        `Remote path: ${safeTerminalText2(suggested.path)}`,
        "Bucket must already exist. pi-sync will not create it."
      ].join("\n"),
      ["Use suggested location (recommended)", "Customize remote location", "Cancel"],
      { signal }
    );
    if (!choice2 || choice2 === "Cancel") return void 0;
    if (choice2 === "Use suggested location (recommended)") return suggested;
    return chooseCustomRemoteLocation(ctx, setupName, connectionName, true, signal);
  }
  const choice = await ctx.ui.select(
    [
      "Choose storage location",
      "",
      `Suggested storage connection: ${connectionName}`,
      `Suggested path: ${safeTerminalText2(suggested.path)}`,
      "S3 bucket names may need to be globally unique and the bucket must already exist."
    ].join("\n"),
    [
      "Use existing bucket with suggested path (recommended)",
      "Customize remote location",
      "Cancel"
    ],
    { signal }
  );
  if (!choice || choice === "Cancel") return void 0;
  if (choice === "Customize remote location") {
    return chooseCustomRemoteLocation(ctx, setupName, connectionName, true, signal);
  }
  const bucket = await requiredExistingBucket(ctx, "pi-sync-your-name", signal);
  return bucket ? { ...suggested, bucket } : void 0;
}
async function chooseAdditionalRemoteLocation(ctx, settings, connectionName, setupName, signal) {
  const setups = ownRecord(settings.syncSetups) ?? {};
  const currentSetup = typeof settings.activeSyncSetup === "string" ? settings.activeSyncSetup : void 0;
  const candidates = Object.entries(setups).map(([name, value]) => ({ name, storage: ownRecord(ownRecord(value)?.storage) })).filter(
    (item) => item.storage?.connection === connectionName && typeof item.storage.bucket === "string"
  );
  const source = candidates.find((item) => item.name === currentSetup) ?? candidates.sort((left, right) => left.name.localeCompare(right.name))[0];
  if (source) {
    const sourcePath = typeof source.storage.path === "string" ? source.storage.path : "pi-sync/home";
    const sourceParent = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "pi-sync";
    const suggestedPath2 = `${sourceParent}/${setupName}`;
    const sameBucketLabel = `Same bucket as \u201C${safeTerminalText2(source.name)}\u201D (recommended)`;
    const choice2 = await ctx.ui.select(
      [
        `Storage location for \u201C${safeTerminalText2(setupName)}\u201D`,
        "",
        `Recommended bucket: ${safeTerminalText2(String(source.storage.bucket))}`,
        `Remote path: ${safeTerminalText2(suggestedPath2)}`,
        "The complete path and local sync state remain separate."
      ].join("\n"),
      [sameBucketLabel, "Use a different bucket", "Customize remote location", "Cancel"],
      { signal }
    );
    if (!choice2 || choice2 === "Cancel") return void 0;
    if (choice2 === sameBucketLabel) {
      return { bucket: String(source.storage.bucket), path: suggestedPath2 };
    }
    if (choice2 === "Use a different bucket") {
      const bucket2 = await requiredExistingBucket(ctx, "pi-sync", signal);
      return bucket2 ? { bucket: bucket2, path: `pi-sync/${setupName}` } : void 0;
    }
    const custom = await chooseCustomRemoteLocation(ctx, setupName, connectionName, false, signal);
    return custom ? { bucket: custom.bucket, path: custom.path } : void 0;
  }
  const connectionSettings = ownRecord(ownRecord(settings.storageConnections)?.[connectionName]);
  const isR2 = isCloudflareR2Endpoint(String(connectionSettings?.endpoint ?? ""));
  const suggestedPath = `pi-sync/${setupName}`;
  const suggestedLabel = isR2 ? "Use suggested location (recommended)" : "Use existing bucket with suggested path (recommended)";
  const choice = await ctx.ui.select(
    `Storage location for \u201C${safeTerminalText2(setupName)}\u201D

Suggested path: ${safeTerminalText2(suggestedPath)}`,
    [suggestedLabel, "Customize remote location", "Cancel"],
    { signal }
  );
  if (!choice || choice === "Cancel") return void 0;
  if (choice === "Customize remote location") {
    const custom = await chooseCustomRemoteLocation(ctx, setupName, connectionName, false, signal);
    return custom ? { bucket: custom.bucket, path: custom.path } : void 0;
  }
  if (isR2) return { bucket: "pi-sync", path: suggestedPath };
  const bucket = await requiredExistingBucket(ctx, "pi-sync-your-name", signal);
  return bucket ? { bucket, path: suggestedPath } : void 0;
}
async function chooseCustomRemoteLocation(ctx, setupName, initialConnectionName, customizeConnectionName, signal) {
  const connectionName = customizeConnectionName ? await requiredInput(ctx, "Storage connection name", initialConnectionName, signal) : initialConnectionName;
  if (!connectionName) return void 0;
  const bucket = await requiredExistingBucket(ctx, "pi-sync", signal);
  if (!bucket) return void 0;
  const storagePath = await requiredInput(ctx, "Storage path", `pi-sync/${setupName}`, signal);
  if (!storagePath) return void 0;
  return { connectionName, bucket, path: storagePath.replace(/^\/+|\/+$/gu, "") };
}
var init_manager_ui = __esm({
  "packages/pi-sync/src/manager-ui.ts"() {
    "use strict";
    init_cancellable_operation();
    init_command();
    init_config();
    init_git_ui();
    init_manager_attention();
    init_manager_helpers();
    init_manager_recovery();
    init_manager_result_dispatcher();
    init_manager_state();
    init_operation_availability();
    init_s3_credentials_ui();
    init_settings_management();
    init_settings_ui();
    init_setup_switch();
    init_storage_connections_ui();
    init_sync_policy();
    init_sync_setups_ui();
    init_webdav_ui();
  }
});

// packages/pi-sync/src/file-selection.ts
var file_selection_exports = {};
__export(file_selection_exports, {
  showFileSelection: () => showFileSelection
});
import fs10 from "node:fs/promises";
import { defineMenu as defineMenu7, runMenu as runMenu7 } from "@narumitw/pi-tui-kit";
async function showFileSelection(ctx, setupName, signal) {
  const config = await loadConfig(setupName);
  if (signal?.aborted) return;
  const selection = syncIncludeSelection(config.include);
  const original = {
    builtIns: new Set(selection.builtIns),
    custom: new Set(selection.custom),
    sessions: selection.sessions
  };
  const draft = cloneDraft(original);
  const customCandidates = await listCustomCandidates(draft.custom);
  if (ctx.mode !== "tui") {
    ctx.ui.notify(
      [
        `pi-sync included content for sync setup ${safeTerminalText3(config.setupName)}:`,
        `include: ${config.include.map(safeTerminalText3).join(", ") || "none"}`,
        `Edit sync.include in ${safeTerminalText3(localConfigPath())}.`
      ].join("\n"),
      "info"
    );
    return;
  }
  while (!signal?.aborted) {
    await showDraftEditor(ctx, config.setupName, draft, customCandidates, signal);
    if (signal?.aborted || sameDraft(original, draft)) return;
    const choice = await showDraftReview(ctx, original, draft, signal);
    if (signal?.aborted) return;
    if (choice === "Continue editing") continue;
    if (choice !== "Save changes") {
      ctx.ui.notify("Included-content changes discarded.", "info");
      return;
    }
    try {
      if (!original.sessions && draft.sessions) {
        const acknowledged = await ctx.ui.confirm(
          "Include session conversations?",
          "Session JSONL may contain prompts, tool output, file paths, images, and secrets. Continue only with storage you trust.",
          { signal }
        );
        if (signal?.aborted) return;
        if (!acknowledged) {
          ctx.ui.notify("Session inclusion was not saved.", "info");
          return;
        }
      }
      const include = [
        ...BUILT_IN_SYNC_ROOTS.filter((candidate) => draft.builtIns.has(candidate)),
        ...draft.custom,
        ...draft.sessions ? ["sessions"] : []
      ];
      if (signal?.aborted) return;
      await updateSyncSetup(
        config.setupName,
        (setup) => ({
          ...setup,
          sync: { ...setup.sync, include }
        }),
        { expectedInclude: config.include, signal }
      );
      if (signal?.aborted) return;
      ctx.ui.notify(
        `Saved included content for sync setup \u201C${safeTerminalText3(config.setupName)}\u201D. It applies to the next manual or automatic sync.`,
        "info"
      );
    } catch (error) {
      if (signal?.aborted) return;
      ctx.ui.notify(
        `Could not save pi-sync file selection: ${safeTerminalText3(error instanceof Error ? error.message : String(error))}`,
        "error"
      );
    }
    return;
  }
}
async function showDraftEditor(ctx, setupName, draft, customCandidates, signal) {
  const menu = defineMenu7({
    start: "editor",
    screens: {
      editor: () => ({
        kind: "multiSelect",
        title: `Included Content \xB7 ${safeTerminalText3(setupName)}`,
        lines: ["Draft only \xB7 leaving this screen opens Save, Discard, or Continue editing."],
        viewportSize: 12,
        items: [
          ...BUILT_IN_SYNC_ROOTS.map((relativePath) => ({
            id: `${BUILT_IN_PREFIX}${relativePath}`,
            label: relativePath,
            description: relativePath.includes(".") ? `Sync the top-level ${relativePath} file when present.` : `Recursively sync every safe file under ${relativePath}/.`,
            selected: draft.builtIns.has(relativePath)
          })),
          ...customCandidates.map((relativePath) => ({
            id: `${CUSTOM_PREFIX}${relativePath}`,
            label: safeTerminalText3(relativePath),
            description: "Additional safe agent-relative file or directory.",
            selected: draft.custom.has(relativePath)
          })),
          {
            id: SESSIONS_ID,
            label: "sessions",
            description: "Session JSONL may contain prompts, tool output, paths, images, and secrets. Sync only to storage you trust.",
            selected: draft.sessions
          }
        ],
        action: "toggle",
        actions: [
          {
            id: ADD_CUSTOM_ID,
            label: "Add custom path\u2026",
            description: "Include an agent-relative file or directory even when it exists only remotely.",
            action: "addCustom"
          }
        ],
        hint: "close",
        doneLabel: "Review changes"
      })
    },
    actions: {
      toggle: async ({ itemId, selected }) => {
        updateDraft(draft, itemId, selected === true);
        return { kind: "stay" };
      },
      addCustom: async ({ ctx: actionCtx, signal: actionSignal }) => {
        const entered = await actionCtx.ui.input(
          "Add included content",
          "Agent-relative path, for example custom.toml or snippets",
          { signal: actionSignal }
        );
        if (actionSignal.aborted) return { kind: "stay" };
        const requested = entered?.trim();
        if (!requested) return { kind: "stay" };
        const existing = customCandidates.find(
          (candidate) => candidate.toLowerCase() === requested.toLowerCase()
        );
        const relativePath = existing ?? requested;
        if (draft.custom.has(relativePath)) return { kind: "stay" };
        try {
          if (!isSafeCustomIncludePath(relativePath)) {
            throw new Error("Enter a safe agent-relative file or directory path.");
          }
          normalizeSyncInclude([
            ...draft.builtIns,
            ...draft.custom,
            ...draft.sessions ? ["sessions"] : [],
            relativePath
          ]);
        } catch (error) {
          if (actionSignal.aborted) return { kind: "stay" };
          actionCtx.ui.notify(
            `Could not add included content: ${safeTerminalText3(error instanceof Error ? error.message : String(error))}`,
            "error"
          );
          return { kind: "stay" };
        }
        if (!existing) {
          customCandidates.push(relativePath);
          customCandidates.sort((left, right) => left.localeCompare(right));
        }
        draft.custom.add(relativePath);
        return { kind: "stay" };
      }
    }
  });
  await runMenu7(ctx, menu, {
    getState: () => void 0,
    signal,
    isCurrent: () => !signal?.aborted
  });
}
async function showDraftReview(ctx, original, draft, signal) {
  let choice;
  const menu = defineMenu7({
    start: "review",
    screens: {
      review: () => ({
        kind: "actions",
        title: "Review included-content changes",
        lines: formatDraftPreview(original, draft).split("\n").slice(2),
        items: [
          { id: "save", label: "Save changes", action: "choose" },
          { id: "discard", label: "Discard changes", action: "choose" },
          { id: "continue", label: "Continue editing", action: "choose" }
        ],
        hint: "close"
      })
    },
    actions: {
      choose: async ({ itemId }) => {
        choice = itemId === "save" ? "Save changes" : itemId === "continue" ? "Continue editing" : "Discard changes";
        return { kind: "close" };
      }
    }
  });
  await runMenu7(ctx, menu, {
    getState: () => void 0,
    signal,
    isCurrent: () => !signal?.aborted
  });
  return choice;
}
function updateDraft(draft, id, included) {
  if (id.startsWith(BUILT_IN_PREFIX))
    return updateSet(draft.builtIns, id.slice(BUILT_IN_PREFIX.length), included);
  if (id.startsWith(CUSTOM_PREFIX))
    return updateSet(draft.custom, id.slice(CUSTOM_PREFIX.length), included);
  if (id === SESSIONS_ID) {
    draft.sessions = included;
    return;
  }
  throw new Error(`Unknown file selection: ${id}`);
}
function updateSet(set, value, included) {
  if (included) set.add(value);
  else set.delete(value);
}
function formatDraftPreview(original, draft) {
  const lines = ["Review included-content changes", ""];
  for (const item of /* @__PURE__ */ new Set([
    ...original.builtIns,
    ...draft.builtIns,
    ...original.custom,
    ...draft.custom
  ])) {
    const before = original.builtIns.has(item) || original.custom.has(item);
    const after = draft.builtIns.has(item) || draft.custom.has(item);
    if (before !== after) lines.push(`${after ? "Include" : "Exclude"}: ${safeTerminalText3(item)}`);
  }
  if (original.sessions !== draft.sessions)
    lines.push(`${draft.sessions ? "Include" : "Exclude"}: sessions`);
  lines.push("", "Saving does not start a network sync.");
  return lines.join("\n");
}
async function listCustomCandidates(configured) {
  const candidates = new Map([...configured].map((item) => [item.toLowerCase(), item]));
  try {
    for (const entry of await fs10.readdir(agentDir(), { withFileTypes: true })) {
      if (!entry.isFile() && !entry.isDirectory() || !isSafeCustomIncludePath(entry.name))
        continue;
      if (!candidates.has(entry.name.toLowerCase()))
        candidates.set(entry.name.toLowerCase(), entry.name);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return [...candidates.values()].sort((left, right) => left.localeCompare(right));
}
function cloneDraft(value) {
  return {
    builtIns: new Set(value.builtIns),
    custom: new Set(value.custom),
    sessions: value.sessions
  };
}
function sameDraft(left, right) {
  return left.sessions === right.sessions && sameSet(left.builtIns, right.builtIns) && sameSet(left.custom, right.custom);
}
function sameSet(left, right) {
  return left.size === right.size && [...left].every((item) => right.has(item));
}
function safeTerminalText3(value) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, "?");
}
var BUILT_IN_PREFIX, CUSTOM_PREFIX, SESSIONS_ID, ADD_CUSTOM_ID;
var init_file_selection = __esm({
  "packages/pi-sync/src/file-selection.ts"() {
    "use strict";
    init_config();
    init_settings_management();
    init_sync_policy();
    BUILT_IN_PREFIX = "builtin:";
    CUSTOM_PREFIX = "custom:";
    SESSIONS_ID = "sessions";
    ADD_CUSTOM_ID = "add-custom";
  }
});

// packages/pi-sync/src/sync-extension.ts
init_command();
init_config();
init_lock();
init_snapshot_transaction();
init_state_directory();
init_sync_attention();
init_sync_errors();
init_sync_policy();
var STATUS_KEY4 = "sync";
var AUTO_SYNC_OPTIONS = {
  yes: true,
  force: false,
  stale: false,
  silent: true,
  reload: false,
  auto: true,
  args: []
};
function sync(pi, dependencies = {}) {
  const loaders = {
    setupSwitch: cachedModuleLoader(
      dependencies.loadSetupSwitch ?? (() => Promise.resolve().then(() => (init_setup_switch(), setup_switch_exports)))
    ),
    snapshot: cachedModuleLoader(dependencies.loadSnapshot ?? (() => Promise.resolve().then(() => (init_snapshot(), snapshot_exports)))),
    syncState: cachedModuleLoader(dependencies.loadSyncState ?? (() => Promise.resolve().then(() => (init_sync_state(), sync_state_exports)))),
    operations: cachedModuleLoader(
      dependencies.loadSyncOperations ?? (() => Promise.resolve().then(() => (init_sync_operations(), sync_operations_exports)))
    )
  };
  const attention = createSyncAttentionController();
  let sessionAbort = new AbortController();
  let shutdownAbort;
  pi.registerCommand("sync", {
    description: "Sync Pi settings through Git, WebDAV, R2, or S3-compatible storage",
    getArgumentCompletions: completeSyncArguments,
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        throw new Error(
          "/sync requires TUI or RPC mode so results and safety prompts are observable."
        );
      }
      const run = () => handleCommand(args, ctx, sessionAbort.signal, loaders, attention);
      if (splitArgs(args)[0] === "migrate-state") await run();
      else await withStateDirectoryAccess(run);
    }
  });
  pi.on("session_start", async (_event, ctx) => {
    shutdownAbort?.abort(new DOMException("Session replaced", "AbortError"));
    shutdownAbort = void 0;
    sessionAbort.abort(new DOMException("Session replaced", "AbortError"));
    sessionAbort = new AbortController();
    const signal = sessionAbort.signal;
    attention.reset(ctx);
    let decision;
    try {
      decision = await withStateDirectoryAccess(() => startSession(ctx, signal, loaders));
    } catch (error) {
      if (signal.aborted) return;
      ctx.ui.notify(`pi-sync state access failed: ${errorMessage(error)}`, "error");
      return;
    }
    if (!decision || signal.aborted) return;
    attention.set(decision, "sync");
    if (ctx.mode !== "tui") {
      ctx.ui.notify(
        `pi-sync auto sync skipped: ${formatRemoteSelectionMismatch(
          decision.setupName,
          decision.localInclude,
          decision.remoteInclude
        )}
RPC review is read-only.`,
        "warning"
      );
    } else if (attention.markOffered()) {
      await resolveSelectionAttention(ctx, attention, signal, loaders, {
        cancelLabel: "Later",
        withStateAccess: withStateDirectoryAccess
      });
    }
    if (!signal.aborted) attention.publish(ctx);
  });
  pi.on("session_shutdown", async (event, ctx) => {
    sessionAbort.abort(new DOMException("Session shut down", "AbortError"));
    attention.reset(ctx);
    shutdownAbort?.abort(new DOMException("Session shut down again", "AbortError"));
    const controller = new AbortController();
    shutdownAbort = controller;
    const signal = combineSignals2(controller.signal, AbortSignal.timeout(3e4));
    const reason = typeof event === "object" && event ? event.reason : void 0;
    try {
      if (reason !== "reload") {
        await withStateDirectoryAccess(async () => {
          if (signal.aborted) return;
          await autoPushSessions(ctx, signal, loaders);
        });
      }
    } catch (error) {
      if (!signal.aborted) {
        ctx.ui.notify(`pi-sync session push skipped: ${errorMessage(error)}`, "warning");
      }
    } finally {
      if (shutdownAbort === controller) shutdownAbort = void 0;
    }
    if (signal.aborted) return;
    ctx.ui.setStatus(STATUS_KEY4, void 0);
  });
}
async function startSession(ctx, signal, loaders) {
  if (signal.aborted) return;
  try {
    const migrationNotice2 = stateDirectoryMigrationNotice();
    if (migrationNotice2) ctx.ui.notify(migrationNotice2, "warning");
  } catch (error) {
    ctx.ui.notify(`pi-sync state directory requires attention: ${errorMessage(error)}`, "error");
    return;
  }
  try {
    await recoverSnapshotTransactionsOnStartup();
    if (signal.aborted) return;
  } catch (error) {
    if (signal.aborted) return;
    ctx.ui.notify(`pi-sync recovery required: ${errorMessage(error)}`, "error");
    return;
  }
  try {
    setSyncSetupCompletions(await configuredSyncSetupNames());
    if (signal.aborted) return;
  } catch {
    if (signal.aborted) return;
    setSyncSetupCompletions([]);
  }
  const migrationNotice = consumeLocalConfigMigrationNotice();
  if (migrationNotice) ctx.ui.notify(migrationNotice, "warning");
  if (signal.aborted) return;
  return autoSync(ctx, signal, loaders);
}
async function handleCommand(rawArgs, ctx, sessionSignal, loaders, attention) {
  if (!rawArgs.trim()) {
    try {
      const { showSyncManager: showSyncManager2 } = await Promise.resolve().then(() => (init_manager_ui(), manager_ui_exports));
      if (sessionSignal.aborted) return;
      await showSyncManager2(
        ctx,
        (route, signal, onCommit, target) => executeCommand(
          route,
          ctx,
          combineSignals2(sessionSignal, signal),
          loaders,
          onCommit,
          target
        ),
        sessionSignal,
        {
          getAttention: () => attention.current(),
          onSelectionResolved: (expected) => {
            if (attention.current() === expected) attention.clear(ctx);
          }
        }
      );
    } catch (error) {
      if (sessionSignal.aborted) return;
      ctx.ui.setStatus(STATUS_KEY4, void 0);
      ctx.ui.notify(errorMessage(error), "error");
    }
    if (!sessionSignal.aborted) attention.publish(ctx);
    return;
  }
  const result = await executeCommand(rawArgs, ctx, sessionSignal, loaders);
  if (result.kind === "decision-required") {
    ctx.ui.notify(result.decision.directMessage, "error");
  } else if (result.kind === "remote-selection-required") {
    const origin = directSelectionOrigin(rawArgs);
    if (origin) attention.set(result.decision, origin);
    const deterministic = splitArgs(rawArgs).some((arg) => arg === "--yes" || arg === "-y");
    if (origin && ctx.mode === "tui" && !deterministic) {
      await resolveSelectionAttention(ctx, attention, sessionSignal, loaders);
    } else {
      ctx.ui.notify(
        formatRemoteSelectionMismatch(
          result.decision.setupName,
          result.decision.localInclude,
          result.decision.remoteInclude
        ),
        "error"
      );
    }
  }
  await clearAttentionAfterCompletedOperation(rawArgs, result, ctx, attention, sessionSignal);
  await reconcileSelectionAttention(ctx, attention, sessionSignal);
  if (!sessionSignal.aborted) attention.publish(ctx);
}
async function clearAttentionAfterCompletedOperation(rawArgs, result, ctx, attention, signal) {
  if (result.kind !== "completed" || result.outcome === "cancelled" || signal.aborted) return;
  const [command, ...rest] = splitArgs(rawArgs);
  if (command !== "sync" && command !== "pull" && command !== "push") return;
  const current = attention.current();
  if (!current) return;
  try {
    const options = parseOptions(rest);
    const setupName = options.setup ?? (await loadConfig()).setupName;
    if (signal.aborted || attention.current() !== current) return;
    if (current.decision.setupName === setupName) attention.clear(ctx);
  } catch {
  }
}
async function reconcileSelectionAttention(ctx, attention, signal) {
  const current = attention.current();
  if (!current || signal.aborted) return;
  try {
    const config = await loadConfig(current.decision.setupName);
    if (signal.aborted || attention.current() !== current) return;
    if (!syncAttentionMatchesConfig(current, config)) attention.clear(ctx);
  } catch {
    if (!signal.aborted && attention.current() === current) attention.clear(ctx);
  }
}
function directSelectionOrigin(rawArgs) {
  const command = splitArgs(rawArgs)[0];
  return command === "sync" || command === "pull" || command === "push" ? command : void 0;
}
async function resolveSelectionAttention(ctx, attention, signal, loaders, options = {}) {
  const current = attention.current();
  if (!current || signal.aborted) return;
  const { dispatchManagerResult: dispatchManagerResult2 } = await Promise.resolve().then(() => (init_manager_result_dispatcher(), manager_result_dispatcher_exports));
  if (signal.aborted || attention.current() !== current) return;
  await dispatchManagerResult2(
    ctx,
    { kind: "remote-selection-required", decision: current.decision },
    current.origin,
    (route, actionSignal, onCommit, target) => {
      const execute = () => executeRecoveryCommand(
        route,
        ctx,
        combineSignals2(signal, actionSignal),
        loaders,
        onCommit,
        target
      );
      return options.withStateAccess ? options.withStateAccess(execute) : execute();
    },
    signal,
    {
      cancelLabel: options.cancelLabel,
      withStateAccess: options.withStateAccess,
      onSelectionResolved: () => {
        if (attention.current() === current) attention.clear(ctx);
      }
    }
  );
}
async function executeRecoveryCommand(rawArgs, ctx, signal, loaders, onCommit, setup) {
  try {
    const [subcommand, ...rest] = splitArgs(rawArgs);
    if (subcommand !== "sync" && subcommand !== "pull" && subcommand !== "push") {
      throw new Error(`Unsupported sync recovery route: ${subcommand ?? "missing"}`);
    }
    const options = parseOptions(rest);
    if (setup !== void 0) options.setup = setup;
    if (signal) options.signal = signal;
    if (onCommit) options.onCommit = onCommit;
    options.reload = false;
    options.auto = false;
    validateCommandOptions(subcommand, options);
    const operations = await loaders.operations();
    throwIfAborted15(options.signal);
    if (subcommand === "push") {
      const outcome = await withLock("push", () => operations.push(ctx, options));
      return { kind: "completed", ...outcome ? { outcome } : {} };
    }
    if (subcommand === "pull") {
      const outcome = await withLock("pull", () => operations.pull(ctx, options));
      return { kind: "completed", ...outcome ? { outcome } : {} };
    }
    await withLock("sync", () => operations.syncBoth(ctx, options));
    return { kind: "completed" };
  } catch (error) {
    if (signal?.aborted) return { kind: "failed" };
    ctx.ui.setStatus(STATUS_KEY4, void 0);
    if (error instanceof RemoteSelectionMismatchError) {
      return { kind: "remote-selection-required", decision: error.decision };
    }
    if (isSyncDecisionRequiredError(error)) {
      return { kind: "decision-required", decision: error.decision };
    }
    ctx.ui.notify(errorMessage(error), "error");
    return { kind: "failed" };
  }
}
async function executeCommand(rawArgs, ctx, signal, loaders, onCommit, setup) {
  try {
    const command = await resolveSyncCommand(rawArgs, ctx);
    if (signal?.aborted || !command) return { kind: "completed" };
    const { subcommand, rest } = command;
    const options = parseOptions(rest);
    if (setup !== void 0) options.setup = setup;
    if (signal) options.signal = signal;
    if (onCommit) options.onCommit = onCommit;
    validateCommandOptions(subcommand, options);
    switch (subcommand) {
      case "help":
        ctx.ui.notify(usage(), "info");
        return { kind: "completed" };
      case "use": {
        const { useSyncSetup: useSyncSetup2 } = await loaders.setupSwitch();
        throwIfAborted15(options.signal);
        await useSyncSetup2(
          ctx,
          options.args[0] ?? "",
          async (selectedSetup) => {
            const operations = await loaders.operations();
            throwIfAborted15(options.signal);
            return withLock(
              "pull",
              () => operations.pull(ctx, { ...options, setup: selectedSetup })
            );
          },
          void 0,
          options.signal
        );
        return { kind: "completed" };
      }
      case "init":
        await initConfig(ctx, signal);
        return { kind: "completed" };
      case "config":
        await showConfig(ctx, options);
        return { kind: "completed" };
      case "files": {
        const { showFileSelection: showFileSelection2 } = await Promise.resolve().then(() => (init_file_selection(), file_selection_exports));
        throwIfAborted15(options.signal);
        await showFileSelection2(ctx, options.setup, options.signal);
        return { kind: "completed" };
      }
      case "status": {
        const operations = await loaders.operations();
        throwIfAborted15(options.signal);
        await operations.status(ctx, options);
        return { kind: "completed" };
      }
      case "diff": {
        const operations = await loaders.operations();
        throwIfAborted15(options.signal);
        await operations.diff(ctx, options);
        return { kind: "completed" };
      }
      case "doctor": {
        const operations = await loaders.operations();
        throwIfAborted15(options.signal);
        await operations.doctor(ctx, options);
        return { kind: "completed" };
      }
      case "push": {
        const operations = await loaders.operations();
        throwIfAborted15(options.signal);
        const outcome = await withLock("push", () => operations.push(ctx, options));
        return { kind: "completed", ...outcome ? { outcome } : {} };
      }
      case "pull": {
        const operations = await loaders.operations();
        throwIfAborted15(options.signal);
        const outcome = await withLock("pull", () => operations.pull(ctx, options));
        return { kind: "completed", ...outcome ? { outcome } : {} };
      }
      case "sync": {
        const operations = await loaders.operations();
        throwIfAborted15(options.signal);
        await withLock("sync", () => operations.syncBoth(ctx, options));
        return { kind: "completed" };
      }
      case "history": {
        const operations = await loaders.operations();
        throwIfAborted15(options.signal);
        await operations.history(ctx, options);
        return { kind: "completed" };
      }
      case "rollback": {
        const operations = await loaders.operations();
        throwIfAborted15(options.signal);
        await withLock("rollback", () => operations.rollback(ctx, options));
        return { kind: "completed" };
      }
      case "migrate-state":
        await migrateStateDirectory(ctx, options);
        return { kind: "completed" };
      case "unlock":
        await unlock(ctx, options);
        return { kind: "completed" };
      default:
        ctx.ui.notify(`Unknown /sync command: ${subcommand}

${usage()}`, "warning");
        return { kind: "failed" };
    }
  } catch (error) {
    if (signal?.aborted) return { kind: "failed" };
    ctx.ui.setStatus(STATUS_KEY4, void 0);
    if (error instanceof SetupPullRequiresUiError) throw error;
    if (error instanceof RemoteSelectionMismatchError) {
      return { kind: "remote-selection-required", decision: error.decision };
    }
    if (isSyncDecisionRequiredError(error)) {
      return { kind: "decision-required", decision: error.decision };
    }
    ctx.ui.notify(errorMessage(error), "error");
    return { kind: "failed" };
  }
}
async function migrateStateDirectory(ctx, options) {
  const notice = stateDirectoryMigrationNotice();
  if (!notice) {
    ctx.ui.notify("pi-sync already uses the canonical pi-sync/ state directory.", "info");
    return;
  }
  if (!options.yes && !await ctx.ui.confirm(
    "Migrate pi-sync state directory",
    "Confirm that every other Pi process is closed. pi-sync will atomically rename .pisync/ to pi-sync/ without merging or deleting either root.",
    { signal: options.signal }
  )) {
    ctx.ui.notify("pi-sync state migration cancelled.", "info");
    return;
  }
  throwIfAborted15(options.signal);
  const result = await migrateLegacyStateDirectory();
  throwIfAborted15(options.signal);
  if (result.status === "ready") {
    ctx.ui.notify("pi-sync already uses the canonical pi-sync/ state directory.", "info");
    return;
  }
  ctx.ui.notify(result.message, result.status === "migrated" ? "info" : "warning");
}
async function autoSync(ctx, signal, loaders) {
  try {
    const partial = await loadPartialConfig();
    throwIfAborted15(signal);
    if (!partial.automatic) return;
    await ensureStateDir();
    throwIfAborted15(signal);
    await loadConfig();
    throwIfAborted15(signal);
    const operations = await loaders.operations();
    throwIfAborted15(signal);
    await withLock("auto-sync", () => {
      throwIfAborted15(signal);
      return operations.syncBoth(ctx, { ...AUTO_SYNC_OPTIONS, signal });
    });
  } catch (error) {
    if (signal.aborted || isMissingConfigError(error)) return;
    ctx.ui.setStatus(STATUS_KEY4, void 0);
    if (error instanceof RemoteSelectionMismatchError) return error.decision;
    ctx.ui.notify(`pi-sync auto sync skipped: ${errorMessage(error)}`, "warning");
  }
}
async function autoPushSessions(ctx, signal, loaders) {
  try {
    const partial = await loadPartialConfig();
    throwIfAborted15(signal);
    if (!partial.automatic) return;
    if (!partial.include.includes("sessions")) return;
    await ensureStateDir();
    throwIfAborted15(signal);
    const config = await loadConfig();
    throwIfAborted15(signal);
    if (!config.include.includes("sessions")) return;
    const [operations, snapshotModule, syncStateModule] = await Promise.all([
      loaders.operations(),
      loaders.snapshot(),
      loaders.syncState()
    ]);
    throwIfAborted15(signal);
    await withLock("auto-session-push", async () => {
      throwIfAborted15(signal);
      const state = await readStateForConfig(config);
      throwIfAborted15(signal);
      const local = await snapshotModule.createSnapshot(
        config.snapshotIdentity,
        snapshotOptionsForContext2(ctx, config)
      );
      throwIfAborted15(signal);
      if (!syncStateModule.hasLocalChanges(local, state, config)) return;
      await operations.push(ctx, { ...AUTO_SYNC_OPTIONS, signal }, { config, state, local });
    });
  } catch (error) {
    if (signal.aborted || isMissingConfigError(error)) return;
    ctx.ui.setStatus(STATUS_KEY4, void 0);
    ctx.ui.notify(`pi-sync session push skipped: ${errorMessage(error)}`, "warning");
  }
}
async function initConfig(ctx, signal) {
  const configPath = localConfigPath();
  if (await readLocalConfigObject()) {
    ctx.ui.notify(`Config already exists: ${await activeLocalConfigPath()}`, "info");
    return;
  }
  if (ctx.mode === "tui") {
    const { showSetupWizard: showSetupWizard2 } = await Promise.resolve().then(() => (init_manager_ui(), manager_ui_exports));
    throwIfAborted15(signal);
    await showSetupWizard2(ctx, signal);
    return;
  }
  await createLocalConfigDocument(localConfigTemplate());
  ctx.ui.notify(
    `Created ${configPath}. Add a storage connection and sync setup before syncing.`,
    "info"
  );
}
async function showConfig(ctx, options) {
  const config = await loadConfig(options.setup);
  const warnings = [
    ...config.backend.type === "s3" ? sessionTokenWarnings(config.backend.profile) : [],
    ...syncSessionsWarnings(config)
  ];
  const storageLines = configStorageLines(config);
  ctx.ui.notify(
    [
      "pi-sync config:",
      `sync setup: ${config.setupName}`,
      `storage connection: ${config.connectionName}`,
      ...storageLines,
      `storage path: ${config.storagePath}`,
      `automatic sync: ${config.automatic ? "enabled" : "disabled"}`,
      `included content: ${config.include.join(", ") || "none"}`,
      `sessions: ${config.include.includes("sessions") ? "included" : "not included"}`,
      `settings file: ${localConfigPath()}`,
      ...warnings
    ].join("\n"),
    warnings.length > 0 ? "warning" : "info"
  );
}
function configStorageLines(config) {
  switch (config.backend.type) {
    case "git":
      return [
        "kind: git",
        `remote: ${displayGitRemote(config.backend.profile.remote)}`,
        "authentication: existing Git/SSH credentials (not stored)",
        `branch: ${config.backend.destination.branch}`
      ];
    case "webdav":
      return [
        "kind: webdav",
        `url: ${displayWebDavUrl(config.backend.profile.url, config.backend.profile.username)}`,
        "username: configured (value hidden)",
        "password: configured"
      ];
    case "s3":
      return [
        "kind: s3",
        `endpoint: ${config.backend.profile.endpoint}`,
        `bucket: ${config.backend.destination.bucket}`,
        `region: ${config.backend.profile.region}`,
        "access key id: configured",
        "secret access key: configured",
        `session token: ${config.backend.profile.sessionToken ? "configured" : "not configured"}`
      ];
  }
}
function displayGitRemote(value) {
  if (!value) return "missing";
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.replace(/^(?:[^@\s]+@)?(?<host>[^:]+):.+$/u, "$<host>:\u2026");
  }
}
function displayWebDavUrl(value, username) {
  if (!value) return "missing";
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return username ? `${url.origin}/\u2026` : `${url.origin}${url.pathname}`;
  } catch {
    return "invalid (value hidden)";
  }
}
function throwIfAborted15(signal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
function combineSignals2(primary, secondary) {
  return secondary ? AbortSignal.any([primary, secondary]) : primary;
}
function snapshotOptionsForContext2(ctx, config) {
  return {
    include: config.include,
    sessionDir: sessionDirFromContext3(ctx)
  };
}
function sessionDirFromContext3(ctx) {
  const manager = ctx.sessionManager;
  const usesDefaultSessionDir = manager.usesDefaultSessionDir;
  if (typeof usesDefaultSessionDir === "function" && usesDefaultSessionDir.call(manager)) {
    return void 0;
  }
  const getSessionDir = manager.getSessionDir;
  return typeof getSessionDir === "function" ? getSessionDir.call(manager) : void 0;
}
function cachedModuleLoader(load) {
  let pending;
  return () => {
    if (!pending) {
      pending = load().catch((error) => {
        pending = void 0;
        throw error;
      });
    }
    return pending;
  };
}
export {
  sync as default
};
