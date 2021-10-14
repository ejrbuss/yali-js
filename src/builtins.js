import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { List as IList } from "immutable";
import { Interpreter } from "./interpreter.js";
import { print } from "./printer.js";
import { read } from "./reader.js";
import { Special } from "./symbols.js";
import {
	assertType,
	BinaryEq,
	BoolConstructor,
	count,
	first,
	hash,
	isEmpty,
	KeywordConstructor,
	ListConstructor,
	MapConstructor,
	InterfaceConstructor,
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
import { toJsIter } from "./iter.js";

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
		Interface: InterfaceConstructor,
		"type-of": typeOf,
		"type-name": typeName,
		"assert-type": assertType,
		"to-Bool": toBool,
		"to-Num": toNum,
		"to-Str": toStr,
		"to-Proc": toProc,
		first: first,
		rest: rest,
		count: count,
		"empty?": isEmpty,
		"#": hash,
		"binary=": BinaryEq,
		"js-neg": (a) => -a,
		"js=": (a, b) => a === b,
		"js>": (a, b) => a > b,
		"js<": (a, b) => a < b,
		"js>=": (a, b) => a >= b,
		"js<=": (a, b) => a <= b,
		"js+": (a, b) => a + b,
		"js-": (a, b) => a - b,
		"js*": (a, b) => a * b,
		"js/": (a, b) => a / b,
		"js-pow": (a, b) => a ** b,
		"js-mod": (a, b) => a % b,
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
		env: () => getInterpreter().currentEnv,
		// interop
		"get-property": (object, property) => object[property],
		"set-property!": (object, property, value) => (object[property] = value),
		"bind-call": (object, thisArg, ...args) => object.call(thisArg, args),
		"bind-call-property": (object, method, ...args) => object[method](...args),
		"js-type-of": (a) => typeof a,
		"js-math": Math,
		// I/O
		"read-file": readFileSync,
		"write-file": writeFileSync,
		"process-args": IList(process.argv),
		"write-stdout": (s) => process.stdout.write(StrConstructor(s)),
		"write-stderr": (s) => process.stdout.write(StrConstructor(s)),
		exit: (code) => process.exit(code),
		// iteration
		"for-each": forEach,
		map: map,
		filter: filter,
		reduce: reduce,
		chunk: chunk,
		flatten: flatten,
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
	const evalEnv = env ?? interpreter.globalEnv.extendEnv("eval");
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
		return interpreter.currentEnv;
	}
}

export function forEach(p, xs) {
	p = ProcConstructor(p);
	const iter = toJsIter(xs);
	let result;
	for (const x of iter) {
		result = p(x);
	}
	return result;
}

export function map(p, xs) {
	p = ProcConstructor(p);
	const acc = [];
	const iter = toJsIter(xs);
	for (const x of iter) {
		acc.push(p(x));
	}
	return IList(acc);
}

export function filter(p, xs) {
	p = ProcConstructor(p);
	const acc = [];
	const iter = toJsIter(xs);
	for (const x of iter) {
		if (p(x)) {
			acc.push(x);
		}
	}
	return IList(acc);
}

export function reduce(p, acc, xs) {
	p = ProcConstructor(p);
	const iter = toJsIter(xs);
	for (const x of iter) {
		acc = p(acc, x);
	}
	return acc;
}

export function chunk(n, xs) {
	const iter = toJsIter(xs);
	const chunks = [];
	let chunk = [];
	for (const x of iter) {
		if (chunk.length === n) {
			chunks.push(IList(chunk));
			chunk = [];
		}
		chunk.push(x);
	}
	if (chunk.length !== 0) {
		chunks.push(IList(chunk));
	}
	return IList(chunks);
}

export function flatten(xs) {
	const acc = [];
	const iter = toJsIter(xs);
	for (const x of iter) {
		acc.push(...x);
	}
	return IList(acc);
}
