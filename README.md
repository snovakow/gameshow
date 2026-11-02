# Gameshow

**TypeScript + React + three.js + React Three Fiber + Vite + WebGPU**

Gameshow is a 3D game-show stage in the browser, being built toward a game of the Monty Hall problem: three crates, one prize, and the question of whether to switch. Today the stage is set, with a host, three crates you can open to reveal what's inside, and a mirror-like floor. The game's rules are still to come.

**Live demo:** [snovakow.com/gameshow](https://snovakow.com/gameshow/)

## Stack

| | |
| --- | --- |
| [TypeScript](https://www.typescriptlang.org) | Strict types across the whole app |
| [React](https://react.dev) | Components and state for the stage and its panels |
| [three.js](https://threejs.org) | Rendering, lighting, shadows, the reflective floor and the animated host |
| [React Three Fiber](https://r3f.docs.pmnd.rs) | The three.js scene, written as React components |
| [Vite](https://vite.dev) | The dev server and the production build |
| [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) | The GPU API three.js renders with, falling back to WebGL 2 in browsers without it |

Around them are drei's helpers, a leva control panel, zustand for game state, and Oxlint for linting.

The rebuild onto this stack is in progress. The live demo and the code on `main` are still the original version: plain three.js on WebGPU in JavaScript, built with Vite.

## What's in it

- **A host** who idles in one of several stances and can be cued to react: dancing, sulking, looking defeated or rejected.
- **Three crates**, each hiding a prize amount that rises out of it when you open the lid.
- **A reflective floor** under a sunny sky, with soft shadows and fog in the distance.
- **A control panel** for choosing the host's stance, triggering reactions, and setting how quickly the animations blend.

## Controls

| To | Do this |
| --- | --- |
| Look around | Drag with the left mouse button |
| Zoom | Scroll |
| Pan | Drag with the right mouse button |
| Open a crate | Click it |
| Change the host's stance or cue a reaction | Use the control panel |

## Workflow

- **Planned in phases.** The rebuild follows a [written plan](docs/react-port-plan.md). Each phase is one focused thread, and the phases that change code end with lint and a type-checked production build passing.
- **Reviewed before it's committed.** Every batch of work goes through `/commit`, a [Claude Code skill](.claude/skills/commit/SKILL.md) that serves as the final code review. It's adapted from a shared [baseline](https://github.com/snovakow/Claude-Skills/tree/main/skills/commit), and it runs in a fresh thread, so the review starts without the author's assumptions. It reads every changed line for bugs, React Three Fiber and three.js pitfalls, type and lint escapes, new dependencies, leftovers and anything that shouldn't be public. Then it runs the checks, splits the work into focused commits with descriptive messages, and keeps this README accurate.
- **Versioned checkpoints.** Versions continue from the prototype's 0.0.0: each reviewed batch ends with a version commit, which marks where the next review starts.
- **Current dependencies.** Packages and tools track their latest releases, and each review reports anything that has fallen behind.
- **Branches and deploys.** Work lands on `development` and reaches `main` by merge. The live site is a static build of `main`.

## Running it locally

You need Node.js 20.19 or later. Then run `npm install`, followed by `npm run dev`.

## Credits

- [three.js](https://threejs.org), including the host model and the reflection technique from its examples.
- The host's animations come from Mixamo.
- The MgOpen typefaces, under the MAGENTA licence included with them; the Droid fonts, under the Apache License 2.0; Gentilis, from SIL's Gentium, under the SIL Open Font License; and Kenney Fonts.
