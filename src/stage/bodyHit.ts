import { Matrix4, Vector3, type BufferGeometry, type Ray, type SkinnedMesh } from 'three'

type Attribute = ReturnType<BufferGeometry['getAttribute']>

// One of a vertex's four bone indices or weights, read as three reads them, plain or interleaved
const component = (attribute: Attribute, vertex: number, k: number) =>
  k === 0
    ? attribute.getX(vertex)
    : k === 1
      ? attribute.getY(vertex)
      : k === 2
        ? attribute.getZ(vertex)
        : attribute.getW(vertex)

// Whether a ray in world space meets skinned meshes as they're posed now, for a tap that needs her
// body exactly. three's own SkinnedMesh.raycast moves the three corners of every triangle it tests
// through the bones, so each vertex is moved several times over; this moves each vertex once into a
// buffer kept for the purpose, then tests the triangles, both faces, until one meets the ray.
// Everything it uses is made here, so a tap allocates nothing
export function bodyHitTest(meshes: SkinnedMesh[]) {
  const parts = meshes.map((mesh) => {
    const position = mesh.geometry.getAttribute('position')
    return {
      mesh,
      position,
      skinIndex: mesh.geometry.getAttribute('skinIndex'),
      skinWeight: mesh.geometry.getAttribute('skinWeight'),
      index: mesh.geometry.getIndex(),
      // Per bone, the whole way from the mesh's bind pose to the world
      bones: mesh.skeleton.bones.map(() => new Matrix4()),
      posed: new Float32Array(position.count * 3),
    }
  })
  const toWorld = new Matrix4()
  const bound = new Vector3()
  const moved = new Vector3()
  const sum = new Vector3()
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const hit = new Vector3()

  return (ray: Ray) => {
    for (let p = 0; p < parts.length; p++) {
      const { mesh, position, skinIndex, skinWeight, index, bones, posed } = parts[p]
      const { skeleton } = mesh
      // As three skins a vertex: the mesh's world matrix, out of the bind space, through the
      // bone, and into the bind space, as one matrix per bone
      toWorld.multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse)
      for (let i = 0; i < bones.length; i++) {
        bones[i]
          .multiplyMatrices(toWorld, skeleton.bones[i].matrixWorld)
          .multiply(skeleton.boneInverses[i])
          .multiply(mesh.bindMatrix)
      }
      for (let v = 0; v < position.count; v++) {
        bound.fromBufferAttribute(position, v)
        sum.set(0, 0, 0)
        for (let k = 0; k < 4; k++) {
          const weight = component(skinWeight, v, k)
          if (weight === 0) continue
          const bone = bones[component(skinIndex, v, k)]
          sum.addScaledVector(moved.copy(bound).applyMatrix4(bone), weight)
        }
        sum.toArray(posed, v * 3)
      }
      const corners = index ? index.count : position.count
      for (let t = 0; t < corners; t += 3) {
        const i0 = index ? index.getX(t) : t
        const i1 = index ? index.getX(t + 1) : t + 1
        const i2 = index ? index.getX(t + 2) : t + 2
        a.fromArray(posed, i0 * 3)
        b.fromArray(posed, i1 * 3)
        c.fromArray(posed, i2 * 3)
        if (ray.intersectTriangle(a, b, c, false, hit)) return true
      }
    }
    return false
  }
}
