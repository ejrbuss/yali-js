export function createEmptyEnv() {
	return {};
}

export function extendEnv(env) {
	return Object.setPrototypeOf({}, env);
}
