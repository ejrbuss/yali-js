import { isList, isMap, Map as IMap } from "immutable";
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

// TODO handle circular references
export function print(form) {
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
		return `(${form.map(print).join(" ")})`;
	}
	if (isMap(form)) {
		return `{${[...form.entries()].flat(1).map(print).join(" ")}}`;
	}
	if (typeof form === "function") {
		let name = form[Special.name] ?? form.name ?? "anonymous";
		return `#<${name}::proc>`;
	}
	if (typeof form === "object" && form !== null) {
		let name = form[Special.name] ?? "";
		let type = form.constructor[Special.name] ?? form.constructor.name;
		return `#<${name}::${type}>`;
	}
	return `#<js"${form}">`;
}

export function colorPrint(form, colors = DefaultColors) {
	function applyColor(keyword, s) {
		return colors.has(keyword) ? applyCode(colors.get(keyword), s) : s;
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
			.map((a) => colorPrint(a, colors))
			.join(" ")}${applyColor(punc, ")")}`;
	}
	if (isMap(form)) {
		return `${applyColor(punc, "{")}${[...form.entries()]
			.flat(1)
			.map((a) => colorPrint(a, colors))
			.join(" ")}${applyColor(punc, "}")}`;
	}
	if (typeof form === "function") {
		let name = form[Special.name] ?? form.name ?? "anonymous";
		return applyColor(poundStr, `#<${name}::proc>`);
	}
	if (typeof form === "object" && form !== null) {
		let name = form[Special.name] ?? "";
		let type = form.constructor[Special.name] ?? form.constructor.name;
		return applyColor(poundStr, `#<${name}::${type}>`);
	}
	return applyColor(poundStr, `#<js"${form}">`);
}

export function printTag([first, ...rest], ...subs) {
	return subs.reduce((acc, sub, i) => {
		return acc + print(sub) + rest[i];
	}, first);
}
