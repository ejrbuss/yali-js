import Imut, { isList, isMap } from "immutable";
import readline from "readline";
import fs from "fs";
import child_process from "child_process";
import { Keyword as KeywordImpl } from "./keyword.js";
import * as Printer from "./Printer.js";
import * as Reader from "./Reader.js";

// TODO all external functions that can throw, need to be wrapped in
// interpreter.throwError

const JsError = global.Error;

const TypeOftype = {
	undefined: Nil,
	boolean: Bool,
	number: Num,
	string: Str,
	symbol: Sym,
	function: Proc,
};

// Type operations

export function typeOf(interpreter, a) {
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
	if (a instanceof JsError) {
		return Error;
	}
	if (typeof a === "object" && a !== null) {
		let constructor = a.type;
		if (typeof constructor === "function") {
			return constructor;
		}
	}
}

export function typeName(interpreter, type) {
	if (type) {
		return type.typeName ?? type.name;
	}
}

export function assertType(interpreter, type, a) {
	if (type !== typeOf(interpreter, a)) {
		const expected = typeName(interpreter, type);
		const actual = Printer.print(a);
		interpreter.throwError(
			new TypeError(`Expected type: ${expected}, but received: ${actual}!`)
		);
	}
}

// Primitive Type constructors

export function Nil(interpreter) {
	return undefined;
}

export async function Bool(interpreter, a) {
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
				interpreter.throwError(
					new JsError(
						Printer.printStr`The to-Bool conversion of ${a} did not return a Bool!`
					)
				);
			}
			return converted;
		}
	}
	interpreter.throwError(
		new JsError(Printer.printStr`Cannot convert ${a} to Bool!`)
	);
}

export async function Num(interpreter, x) {
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
				interpreter.throwError(
					new JsError(
						Printer.printStr`The to-Num conversion of ${x} did not return a Num!`
					)
				);
			}
			return converted;
		}
	}
	interpreter.throwError(
		new JsError(Printer.printStr`Cannot convert ${x} to Num!`)
	);
}

