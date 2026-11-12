import { buttonGroup, folder, useControls } from 'leva'
import { useEffect, useRef } from 'react'
import { create } from 'zustand'

export type Antialiasing = 'msaa' | 'fxaa'

// The night studio, or the sunny stage it replaced, kept for comparison
export type Look = 'studio' | 'daylight'

// The key light's shadow map, a side in texels
export type ShadowSize = 1024 | 2048

// Every switch and slider of the panel's Effects folder, which the stage and the app read here
export interface Effects {
  look: Look
  // A glow around whatever emits light
  bloom: boolean
  bloomStrength: number
  // An outline round the crate under the pointer and the player's choice, in place of the ring
  outline: boolean
  // MSAA smooths edges as the scene draws; FXAA smooths the finished frame instead
  antialiasing: Antialiasing
  // The studio floor's reflection of the stage
  reflection: boolean
  // The reflection blurred as a glossy floor would blur it, and how glossy: 0 is a mirror
  glossy: boolean
  gloss: number
  // Rings rippling out across the studio floor, and the light that carries them onto the stage
  rings: boolean
  ringBrightness: number
  // The spots on each crate and the two coloured ones; without them the key light alone remains
  spotlights: boolean
  shadowSize: ShadowSize
  // A haze lying low over the studio floor, and how thick it is
  haze: boolean
  hazeDensity: number
  // The most device pixels drawn for each CSS pixel
  resolution: number
}

type Switches = Pick<
  Effects,
  | 'bloom'
  | 'outline'
  | 'antialiasing'
  | 'reflection'
  | 'glossy'
  | 'rings'
  | 'spotlights'
  | 'shadowSize'
  | 'haze'
>

export type Preset = 'phone' | 'full' | 'off'

// Phone is meant to run smoothly on a mid-range phone, Full is every extra, Off nothing at all,
// which in daylight draws the stage exactly as it was drawn before there were effects. A preset
// sets the switches only; the look, the sliders and the resolution stay as they are
export const presets: Record<Preset, Switches> = {
  phone: {
    bloom: true,
    outline: false,
    antialiasing: 'msaa',
    reflection: true,
    glossy: false,
    rings: true,
    spotlights: true,
    shadowSize: 1024,
    haze: true,
  },
  full: {
    bloom: true,
    outline: true,
    antialiasing: 'msaa',
    reflection: true,
    glossy: true,
    rings: true,
    spotlights: true,
    shadowSize: 2048,
    haze: true,
  },
  off: {
    bloom: false,
    outline: false,
    antialiasing: 'msaa',
    reflection: false,
    glossy: false,
    rings: false,
    spotlights: false,
    shadowSize: 1024,
    haze: false,
  },
}

const strengthSlider = { value: 1, min: 0, max: 3, step: 0.05 }
const glossSlider = { value: 0.9, min: 0, max: 1, step: 0.05 }
const ringSlider = { value: 1, min: 0, max: 3, step: 0.05 }
// Thick enough at the slider's start to lift the floor's far edge, thin enough that the crates
// standing in it keep their colour
const hazeSlider = { value: 0.25, min: 0, max: 1, step: 0.01 }
// A cap of 2 is as sharp as most eyes can tell on a phone, where 3 would draw more than twice the
// pixels; below 1 draws fewer pixels than the screen has, for a slow device
const resolutionSlider = { value: 2, min: 0.5, max: 3, step: 0.25 }

// The panel starts in the studio on the Phone preset, as the store does, so the two agree from the
// first frame
export const useEffects = create<Effects>(() => ({
  look: 'studio',
  ...presets.phone,
  bloomStrength: strengthSlider.value,
  gloss: glossSlider.value,
  ringBrightness: ringSlider.value,
  hazeDensity: hazeSlider.value,
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
        look: {
          value: 'studio',
          options: { Studio: 'studio', Daylight: 'daylight' },
          label: 'Look',
          hint: 'The night studio, or the sunny stage before it',
        },
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
        reflection: {
          value: presets.phone.reflection,
          label: 'Reflection',
          hint: 'The studio floor reflects the stage',
        },
        glossy: {
          value: presets.phone.glossy,
          label: 'Glossy blur',
          hint: 'Blurs the reflection as a glossy floor would',
        },
        gloss: { ...glossSlider, label: 'Gloss', hint: 'How blurred the reflection is' },
        rings: {
          value: presets.phone.rings,
          label: 'Rings',
          hint: 'Rings of light ripple across the studio floor',
        },
        ringBrightness: { ...ringSlider, label: 'Ring glow', hint: 'How bright the rings are' },
        spotlights: {
          value: presets.phone.spotlights,
          label: 'Spotlights',
          hint: 'A spot on each crate and two coloured ones; off leaves the key light alone',
        },
        shadowSize: {
          value: presets.phone.shadowSize,
          options: { '1024': 1024, '2048': 2048 },
          label: 'Shadow',
          hint: "How finely the key light's shadow is drawn",
        },
        haze: {
          value: presets.phone.haze,
          label: 'Haze',
          hint: 'A haze lying low over the studio floor',
        },
        hazeDensity: { ...hazeSlider, label: 'Thickness', hint: 'How thick the haze is' },
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

  const { look, bloom, bloomStrength, outline, antialiasing, reflection, glossy, gloss } = values
  const { rings, ringBrightness, spotlights, shadowSize, haze, hazeDensity, resolution } = values
  useEffect(() => {
    useEffects.setState({
      look: look === 'daylight' ? 'daylight' : 'studio',
      bloom,
      bloomStrength,
      outline,
      antialiasing: antialiasing === 'fxaa' ? 'fxaa' : 'msaa',
      reflection,
      glossy,
      gloss,
      rings,
      ringBrightness,
      spotlights,
      shadowSize: shadowSize === 2048 ? 2048 : 1024,
      haze,
      hazeDensity,
      resolution,
    })
  }, [
    look,
    bloom,
    bloomStrength,
    outline,
    antialiasing,
    reflection,
    glossy,
    gloss,
    rings,
    ringBrightness,
    spotlights,
    shadowSize,
    haze,
    hazeDensity,
    resolution,
  ])
}
