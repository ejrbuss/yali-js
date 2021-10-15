import {
	isList,
	isMap,
	hash as ihash,
	List as IList,
	List,
	Map as IMap,
} from "immutable";
import { Keyword } from "./keyword.js";
import { print, printTag } from "./printer.js";
import { Special } from "./symbols.js";

export class Interface {
	constructor(typeArgsShape, fallback, defHook) {
		this.methodTable = IMap();
		this.typeArgsShape = typeArgsShape;
		this.fallback = fallback;
		this.defHook = defHook ?? (() => {});
		this.dispatch = this.dispatch.bind(this);
	}

	signature() {
		return this.typeArgsShape.unshift(Symbol.for(this[Special.name]));
	}

	defMethod(typeArgs, impl) {
		assertType(ListConstructor, typeArgs);
		impl = ProcConstructor(impl);
		if (typeArgs.size !== this.typeArgsShape.size) {
			const method = this.typeArgsToMethodSignature(typeArgs);
			throw new Error(
				printTag`Cannot define method ${method} as it does not conform to the signature ${this.signature()}!`
			);
		}
		this.methodTable = this.methodTable.set(typeArgs, impl);
	}

	getMethod(typeArgs) {
		return this.methodTable.get(typeArgs);
	}

	dispatch(...args) {
		const typeArgs = IList(args.slice(0, this.typeArgsShape.size).map(typeOf));
		const impl = this.methodTable.get(typeArgs);
		if (typeof impl !== "undefined") {
			return impl(...args);
		}
		if (this.fallback) {
			return this.fallback(...args);
		}
		const method = this.typeArgsToMethodSignature(typeArgs);
		throw new Error(
			printTag`The method ${method} is not implemented for arguments: ${IList(
				args
			)}!`
		);
	}

	typeArgsToMethodSignature(typeArgs) {
		return typeArgs.map(typeName).unshift(this[Special.name]).map(Symbol.for);
	}

	["get-method"](typeArgs) {
		return this.methodTable.get(typeArgs);
	}
}

export function NilConstructor() {
	return;
}

export function BoolConstructor(a, ...rest) {
	if (typeof a === "boolean") {
		return a;
	}
	const converted = toBool.dispatch(a, ...rest);
	if (typeof converted === "boolean") {
		return converted;
	}
	throw new Error(
		`The to-Bool conversion of ${print(a)} produced ${print(
			converted
		)}, not a Bool!`
	);
}

export function NumConstructor(a, base, ...rest) {
	if (typeof a === "number") {
		return a;
	}
	if (typeof a === "string") {
		if (typeof base === "number") {
			return parseInt(a, base);
		} else {
			return parseFloat(a);
		}
	}
	const converted = toNum.dispatch(a, base, ...rest);
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
			const converted = toStr.dispatch(a);
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
	if (typeof converted === "function" || (a && a instanceof Interface)) {
		return converted;
	}
	throw new Error(
		`The to-Proc conversion of ${print(a)} produced ${print(
			converted
		)}, not a Proc!`
	);
}

export function InterfaceConstructor(a) {
	assertType(InterfaceConstructor, a);
	return a;
}

export function ProtocolConstructor(a) {}

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

JsConstructorToConstructor.set(Interface, InterfaceConstructor);

const unaryTypeArgs = List.of(Symbol.for("a"));
const binaryTypeArgs = List.of(Symbol.for("a"), Symbol.for("b"));

export const toBool = new Interface(unaryTypeArgs);
export const toNum = new Interface(unaryTypeArgs);
export const toStr = new Interface(unaryTypeArgs, (s) => print(s));
export const toProc = new Interface(unaryTypeArgs);
export const first = new Interface(unaryTypeArgs);
export const rest = new Interface(unaryTypeArgs);
export const isEmpty = new Interface(unaryTypeArgs);

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

export const hash = new Interface(unaryTypeArgs, (a) => ihash(a), defHashHook);

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

export const BinaryEq = new Interface(
	binaryTypeArgs,
	(a, b) => a === b,
	defEqHook
);
