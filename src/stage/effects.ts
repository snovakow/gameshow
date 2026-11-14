import { buttonGroup, folder, useControls } from 'leva'
import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import type { HostMode } from './layout.ts'

export type Antialiasing = 'msaa' | 'fxaa'

// The night studio, or the sunny stage it replaced, kept for comparison
export type Look = 'studio' | 'daylight'

// The key light's shadow map, a side in texels
export type ShadowSize = 1024 | 2048

// Every switch and slider of the panel's Effects folder, which the stage and the app read here
export interface Effects {
  look: Look
  // Where the host stands, on her podium or on the floor
  host: HostMode
  // A follow spot of her own in the studio, and how bright it is against its usual brightness
  hostLight: boolean
  hostLightBrightness: number
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
  // The spots on each crate and the two coloured ones; without them the key light alone remains
  spotlights: boolean
  shadowSize: ShadowSize
  // A haze lying low over the studio floor, and how thick it is
  haze: boolean
  hazeDensity: number
  // The show's title in lights over the stage
  marquee: boolean
  // The prizes, the crates' numbers and the marquee's letters as polished metal
  goldShine: boolean
  // Confetti bursting from the winning crate and showering down at the finale, and how many pieces
  confetti: boolean
  confettiCount: number
  // Fireworks over the stage at the finale
  fireworks: boolean
  // Jets of flame at the stage's sides while a win is celebrated
  flames: boolean
  // The studio's spots and bulbs answering the show's moments
  lightCues: boolean
  // The camera pulling back for a win and swinging wide for the finale
  cameraMoves: boolean
  // Long horizontal streaks of light through whatever shines, as an anamorphic lens draws them
  streaks: boolean
  // The picture bursting outward from the winning crate as a win is revealed
  zoomBurst: boolean
  // A soft cone of light under each spot
  cheapBeams: boolean
  // Beams of light through a drifting haze, lit by the spots, in place of the cones, with how many
  // steps each beam is sampled in and how finely they are drawn, as a fraction of the picture's own
  // resolution
  lightBeams: boolean
  // Whether the spots cast shadows while the light beams show, through the haze and onto the stage
  beamShadows: boolean
  beamSteps: number
  beamResolution: number
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
  | 'spotlights'
  | 'shadowSize'
  | 'haze'
  | 'marquee'
  | 'goldShine'
  | 'confetti'
  | 'confettiCount'
  | 'fireworks'
  | 'flames'
  | 'lightCues'
  | 'cameraMoves'
  | 'streaks'
  | 'zoomBurst'
  | 'cheapBeams'
  | 'lightBeams'
>

export type Preset = 'phone' | 'full' | 'off'

// Phone is meant to run smoothly on a mid-range phone, Full is every extra, Off nothing at all,
// which in daylight draws the stage exactly as it was drawn before there were effects. A preset
// sets the switches and the confetti's count; the look, the host's place, her light, the beams'
// shadows, the other sliders and the resolution stay as they are
export const presets: Record<Preset, Switches> = {
  phone: {
    bloom: true,
    outline: false,
    antialiasing: 'msaa',
    reflection: true,
    glossy: false,
    spotlights: true,
    shadowSize: 1024,
    haze: true,
    marquee: true,
    goldShine: true,
    confetti: true,
    confettiCount: 3000,
    fireworks: true,
    flames: true,
    lightCues: true,
    cameraMoves: true,
    streaks: false,
    zoomBurst: false,
    cheapBeams: true,
    lightBeams: false,
  },
  full: {
    bloom: true,
    outline: true,
    antialiasing: 'msaa',
    reflection: true,
    glossy: true,
    spotlights: true,
    shadowSize: 2048,
    haze: true,
    marquee: true,
    goldShine: true,
    confetti: true,
    confettiCount: 12000,
    fireworks: true,
    flames: true,
    lightCues: true,
    cameraMoves: true,
    streaks: true,
    zoomBurst: true,
    // The light beams take the cones' place
    cheapBeams: false,
    lightBeams: true,
  },
  off: {
    bloom: false,
    outline: false,
    antialiasing: 'msaa',
    reflection: false,
    glossy: false,
    spotlights: false,
    shadowSize: 1024,
    haze: false,
    marquee: false,
    goldShine: false,
    confetti: false,
    confettiCount: 3000,
    fireworks: false,
    flames: false,
    lightCues: false,
    cameraMoves: false,
    streaks: false,
    zoomBurst: false,
    cheapBeams: false,
    lightBeams: false,
  },
}

// The most pieces of confetti the slider allows, which is what the confetti makes room for once,
// so the slider never makes it again
export const mostConfetti = 20000

const strengthSlider = { value: 1, min: 0, max: 3, step: 0.05 }
// Her light from off to twice as bright as it was set to read as she does in daylight
const hostLightSlider = { value: 1, min: 0, max: 2, step: 0.05 }
const glossSlider = { value: 0.9, min: 0, max: 1, step: 0.05 }
// Thick enough at the slider's start to lift the floor's far edge, thin enough that the crates
// standing in it keep their colour
const hazeSlider = { value: 0.25, min: 0, max: 1, step: 0.01 }
// A cap of 2 is as sharp as most eyes can tell on a phone, where 3 would draw more than twice the
// pixels; below 1 draws fewer pixels than the screen has, for a slow device
const resolutionSlider = { value: 2, min: 0.5, max: 3, step: 0.25 }
// A few thousand pieces fill the air over a crate; more than that only thickens it
const confettiSlider = { min: 500, max: mostConfetti, step: 500 }
// Twelve steps along each beam, dithered and blurred, hide their banding; fewer show it
const beamStepsSlider = { value: 12, min: 2, max: 16, step: 1 }
// A quarter of the picture's resolution is soft enough for a haze once it's blurred, and draws a
// sixteenth of the pixels
const beamResolutionSlider = { value: 0.25, min: 0.1, max: 1, step: 0.05 }

// The panel starts in the studio on the Phone preset, as the store does, so the two agree from the
// first frame
export const useEffects = create<Effects>(() => ({
  look: 'studio',
  host: 'podium',
  hostLight: true,
  hostLightBrightness: hostLightSlider.value,
  ...presets.phone,
  beamShadows: true,
  bloomStrength: strengthSlider.value,
  gloss: glossSlider.value,
  hazeDensity: hazeSlider.value,
  beamSteps: beamStepsSlider.value,
  beamResolution: beamResolutionSlider.value,
  resolution: resolutionSlider.value,
}))

// Whether any switch needs the render pipeline. With none on, the stage renders as it always has
export const usesPipeline = ({
  bloom,
  outline,
  antialiasing,
  streaks,
  zoomBurst,
  lightBeams,
}: Switches) => bloom || outline || antialiasing === 'fxaa' || streaks || zoomBurst || lightBeams

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
        host: {
          value: 'podium',
          options: { Podium: 'podium', Floor: 'floor' },
          label: 'Host',
          hint: 'The host on her podium behind the crates, or on the floor, nearer and larger',
        },
        hostLight: {
          value: true,
          label: 'Host light',
          hint: 'A spot of her own follows the host in the studio',
        },
        hostLightBrightness: {
          ...hostLightSlider,
          label: 'Brightness',
          hint: "How bright the host's light is",
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
        marquee: {
          value: presets.phone.marquee,
          label: 'Marquee',
          hint: "The show's title over the stage, ringed by chasing lights",
        },
        goldShine: {
          value: presets.phone.goldShine,
          label: 'Gold shine',
          hint: 'The gold in the studio shines like polished metal',
        },
        confetti: {
          value: presets.phone.confetti,
          label: 'Confetti',
          hint: 'Confetti bursts from a winning crate and showers down at the finale',
        },
        confettiCount: {
          ...confettiSlider,
          value: presets.phone.confettiCount,
          label: 'Pieces',
          hint: 'How many pieces of confetti fly, from the next burst on',
        },
        fireworks: {
          value: presets.phone.fireworks,
          label: 'Fireworks',
          hint: 'Fireworks burst over the stage at the finale',
        },
        flames: {
          value: presets.phone.flames,
          label: 'Flame jets',
          hint: "Jets of flame at the stage's sides when you win",
        },
        lightCues: {
          value: presets.phone.lightCues,
          label: 'Light cues',
          hint: "The spots and the title's bulbs answer the show",
        },
        streaks: {
          value: presets.phone.streaks,
          label: 'Streaks',
          hint: 'Streaks of light across whatever shines, as a widescreen lens draws them',
        },
        zoomBurst: {
          value: presets.phone.zoomBurst,
          label: 'Zoom burst',
          hint: 'The picture bursts outward from the winning crate',
        },
        cheapBeams: {
          value: presets.phone.cheapBeams,
          label: 'Cheap beams',
          hint: 'A soft cone of light under each spot',
        },
        lightBeams: {
          value: presets.phone.lightBeams,
          label: 'Light beams',
          hint: 'Beams of light through a haze, in place of the cones',
        },
        beamShadows: {
          value: true,
          label: 'Beam shadows',
          hint: 'The spots cast shadows through the beams and onto the stage',
        },
        beamSteps: {
          ...beamStepsSlider,
          label: 'Beam steps',
          hint: 'How many steps each beam is sampled in',
        },
        beamResolution: {
          ...beamResolutionSlider,
          label: 'Beam detail',
          hint: "How finely the beams are drawn, against the picture's own resolution",
        },
        resolution: {
          ...resolutionSlider,
          label: 'Resolution',
          hint: 'The most pixels drawn for each pixel of the page',
        },
      },
      { order: 0.5 },
    ),
    // Beside the pace of the glide home in the camera's own folder, where it's looked for, though
    // the presets set it with the effects
    Camera: folder({
      cameraMoves: {
        value: presets.phone.cameraMoves,
        label: 'Camera moves',
        hint: 'The view pulls back when you win and swings wide for the finale',
      },
    }),
  }))

  useEffect(() => {
    applyPreset.current = (preset) => set(presets[preset])
  }, [set])

  const { look, host, hostLight, hostLightBrightness } = values
  const { bloom, bloomStrength, outline, antialiasing, reflection, glossy } = values
  const { gloss } = values
  const { spotlights, shadowSize, haze, hazeDensity, marquee } = values
  const { goldShine, confetti, confettiCount, fireworks, flames, lightCues, cameraMoves } = values
  const { streaks, zoomBurst, cheapBeams, lightBeams, beamShadows, beamSteps, beamResolution } =
    values
  const { resolution } = values
  useEffect(() => {
    useEffects.setState({
      look: look === 'daylight' ? 'daylight' : 'studio',
      host: host === 'floor' ? 'floor' : 'podium',
      hostLight,
      hostLightBrightness,
      bloom,
      bloomStrength,
      outline,
      antialiasing: antialiasing === 'fxaa' ? 'fxaa' : 'msaa',
      reflection,
      glossy,
      gloss,
      spotlights,
      shadowSize: shadowSize === 2048 ? 2048 : 1024,
      haze,
      hazeDensity,
      marquee,
      goldShine,
      confetti,
      confettiCount,
      fireworks,
      flames,
      lightCues,
      cameraMoves,
      streaks,
      zoomBurst,
      cheapBeams,
      lightBeams,
      beamShadows,
      beamSteps,
      beamResolution,
      resolution,
    })
  }, [
    look,
    host,
    hostLight,
    hostLightBrightness,
    bloom,
    bloomStrength,
    outline,
    antialiasing,
    reflection,
    glossy,
    gloss,
    spotlights,
    shadowSize,
    haze,
    hazeDensity,
    marquee,
    goldShine,
    confetti,
    confettiCount,
    fireworks,
    flames,
    lightCues,
    cameraMoves,
    streaks,
    zoomBurst,
    cheapBeams,
    lightBeams,
    beamShadows,
    beamSteps,
    beamResolution,
    resolution,
  ])
}
