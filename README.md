# Gameshow

**TypeScript + React + three.js + React Three Fiber + Vite + WebGPU**

Gameshow is a 3D game-show stage in the browser, being built toward a game of the Monty Hall problem: three crates, one prize, and the question of whether to switch. Today the show plays: the host runs round after round, you pick a crate, and in the Monty Hall game she opens an empty one and offers you the switch. You can also make a show for someone as a gift and send it to them as a link. A studio audience murmurs, applauds, cheers and groans along, in a night studio under spotlights.

**Live demo:** [snovakow.com/gameshow](https://snovakow.com/gameshow/)

## Stack

| | |
| --- | --- |
| [TypeScript](https://www.typescriptlang.org) | Strict types across the whole app |
| [React](https://react.dev) | Components and state for the stage and its panels |
| [three.js](https://threejs.org) | Rendering, lighting, shadows, the reflective floor and the animated host |
| [React Three Fiber](https://r3f.docs.pmnd.rs) | The three.js scene, written as React components |
| [Vite](https://vite.dev) | The dev server and the production build |
| [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) | The GPU API three.js's newer renderer is named for; the effects are written in that renderer's node materials and compute passes, and it draws them with WebGL 2, or with WebGPU itself when asked |

Around them are drei's helpers, a leva control panel, zustand for game state, and Oxlint for linting.

Gameshow started as plain three.js in JavaScript, and has been rebuilt onto this stack. The live demo runs the rebuild; the original version stays in the repository's history.

## What's in it

- **A title card** with a loading bar while the host and her moves arrive, and the button that starts the show once they have. On a gift it greets the recipient by name.
- **A game show in rounds.** The host welcomes you, explains the rules and announces each round's prize. You pick one of three numbered crates. In the Monty Hall game she then opens an empty crate and offers you the choice to stay with your pick or switch to the other closed one; in the simple game your pick is your answer. A pause for suspense, then the reveal, and the other crates open to show where the prize was.
- **Two ways to set the prizes.** A fixed ladder of prizes that rise round by round, or prizes set as the show goes, so the total always lands within a range, with a bonus at the end if it falls short.
- **A host** who idles in one of several stances, dances when you win and sulks when you lose. Her lines appear in a speech bubble above her, which never leaves the screen: wherever the view turns, it is moved in from the edge, or clear of the buttons and the tab, only as far as it needs to be.
- **Three crates** whose lids swing open and shut, raising a gold prize or a grey $0 as they open. A gold ring on the floor marks your pick, and with the glow switched on the crate glows too; with the outline switched on, a gold outline marks it instead, and the crate under the pointer as well.
- **A studio audience** you can hear: applause as the show starts, an "ooh" when the host opens an empty crate, a drumroll that breaks off as your crate opens, a cymbal crash, cheers and applause when you win, an "aww" when you don't, and a big cheer at the finale, with the audience murmuring under it all. A button in the corner turns the sound off or on, and the browser remembers your choice for next time. On an iPhone with iOS 17 or later, the show is heard even with the ringer switched to silent.
- **A tab** that keeps the round and the prize in play, a line for each round you've played, how staying and switching have each paid off in the Monty Hall game, and your total. At the end it stays up as your receipt.
- **A night studio.** A dark sky whose colour keeps drifting round the colour wheel, over a glossy floor that reflects the stage and fades into the night. Rings of light ripple out across the floor and wash over the crates and the host. A key light picks out the host and casts the only shadows, a dim spot stands over each crate, two coloured spots throw turning patterns across the stage, and a low haze lies over the floor. Above it all hangs the show's title in gold letters, ringed by bulbs that chase round it: the show's name in the demo, and on a gift a birthday greeting, or whatever the occasion is, to the person it's for. The gold of the title, the prizes and the crates' numbers shines like polished metal, catching the light of a softly lit room of its own.
- **Celebrations.** A win sends confetti bursting out of the winning crate, to tumble down and lie on the floor a while, and jets of flame roar up at both sides of the stage while the host dances. At the finale fireworks burst over the set and confetti showers down over everything, settling on the floor until the next show. The confetti and the fireworks are moved entirely by the graphics card, thousands of pieces at a time.
- **The daylight stage** the studio replaced, one switch away for comparison: a reflective checkerboard floor under a sunny sky, with soft shadows and fog in the distance.
- **A camera** that frames the crates, the ring that marks your pick, the host and her speech bubble on any screen, through a wider lens on a phone held upright, and frames them again when the screen turns or resizes. Look around as you like: whenever the show needs the stage, as the host explains the game, for your pick and your choice to stay or switch, and before any crate opens, the view glides back, and a touch, a drag or a scroll during the glide hands it straight back to you.
- **Made for phones first.** Buttons big enough for a thumb, a layout for each way the phone is held, with the tab in a corner on a wide screen and above the buttons on a tall one, all of it clear of a notch and the home bar, and the screen kept awake while a show runs, where the browser allows it.
- **A control panel** for choosing the game, its prizes and how many rounds the next show plays in the demo, the host's stance, her reactions and how quickly they blend, how quickly the view glides home, how loud the audience's reactions, the drumroll and crash, and the murmur each play, and the effects: the studio or the daylight stage, a glow around what shines and how bright it is, the outline, how edges are smoothed, the floor's reflection and how glossy it is, the rings and how bright they are, the spotlights and how finely the key light's shadow is drawn, the haze and how thick it is, the title in lights, the gold's shine, the confetti and how many pieces fly, the fireworks, the flame jets, and how sharp the picture is drawn, with presets for a phone, for every effect, and for none, which leaves the studio with its key light alone and draws the daylight stage exactly as it was before there were effects. It starts folded away on a phone and on a gift, whose game is the giver's to choose.
- **A frame-rate meter** in the corner.
- **Shows as gifts.** A page for making one: the recipient's name, who it's from and the occasion, the game, the prizes and their range, the number of rounds, the currency, and the host's lines in your own words if you like. It checks everything as you type, warns when the stage can't draw your currency symbol or a letter of the title in 3D, and previews how shows of your gift tend to end, from thousands played by the rules. The finished show is a link to send; "Try it" plays it without counting.

## Gift links

Open the demo and choose "Make a show as a gift" to reach the gift maker. Everything about the show lives in the link itself, after the `#`, the part of a web address a browser never sends to a server, so nothing about a gift is stored anywhere but the browser that plays it. The encoding keeps the amounts out of sight at a glance, but it isn't secret, so don't put anything private in a gift.

A gift is played once. Its browser remembers how far it got: reopen the link and the show carries on from the round after the last one decided, and a finished show reopens on its final tab. The gift maker can forget a link's progress in the browser it runs in. A link that has been cut short or changed shows a message saying so, rather than a broken show.

## Controls

| To | With a mouse | On a touchscreen |
| --- | --- | --- |
| Start the show, stay, switch, go on to the next round or, in the demo, play again | Click the button | Tap the button |
| Pick a crate | Click it | Tap it |
| Stay or switch | Click your crate to stay, or the other closed one to switch | Tap your crate to stay, or the other closed one to switch |
| Skip ahead in what the host is saying | Click the speech bubble | Tap the speech bubble |
| Look around | Drag with the left button | Drag with one finger |
| Zoom | Scroll, or pinch on a trackpad | Pinch |
| Pan | Drag with the right button, or with the left while holding Shift or Cmd | Drag with two fingers |
| Choose the demo's game, change the host's stance or cue a reaction, or switch the effects | Use the control panel | Use the control panel |
| Make a show as a gift | Choose "Make a show as a gift" on the title card | Tap "Make a show as a gift" on the title card |
| Turn the sound off or on | Click the speaker button at the top left | Tap the speaker button at the top left |

Looking around stops a little above level, so the stage is never seen head-on and the floor stays in view, and a pan slides along the floor rather than sinking under it. The zoom has limits either way. A press that turns into a drag looks around rather than picking the crate under it.

## Workflow

- **Planned in phases.** The rebuild followed a written plan. Each phase was one focused thread, and the phases that changed code ended with lint and a type-checked production build passing.
- **Reviewed before it's committed.** Every batch of work goes through `/commit`, a [Claude Code skill](.claude/skills/commit/SKILL.md) that serves as the final code review. It's adapted from a shared [baseline](https://github.com/snovakow/Claude-Skills/tree/main/skills/commit), and it runs in a fresh thread, so the review starts without the author's assumptions. It reads every changed line for bugs, React Three Fiber and three.js pitfalls, type and lint escapes, new dependencies, leftovers and anything that shouldn't be public. Then it runs the checks, splits the work into focused commits with descriptive messages, and keeps this README accurate.
- **Versioned checkpoints.** Versions continue from the prototype's 0.0.0: each reviewed batch ends with a version commit, which marks where the next review starts.
- **Current dependencies.** Packages and tools track their latest releases, and each review reports anything that has fallen behind.
- **Branches and deploys.** Work lands on `development` and reaches `main` by merge. The live site is a static build of `main`.

## Running it locally

You need Node.js 22.18 or later, and a browser with WebGL 2. Then run `npm install`, followed by `npm run dev`, and open the address it prints.

To try it on a phone, run `npm run dev -- --host` instead and open the network address it prints on a phone on the same Wi-Fi. The screen may dim during a show there, since browsers only keep it awake for a secure site.

The stage draws with WebGL 2 on every device, since WebGPU's compute passes, which move the confetti and the fireworks, fail on some graphics cards. To try it with WebGPU instead, add `?webgpu` to the address, in a browser that has it; WebGPU needs a secure site, so a phone on the network address gets WebGL 2 either way. The browser's console says which of the two is drawing.

`npm run lint` and `npm run typecheck` check the code, and `npm test` runs the tests. `npm run build` makes a static site in `dist/`. It uses relative paths, so it works from any folder you copy it to, and `npm run preview` serves it locally.

## Credits

- [three.js](https://threejs.org), including the host model, the textures, among them the two noise textures the flames are drawn from, and the typefaces, and the techniques of its examples for the reflective floors, the studio's sky, rings and glossy reflection, the patterns its coloured spots project, the haze, the gold's shine, the confetti, the fireworks and the flames.
- The host's animations come from [Mixamo](https://www.mixamo.com).
- The audience's sounds are public-domain (CC0) recordings by Joseph Sardin of [BigSoundBank](https://bigsoundbank.com), ShangusBurger (Shane Vincent), noah0189 and phmiller42 on [Freesound](https://freesound.org), and Ddis tts on [Wikimedia Commons](https://commons.wikimedia.org), each cut and re-encoded for the show. [The audio folder's README](public/audio/README.md) lists every file and its source.
- The MgOpen typefaces, under the MAGENTA licence included with them; the Droid fonts, under the Apache License 2.0; Gentilis, from SIL's Gentium, under the SIL Open Font License; and Kenney Fonts, in the public domain.
