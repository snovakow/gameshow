export function Lights() {
  return (
    <>
      <directionalLight
        color={0xffe499}
        intensity={5}
        position={[0.5, 2, 0.5]}
        castShadow
        shadow-camera-near={0.1}
        shadow-camera-far={5}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.005}
        shadow-intensity={1}
        shadow-radius={3}
      />
      <hemisphereLight args={[0x333366, 0x74ccf4, 5]} />
      <hemisphereLight args={[0x74ccf4, 0x000000, 1]} />
    </>
  )
}
