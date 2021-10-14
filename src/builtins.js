import { readFileSync, writeFileSync } from "fs";
import { List as IList } from "immutable";
import { createEmptyEnv, extendEnv } from "./env.js";
import { Interpreter } from "./interpreter.js";
import { print } from "./printer.js";
import { read } from "./reader.js";
import { Special } from "./symbols.js";
import {
	assertType,
	BinaryEq,
	BoolConstructor,
	first,
	hash,
	KeywordConstructor,
	ListConstructor,
	MapConstructor,
	MultiProcConstructor,
	NilConstructor,
	NumConstructor,
	ProcConstructor,
	rest,
	StrConstructor,
	SymConstructor,
	toBool,
	toNum,
	toProc,
	toStr,
	typeName,
	typeOf,
} from "./types.js";

export function createBuiltinsEnv() {
	const jsEnv = {
		// type related
		Nil: NilConstructor,
		Bool: BoolConstructor,
		Num: NumConstructor,
		Str: StrConstructor,
		Sym: SymConstructor,
		Keywordd: KeywordConstructor,
		List: ListConstructor,
		Map: MapConstructor,
		Proc: ProcConstructor,
		MultiProc: MultiProcConstructor,
		"type-of": typeOf,
		"type-name": typeName,
		"assert-type": assertType,
		"to-Bool": toBool,
		"to-Num": toNum,
		"to-Str": toStr,
		"to-Proc": toProc,
		first: first,
		rest: rest,
		"#": hash,
		"binary=": BinaryEq,
		// numerics
		"Num=": (a, b) => a === b,
		"Num>": (a, b) => a > b,
		"Num<": (a, b) => a < b,
		"Num>=": (a, b) => a >= b,
		"Num<=": (a, b) => a <= b,
		"Num+": (a, b) => a + b,
		"Num-": (a, b) => a - b,
		"Num*": (a, b) => a * b,
		"Num/": (a, b) => a / b,
		"Num^": (a, b) => a ** b,
		"Num%": (a, b) => a % b,
		// bitwise operators
		"bitwise-not": (a) => ~a,
		"bitwise-or": (a, b) => a | b,
		"bitwise-and": (a, b) => a & b,
		"bitwise-xor": (a, b) => a ^ b,
		"bitwise<<": (a, b) => a << b,
		"bitwise>>": (a, b) => a >> b,
		"bitwise>>>": (a, b) => a >>> b,
		// meta
		read: read,
		print: print,
		eval: seval,
		env: env,
		// interop
		"js-get": (object, property) => object[property],
		"js-set!": (object, property, value) => (object[property] = value),
		"js-bind": (object, property) => object[property].bind(object),
		"js-call": (object, thisArg, ...args) => object.call(thisArg, args),
		"js-math": Math,
		// I/O
		"read-file-sync": readFileSync,
		"write-file-sync": writeFileSync,
		"process-args": IList(process.argv),
		"stdout-write": (s) => process.stdout.write(StrConstructor(s)),
		"stderr-write": (s) => process.stdout.write(StrConstructor(s)),
		exit: (code) => process.exit(code),
		// other
		"unique-sym": (name) => Symbol.for("#" + StrConstructor(name)),
	};

	// Assign names to all builtins
	const builtinEnv = createEmptyEnv();
	for (const name in jsEnv) {
		const builtin = jsEnv[name];
		builtinEnv[Symbol.for(name)] = builtin;
		builtin[Special.name] = name;
	}
	return builtinEnv;
}

export function seval(source, env, file) {
	assertType(StrConstructor, source);
	file && assertType(StrConstructor, file);
	const evalEnv = env ?? createBuiltinsEnv();
	const forms = read(source, file);
	const interpreter = Interpreter.running ?? new Interpreter(env);
	let result;
	for (const form of forms) {
		result = interpreter.interp(form, evalEnv);
	}
	return result;
}

export function env() {
	const interpreter = Interpreter.running;
	if (interpreter) {
		return extendEnv(interpreter.currentEnv);
	}
}
