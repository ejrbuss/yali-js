import { isList, isMap, List as IList } from "immutable";
import { Env } from "./env.js";
import { toJsIter } from "./iter.js";
import { printTag, print } from "./printer.js";
import { Recured } from "./recured.js";
import { ConstructorSymbols, Special, SpecialForms } from "./symbols.js";
import {
	assertType,
	BoolConstructor,
	ListConstructor,
	Interface,
	ProcConstructor,
	SymConstructor,
	typeOf,
} from "./types.js";

// TODO reserved words in environment!

export class Interpreter {
	static running;
	//
	constructor() {
		this.globalEnv = new Env("global");
		this.currentEnv = this.globalEnv;
		this.stack = [];
		Interpreter.running = Interpreter.running ?? this;
	}

	interp(form, env) {
		const savedRunning = Interpreter.running ?? this;
		const savedStack = this.stack;
		const savedEnv = this.currentEnv;
		try {
			Interpreter.running = this;
			this.stack = [];
			return this.#interp(form, env ?? this.globalEnv);
		} finally {
			Interpreter.running = savedRunning;
			this.stack = savedStack;
			this.currentEnv = savedEnv;
		}
	}

	#throw(error) {
		if (typeof error === "object" && error !== null) {
			const currentStack = error[Special.stack];
			if (typeof currentStack === "undefined") {
				error[Special.stack] = [...this.stack];
			}
		}
		throw error;
	}

	#wrapExternal(f) {
		try {
			return f();
		} catch (error) {
			this.#throw(error);
		}
	}

	#interp(form, env) {
		this.currentEnv = env;
		if (typeof form === "symbol") {
			let interped = env[form];
			if (typeof interped !== "undefined") {
				return interped;
			}
			if (form in env) {
				return interped;
			}
			this.#throw(new Error(printTag`Symbol ${form} is not defined!`));
		}
		if (isList(form)) {
			let [operator, ...operands] = form;
			if (typeof operator === "symbol") {
				// special forms
				if (operator in this) {
					return this[operator](operands, env);
				}
				// macros
				operator = this.#interp(operator, env);
				if (operator[Special.macro] === true) {
					let expansion = operator(...operands);
					return this.#interp(expansion, env);
				}
			} else {
				operator = this.#interp(operator, env);
			}
			// Try to convert to proc
			if (typeof operator !== "function") {
				if (operator instanceof Interface) {
					operator = operator.dispatch;
				} else {
					operator = this.#wrapExternal(() => ProcConstructor(operator));
				}
			}

			// Interped proc
			let interpedOperands = this.#interpOperands(operands, env);
			if (operator[Special.proc] === true) {
				// Tail call stuff
				for (;;) {
					this.stack.push(operator);
					let interped = operator(...interpedOperands);
					this.stack.pop();
					if (interped && interped instanceof Recured) {
						operator = interped.operator;
						interpedOperands = interped.operands;
					} else {
						return interped;
					}
				}
			}
			// External function (need to catch/rethrow errors)
			return this.#wrapExternal(() => operator(...interpedOperands));
		}
		// All other forms evaluate to themselves
		return form;
	}

	#interpOperands(operands, env) {
		const interpedOperands = [];
		const length = operands.length;
		for (let i = 0; i < length; i += 1) {
			const operand = operands[i];
			if (operand === SpecialForms.Splice) {
				i += 1;
				const nextOperand = operands[i];
				const interpedNextOperand = this.#interp(nextOperand, env);
				const splicableNextOperand = this.#wrapExternal(() =>
					toJsIter(interpedNextOperand)
				);
				interpedOperands.push(...splicableNextOperand);
				continue;
			}
			const interpedOperand = this.#interp(operand, env);
			interpedOperands.push(interpedOperand);
		}
		return interpedOperands;
	}

	#assignBindings(bindings, env) {
		this.#wrapExternal(() => assertType(ListConstructor, bindings));
		const bindingsList = bindings;
		const length = bindingsList.size;
		for (let i = 0; i < length; i += 2) {
			const binding = bindingsList.get(i);
			const value = bindingsList.get(i + 1);
			const interpedValue = this.#interp(value, env);
			this.#assignBinding(binding, interpedValue, env);
		}
	}

	#assignBinding(binding, value, env) {
		if (typeof binding === "symbol") {
			env[binding] = value;
			return;
		}
		if (isList(binding)) {
			const [type, ...operands] = binding;
			// Fast path List
			if (type === ConstructorSymbols.List) {
				const iterable = this.#wrapExternal(() => toJsIter(value));
				const iterator = iterable[Symbol.iterator]();
				const length = operands.length;
				for (let i = 0; i < length; i += 1) {
					const operand = operands[i];
					if (operand === SpecialForms.Splice) {
						const nextOperand = operands[i + 1];
						const rest = [...iterator];
						this.#assignBinding(nextOperand, IList(rest), env);
						break;
					}
					this.#assignBinding(operand, iterator.next().value, env);
				}
				return;
			}
			if (type === ConstructorSymbols.Map && isMap(value)) {
				const length = operands.length;
				for (let i = 0; i < length; i += 2) {
					const key = operands[i];
					const interpedKey = this.#interp(key, env);
					const operand = operands[i + 1];
					this.#assignBinding(operand, value.get(interpedKey), env);
				}
				return;
			}
			const interpedType = this.#interp(type, env);
			this.#wrapExternal(() => assertType(interpedType, value));
			// recurse with the list constructor
			this.#assignBinding(
				IList.of(ConstructorSymbols.List, ...operands),
				value,
				env
			);
		}
		this.#throw(
			new Error(
				printTag`Cannot bind value: ${value} to binding form: ${binding}!`
			)
		);
	}

	#assignStrictBinding(binding, value, env) {
		if (typeof binding === "symbol") {
			env[binding] = value;
			return true;
		}
		if (isList(binding)) {
			const [type, ...operands] = binding;
			// Fast path List
			if (type === ConstructorSymbols.List) {
				const iterable = this.#wrapExternal(() => toJsIter(value));
				const iterator = iterable[Symbol.iterator]();
				const length = operands.length;
				for (let i = 0; i < length; i += 1) {
					const operand = operands[i];
					if (operand === SpecialForms.Splice) {
						const nextOperand = operands[i + 1];
						const rest = [...iterator];
						if (!this.#assignStrictBinding(nextOperand, IList(rest), env)) {
							return false;
						}
						break;
					}
					const next = iterator.next();
					if (next.done) {
						return false;
					}
					if (!this.#assignStrictBinding(operand, next.value, env)) {
						return false;
					}
				}
				return iterator.next().done;
			}
			if (type === ConstructorSymbols.Map && isMap(value)) {
				const length = operands.length;
				for (let i = 0; i < length; i += 2) {
					const key = operands[i];
					const interpedKey = this.#interp(key, env);
					const operand = operands[i + 1];
					const valueAtKey = value.get(interpedKey);
					if (!this.#assignStrictBinding(operand, valueAtKey, env)) {
						return false;
					}
				}
				return true;
			}
			const interpedType = this.#interp(type, env);
			if (interpedType !== typeOf(value)) {
				return false;
			}
			// recurse with the list constructor
			return this.#assignStrictBinding(
				IList.of(ConstructorSymbols.List, ...operands),
				value,
				env
			);
		}
		return binding === value;
	}

	// Special forms
	[SpecialForms.Def](operands, env) {
		const name = operands[0];
		this.#wrapExternal(() => assertType(SymConstructor, name));
		const value = operands[1];
		const interpedValue = this.#interp(value, env);
		if (
			typeof interpedValue === "function" &&
			typeof interpedValue[Special.name] === "undefined"
		) {
			interpedValue[Special.name] = name.description;
		}
		env[name] = interpedValue;
		return interpedValue;
	}

	[SpecialForms.Undef](operands, env) {
		const name = operands[0];
		this.#wrapExternal(() => assertType(SymConstructor, name));
		delete env[name];
	}

	[SpecialForms.If](operands, env) {
		const test = operands[0];
		const interpedTest = this.#interp(test, env);
		const booledTest = this.#wrapExternal(() => BoolConstructor(interpedTest));
		if (booledTest === true) {
			return this.#interp(operands[1], env);
		} else {
			return this.#interp(operands[2], env);
		}
	}

	[SpecialForms.Do](operands, env) {
		const body = operands;
		let result;
		body.forEach((form) => (result = this.#interp(form, env)));
		return result;
	}

	[SpecialForms.Recur](operands, env) {
		const recurApplication = operands[0];
		this.#wrapExternal(() => assertType(ListConstructor, recurApplication));
		const [recurOperator, ...recurOperands] = recurApplication;
		const interpedRecurOperator = this.#interp(recurOperator, env);
		const interpedRecurOperands = this.#interpOperands(recurOperands, env);
		return new Recured(interpedRecurOperator, interpedRecurOperands);
	}

	[SpecialForms.Throw](operands, env) {
		const throwable = operands[0];
		const interpedThrowable = this.#interp(throwable, env);
		this.#throw(interpedThrowable);
	}

	[SpecialForms.Try](operands, env) {
		const body = operands;
		const elseCase = operands.pop();
		try {
			let result;
			body.forEach((form) => (result = this.#interp(form, env)));
			return result;
		} catch (error) {
			if (isList(elseCase) && elseCase.first() === SpecialForms.Catch) {
				const [_, binding, ...body] = elseCase;
				const catchEnv = env.extendEnv("catch");
				this.#assignBinding(binding, error, catchEnv);
				let result;
				body.forEach((form) => (result = this.#interp(form, catchEnv)));
				return result;
			}
			return this.#interp(elseCase, env);
		}
	}

	[SpecialForms.Catch]() {
		this.#throw(new Error("Cannot use catch outside of try!"));
	}

	[SpecialForms.Let](operands, env) {
		const [bindings, ...body] = operands;
		const letEnv = env.extendEnv("let");
		this.#assignBindings(bindings, env);
		let result;
		body.forEach((form) => (result = this.#interp(form, letEnv)));
		return result;
	}

	[SpecialForms.Match](operands, env) {
		const [value, ...cases] = operands;
		const interpedValue = this.#interp(value, env);
		const length = cases.length;
		for (let i = 0; i < length; i += 2) {
			const binding = cases[i];
			const matchEnv = env.extendEnv("match");
			if (this.#assignStrictBinding(binding, interpedValue, matchEnv)) {
				const action = cases[i + 1];
				return this.#interp(action, matchEnv);
			}
		}
	}

	[SpecialForms.Proc](operands, env) {
		const [params, ...body] = operands;
		this.#wrapExternal(() => assertType(ListConstructor, params));
		const paramsList = params.unshift(ConstructorSymbols.List);
		// Specialize proc implementation, basedd on body length
		let anonymous;
		if (body.length === 0) {
			anonymous = (...args) => {
				this.#assignBinding(paramsList, args, {});
			};
		} else if (body.length === 1) {
			const bodyForm = body[0];
			anonymous = (...args) => {
				const procEnv = env.extendEnv("proc");
				this.#assignBinding(paramsList, IList(args), procEnv);
				return this.#interp(bodyForm, procEnv);
			};
		} else {
			anonymous = (...args) => {
				const procEnv = env.extendEnv("proc");
				this.#assignBinding(paramsList, IList(args), procEnv);
				let result;
				body.forEach((form) => (result = this.#interp(form, procEnv)));
				return result;
			};
		}
		anonymous[Special.proc] = true;
		anonymous[Special.params] = params;
		anonymous[Special.body] = body;
		return anonymous;
	}

	[SpecialForms.Macro](operands, env) {
		const proc = this[SpecialForms.Proc](operands, env);
		proc[Special.macro] = true;
		return proc;
	}

	[SpecialForms.Interface](operands, env) {
		const signature = operands[0];
		const fallback = operands[1];
		this.#wrapExternal(() => {
			assertType(ListConstructor, signature);
			signature.forEach((name) => assertType(SymConstructor, name));
		});
		const interpedFallback = this.#interp(fallback, env);
		if (typeof fallback !== "undefined") {
			this.#wrapExternal(() => assertType(ProcConstructor, interpedFallback));
		}
		return new Interface(
			signature.first().description,
			signature.rest(),
			interpedFallback
		);
	}

	[SpecialForms.MacroExpand](operands, env) {
		const macroApplication = operands[0];
		this.#wrapExternal(() => assertType(ListConstructor, macroApplication));
		const [macro, ...macroOperands] = macroApplication;
		const interpedMacro = this.#interp(macro, env);
		const procedMacro = this.#wrapExternal(() =>
			ProcConstructor(interpedMacro)
		);
		return procedMacro(...macroOperands);
	}

	[SpecialForms.Quote](operands) {
		return operands[0];
	}

	[SpecialForms.QuasiQuote](operands, env) {
		const quasiQuoted = operands[0];
		if (!isList(quasiQuoted)) {
			return quasiQuoted;
		}
		const quoted = [];
		quasiQuoted.forEach((subForm) => {
			if (isList(subForm)) {
				const [first, second] = subForm;
				if (first === SpecialForms.Unquote) {
					const interpedSecond = this.#interp(second, env);
					quoted.push(interpedSecond);
					return;
				}
				if (first === SpecialForms.UnquoteSplice) {
					const interpedSecond = this.#interp(second, env);
					const sliceableSecond = this.#wrapExternal(() =>
						toJsIter(interpedSecond)
					);
					quoted.push(...sliceableSecond);
					return;
				}
			}
			const quasiQuotedSubForm = this[SpecialForms.QuasiQuote]([subForm], env);
			quoted.push(quasiQuotedSubForm);
		});
		return IList(quoted);
	}

	[SpecialForms.Unquote]() {
		this.#throw(new Error("Cannot use unquote outside of quasi-quote!"));
	}

	[SpecialForms.UnquoteSplice]() {
		this.#throw(new Error("Cannot use unquote-splice outside of quasi-quote!"));
	}

	[SpecialForms.Splice]() {
		this.#throw(new Error("Cannot use unquote-splice outside of bindings!"));
	}

	async [SpecialForms.Async](operands, env) {
		throw new Error("TODO");
	}

	[SpecialForms.Await]() {
		// Idea return an Awaited (like recured)
		// only allow if in an async block
		// keep track of being in an async block as state
		this.#throw(new Error("Cannot use await outside of async!"));
	}
}
