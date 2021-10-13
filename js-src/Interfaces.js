import { List, Map } from "immutable";
import { Special } from "./symbols.js";
import { printTag } from "./Printer.js";
import * as Builtins from "./Builtins.js";

// This is not actually used
// We may be able to define this in lisp

export class Interface {
	/** @type {string} */ name;
	/** @type {List<string>} */ typeArgsShape;
	/** @type {Map<List<any>, function>} */ #registry;

	constructor(name, typeArgsShape) {
		Builtins.assertType(Builtins.Str, name);
		Builtins.assertType(Builtins.List, typeArgsShape);
		this.name = name;
		this.typeArgsShape = typeArgsShape;
		this.#registry = Map();
	}

	/**
	 * @param {List<any>} typeArgs
	 * @param {function} implementation
	 */
	impl(typeArgs, implementation) {
		Builtins.assertType(Builtins.List, typeArgs);
		Builtins.assertType(Builtins.Proc, implementation);
		if (typeArgs.size !== this.typeArgsShape.size) {
			throw new Error(
				printTag`${this} expects type args with the shape: ${this.typeArgsShape}, but recieved: ${typeArgs}!`
			);
		}
		if (this.#registry.has(key)) {
			let impl = this.#registry.get(key);
			throw new Error(
				printTag`${this} is already implemented for type args: ${typeArgs} with implementation ${impl}!`
			);
		}
		this.#registry = this.#registry.set(key, implementation);
	}

	isImpl(...typeArgs) {
		return this.#registry.has(List(typeArgs));
	}

	signature() {
		return this.typeArgsShape.unshift(this.name);
	}

	async [Special.toProc](...args) {
		let typeArgs = List(args.map(Builtins.typeOf));
		let impl = this.#registry.get(typeArgs);
		if (typeof impl === "undefined") {
			throw new Error(
				printTag`${this} is not implemented for types: ${typeArgs}!`
			);
		}
		return await impl(...args);
	}

	[Special.toStr]() {
		return printTag`#(Interface ${this.signature()})`;
	}
}
