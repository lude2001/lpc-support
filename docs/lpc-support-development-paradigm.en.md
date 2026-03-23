# Notes on the LPC Development Paradigm and `lpc-support`

At this point, people in the LPC community are already building in several different directions.

- Some are pushing stronger static analysis and language services
- Some are pushing better external tool integration
- Some are pushing update mechanisms that fit specific Mudlib scenarios better
- And some are pushing workspace truth, local compile loops, development drivers, and package conventions

The entry points are different, and the priorities are different, but the broader direction is actually similar: people are trying, in their own ways, to move LPC development a bit further away from the old state of relying too much on experience, manual steps, and inherited engineering habits.

This document is not meant to define the field for everyone, and it is not meant to present one route as the only correct one.

It is better read as a small attempt to organize the discussion: to place some of these directions side by side, and to explain the judgment behind the `lpc-support` route more clearly.

You can read it as a reference expression of some ideas, together with my own thinking.

## A boundary that should be stated first

`lpc-support` is not primarily trying to solve production-environment problems.

It is mainly trying to solve development-environment problems.

That may sound simple, but it matters. If that boundary is not clear, a lot of later judgment starts to drift.

This is not a new production deployment solution, and it is not an attempt to define one universally correct Mudlib structure. At least from my current point of view, the more important task is to rebuild the development layer first.

Why the development layer?

Because the long-standing debt in LPC is not really “can it run online,” but rather “does development itself have a solid enough foundation.”

For a long time, many things have been held together by experience:

- include paths are remembered by people
- simulated efun paths are remembered by people
- compile-service entry points are remembered by people
- which driver is usable for development is remembered by people
- how external systems are installed is remembered by people
- where to look after something breaks is remembered by people

This can work in the short term. But in the long run, it usually becomes heavier and heavier. The larger the project, the larger the world, and the more content it carries, the more expensive the maintenance becomes.

So, from my perspective, if LPC is going to keep moving forward, it probably cannot keep adding only at the content layer. The development layer itself also needs to be rebuilt.

The `lpc-support` route is basically unfolding along that line of thought.

## It may not be a good idea to put “compatibility with old libs” at the very top

This part is worth stating directly.

Compatibility with old libs matters. I have been doing compatibility work too. But if “compatibility with every existing old structure” becomes the highest goal, then it becomes very hard for a new technical foundation to grow.

The reason is not complicated. Once compatibility becomes the highest goal, design decisions naturally collapse backward:

- projects cannot have a new source of engineering truth, because old projects did not
- workspaces cannot have explicit configuration, because old workflows were not organized that way
- drivers cannot be rebuilt around development needs, because the upstream mainline is not centered on that goal
- packages cannot have a unified protocol, because old projects did not have that concept
- structural analysis cannot be cleanly layered, because old code was not organized that way

And then the result is usually the same: tools keep getting patched, while the foundation itself does not change.

If the goal is only to maintain an existing world, that can still work for a long time. You are extending a structure that is already familiar.

But once the goal changes, the problem changes too.

From my perspective, the more important question is not “how to keep piling a world on top of the old structure,” but “how to give LPC the ability to support larger world expression.”

“Larger” here does not simply mean a larger map or more lore text. It means:

- stronger system consistency
- clearer module boundaries
- easier external capability integration
- more reliable tooling feedback
- lower collaboration friction
- a world narrative that is not forced to advance only through local stitching

If compatibility with old libs remains the highest goal, this kind of foundation will probably remain very hard to grow.

That is also why I tend to think of `lpc-support` not as an improved old tool, but as part of a new LPC application-development paradigm.

## What this paradigm is actually trying to rebuild

From where I stand now, there are at least three layers worth rebuilding first.

### 1. Engineering truth

Many LPC projects have not really had a proper engineering truth layer.

Configuration is scattered. Paths are scattered. Toolchain entry points are scattered. Compile servers are scattered. The editor knows one part, the Mudlib knows one part, and the developer remembers the rest.

This is manageable in a small project, but in a larger one it turns into continuous hidden cost.

