export function freezeOwnProperties(object) {
	Object.getOwnPropertyNames(object).forEach((name) => {
		Object.defineProperty(object, name, { value: object[name] });
	});
	return object;
}
