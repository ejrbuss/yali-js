import { isList } from "immutable";
import { isMap } from "util/types";
import { first, isEmpty, rest } from "./types.js";

export function* firstRestGen(xs: unknown) {
	while (isEmpty.dispatch(xs)) {
		yield first.dispatch(xs);
		xs = rest.dispatch(xs);
	}
}

export function toJsIter(a: unknown): Iterable<unknown> {
	if (isList(a) || isMap(a) || Array.isArray(a)) {
		return a;
	}
	return firstRestGen(a);
}
