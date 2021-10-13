import Imut, { isList, isMap } from "immutable";
import readline from "readline";
import fs from "fs";
import child_process from "child_process";
import { Keyword as KeywordImpl } from "./keyword.js";
import * as Printer from "./Printer.js";
import * as Reader from "./Reader.js";

const TypeOftype = {
	undefined: Nil,
	boolean: Bool,
	number: Num,
	string: Str,
	symbol: Sym,
	function: Proc,
};

// Type operations

export function typeOf(a) {
	let constructor = TypeOftype[typeof a];
	if (typeof constructor !== "undefined") {
		return constructor;
	}
	if (Imut.isList(a)) {
		return List;
	}
	if (Imut.isMap(a)) {
		return Map;
	}
	if (typeof a === "object" && a !== null) {
		let constructor = a.type;
		if (typeof constructor === "function") {
			return constructor;
		}
	}
	return Unknown;
}

export function typeName(a) {
	let constructor = TypeOftype[typeof a];
	if (typeof constructor !== "undefined") {
		return constructor.name;
	}
	if (typeof a === "object" && a !== null) {
		let name = a.typeName;
		if (typeof name === "string") {
			return name;
		}
	}
	return Unknown.name;
}

export function isType(type, a) {
	let constructor = TypeOftype[typeof a];
	if (typeof constructor !== "undefined") {
		return constructor === type;
	}
	if (type === List) {
		return Imut.isList(a);
	}
	if (type === Map) {
		return Imut.isMap(a);
	}
	if (typeof a === "object" && a !== null) {
		let constructor = a.type;
		if (typeof constructor === "function") {
			return constructor === type;
		}
	}
	return type === Unknown;
}

export function assertType(type, a) {
	if (!isType(type, a)) {
		throw new TypeError(
			`Expected type: ${typeName(type)}, but received: ${print(a)}!`
		);
	}
}

// Primitive Type constructors

export function Nil() {
	return undefined;
}

export async function Bool(a) {
	if (typeof a === "boolean") {
		return a;
	}
	if (typeof a === "undefined") {
		return a;
	}
	if (typeof a === "object" && a !== null) {
		let converter = a.toBool;
		if (typeof converter === "function") {
			let converted = await converter.apply(a);
			if (typeof converted !== "boolean") {
				throw new Error(
					Printer.printStr`The to-Bool conversion of ${a} did not return a Bool!`
				);
			}
			return converted;
		}
	}
	throw new Error(Printer.printStr`Cannot convert ${a} to Bool!`);
}

export async function Num(x) {
	if (typeof x === "number") {
		return x;
	}
	if (typeof x === "string") {
		return parseFloat(x);
	}
	if (typeof x === "object" && a !== null) {
		let converter = x.toNum;
		if (typeof converter === "function") {
			let converted = await converter.apply(x);
			if (typeof converted !== "number") {
				throw new Error(
					Printer.printStr`The to-Num conversion of ${x} did not return a Num!`
				);
			}
			return converted;
		}
	}
	throw new Error(Printer.printStr`Cannot convert ${x} to Num!`);
}

export async function Str(...xs) {
	let stringified = await Promise.all(
		xs.map(async (x) => {
			if (typeof x === "string") {
				return x;
			}
			if (typeof x === "undefined") {
				return "";
			}
			if (typeof x === "object" && x !== null) {
				let converter = x.toStr;
				if (typeof converter === "function") {
					let converted = await converter.apply(x);
					if (typeof converted !== "string") {
						throw new Error(
							Printer.printStr`The to-Str conversion of ${x} did not return a Str!`
						);
					}
					return converted;
				}
			}
			return Printer.print(x);
		})
	);
	return stringified.join("");
}

export function Sym(x) {
	let name = Str(x);
	if (name.startsWith("#")) {
		throw new Error(
			`Sym cannot have name ${name}, as # is reserved for unique symbols!`
		);
	}
	return Symbol.for(name);
}

export async function Keyword(x) {
	return KeywordImpl.for(Str(x));
}

