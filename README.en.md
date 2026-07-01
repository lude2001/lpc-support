# LPC Support

[![Version](https://img.shields.io/visual-studio-marketplace/v/ludexiang.lpc-support?color=blue&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![CI](https://github.com/lude2001/lpc-support/actions/workflows/ci.yml/badge.svg)](https://github.com/lude2001/lpc-support/actions/workflows/ci.yml)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/ludexiang.lpc-support?color=success)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![License](https://img.shields.io/github/license/lude2001/lpc-support?color=orange)](https://github.com/lude2001/lpc-support/blob/main/LICENSE)

[中文说明](https://github.com/lude2001/lpc-support/blob/main/README.md)

LPC Support is a VS Code extension for LPC / FluffOS development. It provides editor features, static analysis, documentation, and compile workflow support for day-to-day mudlib development.

The extension follows a conservative static-proof principle: facts that can be proven from the current file, includes, inherits, project configuration, built-in efun docs, or explicit user configuration are used for completion, navigation, and diagnostics. Runtime-dynamic behavior that cannot be proven reliably is downgraded conservatively to avoid false diagnostics and incorrect jumps.

## Feature Overview

### Editor Features

- LPC syntax highlighting and semantic highlighting
- Document outline and folding
- Snippets
- Document formatting and range formatting
- Line comments, block comments, and common keybindings

### Code Intelligence

- Completion for keywords, types, modifiers, macros, functions, and object methods
- Hover documentation from the current file, include files, inherited files, simul-efun files, and built-in efun docs
- Signature help
- Go to definition for functions, variables, macros, include files, and object methods
- References in the current file and provable inherit chains
- Rename for local variables, parameters, and file-scope global variables
- Function documentation panel

### Diagnostics And Type Checking

- LPC syntax diagnostics
- Unused local variable, parameter, and global variable checks
- Local variable declaration-position checks
- Macro, include, object-access, and basic semantic diagnostics
- Conservative type checking for provable assignment, return, argument, and common expression mismatches
- Folder scanning
- Error diagnostics center

### Compile And Runtime Helpers

- Compile the current LPC file
- Compile `.c` files in a directory
- Local `lpccp` compile mode
- Remote HTTP compile mode
- Start a development driver
- Unified compile-management entry point

## Installation

You can install the extension in one of these ways:

1. Search for `LPC[FluffOS]` in the VS Code Marketplace.
2. Install from the command line: `code --install-extension ludexiang.lpc-support`
3. Install from a local `.vsix` file.

## Quick Start

The extension uses `lpc-support.json` at the workspace root as the project entry point. A recommended mudlib-root configuration is:

```json
{
  "version": 1,
  "configHellPath": "config/config.dev",
  "instanceResolutionFunctions": {
    "this_player": ["/clone/user/user"],
    "environment": ["/inherit/room/room"]
  },
  "compile": {
    "mode": "local",
    "local": {
      "useSystemCommand": true,
      "compileMode": "reload-loaded"
    },
    "remote": {
      "activeServer": "Local dev server",
      "servers": []
    }
  }
}
```

The minimum configuration only needs:

- `version`: currently fixed at `1`
- `configHellPath`: the real `config.hell` / `config.dev` used by the project

If you only need language features, `compile` can be omitted. If you want runtime-returning functions to participate in object-method completion and definition, add `instanceResolutionFunctions`.

## Project Configuration

### `lpc-support.json`

`lpc-support.json` stores only the extension entry configuration and user-authored feature configuration. Runtime mudlib facts still come from the real driver configuration file.

Main consumed fields:

- `version`
- `configHellPath`
- `instanceResolutionFunctions`
- `compile.mode`
- `compile.local.useSystemCommand`
- `compile.local.lpccpPath`
- `compile.local.compileMode`
- `compile.remote.activeServer`
- `compile.remote.servers`

### `config.hell` / `config.dev`

The extension reads FluffOS project facts through `configHellPath`, including:

- mudlib directory
- include directories
- simulated efun file
- master file
- global include file

These facts are used by macro resolution, include resolution, simul-efun documentation, object inference, and related language features.

### `instanceResolutionFunctions`

`instanceResolutionFunctions` tells the extension: "this function usually returns these object files in this mudlib." It only affects static language features. It does not change runtime behavior and does not execute the configured functions.

The field is placed at the top level of `lpc-support.json`:

```json
{
  "instanceResolutionFunctions": {
    "functionName": ["/object/file/path1", "/object/file/path2"]
  }
}
```

Configuration rules:

- The key is the function name without parentheses, such as `this_player`, `environment`, `find_player`, or `get_actor`.
- The value is an array of object file paths. Paths starting with `/` are recommended.
- `.c` may be omitted. For example, `/clone/user/user` resolves to `/clone/user/user.c`.
- A path must resolve to a real file in the current VS Code workspace; otherwise that candidate is ignored.
- One function may have multiple candidate objects.
- Relative paths are not recommended. They are resolved relative to the current source file and can become inconsistent across files.

Typical configuration:

```json
{
  "instanceResolutionFunctions": {
    "this_player": ["/clone/user/user"],
    "this_user": ["/clone/user/user"],
    "environment": ["/inherit/room/room"],
    "find_player": ["/clone/user/user"],
    "get_actor": ["/clone/user/user", "/clone/npc/npc"]
  }
}
```

When matched, the configured object files are used for completion, hover, signature help, definition, and simple assignment propagation:

```c
this_player()->query_name();

object me = this_player();
me->query_name();

get_actor(id)->query_name();
```

Boundaries:

- The configuration matches by function name. It does not return different objects for different arguments.
- For known FluffOS runtime efuns, the extension checks basic arity first. Clearly invalid calls do not use the configured candidates.
- This configuration is intended for functions returning a single `object`, not `object *`.
- Efuns such as `users()`, `all_inventory()`, `children()`, and `objects()` do not become array-element object inference sources through this setting.
- `this_object()` does not need configuration; it naturally resolves to the current file.
- `master()` usually does not need configuration; the extension reads the master file from `config.hell` / `config.dev`.
- Configured object paths are not macro expressions. Write object paths directly instead of macro names such as `USER_D`.

### VS Code Settings

Common settings:

- `lpc.enableTypeChecking`: enable or disable `lpc.type.*` type-checking diagnostics
- `lpc.enableUnusedGlobalVarCheck`: enable or disable unused global variable checks
- `lpc.enforceLocalVariableDeclarationAtBlockStart`: enable or disable the declaration-at-block-start check
- `lpc.format.indentSize`: formatter indentation size
- `lpc.performance.debounceDelay`: diagnostics debounce delay
- `lpc.performance.enableMonitoring`: enable lightweight performance monitoring
- `lpc.javadoc.enableAutoGeneration`: enable Javadoc generation
- `lpc.glm4.*`: configure GLM-4 powered comment generation

## Language Feature Boundaries

### Static-Proof Principle

The extension tries to reuse local facts that can be proven from:

- current-file semantics
- include files
- resolvable inherit chains
- built-in efun docs
- simul-efun source and comments
- `lpc-support.json`
- `config.hell` / `config.dev`
- explicitly configured object candidates

When code depends on runtime state, dynamic paths, complex data flow, or unresolved inherit targets, the extension behaves conservatively and does not perform workspace-wide same-name guessing.

### References And Rename

Currently supported:

- local variable and parameter rename in the current file
- file-scope global variable references and rename in the current file and provable inherit chains
- function references in the current file and provable inherit chains

Currently not supported:

- function rename
- `struct` / `class` definition rename
- unreliable workspace-wide same-name expansion

### Object And Instance Resolution

The extension can use provable object sources for `obj->method()` completion, hover, signature help, and definition.

Common supported sources:

- string-path objects, such as `"/obj/user"->query_name()`
- macro-path objects, such as `COMBAT_D->query_name()`
- `this_object()`
- `master()`
- `load_object(path)` / `find_object(path)` / `clone_object(path)`
- provable file-scope `object` bindings in the current file and inherit chain
- simple assignment chains in the current function
- simple `if / else` branch merging
- provable restricted function-return object inference
- `@lpc-return-objects` annotation fallback
- runtime function candidates configured through `instanceResolutionFunctions`

The extension does not statically guess:

- `arr[i]->method()`
- dynamically concatenated object paths
- dynamic inherits
- global runtime state written in `create()` / `setup()` / `reset()`
- arbitrary cross-function data flow, complex loops, dynamic containers, or closure calls
- array-element propagation from efuns returning `object *`

If a runtime function has a stable single-object return type in your project, configure it with `instanceResolutionFunctions`. If the result varies by argument, call stack, room state, or player state, leaving it unconfigured is usually safer.

### Type Checking

Type checking is enabled by default and reports `lpc.type.*` diagnostics as warnings. It checks provable cases such as:

- local and global variable assignments
- function return values
- direct function-call arguments
- efun, simul-efun, and project function return values
- basic arrays, mappings, objects, class / struct values, and common expression types
- narrowing from provable type guards such as `objectp()` and `stringp()`

When type information is incomplete, depends on runtime-dynamic values, or any accepted overload lacks a reliable type, the checker skips the diagnostic conservatively. It can be disabled with:

```json
{
  "lpc.enableTypeChecking": false
}
```

## Formatting

The extension provides document formatting and range formatting, with focused support for:

- Allman-style formatting for functions, `if / else`, loops, and anonymous functions
- structured layout for `mapping`, arrays, and `new(..., field : value)`
- `struct` / `class` definitions
- `switch` range labels
- common `foreach` headers
- conservative handling for heredoc, preprocessor lines, complex multi-line macros, and trailing comments

Current formatting setting:

```json
{
  "lpc.format.indentSize": 4
}
```

## Compile Management

The extension supports both local and remote compile modes.

### Local `lpccp`

Local compile uses `lpccp` to connect to an already running development driver. `lpccp` is not an offline compiler; it must connect to the FluffOS driver associated with `configHellPath`.

Example:

```json
{
  "compile": {
    "mode": "local",
    "local": {
      "useSystemCommand": false,
      "lpccpPath": "tools/lpccp.exe",
      "compileMode": "reload-loaded"
    }
  }
}
```

`compileMode` options:

- `reload-loaded`: try to destruct and reload an already loaded target
- `compile-only`: validate compilation without replacing a loaded object
- `fresh-required`: require the target to be unloaded in the current runtime

See [`docs/lpccp.md`](https://github.com/lude2001/lpc-support/blob/main/docs/lpccp.md) for more details.

### Remote HTTP

Example:

```json
{
  "compile": {
    "mode": "remote",
    "remote": {
      "activeServer": "Local dev server",
      "servers": [
        {
          "name": "Local dev server",
          "url": "http://127.0.0.1:8080",
          "description": "Local compile service"
        }
      ]
    }
  }
}
```

## Common Commands

- Start MUD driver
- Show all LPC variables
- Scan folder for unused variables
- Compile current LPC file
- Compile LPC folder
- Manage compile configuration
- Show simulated efun configuration source
- Show function documentation panel
- Generate Javadoc comments
- Rebuild LPC workspace index
- Refresh, clear, open, and copy entries in the error diagnostics center

## Keybindings

- `Ctrl+/`: line comment
- `Shift+Alt+A`: block comment
- `Ctrl+F5`: compile current LPC file
- `F12`: go to definition
- `Alt+F12`: peek definition

## Javadoc Comments

The extension recognizes common Javadoc-style tags:

- `@brief`
- `@details`
- `@param`
- `@return`
- `@note`
- `@lpc-return-objects`

Example:

```c
/**
 * @brief Gets an equipment object.
 * @param type Equipment type.
 * @return Equipment object.
 * @lpc-return-objects {"/obj/weapon", "/obj/armor"}
 */
object get_equipment(string type);
```

## FAQ

### Macros Or Includes Are Not Recognized

Check that `configHellPath` in `lpc-support.json` points to the real driver configuration file, and that the include directories in that configuration can find the target header files.

### Simulated Efun Documentation Is Not Loaded

Check the simulated efun file configured in `config.hell` / `config.dev`. The extension uses that configuration to parse simul-efun documentation.

### `this_player()` Or `environment()` Does Not Jump To Object Methods

These functions depend on runtime state. If they have stable object types in your mudlib, configure candidates in `instanceResolutionFunctions`, for example `"this_player": ["/clone/user/user"]`. If they can return very different objects in different situations, do not configure them, or configure only a common base / interface object you are comfortable with.

### What Should I Do About A Type-Checking False Positive?

First check whether the relevant type can be proven from declarations, documentation, efun docs, or simul-efun source. If the code depends on runtime-dynamic values, disable `lpc.enableTypeChecking` or open an issue with the provable type source.

### Compile Fails

Check `compile.mode`, remote server URL, `lpccp` path, and whether `configHellPath` matches the configuration file used by the running development driver.

### Completion Or Definition Looks Wrong

Try rebuilding the LPC workspace index, reopening the file, or reloading VS Code. If the issue is reproducible, please open an issue with a minimal reproduction and the related configuration.

## References And Development Paradigm

While advancing LPC static analysis and language-service capabilities, `lpc-support` has referenced some implementation ideas and problem modeling from [`jlchmura/lpc-language-server`](https://github.com/jlchmura/lpc-language-server), and continues to integrate around VS Code extension behavior, workspace configuration, the FluffOS development driver, local compilation, and conservative diagnostics.

For more background on the development-environment boundaries and LPC development paradigm behind this direction, see [`docs/lpc-support-development-paradigm.en.md`](https://github.com/lude2001/lpc-support/blob/main/docs/lpc-support-development-paradigm.en.md).

## Acknowledgements

**Core Development**

- @easyCat
- Wuxia Liming team

**Technical Support**

- ANTLR4
- Zhipu AI (GLM-4)
- FluffOS community

**Donation Support**

Thanks to Niepan, Ruyue, Xueheche, Dianxiaoer, Xuanzhuan, Yuanfen, Youruo, Guqingyi, Tianshaguxing, Xiaojieao, Chuqianqiu, Ren'aoxiang, Xiachen, Chuanchuan de Guang, Huozhe de Jiangshi, and other friends for their support.

## Links

- [GitHub](https://github.com/lude2001/lpc-support)
- [Issue Tracker](https://github.com/lude2001/lpc-support/issues)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
- [FluffOS Documentation](https://www.fluffos.info)

## License

MIT License
