import { isList, isMap, List as IList } from "immutable";
import { toJsIter } from "./iter.js";
import { printTag } from "./printer.js";
import { Recured } from "./recured.js";
import { ConstructorSymbols, Special, SpecialForms } from "./symbols.js";
import {
	assertType,
	BoolConstructor,
	ListConstructor,
	ProcConstructor,
	SymConstructor,
} from "./types.js";

function extendEnv(env) {
	return Object.setPrototypeOf({}, env);
}

export class Interpreter {
	//
	constructor(initialEnv) {
		this.globalEnv = extendEnv(initialEnv);
		this.currentEnv = this.globalEnv;
		this.stack = [];
	}

	interp(form, env) {
		const savedRunning = Interpreter.running;
		const savedStack = this.stack;
		const savedEnv = this.currentEnv;
		try {
			Interpreter.running = this;
			this.stack = [];
			return this.innerInterp(form, env ?? this.globalEnv);
		} finally {
			Interpreter.running = savedRunning;
			this.stack = savedStack;
			this.currentEnv = savedEnv;
		}
	}

	throw(error) {
		if (typeof error === "object" && error !== null) {
			const currentStack = error[Special.stack];
			if (typeof currentStack === "undefined") {
				error[Special.stack] = [...this.stack];
			}
		}
		throw error;
	}

	wrapExternal(f) {
		try {
			return f();
		} catch (error) {
			this.throw(error);
		}
	}

	innerInterp(form, env) {
		this.currentEnv = env;
		if (typeof form === "symbol") {
			let interped = env[form];
			if (typeof interped !== "undefined") {
				return interped;
			}
			if (form in env) {
				return interped;
			}
			this.throw(new Error(printTag`Symbol ${form} is not defined!`));
		}
		if (isList(form)) {
			let [operator, ...operands] = form;
			// Special Forms
			if (typeof operator === "symbol" && operator in this) {
				return this[operator](operands, env);
			}
			// Eval operator
			operator = this.innerInterp(operator, env);
			if (typeof operator !== "function") {
				operator = this.wrapExternal(() => ProcConstructor(operator));
			}
			let anyOperator = operator;
			// Macro expansion
			if (anyOperator[Special.macro] === true) {
				// TODO move over Special.sourceRef of form onto expanded
				let expansion = anyOperator(this, ...operands);
				return this.innerInterp(expansion, env);
			}
			// Interped proc
			const interpedOperands = this.interpOperands(operands, env);
			if (anyOperator[Special.proc] === true) {
				this.stack.push(anyOperator);
				const interped = anyOperator(...interpedOperands);
				this.stack.pop();
				return interped;
			}
			// External function (need to catch/rethrow errors)
			return this.wrapExternal(() => anyOperator(...interpedOperands));
		}
		// All other forms evaluate to themselves
		return form;
	}

	interpOperands(operands, env) {
		const interpedOperands = [];
		const length = operands.length;
		for (let i = 0; i < length; i += 1) {
			const operand = operands[i];
			if (operand === SpecialForms.Splice) {
				const nextOperand = operands[i + 1];
				const interpedNextOperand = this.innerInterp(nextOperand, env);
				const splicableNextOperand = this.wrapExternal(() =>
					toJsIter(interpedNextOperand)
				);
				interpedOperands.push(...splicableNextOperand);
				break;
			}
			const interpedOperand = this.innerInterp(operand, env);
			interpedOperands.push(interpedOperand);
		}
		return interpedOperands;
	}

	assignBindings(bindings, env) {
		this.wrapExternal(() => assertType(ListConstructor, bindings));
		const bindingsList = bindings;
		const length = bindingsList.size;
		for (let i = 0; i < length; i += 2) {
			const binding = bindingsList.get(i);
			const value = bindingsList.get(i + 1);
			const interpedValue = this.innerInterp(value, env);
			this.assignBinding(binding, interpedValue, env);
		}
	}

	assignBinding(binding, value, env) {
		if (typeof binding === "symbol") {
			env[binding] = value;
			return;
		}
		if (isList(binding)) {
			const [type, ...operands] = binding;
			// Fast path List
			if (type === ConstructorSymbols.List) {
				const [...splicedValue] = this.wrapExternal(() => toJsIter(value));
				const length = operands.length;
				for (let i = 0; i < length; i += 1) {
					const operand = operands[i];
					if (operand === SpecialForms.Splice) {
						const nextOperand = operands[i + 1];
						this.assignBinding(nextOperand, IList(splicedValue.slice(i)), env);
						break;
					}
					this.assignBinding(operand, splicedValue[i], env);
				}
				return;
			}
			if (type === ConstructorSymbols.Map && isMap(value)) {
				const length = operands.length;
				for (let i = 0; i < length; i += 2) {
					const key = operands[i];
					const interpedKey = this.innerInterp(key, env);
					const operand = operands[i + 1];
					this.assignBinding(operand, value.get(interpedKey), env);
				}
				return;
			}
			const interpedType = this.innerInterp(type, env);
			this.wrapExternal(() => assertType(interpedType, value));
			// recurse with the list constructor
			this.assignBinding(
				IList.of(ConstructorSymbols.List, ...operands),
				value,
				env
			);
		}
		this.throw(
			new Error(
				printTag`Cannot bind value: ${value} to binding form: ${binding}!`
			)
		);
	}

