import { isList, isMap, List as IList, List, Map as IMap } from "immutable";
import { toJsIter } from "./iter.js";
import { printTag } from "./printer.js";
import { Recured } from "./recured.js";
import { ConstructorSymbols, Special, SpecialForms } from "./symbols.js";
import {
	assertType,
	BoolConstructor,
	Env,
	ListConstructor,
	Proc,
	ProcConstructor,
	SymConstructor,
} from "./types.js";

function extendEnv(env: Env): Env {
	return Object.setPrototypeOf({}, env);
}

export class Interpreter {
	static running?: Interpreter;

	globalEnv: Env;
	currentEnv: Env;
	stack: Function[];

	constructor(initialEnv: Env) {
		this.globalEnv = extendEnv(initialEnv);
		this.currentEnv = this.globalEnv;
		this.stack = [];
	}

	interp(form: unknown, env?: Env): unknown {
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

	throw(error: unknown): never {
		if (typeof error === "object" && error !== null) {
			const currentStack = error[Special.stack];
			if (typeof currentStack === "undefined") {
				error[Special.stack] = [...this.stack];
			}
		}
		throw error;
	}

	wrapExternal<T>(f: () => T): T {
		try {
			return f();
		} catch (error) {
			this.throw(error);
		}
	}

	innerInterp(form: unknown, env: Env): unknown {
		this.currentEnv = env;
		if (typeof form === "symbol") {
			let interped = env[form] as unknown;
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
			let anyOperator = operator as Function;
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

	interpOperands(operands: unknown[], env: Env): unknown[] {
		const interpedOperands: unknown[] = [];
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

	assignBindings(bindings: unknown, env: Env): void {
		this.wrapExternal(() => assertType(ListConstructor, bindings));
		const bindingsList = bindings as IList<unknown>;
		const length = bindingsList.size;
		for (let i = 0; i < length; i += 2) {
			const binding = bindingsList.get(i);
			const value = bindingsList.get(i + 1);
			const interpedValue = this.innerInterp(value, env);
			this.assignBinding(binding, interpedValue, env);
		}
	}

	assignBinding(binding: unknown, value: unknown, env: Env): void {
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

	[SpecialForms.Def](operands: unknown[], env: Env): void {
		const name = operands[0];
		this.wrapExternal(() => assertType(SymConstructor, name));
		const nameSymbol = name as symbol;
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

	[SpecialForms.If](operands: unknown[], env: Env): unknown {
		const test = operands[0];
		const interpedTest = this.innerInterp(test, env);
		const booledTest = this.wrapExternal(() => BoolConstructor(interpedTest));
		if (booledTest === true) {
			return this.innerInterp(operands[1], env);
		} else {
			return this.innerInterp(operands[2], env);
		}
	}

	[SpecialForms.Do](operands: unknown[], env: Env): unknown {
		const body = operands;
		let result: unknown;
		body.forEach((form: unknown) => (result = this.innerInterp(form, env)));
		return result;
	}

	[SpecialForms.Recur](operands: unknown[], env: Env): Recured {
		// TODO implement handling in main loop!
		const recurApplication = operands[0];
		this.wrapExternal(() => assertType(ListConstructor, recurApplication));
		const [recurOperator, ...recurOperands] = recurApplication as any;
		const interpedRecurOperator = this.innerInterp(recurOperator, env);
		const interpedRecurOperands = this.interpOperands(recurOperands, env);
		return new Recured(interpedRecurOperator, interpedRecurOperands);
	}

	[SpecialForms.Throw](operands: unknown[], env: Env) {
		const throwable = operands[0];
		const interpedThrowable = this.innerInterp(throwable, env);
		this.throw(interpedThrowable as Error);
	}

	[SpecialForms.Try](operands: unknown[], env: Env): unknown {
		const body = operands;
		const elseCase = operands.pop();
		try {
			let result: unknown;
			body.forEach((form: unknown) => (result = this.innerInterp(form, env)));
			return result;
		} catch (error) {
			if (isList(elseCase) && elseCase.first() === SpecialForms.Catch) {
				const [_, binding, ...body] = elseCase;
				const catchEnv = extendEnv(env);
				this.assignBinding(binding, error, catchEnv);
				let result: unknown;
				body.forEach((form: unknown) => (result = this.innerInterp(form, env)));
				return result;
			}
			return this.innerInterp(elseCase, env);
		}
	}

	[SpecialForms.Catch]() {
		this.throw(new Error("Cannot use catch outside of try!"));
	}

	[SpecialForms.Let](operands: unknown[], env: Env): unknown {
		const [bindings, ...body] = operands;
		const letEnv = extendEnv(env);
		this.assignBindings(bindings, letEnv);
		let result: unknown;
		body.forEach((form: unknown) => (result = this.innerInterp(form, env)));
		return result;
	}

	[SpecialForms.Proc](operands: unknown[], env: Env): unknown {
		const [params, ...body] = operands;
		this.wrapExternal(() =>
			assertType<IList<unknown>>(ListConstructor, params)
		);
		const paramsList = (params as IList<unknown>).unshift(
			ConstructorSymbols.List
		);
		// Specialize proc implementation, basedd on body length
		let anonymous: Proc;
		if (body.length === 0) {
			anonymous = (...args: unknown[]) => {
				this.assignBinding(paramsList, args, {});
			};
		} else if (body.length === 1) {
			const bodyForm = body[0];
			anonymous = (...args: unknown[]) => {
				const procEnv = extendEnv(env);
				this.assignBinding(paramsList, args, procEnv);
				return this.innerInterp(bodyForm, procEnv);
			};
		} else {
			anonymous = (...args: unknown[]) => {
				const procEnv = extendEnv(env);
				this.assignBinding(paramsList, args, procEnv);
				let result: unknown;
				body.forEach((form: unknown) => (result = this.innerInterp(form, env)));
				return result;
			};
		}
		anonymous[Special.proc] = true;
		anonymous[Special.params] = params;
		anonymous[Special.body] = body;
		return anonymous;
	}

	[SpecialForms.Macro](operands: unknown[], env: Env): unknown {
		let proc = this[SpecialForms.Proc](operands, env);
		this[Special.macro] = true;
		return proc;
	}

	[SpecialForms.MacroExpand](operands: unknown[], env: Env): unknown {
		const macroApplication = operands[0];
		this.wrapExternal(() => assertType(ListConstructor, macroApplication));
		const [macro, ...macroOperands] = macroApplication as IList<unknown>;
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

	[SpecialForms.Quote](operands: unknown[]): unknown {
		return operands[0];
	}

	[SpecialForms.QuasiQuote](operands: unknown[], env: Env): unknown {
		const quasiQuoted = operands[0];
		if (!isList(quasiQuoted)) {
			return quasiQuoted;
		}
		const quoted: unknown[] = [];
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
			const quasiQuotedSubForm = this[SpecialForms.QuasiQuote](
				[subForm],
				env
			) as unknown;
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

	async [SpecialForms.Async](operands: unknown[], env: Env): Promise<unknown> {
		throw new Error("TODO");
	}

	[SpecialForms.Await]() {
		// Idea return an Awaited (like recured)
		// only allow if in an async block
		// keep track of being in an async block as state
		this.throw(new Error("Cannot use await outside of async!"));
	}
}
