import { first, isEmpty, rest } from "./types.js";

export function* firstRestGen(xs) {
	while (!isEmpty.dispatch(xs)) {
		yield first.dispatch(xs);
		xs = rest.dispatch(xs);
	}
}

export function toJsIter(a) {
	if (a[Symbol.iterator]) {
		return a;
	}
	return firstRestGen(a);
}