	// Special forms
	[SpecialForms.Def](operands, env) {
		const name = operands[0];
		this.wrapExternal(() => assertType(SymConstructor, name));
		const nameSymbol = name;
		const value = operands[1];
		const interpedValue = this.innerInterp(value, env);
		if (
			typeof interpedValue === "function" &&
			typeof interpedValue[Special.name] === "undefined"
		) {
			interpedValue[Special.name] = nameSymbol.description;
		}
		env[nameSymbol] = interpedValue;
	}

	[SpecialForms.If](operands, env) {
		const test = operands[0];
		const interpedTest = this.innerInterp(test, env);
		const booledTest = this.wrapExternal(() => BoolConstructor(interpedTest));
		if (booledTest === true) {
			return this.innerInterp(operands[1], env);
		} else {
			return this.innerInterp(operands[2], env);
		}
	}

	[SpecialForms.Do](operands, env) {
		const body = operands;
		let result;
		body.forEach((form) => (result = this.innerInterp(form, env)));
		return result;
	}

	[SpecialForms.Recur](operands, env) {
		// TODO implement handling in main loop!
		const recurApplication = operands[0];
		this.wrapExternal(() => assertType(ListConstructor, recurApplication));
		const [recurOperator, ...recurOperands] = recurApplication;
		const interpedRecurOperator = this.innerInterp(recurOperator, env);
		const interpedRecurOperands = this.interpOperands(recurOperands, env);
		return new Recured(interpedRecurOperator, interpedRecurOperands);
	}

	[SpecialForms.Throw](operands, env) {
		const throwable = operands[0];
		const interpedThrowable = this.innerInterp(throwable, env);
		this.throw(interpedThrowable);
	}

	[SpecialForms.Try](operands, env) {
		const body = operands;
		const elseCase = operands.pop();
		try {
			let result;
			body.forEach((form) => (result = this.innerInterp(form, env)));
			return result;
		} catch (error) {
			if (isList(elseCase) && elseCase.first() === SpecialForms.Catch) {
				const [_, binding, ...body] = elseCase;
				const catchEnv = extendEnv(env);
				this.assignBinding(binding, error, catchEnv);
				let result;
				body.forEach((form) => (result = this.innerInterp(form, env)));
				return result;
			}
			return this.innerInterp(elseCase, env);
		}
	}

	[SpecialForms.Catch]() {
		this.throw(new Error("Cannot use catch outside of try!"));
	}

	[SpecialForms.Let](operands, env) {
		const [bindings, ...body] = operands;
		const letEnv = extendEnv(env);
		this.assignBindings(bindings, letEnv);
		let result;
		body.forEach((form) => (result = this.innerInterp(form, env)));
		return result;
	}

	[SpecialForms.Proc](operands, env) {
		const [params, ...body] = operands;
		this.wrapExternal(() => assertType(ListConstructor, params));
		const paramsList = params.unshift(ConstructorSymbols.List);
		// Specialize proc implementation, basedd on body length
		let anonymous;
		if (body.length === 0) {
			anonymous = (...args) => {
				this.assignBinding(paramsList, args, {});
			};
		} else if (body.length === 1) {
			const bodyForm = body[0];
			anonymous = (...args) => {
				const procEnv = extendEnv(env);
				this.assignBinding(paramsList, args, procEnv);
				return this.innerInterp(bodyForm, procEnv);
			};
		} else {
			anonymous = (...args) => {
				const procEnv = extendEnv(env);
				this.assignBinding(paramsList, args, procEnv);
				let result;
				body.forEach((form) => (result = this.innerInterp(form, env)));
				return result;
			};
		}
		anonymous[Special.proc] = true;
		anonymous[Special.params] = params;
		anonymous[Special.body] = body;
		return anonymous;
	}

	[SpecialForms.Macro](operands, env) {
		let proc = this[SpecialForms.Proc](operands, env);
		this[Special.macro] = true;
		return proc;
	}

	[SpecialForms.MacroExpand](operands, env) {
		const macroApplication = operands[0];
		this.wrapExternal(() => assertType(ListConstructor, macroApplication));
		const [macro, ...macroOperands] = macroApplication;
		const macroInterped = this.innerInterp(macro, env);
		if (
			typeof macroInterped !== "function" ||
			macroInterped[Special.macro] !== true
		) {
			this.throw(
				new Error(printTag`Expected macro, but received: ${macroInterped}!`)
			);
		}
		return macroInterped(...macroOperands);
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
					const interpedSecond = this.innerInterp(second, env);
					quoted.push(interpedSecond);
					return;
				}
				if (first === SpecialForms.UnquoteSplice) {
					const interpedSecond = this.innerInterp(second, env);
					const sliceableSecond = this.wrapExternal(() =>
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
		this.throw(new Error("Cannot use unquote outside of quasi-quote!"));
	}

	[SpecialForms.UnquoteSplice]() {
		this.throw(new Error("Cannot use unquote-splice outside of quasi-quote!"));
	}

	[SpecialForms.Splice]() {
		this.throw(new Error("Cannot use unquote-splice outside of bindings!"));
	}

	async [SpecialForms.Async](operands, env) {
		throw new Error("TODO");
	}

	[SpecialForms.Await]() {
		// Idea return an Awaited (like recured)
		// only allow if in an async block
		// keep track of being in an async block as state
		this.throw(new Error("Cannot use await outside of async!"));
	}
}