import { List, isList } from "immutable";
import * as Builtins from "./Builtins.js";
import { printStr } from "./Printer.js";
import { Recured } from "./Recured.js";
import { Constructors, SpecialForms } from "./Symbols.js";

export class Interpreter {
	/** @type {any} */ globalEnv;
	/** @type {any} */ currentEnv;
	/** @type {any} */ stack;

	/**
	 * @param {any} globalEnv
	 */
	constructor(globalEnv) {
		this.globalEnv = Object.setPrototypeOf({}, globalEnv);
		this.currentEnv = this.globalEnv;
		this.stack = [];
	}

	/**
	 *
	 * @param {any} form
	 * @param {any} env
	 * @returns {any} result or snapshot
	 */
	async interp(form, env) {
		return await this.#interpForm(form, env ?? this.globalEnv);
	}

	pushCaller(caller) {
		this.stack.push(caller);
	}

	popCaller() {
		this.stack.pop();
	}

	throwError(error) {
		if (!(error instanceof Error)) {
			throw new Error(printStr`Expected type Error, but received: ${error}!`);
		}
		error.yaliStack = [...this.stack];
		throw error;
	}

	async #interpForm(form, env) {
		this.currentEnv = env;
		if (typeof form === "symbol") {
			let result = env[form];
			if (typeof result !== "undefined") {
				return result;
			}
			if (form in env) {
				return result;
			}
			this.throwError(new Error(printStr`Symbol ${form} is not defined!`));
		}
		if (isList(form) && form.size > 0) {
			let [operator, ...operands] = form;
			// handle special forms
			if (typeof operator === "symbol" && operator in this) {
				return await this[operator](operands, env);
			}
			operator = await this.#interpForm(operator, env);
			if (typeof operator !== "function") {
				operator = await Builtins.Proc(this, operator);
			}
			if (operator.macro) {
				let expansion = await operator(this, ...operands);
				return await this.#interpForm(expansion, env);
			}
			this.pushCaller(operator.procName ?? operator.name ?? "anonymous");
			const result = await operator(
				this,
				...(await this.#interpOperands(operands, env))
			);
			this.popCaller();
			return result;
		}
		// All other forms evaluate to themselves
		return form;
	}

