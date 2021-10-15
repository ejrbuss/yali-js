import fs from "fs";
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
		Keyword: KeywordConstructor,
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
		"empty?": isEmpty,
		"#": hash,
		"binary=": BinaryEq,
		// iteration
		"for-each": forEach,
		map: map,
		filter: filter,
		reduce: reduce,
		chunk: chunk,
		flatten: flatten,
		// meta
		read: read,
		print: print,
		eval: sourceEval,
		// interop
		js: JsProxy,
		// Specials
		__env: () => getInterpreter().currentEnv,
		__name: Special.name,
		"__js-constructor": Special.jsConstructor,
		"__source-ref": Special.sourceRef,
		__macro: Special.macro,
		__proc: Special.proc,
		__stack: Special.stack,
		__params: Special.params,
		__body: Special.body,
		__builtin: Special.builtin,
	};

	// Assign names to all builtins
	for (const name in jsEnv) {
		const builtin = jsEnv[name];
		env[Symbol.for(name)] = builtin;
		if (typeof builtin === "object" || typeof builtin === "function") {
			builtin[Special.name] = name;
			builtin[Special.builtin] = true;
		}
	}
	return env;
}

const ReSafeIdentifier = /^[a-z_$][a-z_$\d]*/i;
const Global =
	typeof window !== "undefined"
		? window
		: typeof global !== "undefined"
		? global
		: {};

export const JsProxy = new Proxy(
	{
		// Operators
		"==": (a, b) => a == b,
		"===": (a, b) => a === b,
		">": (a, b) => a > b,
		"<": (a, b) => a < b,
		">=": (a, b) => a >= b,
		"<=": (a, b) => a <= b,
		"!": (a) => !a,
		"&&": (a, b) => a && b,
		"||": (a, b) => a || b,
		"?:": (a, b, c) => (a ? b : c),
		"??": (a, b) => a ?? b,
		"++": (a) => a++,
		"--": (a) => a--,
		"+": (a, b) => a + b,
		"u-": (a) => -a,
		"-": (a, b) => a - b,
		"*": (a, b) => a * b,
		"/": (a, b) => a / b,
		"%": (a, b) => a % b,
		"**": (a, b) => a ** b,
		"~": (a) => ~a,
		"&": (a, b) => a & b,
		"|": (a, b) => a | b,
		"<<": (a, b) => a << b,
		">>": (a, b) => a >> b,
		">>>": (a, b) => a >>> b,
		new: (a, ...args) => new a(...args),
		delete: (a, b) => delete a[b],
		void: (a) => void a,
		in: (a, b) => a in b,
		typeof: (a) => typeof a,
		instanceof: (a, b) => a instanceof b,
		import: (a) => import(a),
		// node
		process,
		fs,
	},
	{
		get: (cache, property) => {
			let result = cache[property];
			if (typeof result !== "undefined") {
				return result;
			}
			if (typeof property === "string" && ReSafeIdentifier.test(property)) {
				try {
					result = eval(property);
					cache[property] = result;
					return result;
				} catch (error) {}
			}
		},
		set: (cache, property, value) => {
			cache[property] = value;
			return true;
		},
	}
);

export function getInterpreter() {
	if (Interpreter.running) {
		return Interpreter.running;
	}
	const interpreter = new Interpreter();
	addBuiltins(interpreter.globalEnv);
	addPrelude(interpreter.globalEnv);
	interpreter.globalEnv = interpreter.globalEnv.extendEnv("global");
	return interpreter;
}

export function addPrelude(env) {
	const srcDir = dirname(fileURLToPath(import.meta.url));
	const preludeFile = join(srcDir, "prelude.yali");
	const preludeSrc = fs.readFileSync(preludeFile, "utf-8");
	return sourceEval(preludeSrc, env, preludeFile);
}

export function sourceEval(source, env, file) {
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
		const xIter = toJsIter(x);
		acc.push(...xIter);
	}
	return IList(acc);
}

error[Special.help] = `Creates a new \`Error\` instance

# Syntax
\`\`\`yali
(error)
(error message)
(error message data)
\`\`\`

# Parameters
\`message\` :: (protocol to-Str)
: A human-readable description of the error.
\`data\` :: Map (default \`nil\`)
: A map of data to attach to this error under the property \`data\`.`;
export function error(message, data) {
	if (typeof message !== "undefined") {
		message = StrConstructor(message);
	}
	const error = new Error(message);
	if (typeof data !== "undefined") {
		error.data = assertType(MapConstructor, data);
	}
	return error;
}
