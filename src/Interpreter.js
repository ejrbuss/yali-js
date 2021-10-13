import Imut, { isList, isMap } from "immutable";
import {
	assertType,
	Bool,
	extend,
	get,
	Iter,
	List,
	Proc,
	Sym,
} from "./Builtins.js";
import { printStr } from "./Printer.js";
import { Constructors, SpecialForms } from "./symbols.js";

export class Snapshot {
	/** @type {any} */ env;
	/** @type {continuation} */ continuation;

	constructor(stack, env, continuation) {
		this.stack = stack;
		this.env = env;
		this.continuation = continuation;
	}
}

export class Interpreter {
	/** @type {any} */ globalEnv;
	/** @type {any} */ #currentEnv;

	/**
	 * @param {any} globalEnv
	 */
	constructor(globalEnv) {
		this.globalEnv = globalEnv;
	}

	/**
	 *
	 * @param {any} form
	 * @param {any} env
	 * @returns {Snapshot | any} result or snapshot
	 */
	async interp(form, env) {
		try {
			return await this.#interpForm(form, env ?? this.globalEnv);
		} catch (error) {
			error.env = this.#currentEnv;
			throw error;
		}
	}

	/**
	 * @param {Snapshot} snapshot
	 * @returns {Snapshot | any} result or snapshot
	 */
	async resumeSnapshot(snapshot) {
		try {
			return await snapshot.continuation();
		} catch (error) {
			error.env = this.#currentEnv;
			throw error;
		}
	}

	async #interpForm(form, env) {
		this.#currentEnv = env;
		if (typeof form === "symbol") {
			let result = env[form];
			if (typeof result !== "undefined") {
				return result;
			}
			if (form in env) {
				return result;
			}
			throw new Error(printStr`Symbol ${form} is not defined!`);
		}
		if (isList(form) && form.size > 0) {
			let [operator, ...operands] = form;
			// handle special forms
			if (typeof operator === "symbol" && operator in this) {
				return await this[operator](operands, env);
			}
			operator = await this.#interpForm(operator, env);
			if (typeof operator !== "function") {
				operator = await Proc(operator);
			}
			if (operator.macro) {
				let expansion = await operator(...operands);
				return await this.#interpForm(expansion, env);
			}
			const evaluatedOperands = [];
			const length = operands.length;
			for (let i = 0; i < length; i += 1) {
				const operand = operands[i];
				if (operand === SpecialForms.Splice) {
					const nextOperand = operands[i + 1];
					const interpedNextOperand = await this.#interpForm(nextOperand, env);
					const splicableNextOperand = await Iter(interpedNextOperand);
					evaluatedOperands.push(...splicableNextOperand);
					break;
				}
				const interpedOperand = await this.#interpForm(operand, env);
				evaluatedOperands.push(interpedOperand);
			}
			return await operator(...evaluatedOperands);
		}
		// All other forms evaluate to themselves
		return form;
	}

	async #assignBindings(bindings, env) {
		assertType(List, bindings);
		const length = bindings.size;
		for (let i = 0; i < length; i += 2) {
			const bindingForm = bindings.get(i);
			const valueForm = bindings.get(i + 1);
			const value = await this.#interpForm(valueForm, env);
			await this.#assignBinding(bindingForm, value, env);
		}
	}

	async #assignBinding(bindingForm, value, env) {
		// Recursion bottoms out
		if (typeof bindingForm === "symbol") {
			env[bindingForm] = value;
			return;
		}
		if (isList(bindingForm)) {
			const [type, ...operands] = bindingForm;
			// Fast path List
			if (type === Constructors.List) {
				const [...splicedValue] = await Iter(value);
				const length = operands.length;
				for (let i = 0; i < length; i += 1) {
					const operand = operands[i];
					if (operand === SpecialForms.Splice) {
						const nextOperand = operands[i + 1];
						await this.#assignBinding(
							nextOperand,
							Imut.List(splicedValue.slice(i)),
							env
						);
						break;
					}
					await this.#assignBinding(operand, splicedValue[i], env);
				}
				return;
			}
			if (type === Constructors.Map) {
				const length = operands.length;
				for (let i = 0; i < length; i += 2) {
					const key = operands[i];
					const interpedKey = await this.#interpForm(key, env);
					const operand = operands[i + 1];
					this.#assignBinding(operand, await get(value, interpedKey), env);
				}
				return;
			}
			const interpedType = await this.#interpForm(type, env);
			assertType(interpedType, value);
			// recurse with the list constructor
			this.#assignBinding(
				Imut.List.of(Constructors.List, ...operands),
				value,
				env
			);
		}
		throw new Error(
			printStr`Cannot bind value: ${value} to binding form: ${bindingForm}!`
		);
	}

	// Special forms

	async [SpecialForms.Def](operands, env) {
		const [name, value] = operands;
		assertType(Sym, name);
		const interpedValue = await this.#interpForm(value, env);
		if (
			typeof interpedValue === "function" &&
			typeof interpedValue.procName === "undefined"
		) {
			interpedValue.procName = name.description;
		}
		env[name] = interpedValue;
	}

	async [SpecialForms.If](operands, env) {
		const [test, thenCase, elseCase] = operands;
		const interpedTest = await this.#interpForm(test, env);
		const booledTest = await Bool(interpedTest);
		if (booledTest === true) {
			return await this.#interpForm(thenCase, env);
		} else {
			return await this.#interpForm(elseCase, env);
		}
	}

	async [SpecialForms.Do](operands, env) {
		let result;
		for (let operand of operands) {
			result = await this.#interpForm(operand, env);
		}
		return result;
	}

	async [SpecialForms.Recur](operands, env) {}

	async [SpecialForms.Throw](operands, env) {}

	async [SpecialForms.Try](operands, env) {}

	async [SpecialForms.Catch](operands, env) {}

	async [SpecialForms.Let](operands, env) {
		const [bindings, ...body] = operands;
		const letEnv = extend({}, env);
		await this.#assignBindings(bindings, letEnv);
		let result;
		for (const form of body) {
			result = await this.#interpForm(form, letEnv);
		}
		return result;
	}

	async [SpecialForms.Proc](operands, env) {
		let [params, ...body] = operands;
		assertType(List, params);
		params = params.unshift(Constructors.List);
		const procImpl = async (...args) => {
			let procEnv = extend({}, env);
			await this.#assignBinding(params, args, procEnv);
			let result;
			for (const form of body) {
				result = await this.#interpForm(form, procEnv);
			}
			// TODO handle recur
			return result;
		};
		procImpl.macro = false;
		procImpl.params = params;
		procImpl.body = body;
		return procImpl;
	}

	async [SpecialForms.Macro](operands, env) {}

	async [SpecialForms.MacroExpand](operands, env) {}

	async [SpecialForms.Quote](operands, env) {}

	async [SpecialForms.QuasiQuote](operands, env) {}

	async [SpecialForms.Unquote](operands, env) {}

	async [SpecialForms.UnquoteSplice](operands, env) {}

	async [SpecialForms.Splice](operands, env) {}

	async [SpecialForms.Dot](operands, env) {}

	async [SpecialForms.Breakpoint](operands, env) {}
}
