import RAPIER from "@dimforge/rapier3d-compat";

export default class Physics {
	constructor() {
		this.world = null;
		this.ready = false;
	}

	async init() {
		await RAPIER.init();
		this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
		this.ready = true;
	}

	addDynamicBox(position, halfExtents, options = {}) {
		const desc = RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(position.x, position.y, position.z)
			.setLinearDamping(options.linearDamping ?? 0.4)
			.setAngularDamping(options.angularDamping ?? 0.6);

		const body = this.world.createRigidBody(desc);

		const collider = RAPIER.ColliderDesc.cuboid(
			halfExtents.x,
			halfExtents.y,
			halfExtents.z,
		)
			.setRestitution(options.restitution ?? 0.25)
			.setFriction(options.friction ?? 0.6)
			.setDensity(options.density ?? 1.0);

		this.world.createCollider(collider, body);
		return body;
	}

	addStaticBox(position, halfExtents) {
		const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(
			position.x,
			position.y,
			position.z,
		);
		const body = this.world.createRigidBody(desc);
		const collider = RAPIER.ColliderDesc.cuboid(
			halfExtents.x,
			halfExtents.y,
			halfExtents.z,
		);
		this.world.createCollider(collider, body);
		return body;
	}

	step() {
		if (!this.ready) return;
		this.world.step();
	}
}
