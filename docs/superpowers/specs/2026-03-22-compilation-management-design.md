# Compilation Management Design

Date: 2026-03-22

## Background

The extension currently treats compilation as a remote-server-only workflow:

- `src/compiler.ts` sends HTTP requests to `/update_code/update_file`
- server definitions live in global storage via `lpc-servers.json`
- the command surface is still framed as "manage compilation servers"

That model no longer matches current development-driver workflows. The driver now supports `lpccp`, which provides local runtime compilation for both a single file and a directory, with structured JSON output. At the same time, project configuration is already moving toward `lpc-support.json` as the preferred project-level source of truth.

This design upgrades compilation from "server management" to "compilation management", while preserving remote compilation and adding a first-class local `lpccp` mode.

## Goals

- Rename the user-facing management entry from "管理编译服务器" to "编译管理"
- Keep existing remote HTTP compilation support
- Add local compilation support through `lpccp`
- Allow local mode to either:
  - use `lpccp` from `PATH`, or
  - use an explicit executable path
- Store both local and remote compilation configuration in project-level `lpc-support.json`
- Route both file and folder compilation through a unified compilation management layer
- Use `lpccp` native directory compilation instead of per-file folder fan-out when local mode is active

## Non-Goals

- Replacing the diagnostics pipeline outside compile-triggered diagnostics
- Changing parser / syntax / semantic responsibilities
- Removing legacy settings immediately in this change
- Introducing a new parser or static compilation flow

## User Experience

### Commands

Introduce a new primary command:

- `lpc.manageCompilation`

User-facing title:

- `编译管理`

Compatibility:

- Keep `lpc.manageServers` registered temporarily as a compatibility alias
- Route `lpc.manageServers` internally to the new compilation management flow

Other commands remain:

- `lpc.compileFile`
- `lpc.compileFolder`

### Management Flow

The `编译管理` entry opens a Quick Pick based flow:

1. Choose current compilation mode
   - `本地编译 (lpccp)`
   - `远程编译 (HTTP)`
2. Then choose mode-specific actions

Local mode actions:

- `切换为使用系统命令`
- `设置 lpccp 路径`
- `设置 driver config 路径`
- `查看当前本地编译配置`

Remote mode actions:

- `选择活动服务器`
- `添加服务器`
- `编辑服务器`
- `删除服务器`
- `查看当前远程编译配置`

The selected mode becomes the active compilation mode and is persisted to `lpc-support.json`.

## Configuration Model

Extend `lpc-support.json` with a new `compile` section:

```json
{
  "version": 1,
  "configHellPath": "config.hell",
  "compile": {
    "mode": "local",
    "local": {
      "useSystemCommand": true,
      "lpccpPath": "",
      "driverConfigPath": "etc/config.test"
    },
    "remote": {
      "activeServer": "本地开发服",
      "servers": [
        {
          "name": "本地开发服",
          "url": "http://127.0.0.1:8080",
          "description": "旧的远程编译接口"
        }
      ]
    }
  }
}
```

### Proposed Types

```ts
interface LpcCompileLocalConfig {
    useSystemCommand?: boolean;
    lpccpPath?: string;
    driverConfigPath?: string;
}

interface LpcCompileRemoteServer {
    name: string;
    url: string;
    description?: string;
}

interface LpcCompileRemoteConfig {
    activeServer?: string;
    servers?: LpcCompileRemoteServer[];
}

interface LpcCompileConfig {
    mode?: 'local' | 'remote';
    local?: LpcCompileLocalConfig;
    remote?: LpcCompileRemoteConfig;
}
```

The project config root adds:

```ts
compile?: LpcCompileConfig;
```

### Path Rules

- `driverConfigPath` should be stored relative to workspace root whenever practical
- `lpccpPath` may be empty when `useSystemCommand` is enabled
- if `lpccpPath` is provided and relative, resolve it relative to workspace root

## Architecture

### High-Level Direction

Compilation should no longer be hardwired to one transport. Introduce a small compile-management layer that:

- loads project-level compile settings
- selects the active backend
- executes compilation
- normalizes results into VS Code diagnostics and output messages

### Proposed Services

Keep the user-facing `LPCCompiler` entry if desired for compatibility, but refactor internals so it delegates to backend-specific executors.

Recommended structure:

- `CompilationService`
  - orchestration entry for `compileFile` and `compileFolder`
  - loads `lpc-support.json`
  - chooses backend based on `compile.mode`
- `RemoteCompilationBackend`
  - wraps current HTTP behavior
- `LocalLpccpCompilationBackend`
  - invokes `lpccp`
  - parses stdout JSON / stderr / exit codes

This can live either as new files or as a staged refactor inside `src/compiler.ts`, but the target shape should preserve a clear backend boundary.

## Execution Model

### Shared Preparation

Both `compileFile` and `compileFolder` should:

- determine workspace root
- load project config through `LpcProjectConfigService`
- determine current compile mode
- resolve LPC/MUD path from workspace-relative path

### Remote Mode

Remote mode preserves current behavior with one improvement:

- it reads server list and active server from `lpc-support.json`, not global `lpc-servers.json`

