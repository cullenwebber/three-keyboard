import * as THREE from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import ImportGltf from "../utils/ImportGltf";
import WebGLContext from "../core/WebGLContext";

const ROW_STAGGER = [0, 0.5, 0.75, 1.25];

export default class KeyCaps extends THREE.Group {
	constructor({
		rows = 18,
		cols = 25,
		gap = 0.025,
		material = null,
		physics = null,
		onReady = null,
	} = {}) {
		super();
		this.url = `${import.meta.env.BASE_URL}keycaps.glb`;
		this.rows = rows;
		this.cols = cols;
		this.gap = gap;
		this.material = material || this.#createMaterial();
		this.physics = physics;
		this.onReady = onReady;

		this.bodies = [];
		this.initialPositions = [];
		this.size = new THREE.Vector3();
		this.totalWidth = 0;
		this.totalDepth = 0;

		this._dummy = new THREE.Object3D();
		this._t = new THREE.Vector3();
		this._q = new THREE.Quaternion();

		this.#load();
	}

	#createMaterial() {
		const renderer = new WebGLContext().renderer;
		const ktx2Loader = new KTX2Loader()
			.setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
			.detectSupport(renderer);

		const material = new THREE.MeshStandardMaterial({
			color: 0x777777,
			roughness: 0.2,
			metalness: 1.0,
			aoMapIntensity: 1.75,
		});

		ktx2Loader.load(
			`${import.meta.env.BASE_URL}keycap_bake.ktx2`,
			(texture) => {
				texture.flipY = false;
				texture.colorSpace = THREE.NoColorSpace;
				material.aoMap = texture;
				material.needsUpdate = true;
				ktx2Loader.dispose();
			},
		);

		return material;
	}

	#load() {
		new ImportGltf(this.url, {
			onLoad: (model) => {
				const source = this.#findFirstMesh(model);
				if (!source) return;
				this.#buildInstances(source);
				this.onReady?.(this);
			},
		});
	}

	#findFirstMesh(root) {
		let found = null;
		root.traverse((child) => {
			if (!found && child.isMesh) found = child;
		});
		return found;
	}

	#buildInstances(source) {
		const geometry = source.geometry;
		const material = this.material;

		if (geometry.attributes.uv && !geometry.attributes.uv1) {
			geometry.setAttribute("uv1", geometry.attributes.uv);
		}

		geometry.computeBoundingBox();
		const center = geometry.boundingBox.getCenter(new THREE.Vector3());
		geometry.translate(-center.x, -center.y, -center.z);
		geometry.computeBoundingBox();
		geometry.boundingBox.getSize(this.size);

		const stepX = this.size.x + this.gap;
		const stepZ = this.size.z + this.gap;

		const count = this.rows * this.cols;
		const mesh = new THREE.InstancedMesh(geometry, material, count);
		mesh.castShadow = true;
		mesh.receiveShadow = true;

		const dummy = this._dummy;
		this.totalWidth = (this.cols - 1) * stepX;
		this.totalDepth = (this.rows - 1) * stepZ;

		const halfExtents = {
			x: this.size.x / 2,
			y: this.size.y / 2,
			z: this.size.z / 2,
		};

		let i = 0;
		for (let r = 0; r < this.rows; r++) {
			const stagger = ROW_STAGGER[r % ROW_STAGGER.length] * stepX;
			const z = r * stepZ - this.totalDepth / 2;
			for (let c = 0; c < this.cols; c++) {
				const x = c * stepX - this.totalWidth / 2 + stagger;
				dummy.position.set(x, 0, z);
				dummy.quaternion.identity();
				dummy.updateMatrix();
				mesh.setMatrixAt(i, dummy.matrix);

				this.initialPositions.push({ x, y: 0, z });
				if (this.physics?.ready) {
					this.bodies.push(
						this.physics.addDynamicBox({ x, y: 0, z }, halfExtents),
					);
				}
				i++;
			}
		}
		mesh.instanceMatrix.needsUpdate = true;

		this.mesh = mesh;
		this.add(mesh);
	}

	getIndex(row, col) {
		return row * this.cols + col;
	}

	getBodyAt(row, col) {
		return this.bodies[this.getIndex(row, col)];
	}

	reset() {
		const zero = { x: 0, y: 0, z: 0 };
		for (let i = 0; i < this.bodies.length; i++) {
			const body = this.bodies[i];
			const p = this.initialPositions[i];
			body.setTranslation(p, true);
			body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
			body.setLinvel(zero, true);
			body.setAngvel(zero, true);
		}
	}

	sync() {
		if (!this.mesh || this.bodies.length === 0) return;
		const dummy = this._dummy;
		for (let i = 0; i < this.bodies.length; i++) {
			const body = this.bodies[i];
			const t = body.translation();
			const r = body.rotation();
			dummy.position.set(t.x, t.y, t.z);
			dummy.quaternion.set(r.x, r.y, r.z, r.w);
			dummy.updateMatrix();
			this.mesh.setMatrixAt(i, dummy.matrix);
		}
		this.mesh.instanceMatrix.needsUpdate = true;
	}
}