So `lpc-support` treats `lpc-support.json` at the workspace root as the first entry point. `config.hell` is brought in through it. The structural information that the project actually cares about is synchronized through it. Compile mode, driver configuration, remote servers, and local `lpccp` all start to belong to one place.

That is not simply “one more config file.”

Its real meaning is that the project begins to have an engineering-level source of truth.

Once that source of truth exists, many other things have a chance to become coherent:

- the editor understands the project
- compilation management understands the project
- the error tree understands the project
- external packages understand the project
- AI assistants understand the project

Without that layer, tools eventually fall back to guessing in parallel.

### 2. Structured analysis

The second layer is how the editor understands LPC.

I do not want `lpc-support` to become a language package that survives mainly on regexes and caches. That kind of approach can ship features quickly, but over time it usually becomes unstable.

So the main path is now split into three layers:

- `ParsedDocument`
- `SyntaxDocument`
- `SemanticSnapshot`

I have intentionally avoided collapsing them back into one generic “AST,” because their responsibilities are genuinely different.

- the parser layer handles tokens, trivia, and basic diagnostics
- the syntax layer handles stable structure and token-backed ranges
- the semantic layer handles symbols, inheritance, scopes, and semantic summaries

This is not about having cleaner terminology. It is about making later capabilities stand on something more reliable:

- formatting is not guessing from text
- go-to-definition is not guessing from local scans
- completion is not hoping caches line up
- error location is not “somewhere around here”
- AI tools receive structure instead of fragments

If this layer is weak, everything that looks “modern” above it stays shallow.

### 3. A local development loop

The third layer is the development loop itself.

Traditional LPC development often suffers from a very long feedback chain.

After writing code, you may need to hit a remote endpoint, inspect logs manually, recompile inside the environment, or simply guess which step failed. That can still work, but it is not a very good fit for modern development, and it becomes worse in larger projects.

So along this route, the more reasonable target is to build a shorter local loop:

- the editor knows the project structure
- the local driver is the development driver
- `lpccp` talks directly to that driver
- compile results come back in a structured form
- the error tree can consume them directly
- external capabilities can be installed into the same project through packages

Once that chain is in place, LPC development stops being only “write code and throw it into the old environment to see what happens,” and starts to look at least a little more like modern application development.

## What this stack is made of right now

If we talk in terms of concrete resources, this paradigm currently depends on three major pieces:

- the `lpc-support` extension
- the development driver and `lpccp`
- `external_system_package`

They are not decorative items sitting next to each other. They have different roles.

### 1. The `lpc-support` extension

This is the entry point.

On the surface it is a VS Code extension. In this paradigm, though, it is really doing three things:

- establishing workspace-level engineering truth
- giving LPC structured understanding
- unifying compilation, error trees, package installation protocols, and AI workflows into one context

That is why the right way to use it is not “install the extension and then fill a bunch of paths in the settings page.”

The better order is:

1. create `lpc-support.json` at the project root
2. point it to the real `config.hell`
3. let the extension synchronize `resolved` information
4. then decide whether this project uses local `lpccp` or remote HTTP

At that point the extension stops being an isolated tool and becomes the entry point to the workspace.

### 2. The development driver and `lpccp`

The editor alone is not enough. The development layer also needs a driver that is actually meant to serve local development.

That is the reason behind the FluffOS fork I maintain.

It is not just a pile of unrelated patches. It is aimed at a specific set of development-layer gaps:

- HTTP helper/parser efuns
- a local compile-service workflow
- `lpccp`
- Windows `dist` artifacts
- fixes that make compiler diagnostics more trustworthy

Right now there are two ways to get that driver.

The first is to use the fork directly:

