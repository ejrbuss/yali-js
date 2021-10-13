import { isList, isMap } from "immutable";
import { assertType, Bool, Iter, Proc, Sym } from "./Builtins.js";
import { print, printStr } from "./Printer.js";
import { SpecialForms } from "./symbols.js";

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

	async [SpecialForms.Do](operands, env) {}

	async [SpecialForms.Loop](operands, env) {}

	async [SpecialForms.Recur](operands, env) {}

	async [SpecialForms.Throw](operands, env) {}

	async [SpecialForms.Try](operands, env) {}

	async [SpecialForms.Catch](operands, env) {}

	async [SpecialForms.Let](operands, env) {}

	async [SpecialForms.Proc](operands, env) {}

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
