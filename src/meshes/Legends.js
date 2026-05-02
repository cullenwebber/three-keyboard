import * as THREE from "three";

export default class Legends extends THREE.Group {
	constructor({ keyCaps, text = "CULLEN" }) {
		super();
		this.keyCaps = keyCaps;
		this.text = text.toUpperCase();
		this.perLetter = new Map();
		this._dummy = new THREE.Object3D();
		this.#build();
	}

	#build() {
		const size = this.keyCaps.size;
		const planeSize = size.x * 0.3;

		const counts = new Map();
		for (let r = 0; r < this.keyCaps.rows; r++) {
			for (let c = 0; c < this.keyCaps.cols; c++) {
				const letter = this.text[c % this.text.length];
				counts.set(letter, (counts.get(letter) ?? 0) + 1);
			}
		}

		for (const [letter, count] of counts) {
			const texture = this.#makeLetterTexture(letter);
			const material = new THREE.MeshBasicMaterial({
				map: texture,
				transparent: true,
				depthWrite: false,
			});
			const margin = size.x * 0.12;
			const offsetX = -(size.x / 2 - planeSize / 2 - margin);
			const offsetZ = -(size.z / 2 - planeSize / 2 - margin);

			const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
			geometry.rotateX(-Math.PI / 1.9);
			geometry.rotateZ(-Math.PI / 36);
			geometry.translate(offsetX + 0.015, size.y / 2 - 0.02, offsetZ);

			const mesh = new THREE.InstancedMesh(geometry, material, count);
			mesh.renderOrder = 1;
			this.add(mesh);
			this.perLetter.set(letter, { mesh, bodies: [] });
		}

		for (let r = 0; r < this.keyCaps.rows; r++) {
			for (let c = 0; c < this.keyCaps.cols; c++) {
				const letter = this.text[c % this.text.length];
				const index = this.keyCaps.getIndex(r, c);
				const body = this.keyCaps.bodies[index];
				if (!body) continue;
				this.perLetter.get(letter).bodies.push(body);
			}
		}
	}

	#makeLetterTexture(letter) {
		const size = 256;
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, size, size);
		ctx.fillStyle = "#999999";
		ctx.font = `bold ${size * 0.7}px ui-sans-serif, system-ui, sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(letter, size / 2, size / 2 + size * 0.04);

		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.anisotropy = 8;
		return texture;
	}

	sync() {
		const dummy = this._dummy;
		for (const { mesh, bodies } of this.perLetter.values()) {
			for (let i = 0; i < bodies.length; i++) {
				const t = bodies[i].translation();
				const r = bodies[i].rotation();
				dummy.position.set(t.x, t.y, t.z);
				dummy.quaternion.set(r.x, r.y, r.z, r.w);
				dummy.updateMatrix();
				mesh.setMatrixAt(i, dummy.matrix);
			}
			mesh.instanceMatrix.needsUpdate = true;
		}
	}
}