- [`https://github.com/lude2001/fluffos`](https://github.com/lude2001/fluffos)

If you want to build the development driver yourself and do not want to interfere with the official FluffOS mainline, the most practical route is to fork that repository again and build inside your own fork.

The second is to use the prebuilt Windows development driver shipped in this repository:

- [`docs/Fluffos_Development_Drive/dist.zip`](D:/code/lpc-support/docs/Fluffos_Development_Drive/dist.zip)

After extracting it, the two things that matter are:

- `driver`
- `lpccp`

One point should be stated clearly here: `lpccp` is not an offline compiler.

It is, in essence, the local compile-service client for the development driver. It connects to a driver that is already running, asks that driver to recompile files or directories inside the current runtime environment, and returns structured results.

So the safer order is:

1. start the development driver
2. connect to it through `lpccp`
3. let `lpc-support` use it through `compile.local`

If that part is not understood, the whole workflow tends to stay awkward.

### 3. `external_system_package`

This is not just a temporary script folder either.

From my point of view, it is better understood as the first step toward modular external-system capability in LPC.

Its importance is not “which HTTP controller it contains today,” but that it starts to define a more explicit way of organizing things:

- a package has its own directory
- a package has its own `version.json`
- a package can declare macros
- a package can declare preload objects
- a package can have its own installation protocol
- an AI assistant can install it by following that protocol

That matters because once packages start to become standard capability, there will not be only one `external_system_package`. There will be more packages, and they should not continue to spread only through copy-paste and oral explanation.

They should spread through:

- metadata
- installation protocols
- workspace truth
- AI-assisted execution

From where I stand, that is a more worthwhile direction to keep pushing.

## How these resources actually fit together

If this is reduced to a practical workflow, it looks roughly like this:

1. prepare a Mudlib workspace
2. create `lpc-support.json` at the root
3. point it to the real `config.hell`
4. install the `lpc-support` extension
5. prepare the development driver
6. make `lpccp` available
7. switch the extension to local compilation mode
8. install `external_system_package` if needed
9. start doing editing, compilation, diagnostics, error inspection, and external capability integration inside the same workspace

Once that chain is in place, what you get is no longer a handful of disconnected tools, but an actual development loop:

- the editor knows the project structure
- compilation knows the project configuration
- the error tree knows the active compile environment
- `lpccp` knows the active driver
- packages know how they should be installed into the project
- AI assistants know which protocol they are expected to follow

From my perspective, this matters more than simply supporting a few more syntax points. It changes not just one local experience, but the relationship between the developer and the project.

Many things that used to be stitched together manually now start to become something the system itself can coordinate.

## Why I think this could support larger worlds

If I continue this line of thinking, the thing this stack is really trying to support is not “making it easier to maintain an old world,” but “making it safer to create a new one.”

The point there is not the theme. It is the form of organization.

A genuinely large MUD world should not just be a pile of local stories placed next to each other. It needs:

- more stable engineering structure
- clearer module boundaries
- more reliable tooling feedback
- lower collaboration friction
- more natural external capability integration

Without that base, the larger the world becomes, the higher the cost becomes. At some point the problem is not that things cannot be built, but that they increasingly have to be maintained by manual stitching.

My sense is that if LPC still wants to carry larger-scale world building, this layer probably has to be rebuilt.

Not because “modernization” is a slogan worth chasing by itself, but because without that layer, many things become heavier and heavier over time.

## What still needs to happen

Of course, none of this is finished.

From where I stand now, there are still three areas most worth pushing next.

### 1. Standardizing the package system further

Right now `external_system_package` is only the first package.

What really needs to happen next is to make the package system itself more solid:

- how metadata fields are defined
- how macro injection is defined
- how preload declarations are defined
- how AI installation protocols are defined
- how package upgrades and compatibility are defined

Only then can LPC engineering capability accumulate instead of being reconnected by hand every time.

### 2. Continuing to build the development driver around the local platform

The fork will continue to change, but I hope it becomes increasingly clear about one thing:

it is not there to be “more featureful,” but to make local LPC application development work better.

In other words, every driver-side change should probably be examined with one question first:

does this make LPC feel more like a modern local development platform?

If the answer is no, it is probably not a priority on this route.

### 3. Continuing to connect editor, driver, packages, and AI protocol

Ideally, the editor’s structural understanding, the driver’s compile feedback, package metadata, AI installation protocols, and workspace engineering truth should eventually form one coherent chain.

That means a project is no longer separately using:

- one extension
- one driver
- a few scripts
- a few habits

but a development system whose parts know about each other.

If that happens, LPC development may finally begin to move away from an old environment held together mainly by experience, toward a new environment supported by infrastructure.

## Related projects worth recommending

It also feels worth listing a few other projects here.

The reason is simple: `lpc-support` did not appear in a vacuum, and it is not the only direction worth paying attention to in the modernization of LPC development. If anything, the more interesting picture is that people are pushing from different angles.

### 1. `jlchmura/lpc-language-server`

Project:

- [`https://github.com/jlchmura/lpc-language-server`](https://github.com/jlchmura/lpc-language-server)

This is a project I would strongly recommend looking at.

What it represents is a push toward stronger static analysis and stronger language-service support for LPC. Another way to put it is that it is taking seriously the question: if LPC were treated as a modern language in language-server form, what would that actually look like?

`lpc-support` did borrow some implementation ideas from it around AST-related work. But the underlying direction is not identical.

My route puts more emphasis on:

- workspace engineering truth
- unifying editor, driver, packages, and AI workflow
- organizing the toolchain around a development loop

What `lpc-language-server` contributes more clearly is the push toward stronger, more independent, more language-server-oriented static analysis.

From my point of view, it is worth seeing and worth continuing to study.

### 2. `gesslar/lpc-mcp`

Project:

- [`https://github.com/gesslar/lpc-mcp`](https://github.com/gesslar/lpc-mcp)

This project is closely related to `lpc-language-server`, and it can be understood as an external enhancement along that path.

If `lpc-language-server` is closer to the language-service core itself, then `lpc-mcp` keeps pushing the question of how external tools can be connected to LPC development context more naturally.

That direction is different in implementation from what I am doing with `external_system_package`, AI installation protocols, and workspace truth, but at a higher level they are dealing with a similar class of problem: how to stop LPC development from remaining sealed inside old manual workflows, and how to let it connect more naturally to modern toolchains.

### 3. `serenez/lpc-server-update`

Project:

- [`https://github.com/serenez/lpc-server-update`](https://github.com/serenez/lpc-server-update)

This project provides a socket-based update-file workflow.

It is not the same implementation as the local `lpccp` / compile-service path I am building, but it is solving a very real problem of its own: how to stop code update workflows from remaining entirely manual.

In practical terms, I think it fits ZJMud-style Mudlib scenarios especially well.

So the value of the project is not whether it is “the one correct solution,” but that it has already pushed a real update problem in a real engineering context into something that can actually be used.

## How I see the relationship between these projects and `lpc-support`

I do not want to frame `lpc-support` as if nothing else matters and only this route is valid.

Quite the opposite. I would rather place it in a more practical landscape:

- `lpc-language-server` pushes stronger static analysis and language services
- `lpc-mcp` pushes external tool collaboration
- `lpc-server-update` pushes update mechanisms for specific Mudlib scenarios
- `lpc-support` puts more emphasis on workspace truth, development loops, driver support, package protocol, and tying these things into one continuous development chain

These directions are not mutually exclusive.

From my point of view, together they show something important: LPC is not incapable of modernization. The real question is whether enough people are willing to keep pushing the work layer by layer.

## Closing thought

I do not think `lpc-support` has already accomplished something grand.

At this point it has only just managed to establish a direction.

But one thing feels fairly clear to me:

if LPC still wants to keep moving forward, and still wants to support larger world creation, it probably cannot rely only on compatibility with old libs and maintenance through accumulated habit. The development layer itself likely needs to be rebuilt.

`lpc-support`, `lpc-language-server`, `lpc-server-update`, the development FluffOS fork, `lpccp`, `external_system_package`, workspace-level project configuration, and the structured analysis chain together point toward what this current generation of tooling work is trying to move forward.

This is not simply about making old tools easier to use.

It is closer to rebuilding the foundation underneath LPC development, piece by piece.
