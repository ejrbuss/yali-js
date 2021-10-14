import { isList, isMap, List as IList, List, Map as IMap } from "immutable";
import { Keyword } from "./keyword.js";
import { print } from "./printer.js";
import { Special } from "./symbols.js";

export class MultiProc {
	constructor(name, typeArgsShape, defHook) {
		this[Special.name] = name;
		this.methodTable = IMap();
		this.typeArgsShape = typeArgsShape;
		this.defHook = defHook ?? (() => {});
	}

	signature() {
		return this.typeArgsShape.unshift(Symbol.for(this[Special.name]));
	}

	defMethod(typeArgs, impl) {
		throw new Error("TODO");
	}

	getMethod(typeArgs) {
		return this.methodTable.get(typeArgs);
	}

	dispatch(...args) {
		const typeArgs = IList(args.map(typeOf));
		const impl = this.methodTable.get(typeArgs);
		if (typeof impl !== "undefined") {
			return impl(...args);
		}
		const signature = typeArgs
			.map(typeName)
			.unshift(this[Special.name])
			.join(" ");
		throw new Error(
			`The method (${signature}) is not implemented for arguments: ${print(
				IList(args)
			)}!`
		);
	}
}

export function NilConstructor() {
	return;
}

export function BoolConstructor(a) {
	if (typeof a === "boolean") {
		return a;
	}
	const converted = toBool.dispatch(a);
	if (typeof converted === "boolean") {
		return converted;
	}
	throw new Error(
		`The to-Bool conversion of ${print(a)} produced ${print(
			converted
		)}, not a Bool!`
	);
}

export function NumConstructor(a) {
	if (typeof a === "number") {
		return a;
	}
	const converted = toNum.dispatch(a);
	if (typeof converted === "number") {
		return converted;
	}
	throw new Error(
		`The to-Num conversion of ${print(a)} produced ${print(
			converted
		)}, not a Num!`
	);
}

export function StrConstructor(...args) {
	return args
		.map((a) => {
			if (typeof a === "string") {
				return a;
			}
			const convert = toStr.getMethod(IList.of(typeOf(a))) ?? print;
			const converted = convert(a);
			if (typeof converted === "string") {
				return converted;
			}
			throw new Error(
				`The to-Str conversion of ${print(a)} produced ${print(
					converted
				)}, not a Str!`
			);
		})
		.join("");
}

export function SymConstructor(a) {
	if (typeof a === "symbol") {
		return a;
	}
	assertType(StrConstructor, a);
	if (a.startsWith("#")) {
		throw new Error(
			`Cannot convert ${print(a)} to Sym, # prefix is reserved for unique Sym!`
		);
	}
	return Symbol.for(a);
}

export function KeywordConstructor(a) {
	if (a instanceof Keyword) {
		return a;
	}
	assertType(StrConstructor, a);
	return Keyword.for(a);
}

export function ProcConstructor(a) {
	if (typeof a === "function") {
		return a;
	}
	const converted = toProc.dispatch(a);
	if (typeof converted === "function") {
		return converted;
	}
	throw new Error(
		`The to-Proc conversion of ${print(a)} produced ${print(
			converted
		)}, not a Proc!`
	);
}

export function MultiProcConstructor(a) {
	assertType(MultiProcConstructor, a);
	return a;
}

export function ListConstructor(...args) {
	return IList(args);
}

export function MapConstructor(...args) {
	const keyValuePairs = [];
	const length = args.length;
	for (let i = 0; i < length; i += 2) {
		const key = args[i];
		const value = args[i + 1];
		keyValuePairs.push([key, value]);
	}
	return IMap(keyValuePairs);
}

export function typeOf(a) {
	switch (typeof a) {
		case "undefined":
			return NilConstructor;
		case "boolean":
			return BoolConstructor;
		case "number":
			return NumConstructor;
		case "string":
			return StrConstructor;
		case "symbol":
			return SymConstructor;
		case "function":
			return ProcConstructor;
		case "object":
			if (a === null) {
				break;
			}
			if (isList(a)) {
				return ListConstructor;
			}
			if (isMap(a)) {
				return MapConstructor;
			}
			let jsConstructor = a.constructor;
			let constructor = JsConstructorToConstructor.get(jsConstructor);
			if (typeof constructor === "undefined") {
				constructor = (...args) => new jsConstructor(...args);
				JsConstructorToConstructor.set(jsConstructor, constructor);
			}
			return constructor;
	}
	throw new Error(`Could not take the type of ${a}`);
}

export function jsTypeToType(jsConstructor) {
	let constructor = JsConstructorToConstructor.get(jsConstructor);
	if (typeof constructor === "undefined") {
		constructor = (...args) => new jsConstructor(...args);
		JsConstructorToConstructor.set(jsConstructor, constructor);
	}
	return constructor;
}

export function typeName(type) {
	if (typeof type === "function") {
		const name = type[Special.name] ?? type.name;
		if (typeof name === "string") {
			return name;
		}
	}
	throw new Error(`Cannot find type-name of non type: ${print(type)}!`);
}

export function assertType(type, a) {
	if (type !== typeOf(a)) {
		throw new Error(
			`Expected type: ${typeName(type)}, but received: ${print(a)}!`
		);
	}
}

const JsConstructorToConstructor = new Map();

JsConstructorToConstructor.set(Keyword, KeywordConstructor);

JsConstructorToConstructor.set(MultiProc, MultiProcConstructor);

const unaryTypeArgs = List.of(Symbol.for("a"));
const binaryTypeArgs = List.of(Symbol.for("a"), Symbol.for("b"));

export const toBool = new MultiProc("to-Bool", unaryTypeArgs);
export const toNum = new MultiProc("to-Num", unaryTypeArgs);
export const toStr = new MultiProc("to-Str", unaryTypeArgs);
export const toProc = new MultiProc("to-Proc", unaryTypeArgs);
export const first = new MultiProc("first", unaryTypeArgs);
export const rest = new MultiProc("rest", unaryTypeArgs);
export const isEmpty = new MultiProc("empty?", unaryTypeArgs);

function defHashHook(type, impl) {
	if (typeof type === "function") {
		const jsConstructor = type[Special.jsConstructor];
		if (typeof jsConstructor === "function") {
			type = jsConstructor;
		}
		type.hashCode = function () {
			return impl(this);
		};
	}
	throw new Error(`Could not hook hashCode for type ${print(type)}!`);
}

export const hash = new MultiProc("#", unaryTypeArgs, defHashHook);

function defEqHook(type, impl) {
	if (typeof type === "function") {
		const jsConstructor = type[Special.jsConstructor];
		if (typeof jsConstructor === "function") {
			type = jsConstructor;
		}
		type.equals = function (other) {
			return impl(this, other);
		};
	}
	throw new Error(`Could not hook equals for type ${print(type)}!`);
}

export const BinaryEq = new MultiProc("binary=", binaryTypeArgs, defEqHook);
