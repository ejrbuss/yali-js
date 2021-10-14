import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
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
import { url } from "inspector";

export function addBuiltins(env) {
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
		// list
		"List-first": (a) => a.first(),
		"List-rest": (a) => a.rest(),
		"List-empty?": (a) => a.isEmpty(),
		// map
		// meta
		read: read,
		print: print,
		eval: seval,
		env: () => getInterpreter().currentEnv,
		// interop
		"js-get": (object, property) => object[property],
		"js-set!": (object, property, value) => (object[property] = value),
		"js-call": (object, thisArg, ...args) => object.call(thisArg, args),
		"js-math": Math,
		// I/O
		"read-file": readFileSync,
		"write-file": writeFileSync,
		"process-args": IList(process.argv),
		"write-stdout": (s) => {
			process.stdout.write(StrConstructor(s));
		},
		"write-stderr": (s) => process.stdout.write(StrConstructor(s)),
		exit: (code) => process.exit(code),
		// other
		"unique-sym": (name) => Symbol.for("#" + StrConstructor(name)),
	};

	// Assign names to all builtins
	for (const name in jsEnv) {
		const builtin = jsEnv[name];
		env[Symbol.for(name)] = builtin;
		builtin[Special.name] = name;
	}
	return env;
}

export function getInterpreter() {
	if (Interpreter.running) {
		return Interpreter.running;
	}
	const interpreter = new Interpreter();
	addPrelude(addBuiltins(interpreter.globalEnv));
	return interpreter;
}

export function addPrelude(env) {
	const srcDir = dirname(fileURLToPath(import.meta.url));
	const preludeFile = join(srcDir, "prelude.yali");
	const preludeSrc = readFileSync(preludeFile, "utf-8");
	return seval(preludeSrc, getInterpreter().globalEnv);
}

export function seval(source, env, file) {
	assertType(StrConstructor, source);
	file && assertType(StrConstructor, file);
	const interpreter = getInterpreter();
	const evalEnv = env ?? extendEnv(interpreter.globalEnv);
	const forms = read(source, file);
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
