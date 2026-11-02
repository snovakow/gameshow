# Port plan: Gameshow to React Three Fiber

This plan replaces Gameshow's vanilla JavaScript prototype (three.js with its WebGPU renderer, built with Vite) with a Vite + React + TypeScript app built on React Three Fiber (R3F), still rendering with three's WebGPU renderer. The end result looks as if the project had been created that way from the start. You run the terminal steps yourself. Each phase that changes code has a prompt to paste into a fresh Claude Code thread in this repository, and every phase ends with `/commit`.

The prompts send the agent back to this file, so it is the single source of truth: if you disagree with a default under **Decisions**, edit it here before running the phase that uses it.

Latest versions on 2026-10-30, when this was last checked: three.js r187 (`three@0.187.0`), `@react-three/fiber` 9.8, `@react-three/drei` 10.7, create-vite 9.3 with Vite 8.3, React 19.3, TypeScript 7.0, Oxlint 1.90, Node.js 24.22 LTS and npm 12.2. The same stack was checked in a scratch copy of the template: installed at those versions, a WebGPU scene in Appendix C's shape type-checks with TypeScript 7, passes Oxlint's type-aware rules with warnings failing, and builds with Vite.

## 1. Where it ends up

```
gameshow/
├── .claude/skills/commit/      the /commit skill, a copy of the Claude-Skills baseline (section 5)
├── docs/react-port-plan.md     this plan, deleted in Phase 8
├── public/                     the prototype's assets, moved from src/public/
│   ├── animations/             the host's Mixamo clips (.fbx)
│   ├── fonts/                  typeface JSON for the prize text, with their licences
│   ├── models/gltf/            Michelle.glb, the host
│   └── textures/               the crate and the checkerboard floor
├── src/
│   ├── main.tsx                React root, in StrictMode
│   ├── App.tsx                 the <Canvas> and the DOM overlays
│   ├── index.css               full-window layout, the page's colours and type
│   ├── store.ts                zustand: crate and game state
│   └── stage/                  Stage, renderer.ts (the WebGPU renderer guard), Lights, Backdrop,
│                               Floor, Crate, Prize, Host, useHostAnimations
├── index.html                  title, analytics, #root
├── vite.config.ts              base: '' for relative asset paths
├── .oxlintrc.json              lint rules (D1)
├── tsconfig.json, tsconfig.app.json, tsconfig.node.json
├── package.json, package-lock.json   with one npm override, so every package shares the same three (D14)
├── gameshow.code-workspace
└── README.md                   for the public
```

Gone: `vite.config.js` with its `root: "src"` layout; `src/index.html` with an import map copied from three's examples; `src/index.js`, `src/scene.js` and `src/main.css`; `src/.vscode/`; and the old `package.json`, which asked for `three >=0.178.0`.

Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `lint`, `lint:fix`, `typecheck`.

The prototype stays readable at commit `2655da8`, the last before the port, for example `git show 2655da8:src/index.js`.

## 2. Decisions

These are the defaults the prompts follow. Change a row before running the phase it affects.

| # | Topic | Default | Alternative |
| --- | --- | --- | --- |
| D1 | Linter (chosen in Phase 2, configured in Phase 3) | **Oxlint**, create-vite's default: its React and TypeScript rules plus type-aware rules, with warnings failing `npm run lint`. Its React rules include React Compiler-style checks, such as `react(immutability)`, which flag mutating what a hook returned; Appendix C's patterns satisfy them, so they stay on | **ESLint** (pick it at the prompt or pass `--eslint`), with `@react-three/eslint-plugin`'s two allocation-in-loop rules |
| D2 | React Compiler | Off (the plain "TypeScript" variant) | `react-compiler-ts`: little to gain in a frame-loop app, and slower builds |
| D3 | Control panel | **leva**, with the lil-gui panel's controls, ranges and defaults. It shows numbers to two decimals at most, which is why Bounder's port dropped it for lil-gui; both Durations (0 to 5, default 0.5) fit | Keep **lil-gui**, created in an effect and destroyed on unmount |
| D4 | State | **zustand** for crate and game state, ready for the game rules | React state inside the stage |
| D5 | Game rules | Not part of the port. The Monty Hall rules (pick a crate, the host opens another, switch or stay) are the first feature after it | |
| D6 | Analytics | Keep the gtag snippet as the live page has it, on every host | Load it only on snovakow.com |
| D7 | Leftovers from three's example | Drop the "three.js webgpu - reflection" info line, the unused import map, the empty module script, and the CSS nothing uses (B1, B2, B10) | Keep them |
| D8 | Assets | Move all of `src/public/` to `public/` unchanged, including fonts and files nothing loads yet | Prune what nothing loads (every font but optimer bold, the TTF) to shrink the deploy |
| D9 | Build output | `dist/` with `base: ''`; deploy by replacing the contents of `~/Sites/localhost/live/gameshow/` with `dist/` | `build.outDir` pointing straight at the live folder |
| D10 | Version | Versions continue where the prototype left off: its `package.json` never left `0.0.0`, the number the Vite template also writes, so nothing needs carrying over. Only `/commit` changes them, each time with a version commit that becomes the next run's baseline (section 5). Phase 2's `/commit 0.0.1` makes the first, on the template's `package.json`; every run after it bumps the last number; Phase 8's `/commit 0.1.0` marks the first release, the one merged into `main` and deployed. Phase 0's run passes no version, so it ends without one, and pushing closes it | Keep bumping the last number at the release too, as timspicks does |
| D11 | The prototype's defects | Fix them as Appendix B says; strict TypeScript rejects several anyway | Port them as they are |
| D12 | This plan | Deleted in Phase 8, before the merge to `main`; git history keeps it | Keep it under `docs/` |
| D13 | Renderer | three's **`WebGPURenderer`**, as now, created by an async `gl` factory on the Canvas that awaits `renderer.init()`. Where a browser lacks WebGPU it falls back to its own WebGL 2 backend. The floor's TSL reflection, the node-based background and `MeshPhongNodeMaterial` carry over unchanged (Appendix C) | |
| D14 | Versions | **Latest of everything** at install time, and again whenever `/commit` reports something behind (`npm outdated`). create-vite's template already pins TypeScript 7.0. One npm override, `"three": "$three"`, makes drei's `stats-gl` share the app's three instead of bundling its own. Deliberate holds: Node.js 24 LTS, because Node 26 won't start on this Mac's macOS 12.7 (it needs 13.5); `@types/node` 24 to match it; and React within R3F's peer range (19.0 to 19.3, which is also the latest today) | Keep the template's pins |
| D15 | The host's animations | Keep them. They're Mixamo downloads (their files say so), and this repository is public; check that Adobe's terms let you publish the raw files, and if not, keep them out of the repository and deploy them separately | Remove them from the repository now |

