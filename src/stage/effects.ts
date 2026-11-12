import { buttonGroup, folder, useControls } from 'leva'
import { useEffect, useRef } from 'react'
import { create } from 'zustand'

export type Antialiasing = 'msaa' | 'fxaa'

// Every switch and slider of the panel's Effects folder, which the stage and the app read here
export interface Effects {
  // A glow around whatever emits light
  bloom: boolean
  bloomStrength: number
  // An outline round the crate under the pointer and the player's choice, in place of the ring
  outline: boolean
  // MSAA smooths edges as the scene draws; FXAA smooths the finished frame instead
  antialiasing: Antialiasing
  // The most device pixels drawn for each CSS pixel
  resolution: number
}

type Switches = Pick<Effects, 'bloom' | 'outline' | 'antialiasing'>

export type Preset = 'phone' | 'full' | 'off'

// Phone is meant to run smoothly on a mid-range phone, Full is every extra, Off nothing at all,
// which draws the stage exactly as it was drawn before there were effects. A preset sets the
// switches only; the sliders and the resolution stay as they are
export const presets: Record<Preset, Switches> = {
  phone: { bloom: true, outline: false, antialiasing: 'msaa' },
  full: { bloom: true, outline: true, antialiasing: 'msaa' },
  off: { bloom: false, outline: false, antialiasing: 'msaa' },
}

const strengthSlider = { value: 1, min: 0, max: 3, step: 0.05 }
// A cap of 2 is as sharp as most eyes can tell on a phone, where 3 would draw more than twice the
// pixels; below 1 draws fewer pixels than the screen has, for a slow device
const resolutionSlider = { value: 2, min: 0.5, max: 3, step: 0.25 }

// The panel starts on the Phone preset, as the store does, so the two agree from the first frame
export const useEffects = create<Effects>(() => ({
  ...presets.phone,
  bloomStrength: strengthSlider.value,
  resolution: resolutionSlider.value,
}))

// Whether any switch needs the render pipeline. With none on, the stage renders as it always has
export const usesPipeline = ({ bloom, outline, antialiasing }: Switches) =>
  bloom || outline || antialiasing === 'fxaa'

// The panel's Effects folder, kept below the stage's own folders and above the Sound folder. It
// writes the store, so the panel shows what a preset chose and the two never disagree
export function useEffectsFolder() {
  // The presets' buttons are made before the folder's setter exists, so they reach it through here
  const applyPreset = useRef<(preset: Preset) => void>(() => undefined)
  const [values, set] = useControls(() => ({
    Effects: folder(
      {
        preset: buttonGroup({
          label: 'Preset',
          opts: {
            Phone: () => applyPreset.current('phone'),
            Full: () => applyPreset.current('full'),
            Off: () => applyPreset.current('off'),
          },
        }),
        bloom: { value: presets.phone.bloom, label: 'Bloom', hint: 'A glow around what shines' },
        bloomStrength: { ...strengthSlider, label: 'Strength', hint: 'How bright the glow is' },
        outline: {
          value: presets.phone.outline,
          label: 'Outline',
          hint: 'Outlines the crate you point at and your pick, in place of the ring',
        },
        antialiasing: {
          value: presets.phone.antialiasing,
          options: { MSAA: 'msaa', FXAA: 'fxaa' },
          label: 'Antialiasing',
          hint: 'MSAA smooths edges as they draw; FXAA smooths the finished frame',
        },
        resolution: {
          ...resolutionSlider,
          label: 'Resolution',
          hint: 'The most pixels drawn for each pixel of the page',
        },
      },
      { order: 0.5 },
    ),
  }))

  useEffect(() => {
    applyPreset.current = (preset) => set(presets[preset])
  }, [set])

  const { bloom, bloomStrength, outline, antialiasing, resolution } = values
  useEffect(() => {
    useEffects.setState({
      bloom,
      bloomStrength,
      outline,
      antialiasing: antialiasing === 'fxaa' ? 'fxaa' : 'msaa',
      resolution,
    })
  }, [bloom, bloomStrength, outline, antialiasing, resolution])
}