export async function Str(interpreter, ...xs) {
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
						interpreter.throwError(
							new JsError(
								Printer.printStr`The to-Str conversion of ${x} did not return a Str!`
							)
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

export function Sym(interpreter, x) {
	let name = Str(interpreter, x);
	if (name.startsWith("#")) {
		interpreter.throwError(
			new JsError(
				`Sym cannot have name ${name}, as # is reserved for unique symbols!`
			)
		);
	}
	return Symbol.for(name);
}

export async function Keyword(interpreter, x) {
	return KeywordImpl.for(Str(interpreter, x));
}

export async function Proc(interpreter, x) {
	if (typeof x === "function") {
		return x;
	}
	if (isList(x) || isMap(x)) {
		return (_interpreter, ...args) => x.get(...args);
	}
	if (typeof x === "object" && x !== null) {
		let toProc = x.toProc;
		if (typeof toProc === "function") {
			let proc = await toProc.apply(x);
			if (typeof proc !== "function") {
				interpreter.throwError(
					new JsError(
						Printer.printStr`The to-Proc conversion of ${x} did not return a Proc!`
					)
				);
			}
			return proc;
		}
	}
	interpreter.throwError(
		new JsError(Printer.printStr`Cannot convert ${x} to Proc!`)
	);
}

export function List(interpreter, ...xs) {
	return Imut.List(xs);
}

export function Map(interpreter, ...xs) {
	let pairs = [];
	let length = xs.length;
	for (let i = 0; i < length; i += 2) {
		pairs.push([xs[i], xs[i + 1]]);
	}
	return Imut.Map(pairs);
}

export async function Error(interpreter, message) {
	return new JsError(await Str(interpreter, message));
}

export async function Iter(interpreter, x) {
	if (isList(x) || isMap(x) || Array.isArray(x)) {
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
	interpreter.throwError(
		new JsError(Printer.printStr`Cannot convert ${x} to Iter!`)
	);
}

// Core operations

export async function get(interpreter, x, ...args) {
	if (isList(x) || isMap(x)) {
		return x.get.apply(x, args);
	}
	if (typeof x === "object" && x !== null) {
		let getImpl = x.get;
		if (typeof getImpl === "function") {
			return await getImpl.apply(x, args);
		}
	}
	interpreter.throwError(
		new JsError(Printer.printStr`Cannot call get on ${x}!`)
	);
}

export async function equals(interpreter, a, b) {
	return Imut.is(a, b);
}

export async function hashCode(interpreter, a) {
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

export async function print(interpreter, a) {
	return await Printer.print(a);
}

export function read(interpreter, a) {
	return Reader.read(a);
}

export async function evalForms(interpreter, forms) {
	let evalEnv = Object.setPrototypeOf({}, interpreter.globalEnv);
	let result;
	for (let form of forms) {
		result = await interpreter.interp(form, evalEnv);
	}
	return result;
}

export async function importForms(interpreter, forms, prefix) {
	prefix = await Str(interpreter, prefix);
	let currentEnv = interpreter.currentEnv;
	let importEnv = Object.setPrototypeOf({}, interpreter.globalEnv);
	for (let form of forms) {
		await interpreter.interp(form, importEnv);
	}
	for (const symbol of Object.getOwnPropertySymbols(importEnv)) {
		currentEnv[Symbol.for(prefix + symbol.description)] = importEnv[symbol];
	}
}

// Numeric operations

export function neg(interpreter, a) {
	return -a;
}

export function add(interpreter, a, b) {
	return a + b;
}

export function sub(interpreter, a, b) {
	return a - b;
}

export function mul(interpreter, a, b) {
	return a * b;
}

export function div(interpreter, a, b) {
	return a / b;
}

export function mod(interpreter, a, b) {
	return a % b;
}

export function pow(interpreter, a, b) {
	return a ** b;
}

export function bitAnd(interpreter, a, b) {
	return a & b;
}

export function bitOr(interpreter, a, b) {
	return a | b;
}

export function bitNot(interpreter, a, b) {
	return ~a;
}

export function bitXor(interpreter, a, b) {
	return a ^ b;
}

export function leftShift(interpreter, a, b) {
	return a << b;
}

export function rightShift(interpreter, a, b) {
	return a >> b;
}

export function rightShiftUnsigned(interpreter, a, b) {
	return a >>> b;
}

export function lt(interpreter, a, b) {
	return a < b;
}

export function lte(interpreter, a, b) {
	return a <= b;
}

export function gt(interpreter, a, b) {
	return a > b;
}

export function gte(interpreter, a, b) {
	return a >= b;
}

// IO operations

export function jsProcess(interpreter) {
	return process;
}

export function writeFile(interpreter, file, content, flag) {
	return fs.writeFileSync(file, content, {
		flag: flag ?? "w",
	});
}

export function readFile(interpreter, file) {
	return fs.readFileSync(file, { encoding: "utf-8" });
}

let readlineInterface;

export async function input(_interpreter, prompt) {
	if (typeof readlineInterface === "undefined") {
		readlineInterface = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
	}
	return new Promise((resolve) => {
		readlineInterface.question(prompt, resolve);
	});
}

export async function exec(interpreter, ...args) {
	const strArgs = await Promise.all(args.map((x) => Str(interpreter, x)));
	return child_process.execSync(strArgs.join(" ")).toString();
}

// interop

export function jsGetMethod(_interpreter, object, property, args) {
	return object[property](...args);
}

export function jsGetProperty(_interpreter, object, property) {
	return object[property];
}

export function jsSetProperty(_interpreter, object, property, value) {
	object[property] = value;
}

// other

export function uniqueSym(interpreter, a) {
	return Symbol(`#${Str(interpreter, a)}`);
}