## 3. How to run a phase

1. Read the phase, and do its **You** steps: git steps in GitHub Desktop, and the rest in a terminal at the repository root.
2. Open a fresh Claude Code thread in this repository and paste the phase's **Prompt**. The agent reads this file, does that phase only, runs the checks, and summarises without committing.
3. Do the phase's **Check** yourself and ask for fixes in the same thread.
4. Open another fresh thread and run `/commit` with a note naming the phase, such as `/commit Phase 4 of docs/react-port-plan.md`. It has to be the thread's first message: the skill stops otherwise, because a thread that wrote the code can't review it from the repository alone. The note lets it read the phase for intent. It fixes what it can in commits that aren't pushed yet, such as a vague message, and asks before committing over a failing check or anything else it can't settle.
5. Start the next phase in a new thread.

If a phase goes badly, GitHub Desktop's Changes tab shows what it touched. **Branch → Discard All Changes…** puts the changed files back and moves the new ones to the Trash. Check the list first: it also discards anything else that isn't committed, such as Phase 1's moves while Phase 2 is under way. Then run the prompt again.

## 4. Phases

### Before Phase 0: bring the tools up to date

**You**

Node and npm are installed for the whole Mac, so Bounder's port already did steps 1 and 2: on 2026-11-02 this Mac had Node.js 24.22.2, the latest LTS, and npm 12.2.1, the latest. Run the check at the end of step 2, and repeat the steps only if it shows something older.

1. **Node.js 24.22.2**, the latest LTS. Install it with the macOS installer (the x64 `.pkg`) from nodejs.org, into `/usr/local/bin`. Node 26 is newer, but it fails to start on this Mac's macOS 12.7.6 (`dyld: Symbol not found` in `libc++`); its builds need macOS 13.5 or later. Node 24 stays supported until April 2028, and upgrading macOS is what would unlock Node 26.
2. **npm 12**, which needs Node 24.15 or later, so it comes after Node. The installer's global folder belongs to root, hence `sudo`:

   ```sh
   sudo npm install -g npm@latest
   node -v && npm -v
   ```

   Expect v24.22.2 or a later 24.x, and 12.x.

   `sudo npm` can leave root-owned files in your npm cache, and then later installs fail with `EACCES` under `~/.npm/_cacache`. Hand the cache back to yourself:

   ```sh
   sudo chown -R "$(id -un)":staff ~/.npm
   ```

3. **git**, optionally. Apple's 2.37.1 is the newest its command-line tools offer on macOS 12, and the current release is 2.56. Homebrew supports macOS 12 only at its lowest tier, building from source, and MacPorts is the other route. The `/commit` skill works with 2.37 either way.

### Phase 0: switch to development, commit this plan and the skill, and push

**You**

1. Work lands on `development` and reaches `main` by merge. GitHub has a `development` branch level with `main`; check it out: in GitHub Desktop, choose **Current Branch → `development`**. If Desktop asks what to do with your uncommitted changes, bring them to `development`.

