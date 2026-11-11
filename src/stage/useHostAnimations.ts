import { useAnimations } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import { button, folder, useControls } from 'leva'
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import { LoopOnce, LoopRepeat, type AnimationAction, type Object3D } from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import type { PoseName } from '../game/director.ts'
import { useGame } from '../store.ts'

// Each clip is the first in its file; stances loop, and poses play once and hold their last frame
const stances: [string, string][] = [
  ['Idle Simple', 'Idle2.fbx'],
  ['Idle', 'Idle.fbx'],
  ['Idle Briefcase', 'Standing W_Briefcase Idle.fbx'],
]
// Named as the show cues them
const poses: [PoseName, string][] = [
  ['Defeated', 'Defeated.fbx'],
  ['Rejected', 'Rejected.fbx'],
  ['Sad', 'Sad Idle.fbx'],
  ['Samba Dancing', 'Samba Dancing.fbx'],
  ['Samba Dancing 2', 'Samba Dancing 2.fbx'],
  ['Samba Dancing 3', 'Samba Dancing 3.fbx'],
]
const stanceNames = stances.map(([name]) => name)
const poseNames = poses.map(([name]) => name)
const names = [...stanceNames, ...poseNames]
const urls = [...stances, ...poses].map(
  ([, file]) => `${import.meta.env.BASE_URL}animations/${file}`,
)

// Start the clips loading now, so they arrive alongside the model rather than after it
useLoader.preload(FBXLoader, urls)

export function useHostAnimations(model: RefObject<Object3D | null>) {
  const files = useLoader(FBXLoader, urls)
  // Loaded clips are cached and shared, so each is cloned before it's named
  const clips = useMemo(
    () =>
      files.map((file, i) => {
        const clip = file.animations[0].clone()
        clip.name = names[i]
        return clip
      }),
    [files],
  )
  const { actions, mixer } = useAnimations(clips, model)
  // The action playing, or fading in, now
  const active = useRef<AnimationAction | null>(null)

  const fadeTo = useCallback(
    (name: string, duration: number) => {
      const action = actions[name]
      if (!action || action === active.current) return
      const previous = active.current
      active.current = action
      // Nothing is playing yet, so the first stance starts at once rather than fading in
      if (!previous) {
        action.play()
        return
      }
      previous.fadeOut(duration)
      action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play()
    },
    [actions],
  )

  const poseCue = useGame((s) => s.poseCue)
  const cue = useGame((s) => s.cue)
  // The cues present at mount have already played, so a remount (StrictMode's second one
  // included) never replays them
  const mountedPose = useRef(poseCue?.id)
  const mountedCue = useRef(cue?.id)

  const [{ stance, poseDuration }, , get] = useControls(
    () => ({
      Stances: folder({
        stanceDuration: { value: 0.5, min: 0, max: 5, label: 'Duration' },
        stance: { value: stanceNames[0], options: stanceNames, label: 'Stance' },
      }),
      Poses: folder({
        poseDuration: { value: 0.5, min: 0, max: 5, label: 'Duration' },
        ...Object.fromEntries(
          poseNames.map((name) => [
            name,
            button((read) => fadeTo(name, read('Poses.poseDuration'))),
          ]),
        ),
      }),
    }),
    [fadeTo],
  )

  // The mixer hands back the same cached actions as useAnimations, but set up here they aren't
  // a hook's result, which react(immutability) won't let change
  useEffect(() => {
    const root = model.current
    if (root) {
      for (const clip of clips) {
        const action = mixer.clipAction(clip, root)
        if (stanceNames.includes(clip.name)) {
          action.setLoop(LoopRepeat, Infinity)
        } else {
          action.setLoop(LoopOnce, 1)
          action.clampWhenFinished = true
        }
      }
    }
    return () => {
      mixer.stopAllAction()
      active.current = null
    }
  }, [clips, mixer, model])

  useEffect(() => {
    fadeTo(stance, get('stanceDuration'))
  }, [fadeTo, get, stance])

  // The show cues a pose through the same fade as the panel's buttons; the show never waits
  // for one, and the next cue cuts a long dance short
  useEffect(() => {
    if (!poseCue || poseCue.id === mountedPose.current) return
    fadeTo(poseCue.pose, get('poseDuration'))
  }, [fadeTo, get, poseCue])

  // Each round starts from the panel's current stance
  useEffect(() => {
    if (!cue || cue.id === mountedCue.current || cue.name !== 'roundStart') return
    fadeTo(get('stance'), get('stanceDuration'))
  }, [cue, fadeTo, get])

  // A finished pose fades back to the current stance
  useEffect(() => {
    const onFinished = ({ action }: { action: AnimationAction }) => {
      if (action === active.current) fadeTo(stance, poseDuration)
    }
    mixer.addEventListener('finished', onFinished)
    return () => {
      mixer.removeEventListener('finished', onFinished)
    }
  }, [mixer, fadeTo, stance, poseDuration])
}