Folder compilation in remote mode may continue to use the existing file fan-out behavior in this change, unless later remote protocol support adds a true directory endpoint.

### Local Mode

Single-file command:

```bash
lpccp <config-path> <mud-path>
```

Directory command:

```bash
lpccp <config-path> <mud-dir>
```

Execution rules:

- if `useSystemCommand` is `true`, launch `lpccp`
- otherwise launch configured executable path
- pass the resolved driver config path as the first positional argument
- pass the MUD path or directory as the second positional argument

Implementation should use Node child process APIs, capture:

- stdout
- stderr
- exit code

## Result Normalization

`lpccp` stdout is JSON and should be treated as the primary structured response.

### Exit Code Handling

- `0`: request succeeded and top-level `ok: true`
- `1`: request completed but compilation returned errors; still parse stdout JSON and surface diagnostics
- `2`: local connection or request-level failure; treat stderr as the primary error surface and show actionable guidance

### File Response Mapping

Map file diagnostics to the current document URI.

Expected JSON fields:

- `ok`
- `kind: "file"`
- `target`
- `diagnostics`

Each diagnostic should map to `vscode.Diagnostic` using:

- `severity: "warning"` -> `DiagnosticSeverity.Warning`
- otherwise -> `DiagnosticSeverity.Error`

When line information is missing or invalid, fall back to line 0.

### Directory Response Mapping

Expected JSON fields:

- `ok`
- `kind: "directory"`
- `files_total`
- `files_ok`
- `files_failed`
- `results`

Behavior:

- aggregate success/failure summary into the output channel
- for every result entry, map diagnostics back to its corresponding workspace file URI
- clear diagnostics for files that compiled successfully and were included in the response

### Output Channel Behavior

Continue using the LPC compiler output channel and print:

- active mode
- resolved command or server target
- compile target
- high-level summary
- stderr or request-level failures when execution fails

## Migration Strategy

### Existing Project Config Migration

When `lpc-support.json` already exists but does not contain `compile`, initialize it lazily when the user opens `编译管理` or triggers compilation.

Default initialization:

- if legacy remote server config exists, initialize `compile.remote` from it
- otherwise initialize empty remote config
- default `compile.mode` to:
  - `remote` when remote servers are available
  - otherwise `local` only if local config is explicitly created by the user

### Global Server Migration

Current remote server definitions live in global storage (`lpc-servers.json`).

Migration approach:

1. Read legacy server config through `LPCConfigManager`
2. On first compilation-management load for a workspace, if `compile.remote.servers` is missing or empty:
   - import legacy servers into project config
   - preserve legacy active server as `compile.remote.activeServer`
3. Write migrated values to `lpc-support.json`
4. Continue reading from project config as the new source of truth

This keeps migration automatic and minimizes user re-entry.

### Legacy Setting Prompt Logic

Migration detection should expand from:

- `lpc.includePath`
- `lpc.simulatedEfunsPath`
- `lpc.driver.command`

to also consider legacy compilation server storage when useful for messaging. The prompt can remain focused on `lpc-support.json` as the project-level source of truth.

## Validation Rules

Before running local compilation:

- require `driverConfigPath`
- require either `useSystemCommand === true` or a non-empty `lpccpPath`

Helpful errors:

- missing config path
- missing executable path when system command is disabled
- failed process spawn
- invalid JSON from `lpccp`
- workspace root unavailable

Before running remote compilation:

- require at least one configured server
- require an active server or pick the first server as fallback

## Testing Plan

### Unit Tests

Add focused tests for:

- project config read/write of `compile` section
- migration from legacy global remote servers into project config
- command registration rename and compatibility alias
- local mode command resolution
- local mode exit code and JSON parsing behavior
- remote mode loading from project config instead of global file

Likely files:

- `src/projectConfig/__tests__/LpcProjectConfigService.test.ts`
- `src/projectConfig/__tests__/projectConfigMigration.test.ts`
- `src/modules/__tests__/commandModule.test.ts`
- new compile-management tests near compiler implementation

### Behavior Tests

Cover:

- `lpc.compileFile` using local mode with `useSystemCommand`
- `lpc.compileFile` using local mode with explicit executable path
- `lpc.compileFolder` using local mode and directory JSON results
- `lpc.compileFile` using remote mode after migration to project config

Mocks should verify:

- spawned command and arguments
- diagnostics written for reported files
- output channel summary messages

## Risks

- Mixing global legacy server storage and project config during migration could create confusing precedence if not made explicit
- Folder result mapping must correctly translate MUD paths back to workspace file paths
- `lpccp` JSON parse failures need clear fallback logging to avoid silent failures
- local executable path handling must work on Windows path conventions

## Rollout Notes

- Keep `lpc.manageServers` as a compatibility alias for this release
- update command titles and README wording from "管理编译服务器" to "编译管理"
- document `lpccp` local mode requirements and examples

## Recommended Implementation Order

1. Extend project config types and service helpers for `compile`
2. Add migration from legacy remote server storage into `lpc-support.json`
3. Refactor compiler into a mode-aware orchestration layer
4. Implement local `lpccp` backend
5. Update command surface and menus to `编译管理`
6. Add tests
7. Update README / changelog
