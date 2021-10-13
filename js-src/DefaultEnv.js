import { Interpreter } from "./Interpreter.js";
import * as Builtins from "./Builtins.js";
import { Constructors } from "./Symbols.js";

export function createDefaultEnv() {
	let env = {};
	for (const builtinName in Builtins) {
		let symbol = Symbol.for(`__builtin__${builtinName}`);
		env[symbol] = Builtins[builtinName];
	}
	for (const constructorName in Constructors) {
		let symbol = Constructors[constructorName];
		env[symbol] = Builtins[constructorName];
	}
	env[Symbol.for("x")] = [1, 2, 3];
	return env;
}
