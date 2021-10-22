import {
	isList,
	isMap,
	hash as ihash,
	List as IList,
	Map as IMap,
	is,
} from "immutable";
import { Keyword } from "./keyword.js";
import { print } from "./printer.js";
import { Special } from "./symbols.js";
import { freezeOwnProperties } from "./util.js";

export function NilConstructor() {
	return;
}

export function BoolConstructor(value) {
	if (typeof value === "boolean") {
		return value;
	}
	const converted = toBool.dispatch(value);
	if (typeof converted === "boolean") {
		return converted;
	}
	const printedvaluue = print(value);
	const printedConverted = print(converted);
	throw new Error(
		`The to-Bool conversion of \`${printedvaluue}\` produced \`${printedConverted}\`, not a Bool!`
	);
}

export function NumConstructor(value, base) {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string") {
		if (typeof base === "number") {
			return parseInt(value, base);
		} else {
			return parseFloat(value);
		}
	}
	const converted = toNum.dispatch(value, base);
	if (typeof converted === "number") {
		return converted;
	}
	const printedValue = print(value);
	const printedConverted = print(converted);
	throw new Error(
		`The to-Num conversion of \`${printedValue}\` produced \`${printedConverted}\`, not a Num!`
	);
}

export function StrConstructor(...values) {
	return values
		.map((value) => {
			if (typeof value === "string") {
				return value;
			}
			const converted = toStr.dispatch(value);
			if (typeof converted === "string") {
				return converted;
			}
			const printedValue = print(value);
			const printedConverted = print(converted);
			throw new Error(
				`The to-Str conversion of \`${printedValue}\` produced \`${printedConverted}\`, not a Str!`
			);
		})
		.join("");
}

export function SymConstructor(value) {
	if (typeof value === "symbol") {
		return value;
	}
	assertType(StrConstructor, value);
	return Symbol.for(value);
}

export function KeywordConstructor(a) {
	if (a instanceof Keyword) {
		return a;
	}
	assertType(StrConstructor, a);
	return Keyword.for(a);
}

Keyword[Special.yaliConstructor] = KeywordConstructor;
KeywordConstructor[Special.jsConstructor] = Keyword;

export function ProcConstructor(value) {
	if (typeof value === "function") {
		return value;
	}
	const converted = toProc.dispatch(value);
	if (typeof converted === "function") {
		return converted;
	}
	const printedValue = print(value);
	const printedConverted = print(converted);
	throw new Error(
		`The to-Proc conversion of \`${printedValue}\` produced \`${printedConverted}\`, not a Proc!`
	);
}

