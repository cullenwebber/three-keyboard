import * as THREE from "three";
import WebGLContext from "../core/WebGLContext";
import { CameraRig } from "../utils/CameraRig";
import KeyCaps from "../meshes/KeyCaps";
import Legends from "../meshes/Legends";
import Physics from "../core/Physics";
import { HDRLoader } from "three/examples/jsm/Addons.js";

export default class Scene {
	constructor() {
		this.context = null;
		this.camera = null;
		this.cameraRig = null;
		this.width = 0;
		this.height = 0;
		this.aspectRatio = 0;
		this.scene = null;
		this.envMap = null;
		this.#init();
	}

	async #init() {
		this.#setContext();
		this.#setupScene();
		this.#setupCamera();
		this.#setupCameraRig();
		await this.#setupPhysics();
		await this.#addObjects();
		this.#trackWindowMotion();
		this.#setupResetButton();
	}

	#setupResetButton() {
		const button = document.querySelector("[data-reset-button]");
		if (!button) return;
		button.addEventListener("click", () => this.keyCaps?.reset());
	}

	async #setupPhysics() {
		this.physics = new Physics();
		await this.physics.init();
	}

	#setContext() {
		this.context = new WebGLContext();
	}

	#setupScene() {
		this.scene = new THREE.Scene();
		this.scene.environmentIntensity = 1;
		this.scene.fog = new THREE.Fog(0x000000, 4, 8);
		this.#loadEnvironment();
	}

	#loadEnvironment() {
		const pmremGenerator = new THREE.PMREMGenerator(this.context.renderer);
		pmremGenerator.compileEquirectangularShader();

		new HDRLoader().load(`${import.meta.env.BASE_URL}studio_4.hdr`, (hdr) => {
			hdr.mapping = THREE.EquirectangularReflectionMapping;
			this.envMap = pmremGenerator.fromEquirectangular(hdr).texture;
			this.scene.environment = this.envMap;
			hdr.dispose();
			pmremGenerator.dispose();
		});
	}

	#setupCamera() {
		this.#calculateAspectRatio();
		this.camera = new THREE.PerspectiveCamera(45, this.aspectRatio, 1, 100);
		this.camera.position.z = 4;
	}

	#setupCameraRig() {
		this.cameraRig = new CameraRig(this.camera, {
			target: new THREE.Vector3(0, -1, 0),
			xLimit: [2, 4],
			yLimit: [1, 2],
		});
	}

	async #addObjects() {
		this.keyCaps = new KeyCaps({
			physics: this.physics,
			onReady: (kc) => {
				this.#buildContainer(kc);
				this.legends = new Legends({ keyCaps: kc, text: "CULLEN" });
				this.scene.add(this.legends);
			},
		});
		this.scene.add(this.keyCaps);
	}

	#buildContainer(kc) {
		const wallThickness = 0.5;
		const halfW = kc.totalWidth / 2 + kc.size.x + 0.3;
		const halfD = kc.totalDepth / 2 + kc.size.z + 0.3;
		const floorY = -kc.size.y / 2;
		const ceilY = floorY + 2;

		this.physics.addStaticBox(
			{ x: 0, y: floorY - wallThickness, z: 0 },
			{ x: halfW + wallThickness, y: wallThickness, z: halfD + wallThickness },
		);
		this.physics.addStaticBox(
			{ x: 0, y: ceilY + wallThickness, z: 0 },
			{ x: halfW + wallThickness, y: wallThickness, z: halfD + wallThickness },
		);
		this.physics.addStaticBox(
			{ x: -halfW - wallThickness, y: 0, z: 0 },
			{ x: wallThickness, y: 4, z: halfD + wallThickness },
		);
		this.physics.addStaticBox(
			{ x: halfW + wallThickness, y: 0, z: 0 },
			{ x: wallThickness, y: 4, z: halfD + wallThickness },
		);
		this.physics.addStaticBox(
			{ x: 0, y: 0, z: -halfD - wallThickness },
			{ x: halfW + wallThickness, y: 4, z: wallThickness },
		);
		this.physics.addStaticBox(
			{ x: 0, y: 0, z: halfD + wallThickness },
			{ x: halfW + wallThickness, y: 4, z: wallThickness },
		);
	}

	#trackWindowMotion() {
		this._lastScreenX = window.screenX;
		this._lastScreenY = window.screenY;
		this._impulseScale = 0.0015;
		this._torqueScale = 0.0001;
		this.#setupTilt();
	}

	#setupTilt() {
		this._tiltGravity = { x: 0, y: -9.81, z: 0 };
		this._tiltActive = false;

		const start = async () => {
			const E = window.DeviceOrientationEvent;
			if (E && typeof E.requestPermission === "function") {
				try {
					const res = await E.requestPermission();
					if (res !== "granted") return;
				} catch {
					return;
				}
			}
			window.addEventListener("deviceorientation", (e) => this.#onTilt(e));
			this._tiltActive = true;
			window.removeEventListener("touchend", start);
			window.removeEventListener("click", start);
		};
		window.addEventListener("touchend", start, { once: true });
		window.addEventListener("click", start, { once: true });
	}

	#onTilt(event) {
		const beta = (event.beta ?? 0) * (Math.PI / 180);
		const gamma = (event.gamma ?? 0) * (Math.PI / 180);
		const g = 9.81;
		this._tiltGravity.x = g * Math.sin(gamma);
		this._tiltGravity.y = -g * Math.cos(beta) * Math.cos(gamma);
		this._tiltGravity.z = g * Math.sin(beta);
		if (this.physics?.world) this.physics.world.gravity = this._tiltGravity;
	}

	#applyWindowImpulse() {
		if (!this.keyCaps?.bodies?.length) return;
		const dx = window.screenX - this._lastScreenX;
		const dy = window.screenY - this._lastScreenY;
		this._lastScreenX = window.screenX;
		this._lastScreenY = window.screenY;
		if (dx === 0 && dy === 0) return;

		const impulse = {
			x: dx * this._impulseScale,
			y: dy * this._impulseScale,
			z: 0,
		};
		const ts = this._torqueScale;
		for (let i = 0; i < this.keyCaps.bodies.length; i++) {
			const b = this.keyCaps.bodies[i];
			b.applyImpulse(impulse, true);
			const jitter = ((i * 9301 + 49297) % 233280) / 233280 - 0.5;
			b.applyTorqueImpulse(
				{
					x: dy * ts * (0.5 + jitter),
					y: (dx + dy) * ts * jitter,
					z: -dx * ts * (0.5 + jitter),
				},
				true,
			);
		}
	}

	#calculateAspectRatio() {
		const { width, height } = this.context.getFullScreenDimensions();
		this.width = width;
		this.height = height;
		this.aspectRatio = this.width / this.height;
	}

	animate(delta, elapsed) {
		this.cameraRig?.update(delta);
		this.#applyWindowImpulse();
		this.physics?.step();
		this.keyCaps?.sync();
		this.legends?.sync();
	}

	onResize(width, height) {
		this.width = width;
		this.height = height;
		this.aspectRatio = width / height;

		this.camera.aspect = this.aspectRatio;
		this.camera.updateProjectionMatrix();
	}
}
