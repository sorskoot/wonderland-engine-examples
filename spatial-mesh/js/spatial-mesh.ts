import {
    Component,
    Material,
    Mesh,
    MeshAttribute,
    MeshComponent,
    MeshIndexType,
    Object3D,
} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';

const tempVec = new Float32Array(3);
const tempQuat = new Float32Array(4);

/**
 * context for a mesh
 */
type MeshContext = {
    id: number;
    timestamp: number;
    mesh: Object3D;
};

/**
 * Component for visualizing spatial meshes.
 */
export class SpatialMesh extends Component {
    static TypeName = 'spatial-mesh';

    @property.material()
    material?: Material;

    private roomMeshes = new Map<XRMesh, MeshContext>();
    private meshId = 0;

    update(dt: number) {
        const xr = this.engine.xr;
        if (!xr) {
            return; // We're not in XR, so don't do anything.
        }

        const frame = xr.frame;
        const referenceSpace = xr.currentReferenceSpace;

        // @ts-ignore detectedMeshes is not yet in the WebXR.d.ts definition.
        const detectedMeshes = xr.frame.detectedMeshes as XRMeshSet | undefined;

        // Loop over all detected meshes and create/update the geometry if needed.
        detectedMeshes?.forEach((mesh: XRMesh) => {
            const meshPose = frame.getPose(mesh.meshSpace, referenceSpace);
            let geometry;
            if (this.roomMeshes.has(mesh)) {
                // If we already have a mesh for this XRMesh, check if we need to update it.
                const meshContext = this.roomMeshes.get(mesh)!;
                if (meshContext.timestamp < mesh.lastChangedTime) {
                    meshContext.timestamp = mesh.lastChangedTime;
                    geometry = meshContext.mesh;
                    const meshComponent = geometry.getComponent(MeshComponent)?.mesh!;
                    this.updateGeometry(meshComponent, mesh.vertices, mesh.indices);
                }
            } else {
                // If we don't have a mesh for this XRMesh, create a new one.
                geometry = this.createGeometry(mesh.vertices, mesh.indices);
                const meshContext: MeshContext = {
                    id: this.meshId,
                    timestamp: mesh.lastChangedTime,
                    mesh: geometry,
                };
                this.roomMeshes.set(mesh, meshContext);
                this.meshId++;
            }

            if (meshPose && geometry) {
                // Set the position and rotation of the mesh based on the XRMesh.
                this.setXRRigidTransformLocal(geometry, meshPose?.transform!);
            }
        });
    }

    /**
     * Update the geometry of a mesh based on the vertices and indices.
     * @param meshComponent The mesh component to update.
     * @param vertices The array of vertices.
     * @param indices The array of indices.
     */
    private updateGeometry(
        meshComponent: Mesh,
        vertices: Float32Array,
        indices: Float32Array
    ) {
        meshComponent.indexData?.set(indices);
        const positions = meshComponent.attribute(MeshAttribute.Position);
        let v = 0;
        for (let i = 0; i < vertices.length / 3; i++) {
            positions?.set(i, [vertices[v], vertices[v + 1], vertices[v + 2]]);
            v += 3;
        }
    }

    /**
     * Creates a new Obkec3D with a MeshComponent and a Mesh, created from the spatial mesh.
     * @param vertices Vertices of the spatial mesh.
     * @param indices Indices of the spatial mesh.
     * @returns The created Object3D.
     */
    private createGeometry(vertices: Float32Array, indices: Float32Array): Object3D {
        const meshObj = this.engine.scene.addObject();
        const meshComp = meshObj.addComponent(MeshComponent)!;
        meshComp.material = this.material;
        const mesh = new Mesh(this.engine, {
            vertexCount: vertices.length / 3,
            indexData: indices,
            indexType: MeshIndexType.UnsignedInt,
        });

        this.updateGeometry(mesh, vertices, indices);

        meshComp.mesh = mesh;
        return meshObj;
    }

    /**
     * Set the position and rotation of an Object3D based on an XRRigidTransform.
     * @param o Object3D to set the position and rotation of.
     * @param transform XRRigidTransform to set the position and rotation from.
     */
    setXRRigidTransformLocal(o: Object3D, transform: XRRigidTransform) {
        const r = transform.orientation;
        tempQuat[0] = r.x;
        tempQuat[1] = r.y;
        tempQuat[2] = r.z;
        tempQuat[3] = r.w;

        const t = transform.position;
        tempVec[0] = t.x;
        tempVec[1] = t.y;
        tempVec[2] = t.z;

        o.resetPositionRotation();
        o.setTransformWorld(tempQuat);
        o.setPositionWorld(tempVec);
    }
}
