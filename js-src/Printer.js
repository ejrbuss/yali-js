import util from "util";
import { isList, isMap } from "immutable";
import { AnsiCodes, applyCode } from "./AnsiCodes.js";
import { Keyword } from "./keyword.js";

export const DefaultTransforms = {
	Nil: (a) => a,
	Bool: (a) => a,
	Num: (a) => a,
	Str: (a) => a,
	Sym: (a) => a,
	Keyword: (a) => a,
	Punctuation: (a) => a,
	PoundString: (a) => a,
};

export const ColorTransforms = {
	Nil: (a) => applyCode(AnsiCodes.FgRed, a),
	Bool: (a) => applyCode(AnsiCodes.FgRed, a),
	Num: (a) => applyCode(AnsiCodes.FgYellow, a),
	Str: (a) => applyCode(AnsiCodes.FgGreen, a),
	Sym: (a) => a,
	Keyword: (a) => applyCode(AnsiCodes.FgGreen, a),
	Punctuation: (a) => applyCode(AnsiCodes.FgMagenta, a),
	PoundString: (a) => applyCode(AnsiCodes.FgBlue, a),
};

export function print(form, transforms = DefaultTransforms) {
	if (typeof form === "undefined") {
		return transforms.Nil("nil");
	}
	if (typeof form === "boolean") {
		return transforms.Bool(JSON.stringify(form));
	}
	if (typeof form === "number") {
		return transforms.Num(JSON.stringify(form));
	}
	if (typeof form === "string") {
		return transforms.Str(JSON.stringify(form));
	}
	if (typeof form === "symbol") {
		return transforms.Sym(form.description);
	}
	if (typeof form === "function") {
		let name = form.procNamme ?? form.typeName ?? form.name ?? "anonymous";
		let type = form.macro ? "macro" : "proc";
		return transforms.PoundString(`#<${type}::${name}>`);
	}
	if (form instanceof Keyword) {
		return transforms.Keyword(form.toStr());
	}
	if (form instanceof Error) {
		let name = form.typeName ?? form.name ?? "Error";
		let message = form.message;
		return transforms.PoundString(`#<${name}::${JSON.stringify(message)}>`);
	}
	if (isList(form)) {
		return `${transforms.Punctuation("(")}${form
			.map((a) => print(a, transforms))
			.join(" ")}${transforms.Punctuation(")")}`;
	}
	if (isMap(form)) {
		return `${transforms.Punctuation("{")}${[...form.entries()]
			.flat(1)
			.map((a) => print(a, transforms))
			.join(" ")}${transforms.Punctuation("}")}`;
	}
	if (typeof form === "object" && form !== null) {
		let name = form.typeName ?? form.name;
		if (typeof name === "string") {
			return transforms.PoundString(`#<${name}>`);
		}
	}
	return transforms.PoundString(`#<js::${util.inspect(form)}>`);
}

export function printStr(strings, ...subs) {
	return subs.reduce(
		(acc, sub, i) => acc + print(sub) + strings[i + 1],
		strings[0]
	);
}
