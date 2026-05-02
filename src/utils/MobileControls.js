export default class MobileControls {
	constructor({ physics, getBodies, applyImpulse, overlaySelector = "[data-start-overlay]" }) {
		this.physics = physics;
		this.getBodies = getBodies;
		this.applyImpulse = applyImpulse;
		this.overlay = document.querySelector(overlaySelector);

		this._tiltGravity = { x: 0, y: -9.81, z: 0 };
		this._tiltActive = false;

		this.#setup();
	}

	#setup() {
		const O = window.DeviceOrientationEvent;
		const M = window.DeviceMotionEvent;
		const needsOrientation = O && typeof O.requestPermission === "function";
		const needsMotion = M && typeof M.requestPermission === "function";

		if (!needsOrientation && !needsMotion) {
			this.#enable();
			return;
		}
		if (!this.overlay) {
			this.#enable();
			return;
		}

		this.overlay.hidden = false;
		this.overlay.classList.remove("hidden");
		this.overlay.classList.add("flex");

		const onTap = () => {
			const reqs = [];
			if (needsOrientation) reqs.push(O.requestPermission().catch(() => "denied"));
			if (needsMotion) reqs.push(M.requestPermission().catch(() => "denied"));
			Promise.all(reqs)
				.then((results) => {
					if (results.every((r) => r === "granted")) this.#enable();
				})
				.finally(() => this.#hideOverlay());
		};
		this.overlay.addEventListener("click", onTap, { once: true });
	}

	#hideOverlay() {
		if (!this.overlay) return;
		this.overlay.hidden = true;
		this.overlay.classList.add("hidden");
		this.overlay.classList.remove("flex");
	}

	#enable() {
		window.addEventListener("deviceorientation", (e) => this.#onTilt(e));
		this._tiltActive = true;
		this.#enableShake();
	}

	#onTilt(event) {
		const beta = (event.beta ?? 0) * (Math.PI / 180);
		const gamma = (event.gamma ?? 0) * (Math.PI / 180);
		const g = 9.81 * 2.25;
		this._tiltGravity.x = g * Math.sin(gamma);
		this._tiltGravity.y = -g * Math.cos(beta) * Math.cos(gamma);
		this._tiltGravity.z = g * Math.sin(beta);
		if (this.physics?.world) this.physics.world.gravity = this._tiltGravity;
		const bodies = this.getBodies?.();
		if (bodies) {
			for (let i = 0; i < bodies.length; i++) bodies[i].wakeUp();
		}
	}

	#enableShake() {
		const shakeThreshold = 14;
		const cooldownMs = 180;
		const impulseScale = 80;
		let lastShake = 0;

		window.addEventListener("devicemotion", (e) => {
			const a = e.acceleration;
			if (!a) return;
			const ax = a.x ?? 0;
			const ay = a.y ?? 0;
			const az = a.z ?? 0;
			const mag = Math.hypot(ax, ay, az);
			if (mag < shakeThreshold) return;
			const now = performance.now();
			if (now - lastShake < cooldownMs) return;
			lastShake = now;
			const strength = (mag - shakeThreshold) * impulseScale + 400;
			this.applyImpulse?.(0, -strength);
		});
	}
}
