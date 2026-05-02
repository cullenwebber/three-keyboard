import * as THREE from "three";
import { easing } from "maath";

export class CameraRig {
	/**
	 * @param {THREE.Camera} camera - The camera to rig
	 * @param {Object} options
	 * @param {THREE.Vector3} options.target - Point the camera looks at
	 * @param {Array} options.xLimit - [min, max] for camera x position
	 * @param {Array} options.yLimit - [min, max] for camera y position (optional)
	 * @param {number} options.smoothTime - Smooth time for easing (lower = faster)
	 */
	constructor(camera, options = {}) {
		this.camera = camera;
		this.target = options.target || new THREE.Vector3(0, 0, 0);
		this.xLimit = options.xLimit || [-5, 5];
		this.yLimit = options.yLimit || null;
		this.smoothTime = options.smoothTime || 0.25;

		// normalized pointer (-1..1)
		this.pointer = { x: 0, y: 0 };

		this._bindEvents();
	}

	_bindEvents() {
		window.addEventListener("mousemove", (event) => {
			this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
			this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
		});
	}

	/**
	 * Call every frame
	 * @param {number} delta - Time delta in seconds
	 */
	update(delta) {
		const targetX = this.target.x + this.pointer.x * 2;
		const limitedX = Math.max(
			this.xLimit[0],
			Math.min(this.xLimit[1], targetX),
		);

		easing.damp(this.camera.position, "x", limitedX, this.smoothTime, delta);

		if (this.yLimit) {
			const targetY = this.target.y + this.pointer.y * 10;
			const limitedY = Math.max(
				this.yLimit[0],
				Math.min(this.yLimit[1], targetY),
			);
			easing.damp(this.camera.position, "y", limitedY, this.smoothTime, delta);
		}

		this.camera.lookAt(this.target);
	}
}