export async function Proc(x) {
	if (typeof x === "function") {
		return x;
	}
	if (isList(x) || isMap(x)) {
		return x.get.bind(x);
	}
	if (typeof x === "object" && x !== null) {
		let toProc = x.toProc;
		if (typeof toProc === "function") {
			let proc = await toProc.apply(x);
			if (typeof proc !== "function") {
				throw new Error(
					Printer.printStr`The to-Proc conversion of ${x} did not return a Proc!`
				);
			}
			return proc;
		}
	}
	throw new Error(Printer.printStr`Cannot convert ${x} to Proc!`);
}

export function List(...xs) {
	return Imut.List(xs);
}

export function Map(...xs) {
	let pairs = [];
	let length = xs.length;
	for (let i = 0; i < length; i += 2) {
		pairs.push([xs[i], xs[i + 1]]);
	}
	return Imut.Map(pairs);
}

export function Unknown() {
	return {};
}

export async function Iter(x) {
	if (isList(x) || isMap(x)) {
		return x;
	}
	if (typeof x === "object" && x !== null) {
		function* makeIter(it) {
			while (typeof it !== "undefined") {
				yield it.first.apply(it);
				it = it.rest.apply(it);
			}
		}
		// best guess that this is probably iterable
		if ("first" in x && "rest" in x) {
			return makeIter(x);
		}
	}
	throw new Error(Printer.printStr`Cannot convert ${x} to Iter!`);
}

// Core operations

export async function get(x, ...args) {
	if (isList(x) || isMap(x)) {
		return x.get.apply(x, args);
	}
	if (typeof x === "object" && x !== null) {
		let getImpl = x.get;
		if (typeof getImpl === "function") {
			return await getImpl.apply(x, args);
		}
	}
	throw new Error(Printer.printStr`Cannot call get on ${x}!`);
}

export async function equals(a, b) {
	return Imut.is(a, b);
}

export async function hashCode(a) {
	if (typeof a === "object" && a !== null) {
		if (Imut.isList(a)) {
			return a.hashCode();
		}
		if (Imut.isMap(a)) {
			return a.hashCode();
		}
		let hashCodeImpl = a.hashCode();
		if (typeof hashCodeImpl === "function") {
			return await hashCodeImpl.apply(a);
		}
	}
	return Imut.hash(a);
}

export async function print(a) {
	return await Printer.print(a);
}

export function read(a) {
	return Reader.read(a);
}

// Numeric operations

export function neg(a) {
	return -a;
}

export function add(a, b) {
	return a + b;
}

export function mul(a, b) {
	return a * b;
}

export function div(a, b) {
	return a / b;
}

export function mod(a, b) {
	return a % b;
}

export function pow(a, b) {
	return a ** b;
}

export function bitAnd(a, b) {
	return a & b;
}

export function bitOr(a, b) {
	return a | b;
}

export function bitNot(a, b) {
	return ~a;
}

export function bitXor(a, b) {
	return a ^ b;
}

export function leftShift(a, b) {
	return a << b;
}

export function rightShift(a, b) {
	return a >> b;
}

export function rightShiftUnsigned(a, b) {
	return a >>> b;
}

export function lt(a, b) {
	return a < b;
}

export function lte(a, b) {
	return a <= b;
}

export function gt(a, b) {
	return a > b;
}

export function gte(a, b) {
	return a >= b;
}

// IO operations

export function nodeProcess() {
	return process;
}

export function writeFile(file, content, flag) {
	return fs.writeFileSync(file, content, {
		flag: flag ?? "w",
	});
}

export function readFile(file) {
	return fs.readFileSync(file, { encoding: "utf-8" });
}

export async function input(prompt) {
	const readlineInterface = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	return new Promise((resolve) => {
		readlineInterface.question(prompt, resolve);
	});
}

export async function exec(...args) {
	const strArgs = await Promise.all(args.map((x) => Str(x)));
	return child_process.execSync(strArgs.join(" ")).toString();
}

// other

export function uniqueSym(a) {
	return Symbol(`#${Str(a)}`);
}

export function extend(target, parent) {
	Object.setPrototypeOf(target, parent);
}
