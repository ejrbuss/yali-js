import { Special } from "./symbols.js";

export class Env {
	constructor(name) {
		if (typeof name === "string") {
			this[Special.name] = name;
		}
	}

	extendEnv(name) {
		return Object.setPrototypeOf(new Env(name), this);
	}
}
