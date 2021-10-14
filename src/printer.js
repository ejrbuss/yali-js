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
	[Keyword.for("#string"), FgBlue],
]);

export function print(form, colors = IMap()) {
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
			.map((a) => print(a, colors))
			.join(" ")}${applyColor(punc, ")")}`;
	}
	if (isMap(form)) {
		return `${applyColor(punc, "{")}${[...form.entries()]
			.flat(1)
			.map((a) => print(a, colors))
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
