import { isList, isMap } from "immutable";
import { first, isEmpty, rest } from "./types.js";

export function* firstRestGen(xs) {
	while (isEmpty.dispatch(xs)) {
		yield first.dispatch(xs);
		xs = rest.dispatch(xs);
	}
}

export function toJsIter(a) {
	if (isList(a) || isMap(a) || Array.isArray(a)) {
		return a;
	}
	return firstRestGen(a);
}