2. In a fresh Claude Code thread here, run `/commit Plan and tooling for the React port`. Expect separate commits for the `/commit` skill, the public README, this plan, and the workspace, which now opens the repository root instead of `src/` and replaces the deleted `src/.vscode/settings.json` (Phase 3's step 7, done ahead). There's no version commit yet: the prototype's `package.json` is about to be replaced, so the first one waits for the template's, in Phase 2 (D10). Nothing here changes code, so no checks need to run; the prototype's `test` script is npm's placeholder, which always fails.
3. Push `development`: click **Push origin**.

   Until the first version commit, a run's baseline is the newest pushed commit, so pushing is what closes this run. Without the push, Phase 2's run would ask about these commits before reading them; answering that it should keep them all, as already reviewed, does the same.

### Phase 1: remove the vanilla setup and move the assets

**You**

GitHub Desktop's Changes tab should show no changes. Then, in a terminal:

```sh
mv src/public public
rm package.json package-lock.json vite.config.js src/index.html src/index.js src/scene.js src/main.css
rm -f src/.DS_Store
rmdir src
```

`src/.DS_Store` is Finder's, and git ignores it. `rmdir` fails if anything else is left in `src/`. The Changes tab now shows the seven prototype files deleted and the 30 assets moved from `src/public/` to `public/`. If an old `node_modules` folder is here from the vanilla setup, delete it with `rm -rf node_modules`; Phase 2 installs afresh. Don't commit yet; Phase 2's `/commit` commits both phases together.

### Phase 2: scaffold Vite in place and install the 3D stack

**You**

1. Scaffold into this folder:

   ```sh
   npm create vite@latest . -- --template react-ts
   ```

   Answer its prompts like this:
   - *Current directory is not empty*: **Ignore files and continue**. Not "Remove existing files", which deletes everything except `.git`, including `.claude/`, `docs/` and the moved assets. Since everything but the moves is committed, **Discard All Changes** in GitHub Desktop would bring it back, with the assets in `src/public/` again for Phase 1 to redo, but don't.
   - *Which linter to use?*: **Oxlint** (D1).
   - *Install with npm and start now?*: **No**.

   It writes the template's files into the folder, overwriting `README.md` and `.gitignore`, and adds its two icons to `public/`. Keep its `.gitignore`, which already covers `.DS_Store`, and bring back the public README: in GitHub Desktop's Changes tab, right-click `README.md` and choose **Discard Changes…**.

2. Install everything at its latest version (D14): the template's own packages, which create-vite pins a little behind, and the 3D stack. Then add the override that makes every package share the app's three, and install once more to apply it. The template's `package.json` says `0.0.0`, where the prototype's version left off (D10), so leave that alone.

   ```sh
   npm install
   npm install react@latest react-dom@latest three@latest @react-three/fiber@latest @react-three/drei@latest leva@latest zustand@latest
   npm install --save-dev vite@latest @vitejs/plugin-react@latest typescript@latest oxlint@latest @types/react@latest @types/react-dom@latest @types/three@latest @types/node@24
   npm pkg set 'overrides.three=$three'
   npm install
   ```

   Leave out `leva` or `zustand` if you changed D3 or D4. npm 12 runs no install scripts that haven't been approved, so it warns that `fsevents`' was skipped. That's harmless: it's an optional macOS file watcher, and the dev server, lint and build work without it.

3. Check that there is one three.js, with types from the same release, and that nothing is behind:

   ```sh
   npm ls three @types/three
   npm outdated
   ```

   Expect `three@0.187.x` (or newer) everywhere, deduped under fiber, drei, three-stdlib and stats-gl, and `@types/three` at the same minor version. `npm outdated` should list only `@types/node`, held at 24 to match Node (D14). If npm reports a React peer conflict, it's because R3F 9 accepts React 19.0 to 19.3, so a newer React has come out: run `npm install react@~19.3 react-dom@~19.3`, and hold it there until R3F catches up.

4. Check the untouched template: run `npm run dev` and open the URL it prints (stop it with Ctrl+C), then `npm run lint` and `npm run build`.
5. In a fresh thread, run `/commit 0.0.1 Phases 1 and 2 of docs/react-port-plan.md`. Expect separate commits for removing the vanilla setup, moving the assets into `public/`, and the scaffold with its dependencies, then `Version 0.0.1`, the first version commit (D10). From here on, every run ends with one.

### Phase 3: app shell and tooling

**Prompt**

```text
Read docs/react-port-plan.md: sections 1 and 2, Phase 3, and Appendix C. Carry out Phase 3 only: turn the fresh create-vite scaffold into Gameshow's app shell and tooling. The prototype's code is at commit 2655da8 (git show 2655da8:<file>). If the plan turns out to be wrong or impossible somewhere, stop and tell me instead of improvising. Don't commit. Finish with npm run lint, npm run typecheck and npm run build passing, then summarise what changed and anything you couldn't do.
```

**The work**

1. Remove the template's demo: `src/App.css`, `src/assets/`, `public/icons.svg`, and `public/favicon.svg` with its `<link>`. `src/App.tsx` renders a full-window `<Canvas>` with nothing in it yet.
2. `index.html`: `lang="en"`, the title "Gameshow", a one-line meta description, the gtag snippet exactly as the prototype's `src/index.html` has it (D6), and the prototype's viewport meta, which stops pinch-zoom from scaling the page. Keep `#root` and the module script. Leave out the import map, the empty module script and the info line (D7).
3. `src/index.css`: only what the app needs. `html`, `body` and `#root` fill the window with no margin and no scrollbars, on the prototype's black background with white 13px monospace text.
4. `vite.config.ts`: `base: ''` (D9), with a one-line comment saying why. The WebGPU build of three makes one chunk of about 2 MB, so raise `build.chunkSizeWarningLimit` to cover it rather than splitting chunks; it's one scene.
5. `package.json`: add `"typecheck": "tsc -b"` and `"lint:fix": "oxlint --fix"` to the template's scripts. Leave the version alone; only `/commit` changes it (D10).
6. `.oxlintrc.json` (D1): keep the template's plugins and rules, and:
   - ignore `.claude/**`, whose `/commit` scan script stays word for word the Claude-Skills baseline (section 5) and fails type-aware `require-array-sort-compare` on two sorts
   - make the `correctness` category errors, and add `suspicious` as warnings
   - turn off `react/react-in-jsx-scope`, which `suspicious` brings in and React's automatic JSX runtime makes obsolete; with warnings failing, it would fail every `.tsx` file
   - make warnings fail the run (`options.denyWarnings`)
   - turn on type-aware rules: `npm install --save-dev oxlint-tsgolint@latest`, then `options.typeAware`. This was checked with TypeScript 7; if it fails anyway, stop and say why.
   - leave the React Compiler-style rules, such as `react(immutability)`, on, and write code that satisfies them (Appendix C, item 9)
7. `gameshow.code-workspace`: already done and committed in Phase 0 (its folder is `.`, with `files.exclude` and `search.exclude` set), so leave it alone.
8. `README.md`: keep "Running it locally" accurate for the new setup, with Node.js 22.12 or later, which Vite 8 and drei's camera-controls need. Keep its public voice.

**Check** `npm run dev` shows an empty page with no console errors, and the elements panel shows a `<canvas>` filling the window, two `<div>`s down (`#root > div > div > canvas`), where R3F nests it. Expect one console warning, `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` It's R3F's: R3F 9 still makes a `THREE.Clock`, which three deprecated in r183. It needs nothing, and it goes once a stable R3F 10 replaces the clock.

### Phase 4: the stage

**Prompt**

```text
Read docs/react-port-plan.md: section 2, Phase 4 and Appendices A, B and C. Carry out Phase 4 only: port the renderer, camera, controls, lights, fog, background and reflective floor from src/index.js and src/scene.js to React Three Fiber. The prototype's code is at commit 2655da8 (git show 2655da8:<file>). Match Appendix A's values exactly. If the plan turns out to be wrong or impossible somewhere, stop and tell me instead of improvising. Don't commit. Finish with npm run lint and npm run build passing, then summarise, listing anything that doesn't match Appendix A and what I should look at in the browser.
```

**The work**

- `App.tsx`: the `<Canvas>`, with static props (Appendix C, items 1 to 4):
  - `gl`: an async factory that creates three's `WebGPURenderer` with antialiasing and awaits its `init()` (D13), then logs once with `console.info` whether it got WebGPU or the WebGL 2 fallback
  - camera: fov 50, near 0.25, far 30, at (1, 2, 4)
  - `flat`, because the prototype sets no tone mapping
  - `shadows="percentage"`, which is PCF, the prototype's default
  - a `dpr` that allows the full device pixel ratio, as before
- `src/stage/renderer.ts`: `asWebGPU()`, the guard that hands components the `WebGPURenderer` that R3F types as a `WebGLRenderer` (item 2).
- `src/stage/Stage.tsx` composes the stage: drei's `<OrbitControls makeDefault enableDamping={false} />` with Appendix A's limits and target, the lights, the backdrop, the floor, and drei's `<Stats />`.
- `Lights`: the sun and its shadow, and the two hemisphere lights (Appendix A).
- `Backdrop`: the fog, and the TSL gradient set as the scene's `backgroundNode` (item 7).
- `Floor`: the plane, its `MeshPhongNodeMaterial` with the checkerboard and the TSL reflection, offset by the normal map, as in the prototype (items 5 and 6).

**Check** The console says whether WebGPU or its WebGL 2 fallback is rendering; current Chrome, Edge and Safari should get WebGPU. The stage matches the live demo without the crates and the host: the blue gradient sky, the fog, the checkerboard floor reflecting what's above it, and the orbit limits (no going below the floor, zoom between 1 and 10).

### Phase 5: crates and prizes

**Prompt**

```text
Read docs/react-port-plan.md: section 2, Phase 5 and Appendices A, B and C. Carry out Phase 5 only: port the crates, their lids and the prize text from src/index.js. The prototype's code is at commit 2655da8 (git show 2655da8:<file>). Match Appendix A's values exactly. If the plan turns out to be wrong or impossible somewhere, stop and tell me instead of improvising. Don't commit. Finish with npm run lint and npm run build passing, then summarise, listing anything that doesn't match Appendix A and what I should look at in the browser.
```

**The work**

- `src/store.ts` (zustand, D4): each crate's prize label and open state, with an `open(crate)` action. Shape it so the game rules (D5) can drive it later.
- `Crate`: the five sides and the hinged lid as Appendix A describes them, with the crate texture, its own material, and shadows. Clicking a crate opens it through R3F's `onClick` (item 11; B4), and `useFrame` swings the lid with the prototype's ease, through refs (items 9 and 12).
- `Prize`: the prize text in each crate, built with three's own `FontLoader` and `TextGeometry` (item 8), rising with the lid. Build only the three prizes that are shown (B6).

**Check** Three crates sit where the live demo has them. Clicking one swings its lid open over a second and raises its gold prize; clicking it again replays the opening, as the prototype does (B8). Clicking the panel never opens a crate behind it.

### Phase 6: the host and the panel

**Prompt**

```text
Read docs/react-port-plan.md: section 2, Phase 6 and Appendices A, B and C. Carry out Phase 6 only: port the animated host and the stance and pose panel from src/index.js. The prototype's code is at commit 2655da8 (git show 2655da8:<file>). Match Appendix A's values exactly. If the plan turns out to be wrong or impossible somewhere, stop and tell me instead of improvising. Don't commit. Finish with npm run lint and npm run build passing, then summarise, listing anything that doesn't match Appendix A and what I should try in the browser.
```

**The work**

- `Host`: `models/gltf/Michelle.glb` placed and turned as Appendix A says, cloned before anything on it changes, with shadows on its skinned mesh found by type rather than by its position in the hierarchy (items 8 and 10; B5).
- `useHostAnimations`: the nine FBX clips loaded with three's own `FBXLoader`, each clip cloned and named, the mixer and actions from drei's `useAnimations`, and the prototype's fades: stances loop, poses play once and hold their last frame, and a finished pose fades back to the current stance (item 9). Nothing runs before the model and its clips are in (B3).
- The panel, in leva (D3): a Stances folder with Duration and Stance, and a Poses folder with Duration and a button per pose, with Appendix A's ranges and defaults.

**Check** The host idles in "Idle Simple". Changing the stance blends to it over the Duration; each pose button plays its reaction once, then blends back to the stance. Pressing a pose button straight after the page loads does nothing harmful.

### Phase 7: parity review and README

**Prompt**

```text
Read docs/react-port-plan.md in full. Carry out Phase 7 only: review the finished port against Appendices A, B and C and the prototype at commit 2655da8 (git show 2655da8:<file>), fix differences that aren't intended, remove leftovers, and bring README.md up to date for the public. Don't commit. Finish with npm run lint, npm run typecheck and npm run build passing; then serve the build with npm run preview and confirm that the page and every asset it references load with HTTP 200 (curl is fine). Summarise what you fixed, what still differs from Appendix A and why, and give me a checklist to walk through in the browser.
```

**The work**

- Go through Appendix A line by line against the code. Fix what differs unintentionally, and list the deliberate differences, such as D3, D7 and the Appendix B fixes.
- Remove leftovers: template files or text (the Vite and React logos, "Vite + React", `App.css`), dependencies nothing imports (compare `npm ls --depth=0` with the imports), `any` or lint suppressions without a stated reason, and `console.log`.
- README.md, for a public reader. Keep the stack line, the Stack table and the Workflow section, and bring the rest up to date: what Gameshow is, the live demo, what's in it, the controls, running and building it (`npm run build` makes a static site in `dist/` that works from any folder), its status (the rebuild is done and the live demo runs it, as a present fact, since Phase 8 merges and deploys straight after this phase), and credits. No file paths or internal values; keep the existing voice. Keep the link to this plan for now; Phase 8 removes it.

**You** Walk the agent's checklist in `npm run dev` and again in `npm run preview`. Then, in a fresh thread, run `/commit Phase 7 of docs/react-port-plan.md`.

### Phase 8: merge and deploy

**You**

1. Delete this plan. Read the rest of this phase first; afterwards it is only in git history. `git show $(git rev-list -n 1 HEAD -- docs/react-port-plan.md)^:docs/react-port-plan.md` prints the last version before the deletion.

   ```sh
   rm docs/react-port-plan.md
   rmdir docs
   ```

   Then, in a fresh thread, run `/commit 0.1.0 Remove the port plan now that the port is done`. The scan lists the plan among the deleted files, and the run drops the README's link to it in the same batch. Its last commit is `Version 0.1.0`, the first release (D10).
2. Merge and push, in GitHub Desktop:
   1. With `development` checked out, choose **Branch → Merge into Current Branch…** and pick `main`. It should say `development` is already up to date with it, meaning `main` has no commits that `development` lacks; close the dialog. If it finds commits instead, merge them, run `/commit` if the merge needs fixes, and start this step again.
   2. Switch **Current Branch** to `main`, choose **Branch → Merge into Current Branch…**, and merge `development`. Since `main` has nothing of its own, this fast-forwards, with no merge commit.
   3. Click **Push origin**, then switch back to `development` and click **Push origin** there too, so GitHub's `development` matches `main`.
3. Build and deploy:

   ```sh
   npm ci
   npm run build
   ```

   Replace the contents of `~/Sites/localhost/live/gameshow/` with those of `dist/`, then publish `live/` to snovakow.com the way you do for the other sites. The new build has the same asset folders plus a fresh `assets/`, so the old `assets/` files can go.
4. Open https://snovakow.com/gameshow/ and check that the stage loads with no 404s, and that the Network panel shows gtag.

## 5. The /commit skill

`.claude/skills/commit/` holds `/commit`, the final review before work enters the repository's history. It's a project copy of the generic skill in [Claude-Skills](https://github.com/snovakow/Claude-Skills/tree/main/skills/commit). Its steps, and its scan below the scan's settings, are the baseline's word for word, and its frontmatter adds only a grant for `npm outdated`. What's Gameshow's own is the two settings blocks, one at the top of `SKILL.md` and its twin at the top of `scripts/scan.mjs`, and a short "Rules of this repository" section. `metadata.baseline` in the frontmatter dates the baseline it came from, and "Keeping a copy current" in the baseline's README has the diffs that compare a copy with it and the way to bring one up to date.

It runs only when you type it, on Opus at max effort, and only as the first message of a fresh thread. `/commit [x.y.z] [notes]`:

- **Surveys** with `git fetch` and a read-only scan, and stops to ask about:
  - a merge, rebase or similar in progress, or a detached HEAD
  - being on `main`, or behind the upstream
  - a version changed by hand
  - credentials or session data in added lines
  - a file that looks like it shouldn't be tracked, or a large one. Among these are `node_modules`, `dist`, `.env` files, personal Claude settings, keys, and the prototype's layout coming back. Large means over 4 MB here, above the host's model and clips.
  - before the first version commit, commits above the newest pushed commit, which it asks about before reading any
- **Reviews** every commit since the baseline, the working-tree diff and every untracked file, in full. It checks messages against diffs, comments against code, references a public reader can't follow, and leftovers. Gameshow's rules add a code review: correctness, React and R3F lifecycle, what `WebGPURenderer` can't run, type and lint escapes, and new dependencies and assets.
- **Runs the checks**, `npm run lint`, `npm run typecheck` and `npm run build`, and asks before committing over a failure. Then it runs `npm outdated` and lists what has fallen behind, apart from D14's holds. It never installs or upgrades anything.
- **Fixes what it can** in unpushed commits after the baseline, such as a vague or file-name subject. It amends the tip, or folds `fixup!` and `amend!` commits in with one autosquash rebase and checks that the fold changed no files. Pushed commits are reported, never rewritten.
- **Commits** the batch, planned first: one concern per commit, the file as the unit, explicit paths, and an order in which each commit stands on its own. Subjects are imperative and at most 72 characters. Bodies say why and what was verified, and end with the thread's co-author trailer.
- **Keeps README.md true** for the public. This plan is yours: it commits the plan but never edits it, and says when a change makes it inaccurate.
- **Ends with a version commit** once they've started (D10). Its message is `Version X.Y.Z` alone, by snovakow, with no trailer, and it touches only `package.json` and `package-lock.json`. It's the next run's baseline, and since it's in the history it holds in every clone. Before the first one, a run ends without a version commit, and pushing is what closes it.
- **Reports** what it flagged, each commit, what it left out and why, the checks and their results, and whether the live site needs a rebuild after the merge. It also gives the undo point, `git reset --soft <start>`. It never pushes, never changes branches, and never discards your work.

After the report, more work in the same thread is ordinary development. Once a run has ended with a version commit, that work can be committed as usual, and the next run reviews it. Before then it stays uncommitted, because nothing would tell it apart from the run's own commits.

## Appendix A: behaviour reference

What the prototype does, for the port to match. D7 and the Appendix B fixes are the intended differences.

**Renderer and camera**

- Renderer: `WebGPURenderer`, antialiased; the pixel ratio follows `window.devicePixelRatio` and the size follows the window; shadows on, with the default type, PCF; no tone mapping; sRGB output.
- Perspective camera: fov 50, near 0.25, far 30, at (1, 2, 4). Its `lookAt(0, 1, 0)` is overridden by the controls' target.
- OrbitControls with three's defaults (no damping), plus: minimum distance 1, maximum distance 10, maximum polar angle π/2, so the view never goes below the floor, and target (0, 0.5, 0).
- three's Stats FPS meter in the top-left corner.

**Sky, fog and light**

- Background: the TSL node `normalWorldGeometry.y.mix(color(0x0487e2), color(0x0066ff))`, a vertical gradient from sky blue to a deeper blue.
- Fog: linear, colour 0x0487e2, from 7 to 25.
- Sun: a directional light, colour 0xFFE499, intensity 5, at (0.5, 2, 0.5), aimed at the origin, casting shadows. Its orthographic shadow camera spans ±2, near 0.1, far 5; map 2048 × 2048, bias −0.005, shadow intensity 1, radius 3.
- Two hemisphere lights: one with sky 0x333366, ground 0x74ccf4 and intensity 5; one with sky 0x74ccf4, ground black and intensity 1.

**Floor**

- A 50 × 50 plane, rotated −π/2 about x at the origin, receiving shadows.
- `MeshPhongNodeMaterial` whose `colorNode` is the checkerboard texture, its UVs multiplied by 15, plus the reflection.
- Textures: `textures/floors/FloorsCheckerboard_S_Diffuse.jpg` (sRGB, repeating) and `…_Normal.jpg` (repeating). The normal map doesn't light the floor; it ripples the reflection, by adding `texture(normal, uv × 15).xy × 2 − 1`, times 0.02, to the reflection's UVs.
- Reflection: TSL `reflector({ resolution: 0.5 })`, half the render resolution, whose target is rotated −π/2 about x and added to the scene.

**Crates**

- Three crates of size 0.75, centred at y = 0.375, at (−1.5, 0), (0, −1.5) and (1.5, 0) on x and z.
- Each is a group of five planes, all casting and receiving shadows: the bottom, raised by 0.03, then the back, front, right and left. A lid group hinged at the top back edge holds the top plane. Each crate has its own `MeshPhongMaterial`, with `textures/crate.gif` at anisotropy 4, double-sided.
- Clicking anywhere on a crate opens it: the lid swings to −0.6π about x over one second with a cosine ease, `0.5 − cos(πt) / 2`. It stays open; clicking again restarts the swing from closed.

**Prizes**

- The text "$0", "$1" and "$2", one per crate, in `fonts/optimer_bold.typeface.json`: size 0.375, depth 0.015, curve segments 4, no bevel, in one shared gold `MeshPhongMaterial` (0xFFD700), casting and receiving shadows.
- Centred on x, at z = −depth / 2, starting at y = −0.1 inside the crate and rising by up to 0.75 with the lid's ease.

**Host**

- `models/gltf/Michelle.glb`, rotated −π/2 about x, at z = 1, its skinned mesh casting and receiving shadows, driven by an `AnimationMixer`.
- Clips, the first in each FBX file under `animations/`:
  - Stances, looping: "Idle Simple" (`Idle2.fbx`, the one it starts in), "Idle" (`Idle.fbx`), "Idle Briefcase" (`Standing W_Briefcase Idle.fbx`).
  - Poses, played once and held on their last frame: "Defeated", "Rejected", "Sad" (`Sad Idle.fbx`), "Samba Dancing", "Samba Dancing 2" and "Samba Dancing 3".
- A change fades the current action out and the new one in over the duration, after resetting the new one to time scale 1 and weight 1. A finished pose fades back to the current stance over the pose duration.

**Panel** (lil-gui)

| Folder | Control | Range | Default |
| --- | --- | --- | --- |
| Stances | Duration | 0 to 5 | 0.5 |
| Stances | Stance | the three stances | Idle Simple |
| Poses | Duration | 0 to 5 | 0.5 |
| Poses | a button per pose | | |

**Page**: the title "Gameshow"; no margin, a black background and white 13px monospace text; a viewport that disables user scaling; and gtag with measurement ID G-DV1KLMY93N on every host.

## Appendix B: defects in the prototype

| # | Where | Defect | In the port |
| --- | --- | --- | --- |
| B1 | `src/index.html` | An import map copied from three's examples points at `../build/three.js` and `./jsm/`, which don't exist; Vite resolves `three` itself and never uses it. An empty inline module script follows | Dropped (D7) |
| B2 | `src/index.html` | The info line credits three's "webgpu - reflection" example rather than describing the game | Dropped (D7) |
| B3 | `src/index.js`, pose buttons | Pressing one before the model has loaded throws, because `mixer` is still null when the `finished` listener is added | Nothing runs before the model and its clips are in |
| B4 | `src/index.js`, `onWindowClick` | Clicks are taken from the whole window, so a click on the lil-gui panel raycasts into the scene and can open a crate behind it | R3F's events, which only come from the canvas |
| B5 | `src/index.js`, model setup | Shadows are set on `model.children[0].children[0]`, which depends on the GLB's hierarchy | Set them on the skinned mesh, found by type |
| B6 | `src/index.js`, `loadFont` | Six prize texts ("$0" to "$5") are built but only three are shown | Build the three that are shown |
| B7 | `src/index.js`, `makeText` | `rotation.y = Math.PI * 2` is a full turn, so it does nothing | Dropped |
| B8 | `src/index.js`, `BoxState` | An open crate can't close, and clicking it again snaps the lid shut and swings it open again | Kept as is; the game rules (D5) will decide how crates behave |
| B9 | `package.json` | `three >=0.178.0` is an open-ended range that would accept a breaking release, and `main`, `license` and the failing `test` script are `npm init` leftovers | Replaced by the template's `package.json` with pinned caret ranges |
| B10 | `src/main.css` | Copied from three's examples: rules for `#overlay`, `#notSupported`, buttons and lil-gui that nothing uses | Dropped (D7) |
| B11 | `vite.config.js`, `src/.vscode/` | `root: "src"` puts the page, the code and the assets in one folder, which the workspace and editor settings then work around | The template's layout |

## Appendix C: notes on R3F, WebGPU and three r186 for this port

Checked against the source of `@react-three/fiber` 9.8.2, `@react-three/drei` 10.7.9 and three 0.186.1, and in a scratch copy of the template built with the latest toolchain. drei, three-stdlib and R3F import nothing that three 0.186.1 lacks. Rechecked on 2026-10-30 against three 0.187.0, with a WebGPU scene using item 1's factory, `asWebGPU()` and leva, type-checked, linted with the Phase 3 config and built; only item 1's backend check needed changing.

1. **Creating the WebGPU renderer.** R3F 9 accepts an async `gl` factory. Narrow the `canvas` it passes, which R3F types more widely than the DOM does, with `if (!(canvas instanceof HTMLCanvasElement)) throw new Error(…)`; TypeScript 7 rejects it unnarrowed. Then construct `new WebGPURenderer({ canvas, antialias: true })` and `await renderer.init()` before returning it, after which `render()` works each frame (`renderAsync` is deprecated). `'isWebGPUBackend' in renderer.backend` says whether WebGPU or the WebGL 2 fallback is rendering. `@types/three` 0.187 types `backend` as the base `Backend`, which lacks the flag, so `renderer.backend.isWebGPUBackend` doesn't type-check.
2. **R3F types the renderer as a WebGLRenderer.** `useThree((s) => s.gl)` is typed `WebGLRenderer` even though it holds a `WebGPURenderer`. Go through `asWebGPU()` in `src/stage/renderer.ts`: an `instanceof WebGPURenderer` guard that takes an `object` and narrows it, so no cast is needed. Anisotropy comes from the renderer's own `getMaxAnisotropy()`; a `WebGPURenderer` has no `capabilities` object.
3. **The Canvas defaults differ from the prototype.** With a factory there are no `gl` props, so R3F would set ACES tone mapping once the renderer exists; the prototype has none, so pass `flat`, which keeps it off. `shadows={true}` asks for PCFSoftShadowMap, which r186 removed (WebGPU's shadow node has no filter for it), so pass `shadows="percentage"`, the prototype's PCF. R3F caps the pixel ratio at 2 by default, where the prototype used the full `devicePixelRatio`. drei's `OrbitControls` damps by default; `enableDamping={false}` matches three's default.
4. **Keep the Canvas props static.** R3F re-applies `shadows`, `flat` and `linear` only when those props change (by shallow comparison), so they hold. Anything changed at runtime is set on the renderer from inside the Canvas; under WebGPU, tone-mapping and shadow-type changes rebuild what they need by themselves.
5. **Only node materials run under WebGPU.** GLSL `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile` don't run; custom shading is TSL (`three/tsl`) or node materials, as the prototype already does. Classic materials such as the crates' `MeshPhongMaterial` and the glTF model's are converted automatically. Build a node graph once, where its material is created, never on each render.
6. **The reflection.** Create `reflector({ resolution: 0.5 })` in the effect that owns it, rotate its `target`, and put the target in the scene (`<primitive object={reflection.target} />`, or `scene.add` in that effect). The floor material's `colorNode` combines the checkerboard and the reflection, with the normal-map offset added to the reflection's `uvNode`, as the prototype does. Dispose of both on unmount.
7. **The background and the fog.** Set `scene.backgroundNode` from an effect, through `get()` (item 9), and clear it in the cleanup. The fog can be a declarative `<fog attach="fog" args={[0x0487e2, 7, 25]} />`.
8. **Loaders, and their shared results.** Load with three's own addon loaders through R3F's `useLoader`: `GLTFLoader`, `FBXLoader`, `FontLoader` and `TextureLoader`, the code the prototype already runs. drei's helpers wrap three-stdlib's older copies; its `<Text3D>`, for one, passes `height` where three's `TextGeometry` now calls it `depth`. Loader results are cached and shared, so never change one in place: clone first, with `SkeletonUtils.clone` (`three/addons/utils/SkeletonUtils.js`) for the skinned host and `clip.clone()` before renaming a clip. React's StrictMode mounts components twice in development, so one-off setup has to be idempotent or undone in its effect's cleanup.
9. **Satisfying the React Compiler-style lint rules.** Oxlint's `react(immutability)` flags mutating anything a hook returned, `useMemo` and `useThree` results included, even inside an effect. These patterns pass, as checked in the scratch build:
   - Create imperative three objects (the reflector, node materials, the mixer's listeners) inside the effect that owns them, keep them in a ref for later effects, and dispose of them in that effect's cleanup.
   - Read the renderer, scene, camera and controls through `const get = useThree((s) => s.get)`, calling `get()` inside effects and handlers.
   - Mutate per-frame state, such as a lid's rotation, through refs inside `useFrame`.
10. **Animations.** drei's `useAnimations(clips, ref)` returns the mixer and an action per clip name. Set each action's loop once (`LoopRepeat` for stances; `LoopOnce` with `clampWhenFinished` for poses), and fade as Appendix A says. Add the mixer's `finished` listener in an effect and remove it in the cleanup.
11. **R3F's pointer events.** Only objects with handlers are raycast, and events come only from the canvas, so a click on the leva panel never reaches the stage. Put `onClick` on each crate's group and call `e.stopPropagation()`, so a click opens only the nearest crate.
12. **Nothing allocates per frame.** Inside `useFrame`, reuse vectors and other objects through refs or module scope, and read time from R3F's clock.
13. **Public assets need the base prefix.** With `base: ''`, reference files in `public/` as `` `${import.meta.env.BASE_URL}models/gltf/Michelle.glb` ``, never with a leading `/`. Some clip files have spaces in their names; the browser encodes them, so they load as they are.
14. **Versions.** Everything installs at its latest (D14). `npm ls three` should show one three: fiber, drei and three-stdlib take it as a peer, and the `$three` override folds in the copy drei's `stats-gl` would otherwise bring. `@types/three` comes from the same release. TypeScript 7 builds the template's tsconfig unchanged, and Oxlint's type-aware rules run on it. React has to stay within R3F 9's peer range (19.0 to 19.3), and `@types/node` follows the Node in use (24). After that, `npm outdated` should list only `@types/node`.
