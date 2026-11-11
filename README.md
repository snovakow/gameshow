# Gameshow

**TypeScript + React + three.js + React Three Fiber + Vite + WebGPU**

Gameshow is a 3D game-show stage in the browser, being built toward a game of the Monty Hall problem: three crates, one prize, and the question of whether to switch. Today the show plays: the host runs round after round, you pick a crate, and in the Monty Hall game she opens an empty one and offers you the switch. Gift links, sound and a night studio with its own effects are still to come.

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

Gameshow started as plain three.js in JavaScript, and has been rebuilt onto this stack. The live demo runs the rebuild; the original version stays in the repository's history.

## What's in it

- **A title card** with a loading bar while the host and her moves arrive, and the button that starts the show once they have.
- **A game show in rounds.** The host welcomes you, explains the rules and announces each round's prize. You pick one of three numbered crates. In the Monty Hall game she then opens an empty crate and offers you the choice to stay with your pick or switch to the other closed one; in the simple game your pick is your answer. A pause for suspense, then the reveal, and the other crates open to show where the prize was.
- **Two ways to set the prizes.** A fixed ladder of prizes that rise round by round, or prizes set as the show goes, so the total always lands within a range, with a bonus at the end if it falls short.
- **A host** who idles in one of several stances, dances when you win and sulks when you lose. Her lines appear in a speech bubble above her, which never leaves the screen: wherever the view turns, it is moved in from the edge, or clear of the buttons and the tab, only as far as it needs to be.
- **Three crates** whose lids swing open and shut, raising a gold prize or a grey $0 as they open. A gold ring on the floor marks your pick.
- **A tab** that keeps the round and the prize in play, a line for each round you've played, how staying and switching have each paid off in the Monty Hall game, and your total. At the end it stays up as your receipt.
- **A reflective floor** under a sunny sky, with soft shadows and fog in the distance.
- **A camera** that frames the crates, the ring that marks your pick, the host and her speech bubble on any screen, through a wider lens on a phone held upright, and frames them again when the screen turns or resizes. Look around as you like: whenever the show needs the stage, for your pick, your choice to stay or switch, the reveal and a loss, the view glides back, and a touch, a drag or a scroll during the glide hands it straight back to you.
- **Made for phones first.** Buttons big enough for a thumb, a layout for each way the phone is held, with the tab in a corner on a wide screen and above the buttons on a tall one, all of it clear of a notch and the home bar, and the screen kept awake while a show runs, where the browser allows it.
- **A control panel** for choosing the game, its prizes and how many rounds the next show plays, the host's stance, and her reactions and how quickly they blend. It starts folded away on a phone.
- **A frame-rate meter** in the corner.

## Controls

| To | With a mouse | On a touchscreen |
| --- | --- | --- |
| Start the show, stay, switch, go on to the next round or play again | Click the button | Tap the button |
| Pick a crate | Click it | Tap it |
| Stay or switch | Click your crate to stay, or the other closed one to switch | Tap your crate to stay, or the other closed one to switch |
| Skip ahead in what the host is saying | Click the speech bubble | Tap the speech bubble |
| Look around | Drag with the left button | Drag with one finger |
| Zoom | Scroll, or pinch on a trackpad | Pinch |
| Pan | Drag with the right button, or with the left while holding Shift or Cmd | Drag with two fingers |
| Choose the game, or change the host's stance or cue a reaction | Use the control panel | Use the control panel |

Looking around stops a little above level, so the stage is never seen head-on and the floor stays in view, and a pan slides along the floor rather than sinking under it. The zoom has limits either way. A press that turns into a drag looks around rather than picking the crate under it.

## Workflow

- **Planned in phases.** The rebuild followed a written plan. Each phase was one focused thread, and the phases that changed code ended with lint and a type-checked production build passing.
- **Reviewed before it's committed.** Every batch of work goes through `/commit`, a [Claude Code skill](.claude/skills/commit/SKILL.md) that serves as the final code review. It's adapted from a shared [baseline](https://github.com/snovakow/Claude-Skills/tree/main/skills/commit), and it runs in a fresh thread, so the review starts without the author's assumptions. It reads every changed line for bugs, React Three Fiber and three.js pitfalls, type and lint escapes, new dependencies, leftovers and anything that shouldn't be public. Then it runs the checks, splits the work into focused commits with descriptive messages, and keeps this README accurate.
- **Versioned checkpoints.** Versions continue from the prototype's 0.0.0: each reviewed batch ends with a version commit, which marks where the next review starts.
- **Current dependencies.** Packages and tools track their latest releases, and each review reports anything that has fallen behind.
- **Branches and deploys.** Work lands on `development` and reaches `main` by merge. The live site is a static build of `main`.

## Running it locally

You need Node.js 22.18 or later, and a browser with WebGPU or WebGL 2. Then run `npm install`, followed by `npm run dev`, and open the address it prints.

To try it on a phone, run `npm run dev -- --host` instead and open the network address it prints on a phone on the same Wi-Fi. Over plain HTTP the phone renders with WebGL 2, and the screen may dim during a show, since browsers only keep it awake for a secure site.

`npm run lint` and `npm run typecheck` check the code, and `npm test` runs the tests. `npm run build` makes a static site in `dist/`. It uses relative paths, so it works from any folder you copy it to, and `npm run preview` serves it locally.

## Credits

- [three.js](https://threejs.org), including the host model, the textures, the typefaces and the reflection technique from its examples.
- The host's animations come from [Mixamo](https://www.mixamo.com).
- The MgOpen typefaces, under the MAGENTA licence included with them; the Droid fonts, under the Apache License 2.0; Gentilis, from SIL's Gentium, under the SIL Open Font License; and Kenney Fonts, in the public domain.