export function ListConstructor(...values) {
	return IList(values);
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

const OnDefKeyword = Keyword.for("on-def");
const DefaultImplKeyword = Keyword.for("default-impl");

export class Interface {
	#implTable;
	arity;
	signature;
	["on-def"];
	["default-impl"];

	constructor(signature, options = IMap()) {
		assertType(ListConstructor, signature);
		signature.forEach((symbol) => assertType(SymConstructor, symbol));
		let nameSym = signature.first();
		assertType(MapConstructor, options);
		let onDef = options.get(OnDefKeyword);
		if (typeof onDef !== "undefined") {
			onDef = ProcConstructor(onDef);
		}
		let defaultImpl = options.get(DefaultImplKeyword);
		if (typeof defaultImpl !== "undefined") {
			defaultImpl = ProcConstructor(defaultImpl);
		}
		this[Special.name] = nameSym.description;
		this.#implTable = IMap();
		this.arity = signature.size - 1;
		this.signature = signature;
		this["on-def"] = onDef;
		this["default-impl"] = defaultImpl;
		this.dispatch = this.dispatch.bind(this);
		// Freeze current properties, but allow additional properties to be
		// added (eg. Special symbols)
		freezeOwnProperties(this);
	}

	["impl-signature"](args) {
		assertType(ListConstructor, args);
		return `(${args.map(typeName).unshift(this[Special.name]).join(" ")})`;
	}

	["def-impl"](args, impl) {
		assertType(ListConstructor, args);
		impl = ProcConstructor(impl);
		if (this.signature.length !== args.length) {
			const implSig = print(this["impl-signature"](args));
			const sig = print(this.signature);
			throw new Error(
				`Cannot define \`${implSig}\` as it does not conform to the signature \`${sig}\`!`
			);
		}
		this.#implTable = this.#implTable.set(args, impl);
		if (typeof this["on-def"] !== "undefined") {
			this["on-def"](args, impl);
		}
	}

	["impl-for"](...args) {
		const typeArgs = IList(args.slice(0, this.arity));
		const impl = this.#implTable.get(typeArgs);
		return impl ?? this["default-impl"];
	}

	dispatch(...args) {
		const typeArgs = IList(args.slice(0, this.arity).map(typeOf));
		const impl = this.#implTable.get(typeArgs);
		if (typeof impl !== "undefined") {
			return impl(...args);
		}
		if (typeof this["default-impl"] !== "undefined") {
			return this["default-impl"](...args);
		}
		const printedArgs = print(IList(args));
		const implSig = this["impl-signature"](typeArgs);
		const message = `The interface \`${implSig}\` is not implemented for arguments: \`${printedArgs}\`!`;
		throw new Error(message);
	}
}

freezeOwnProperties(Interface);
freezeOwnProperties(Interface.prototype);

export function InterfaceConstructor(value) {
	assertType(InterfaceConstructor, value);
	return value;
}

Interface[Special.yaliConstructor] = InterfaceConstructor;
InterfaceConstructor[Special.jsConstructor] = Interface;

function createUnarySignature(name) {
	return IList.of(Symbol.for(name), Symbol.for("a"));
}

function createBinarySignature(name) {
	return IList.of(Symbol.for(name), Symbol.for("a"), Symbol.for("b"));
}

export const toBool = new Interface(createUnarySignature("to-Bool"));

export const toNum = new Interface(createUnarySignature("to-Num"));

export const toStr = new Interface(
	createUnarySignature("to-Str"),
	IMap([[DefaultImplKeyword, print]])
);

export const toProc = new Interface(createBinarySignature("to-Proc"));

export const first = new Interface(createUnarySignature("first"));

export const rest = new Interface(createUnarySignature("rest"));

export const isEmpty = new Interface(createUnarySignature("empty?"));

function onHashDef(type, impl) {
	if (typeof type !== "function") {
		throw new Error(`Could not hook hashCode for type ${print(type)}!`);
	}
	const jsConstructor = type[Special.jsConstructor];
	if (typeof jsConstructor === "function") {
		type = jsConstructor;
	}
	type.prototype.hashCode = function () {
		return impl(this);
	};
}

export const hash = new Interface(
	createUnarySignature("hash"),
	IMap([
		[DefaultImplKeyword, ihash],
		[OnDefKeyword, onHashDef],
	])
);

function onBinaryEqHash(type, impl) {
	if (typeof type !== "function") {
		throw new Error(`Could not hook equals for type ${print(type)}!`);
	}
	const jsConstructor = type[Special.jsConstructor];
	if (typeof jsConstructor === "function") {
		type = jsConstructor;
	}
	type.prototype.equals = function (other) {
		return impl(this, other);
	};
}

export const BinaryEq = new Interface(
	createBinarySignature("binary="),
	IMap([
		[DefaultImplKeyword, (a, b) => is(a, b)],
		[OnDefKeyword, onBinaryEqHash],
	])
);

export function typeOf(value) {
	switch (typeof value) {
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
			if (value === null) {
				break;
			}
			if (isList(value)) {
				return ListConstructor;
			}
			if (isMap(value)) {
				return MapConstructor;
			}
			const jsConstructor = value.constructor;
			let constructor = jsConstructor[Special.yaliConstructor];
			if (typeof constructor === "undefined") {
				constructor = (...args) => new jsConstructor(...args);
				constructor[Special.name] = jsConstructor.name;
				constructor[Special.jsConstructor] = jsConstructor;
				jsConstructor[Special.yaliConstructor] = constructor;
			}
			return constructor;
	}
	const printedValue = print(value);
	throw new Error(`Could not take the type of \`${printedValue}\`!`);
}

export function typeName(type) {
	if (typeof type === "function") {
		const name = type[Special.name] ?? type.name;
		if (typeof name === "string") {
			return name;
		}
	}
	throw new Error(`Cannot find type-name of non type: \`${print(type)}\`!`);
}

export function assertType(type, value) {
	if (type !== typeOf(value)) {
		const typeNameOfType = typeName(type);
		const printedValue = print(value);
		throw new Error(
			`Expected type \`${typeNameOfType}\`, but received: \`${printedValue}\`!`
		);
	}
	return value;
}
