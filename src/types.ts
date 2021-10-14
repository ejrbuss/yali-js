import { isList, isMap, List as IList, List, Map as IMap } from "immutable";
import { Keyword } from "./keyword.js";
import { print } from "./printer.js";
import { Special } from "./symbols.js";

export type Nil = undefined;
export type Bool = boolean;
export type Num = number;
export type Str = string;
export type Sym = symbol;
export type Proc = Function;
export type Env = {};

export class MultiProc {
	typeArgsShape: IList<unknown>;
	methodTable: IMap<IList<unknown>, Proc | Nil>;
	defHook: Proc;

	constructor(name: string, typeArgsShape: IList<unknown>, defHook?: Proc) {
		this[Special.name] = name;
		this.methodTable = IMap();
		this.typeArgsShape = typeArgsShape;
		this.defHook = defHook ?? (() => {});
	}

	signature() {
		return this.typeArgsShape.unshift(Symbol.for(this[Special.name]));
	}

	defMethod(typeArgs: IList<unknown>, impl: Proc): void {
		throw new Error("TODO");
	}

	getMethod(typeArgs: IList<unknown>): Proc | Nil {
		return this.methodTable.get(typeArgs);
	}

	dispatch(...args: unknown[]): unknown {
		let typeArgs = IList(args.map(typeOf));
		let impl = this.methodTable.get(typeArgs);
		if (typeof impl !== "undefined") {
			return impl(...args);
		}
		throw new Error(
			`${this[Special.name]} is not implemented for ${print(typeArgs)}!`
		);
	}
}

export function NilConstructor(): Nil {
	return;
}

export function BoolConstructor(a: unknown): Bool {
	if (typeof a === "boolean") {
		return a;
	}
	const converted = ToBool.dispatch(a);
	if (typeof converted === "boolean") {
		return converted;
	}
	throw new Error(
		`The to-Bool conversion of ${print(a)} produced ${print(
			converted
		)}, not a Bool!`
	);
}

export function NumConstructor(a: unknown): Num {
	if (typeof a === "number") {
		return a;
	}
	const converted = ToNum.dispatch(a);
	if (typeof converted === "number") {
		return converted;
	}
	throw new Error(
		`The to-Num conversion of ${print(a)} produced ${print(
			converted
		)}, not a Num!`
	);
}

export function StrConstructor(...args: unknown[]): Str {
	return args
		.map((a) => {
			if (typeof a === "string") {
				return a;
			}
			const convert = ToStr.getMethod(IList.of(typeOf(a))) ?? print;
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

export function SymConstructor(a: unknown): Sym {
	if (typeof a === "symbol") {
		return a;
	}
	assertType<Str>(StrConstructor, a);
	return Symbol.for(a);
}

export function KeywordConstructor(a: unknown): Keyword {
	if (a instanceof Keyword) {
		return a;
	}
	assertType<Str>(StrConstructor, a);
	return Keyword.for(a);
}

export function ProcConstructor(a: unknown): Proc {
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

export function MultiProcConstructor(a: unknown): MultiProc {
	assertType<MultiProc>(MultiProcConstructor, a);
	return a;
}

export function ListConstructor(...args: unknown[]): IList<unknown> {
	return IList(args);
}

export function MapConstructor(...args: unknown[]): IMap<unknown, unknown> {
	const keyValuePairs: [unknown, unknown][] = [];
	const length = args.length;
	for (let i = 0; i < length; i += 2) {
		const key = args[i];
		const value = args[i + 1];
		keyValuePairs.push([key, value]);
	}
	return IMap(keyValuePairs);
}

export function typeOf(a: unknown): Proc {
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
			let jsConstructor = (a as any).constructor;
			let constructor = JsConstructorToConstructor.get(jsConstructor);
			if (typeof constructor === "undefined") {
				constructor = (...args: unknown[]) => new jsConstructor(...args);
				JsConstructorToConstructor.set(jsConstructor, constructor);
			}
			return constructor;
	}
	throw new Error(`Could not take the type of ${a}`);
}
typeOf[Special.name] = "type-of";

export function jsTypeToType(jsConstructor: any): Proc {
	let constructor = JsConstructorToConstructor.get(jsConstructor);
	if (typeof constructor === "undefined") {
		constructor = (...args: unknown[]) => new jsConstructor(...args);
		JsConstructorToConstructor.set(jsConstructor, constructor);
	}
	return constructor;
}
jsTypeToType[Special.name] = "js-type-to-type";

export function typeName(type: unknown): Str {
	if (typeof type === "object" && type !== null) {
		const anyType = type as any;
		const name = anyType[Special.name] ?? anyType.name;
		if (typeof name === "string") {
			return name;
		}
	}
	throw new Error(`Cannot find type-name of non type: ${print(type)}!`);
}
typeName[Special.name] = "type-name";

export function assertType<T>(type: unknown, a: unknown): asserts a is T {
	if (type !== typeOf(a)) {
		throw new Error(`Expected type: ${typeName(type)}, but received: ${a}!`);
	}
}
assertType[Special.name] = "assert-type";

const JsConstructorToConstructor: Map<Function, Proc> = new Map();

JsConstructorToConstructor.set(Keyword, KeywordConstructor);
JsConstructorToConstructor.set(MultiProc, MultiProcConstructor);

export const ErrorConstructor = jsTypeToType(Error);
export const PromiseConstructor = jsTypeToType(Promise);

const unaryTypeArgs = List.of(Symbol.for("a"));
const binaryTypeArgs = List.of(Symbol.for("a"), Symbol.for("b"));

export const ToBool = new MultiProc("to-Bool", unaryTypeArgs);
export const ToNum = new MultiProc("to-Num", unaryTypeArgs);
export const ToStr = new MultiProc("to-Str", unaryTypeArgs);
export const toProc = new MultiProc("to-Proc", unaryTypeArgs);
export const first = new MultiProc("first", unaryTypeArgs);
export const rest = new MultiProc("rest", unaryTypeArgs);
export const isEmpty = new MultiProc("empty?", unaryTypeArgs);

function defHashHook(type: unknown, impl: Proc): void {
	if (typeof type === "function") {
		const jsConstructor = type[Special.jsConstructor];
		if (typeof jsConstructor === "function") {
			type = jsConstructor;
		}
		(type as any).hashCode = function (): unknown {
			return impl(this);
		};
	}
	throw new Error(`Could not hook hashCode for type ${print(type)}!`);
}

export const hash = new MultiProc("#", unaryTypeArgs, defHashHook);

function defEqHook(type: unknown, impl: Proc): void {
	if (typeof type === "function") {
		const jsConstructor = type[Special.jsConstructor];
		if (typeof jsConstructor === "function") {
			type = jsConstructor;
		}
		(type as any).equals = function (other: unknown): unknown {
			return impl(this, other);
		};
	}
	throw new Error(`Could not hook equals for type ${print(type)}!`);
}

export const BinaryEq = new MultiProc("binary=", binaryTypeArgs, defEqHook);