	async #interpOperands(operands, env) {
		const interpedOperands = [];
		const length = operands.length;
		for (let i = 0; i < length; i += 1) {
			const operand = operands[i];
			if (operand === SpecialForms.Splice) {
				const nextOperand = operands[i + 1];
				const interpedNextOperand = await this.#interpForm(nextOperand, env);
				const splicableNextOperand = await Builtins.Iter(
					this,
					interpedNextOperand
				);
				interpedOperands.push(...splicableNextOperand);
				break;
			}
			const interpedOperand = await this.#interpForm(operand, env);
			interpedOperands.push(interpedOperand);
		}
		return interpedOperands;
	}

	async #assignBindings(bindings, env) {
		Builtins.assertType(this, Builtins.List, bindings);
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
				const [...splicedValue] = await Builtins.Iter(this, value);
				const length = operands.length;
				for (let i = 0; i < length; i += 1) {
					const operand = operands[i];
					if (operand === SpecialForms.Splice) {
						const nextOperand = operands[i + 1];
						await this.#assignBinding(
							nextOperand,
							List(splicedValue.slice(i)),
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
					this.#assignBinding(
						operand,
						await Builtins.get(this, value, interpedKey),
						env
					);
				}
				return;
			}
			const interpedType = await this.#interpForm(type, env);
			Builtins.assertType(this, interpedType, value);
			// recurse with the list constructor
			this.#assignBinding(List.of(Constructors.List, ...operands), value, env);
		}
		this.throwError(
			new Error(
				printStr`Cannot bind value: ${value} to binding form: ${bindingForm}!`
			)
		);
	}

	// Special forms

	async [SpecialForms.Def](operands, env) {
		if (operands.length !== 2) {
			this.throwError(new Error("def expects 2 operands!"));
		}
		const [name, value] = operands;
		Builtins.assertType(this, Builtins.Sym, name);
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
		if (operands.length > 3) {
			this.throwError(new Error("if expects 3 or fewer operands!"));
		}
		const [test, thenCase, elseCase] = operands;
		const interpedTest = await this.#interpForm(test, env);
		const booledTest = await Builtins.Bool(this, interpedTest);
		if (booledTest === true) {
			return await this.#interpForm(thenCase, env);
		} else {
			return await this.#interpForm(elseCase, env);
		}
	}

	async [SpecialForms.Do](operands, env) {
		const body = operands;
		let result;
		for (let form of body) {
			result = await this.#interpForm(form, env);
		}
		return result;
	}

	async [SpecialForms.Recur](operands, env) {
		return new Recured(await this.#interpOperands(operands, env));
	}

	async [SpecialForms.Throw](operands, env) {
		if (operands.length !== 1) {
			this.throwError(new Error("throw expects a single operand!"));
		}
		const [throwable] = operands;
		const interpedThrowable = await this.#interpForm(throwable, env);
		this.throwError(interpedThrowable);
	}

	async [SpecialForms.Try](operands, env) {
		const body = operands;
		const elseCase = operands.pop();
		try {
			let result;
			for (let form of body) {
				result = await this.#interpForm(form, env);
			}
			return result;
		} catch (error) {
			if (isList(elseCase) && elseCase.first() === SpecialForms.Catch) {
				if (elseCase.size < 2) {
					this.throwError(new Error("catch expects 1 or more operands!"));
				}
				const [_, binding, ...body] = elseCase;
				const catchEnv = Object.setPrototypeOf({}, env);
				this.#assignBinding(binding, error, catchEnv);
				let result;
				for (let form of body) {
					result = await this.#interpForm(form, catchEnv);
				}
				return result;
			}
			return this.#interpForm(elseCase);
		}
	}

	async [SpecialForms.Catch](operands, env) {
		this.throwError(new Error("Cannot use catch outside of try!"));
	}

	async [SpecialForms.Let](operands, env) {
		const [bindings, ...body] = operands;
		const letEnv = Object.setPrototypeOf({}, env);
		await this.#assignBindings(bindings, letEnv);
		let result;
		for (const form of body) {
			result = await this.#interpForm(form, letEnv);
		}
		return result;
	}

	async [SpecialForms.Proc](operands, env) {
		let [params, ...body] = operands;
		Builtins.assertType(this, Builtins.List, params);
		params = params.unshift(Constructors.List);
		const procImpl = async (_, ...args) => {
			let result;
			for (;;) {
				let procEnv = Object.setPrototypeOf({}, env);
				await this.#assignBinding(params, args, procEnv);
				for (const form of body) {
					result = await this.#interpForm(form, procEnv);
				}
				if (result instanceof Recured) {
					args = result.operands;
					continue;
				}
				return result;
			}
		};
		procImpl.macro = false;
		procImpl.params = params;
		procImpl.body = body;
		return procImpl;
	}

	async [SpecialForms.Macro](operands, env) {
		let proc = await this[SpecialForms.Proc](operands, env);
		proc.macro = true;
		return proc;
	}

	async [SpecialForms.MacroExpand](operands, env) {
		if (operands.length !== 1) {
			this.throwError(new Error("macro-expand expects a single operand!"));
		}
		const [macroApplication] = operands;
		Builtins.assertType(this, Builtins.List, macroApplication);
		const [macro, ...macroOperands] = macroApplication;
		const macroInterped = await this.#interpForm(macro, env);
		if (typeof macroInterped !== "function" || macroInterped.macro !== true) {
			this.throwError(
				new TypeError(
					printStr`Expected macro, but received: ${print(macroInterped)}!`
				)
			);
		}
		return await macroInterped(...macroOperands);
	}

	async [SpecialForms.Quote](operands, _env) {
		if (operands.length !== 1) {
			this.throwError(new Error("quote expects a single operand!"));
		}
		const [quoted] = operands;
		return quoted;
	}

	async [SpecialForms.QuasiQuote](operands, env) {
		if (operands.length !== 1) {
			this.throwError(new Error("quasi-quote expects a single operand!"));
		}
		const [quasiQuoted] = operands;
		if (!isList(quasiQuoted)) {
			return quasiQuoted;
		}
		const quoted = [];
		for (const subForm of quasiQuoted) {
			if (isList(subForm)) {
				const [first, second] = subForm;
				if (first === SpecialForms.Unquote) {
					if (subForm.size !== 2) {
						this.throwError(new Error("unquote expects a single operand!"));
					}
					const interpedSecond = await this.#interpForm(second, env);
					quoted.push(interpedSecond);
					continue;
				}
				if (first === SpecialForms.UnquoteSplice) {
					if (subForm.size !== 2) {
						this.throwError(
							new Error("unquote-slice expects a single operand!")
						);
					}
					const interpedSecond = await this.#interpForm(second, env);
					const sliceableSecond = await Builtins.Iter(this, interpedSecond);
					quoted.push(...sliceableSecond);
					continue;
				}
			}
			const quasiQuotedSubForm = await this[SpecialForms.QuasiQuote](
				[subForm],
				env
			);
			quoted.push(quasiQuotedSubForm);
		}
		return List(quoted);
	}

	async [SpecialForms.Unquote](_operands, _env) {
		this.throwError(new Error("Cannot use unquote outside of quasi-quote!"));
	}

	async [SpecialForms.UnquoteSplice](_operands, _env) {
		this.throwError(
			new Error("Cannot use unquote-splice outside of quasi-quote!")
		);
	}

	async [SpecialForms.Splice](_operands, _env) {
		this.throwError(
			new Error("Cannot use unquote-splice outside of bindings!")
		);
	}
}
