import { isList, isMap, List as IList, Map as IMap } from "immutable";
import { Keyword } from "./keyword.js";
import { applyCode, FgBlue, FgGreen, FgRed, FgYellow } from "./ansi.js";
import { Special } from "./symbols.js";

// keywords
const nil = Keyword.for("nil");
const bool = Keyword.for("bool");
const num = Keyword.for("num");
const str = Keyword.for("str");
const sym = Keyword.for("sym");
const keyword = Keyword.for("keyword");
const punc = Keyword.for("punc");
const poundStr = Keyword.for("pound-str");

export const DefaultColors = IMap([
	[Keyword.for("nil"), FgRed],
	[Keyword.for("bool"), FgRed],
	[Keyword.for("num"), FgYellow],
	[Keyword.for("str"), FgGreen],
	[Keyword.for("sym"), ""],
	[Keyword.for("keyword"), FgGreen],
	[Keyword.for("punc"), ""],
	[Keyword.for("pound-str"), FgBlue],
]);

export function print(form) {
	const visited = new Set();
	function innerPrint(form) {
		if (visited.has(form)) {
			return "...";
		}
		if (typeof form === "undefined") {
			return "nil";
		}
		if (typeof form === "boolean") {
			return JSON.stringify(form);
		}
		if (typeof form === "number") {
			return JSON.stringify(form);
		}
		if (typeof form === "string") {
			return JSON.stringify(form);
		}
		if (typeof form === "symbol") {
			return form.description ?? "";
		}
		if (form instanceof Keyword) {
			return `:${form.name}`;
		}
		if (isList(form)) {
			visited.add(form);
			return `(${form.map(innerPrint).join(" ")})`;
		}
		if (isMap(form)) {
			visited.add(form);
			return `{${[...form.entries()].flat(1).map(innerPrint).join(" ")}}`;
		}
		if (typeof form === "function") {
			let name = form[Special.name] ?? form.name ?? "anonymous";
			return `#<${name}::proc>`;
		}
		if (typeof form === "object" && form !== null) {
			const constructor = form.constructor[Special.yaliConstructor];
			if (typeof constructor !== "undefined") {
				const signature = constructor.signature;
				const type = signature.first();
				const properties = signature
					.rest()
					.map((propertySymbol) => form[propertySymbol.name]);
				return innerPrint(IList.of(type, ...properties));
			} else {
				let type = form.constructor.name;
				return `#<::${type}>`;
			}
		}
		return `#<js"${form}">`;
	}
	return innerPrint(form);
}

export function colorPrint(form, colors = DefaultColors) {
	const visited = new Set();
	function applyColor(keyword, s) {
		return colors.has(keyword) ? applyCode(colors.get(keyword), s) : s;
	}
	function innerPrint(form) {
		if (visited.has(form)) {
			return "...";
		}
		if (typeof form === "undefined") {
			return applyColor(nil, "nil");
		}
		if (typeof form === "boolean") {
			return applyColor(bool, JSON.stringify(form));
		}
		if (typeof form === "number") {
			return applyColor(num, JSON.stringify(form));
		}
		if (typeof form === "string") {
			return applyColor(str, JSON.stringify(form));
		}
		if (typeof form === "symbol") {
			return applyColor(sym, form.description ?? "");
		}
		if (form instanceof Keyword) {
			return applyColor(keyword, ":" + form.name);
		}
		if (isList(form)) {
			return `${applyColor(punc, "(")}${form
				.map(innerPrint)
				.join(" ")}${applyColor(punc, ")")}`;
		}
		if (isMap(form)) {
			return `${applyColor(punc, "{")}${[...form.entries()]
				.flat(1)
				.map(innerPrint)
				.join(" ")}${applyColor(punc, "}")}`;
		}
		if (typeof form === "function") {
			let name = form[Special.name] ?? form.name ?? "anonymous";
			return applyColor(poundStr, `#<${name}::proc>`);
		}
		if (typeof form === "object" && form !== null) {
			const constructor = form.constructor[Special.yaliConstructor];
			if (typeof constructor !== "undefined") {
				const signature = constructor.signature;
				const type = signature.first();
				const properties = signature
					.rest()
					.map((propertySymbol) => form[propertySymbol.description]);
				return innerPrint(IList.of(type, ...properties));
			} else {
				let type = form.constructor.name;
				return applyColor(poundStr, `#<::${type}>`);
			}
		}
		return applyColor(poundStr, `#<js"${form}">`);
	}
	return innerPrint(form);
}

export function printTag([first, ...rest], ...subs) {
	return subs.reduce((acc, sub, i) => {
		return acc + print(sub) + rest[i];
	}, first);
}
