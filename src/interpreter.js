import { isList, isMap, List as IList, Map as IMap } from "immutable";
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
	InterfaceConstructor,
} from "./types.js";

export class Interpreter {
	static running;
	static #MacroCache = new Map();

	constructor() {
		this.globalEnv = new Env("root");
		this.currentEnv = this.globalEnv;
		this.currentProc = undefined;
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
			const jsStack = error.stack;
			const currentStack = error[Special.stack];
			if (
				jsStack &&
				typeof currentStack === "undefined" &&
				this.stack.length > 0
			) {
				let stackStr = `${error.name}: ${error.message}\n`;
				// The first stack frame is not within a procedure
				this.stack.reverse().forEach(({ form, proc }) => {
					const ref = form[Special.sourceRef];
					if (typeof proc !== "undefined") {
						const name = proc[Special.name] ?? proc.name;
						stackStr += `    at ${name} ${ref}\n`;
					} else {
						stackStr += `    at ${ref}\n`;
					}
				});
				error[Special.stack] = stackStr;
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
		if (typeof form === "symbol") {
			let interped = env[form];
			if (typeof interped !== "undefined") {
				return interped;
			}
			if (form in env) {
				return interped;
			}
			this.#throw(new Error(printTag`Symbol \`${form}\` is not defined!`));
		}
		if (isList(form)) {
			try {
				this.currentEnv = env;
				this.stack.push({ form, proc: this.currentProc });
				const operands = form.toArray();
				let operator = operands.shift();
				if (typeof operator === "symbol") {
					// special forms
					if (operator in this) {
						return this[operator](operands, env);
					}
					// macros
					operator = this.#interp(operator, env);
					if (operator[Special.macro] === true) {
						const expansion = this.#expandMacro(operator, form, operands);
						return this.#interp(expansion, env);
					}
				} else {
					operator = this.#interp(operator, env);
				}
				// Try to convert to proc
				if (typeof operator !== "function") {
					if (operator && operator instanceof Interface) {
						operator = operator.dispatch;
					} else {
						operator = this.#wrapExternal(() => ProcConstructor(operator));
					}
				}

				// Interped proc
				let interpedOperands = this.#interpOperands(operands, env);
				if (operator[Special.proc] === true) {
					const prevProc = this.currentProc;
					this.currentProc = operator;
					// Tail call stuff
					for (;;) {
						let interped = operator(...interpedOperands);
						if (interped && interped instanceof Recured) {
							operator = interped.operator;
							interpedOperands = interped.operands;
						} else {
							this.currentProc = prevProc;
							return interped;
						}
					}
				}
				// External function (need to catch/rethrow errors)
				return this.#wrapExternal(() => operator(...interpedOperands));
			} finally {
				this.stack.pop();
			}
		}
		// All other forms evaluate to themselves
		return form;
	}

	#interpOperands(operands, env) {
		const interpedOperands = [];
		operands.forEach((operand) => {
			if (isList(operand) && operand.first() === SpecialForms.Splice) {
				operand = operand.get(1);
				const interpedOperand = this.#interp(operand, env);
				const splicableOperand = this.#wrapExternal(() =>
					toJsIter(interpedOperand)
				);
				interpedOperands.push(...splicableOperand);
			} else {
				const interpedOperand = this.#interp(operand, env);
				interpedOperands.push(interpedOperand);
			}
		});
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
			return true;
		}
		if (isList(binding)) {
			const [type, ...operands] = binding;
			// Fast path List
			if (type === ConstructorSymbols.List) {
				const iterable = this.#wrapExternal(() => toJsIter(value));
				const iterator = iterable[Symbol.iterator]();
				let spliced = false;
				operands.forEach((operand) => {
					if (spliced) {
						this.#throw(
							new Error(
								printTag`Cannot have further bindings after a splice: ${binding}!`
							)
						);
					}
					if (isList(operand) && operand.first() === SpecialForms.Splice) {
						operand = operand.get(1);
						const rest = [...iterator];
						this.#assignBinding(operand, IList(rest), env);
						spliced = true;
					} else {
						this.#assignBinding(operand, iterator.next().value, env);
					}
				});
				return;
			}
			if (type === ConstructorSymbols.Map && isMap(value)) {
				let remainingValue = value;
				const length = operands.length;
				for (let i = 0; i < length; i += 2) {
					const key = operands[i];
					if (isList(key) && key.first() === SpecialForms.Splice) {
						const operand = key.get(1);
						this.#assignBinding(operand, remainingValue, env);
						remainingValue = IList([]);
					} else {
						const operand = operands[i + 1];
						const interpedKey = this.#interp(key, env);
						this.#assignBinding(operand, value.get(interpedKey), env);
						remainingValue = remainingValue.remove(interpedKey);
					}
				}
				return;
			}
			const interpedType = this.#interp(type, env);
			if (typeof interpedType !== "undefined") {
				const signature = interpedType.signature;
				if (isList(signature)) {
					const properties = signature
						.rest()
						.map((propertySymbol) => value[propertySymbol.description]);
					this.#wrapExternal(() => assertType(interpedType, value));
					this.#assignBinding(
						IList.of(ConstructorSymbols.List, ...operands),
						properties,
						env
					);
					return;
				}
			}
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
				let spliced = false;
				for (const operand of operands) {
					if (spliced) {
						this.#throw(
							new Error(
								printTag`Cannot have further bindings after a splice: ${binding}!`
							)
						);
					}
					if (isList(operand) && operand.first() === SpecialForms.Splice) {
						const sliceOperand = operand.get(1);
						const rest = [...iterator];
						if (!this.#assignBinding(sliceOperand, IList(rest), env)) {
							return false;
						}
						spliced = true;
					} else {
						const next = iterator.next();
						if (next.done) {
							return false;
						}
						if (!this.#assignBinding(operand, next.value, env)) {
							return false;
						}
					}
				}
				return iterator.next().done;
			}
			if (type === ConstructorSymbols.Map && isMap(value)) {
				let remainingValue = value;
				const length = operands.length;
				for (let i = 0; i < length; i += 2) {
					const key = operands[i];
					if (isList(key) && key.first() === SpecialForms.Splice) {
						const operand = key.get(1);
						if (!this.#assignStrictBinding(operand, remainingValue, env)) {
							return false;
						}
						remainingValue = IList([]);
					} else {
						const operand = operands[i + 1];
						const interpedKey = this.#interp(key, env);
						if (
							!this.#assignStrictBinding(operand, value.get(interpedKey), env)
						) {
							return false;
						}
						remainingValue = remainingValue.remove(interpedKey);
					}
				}
				return true;
			}
			console.log(new Error().stack);
			const interpedType = this.#interp(type, env);
			if (typeof interpedType !== "undefined") {
				const signature = interpedType.signature;
				if (
					interpedType === this.#wrapExternal(() => typeOf(value)) &&
					isList(signature)
				) {
					const properties = signature
						.rest()
						.map((propertySymbol) => value[propertySymbol.description]);
					return this.#assignStrictBinding(
						IList.of(ConstructorSymbols.List, ...operands),
						properties,
						env
					);
				}
			}
		}
		return binding === value;
	}

	#expandMacro(macro, form, operands) {
		let cache;
		if (Interpreter.#MacroCache.has(macro)) {
			cache = Interpreter.#MacroCache.get(macro);
		} else {
			cache = IMap();
			Interpreter.#MacroCache.set(macro, cache);
		}
		const prevProc = this.currentProc;
		this.currentProc = macro;
		const listOperands = IList(operands);
		if (cache.has(listOperands)) {
			return cache.get(listOperands);
		}
		const expanded = macro(...operands);
		cache.set(listOperands, expanded);
		this.currentProc = prevProc;
		if (
			typeof form !== "undefined" &&
			typeof form[Special.sourceRef] !== "undefined"
		) {
			this.#deeplyApplySourceRef(expanded, form[Special.sourceRef]);
		}
		return expanded;
	}

	#deeplyApplySourceRef(form, ref) {
		if (isList(form)) {
			form[Special.sourceRef] = ref;
			form.forEach((subForm) => this.#deeplyApplySourceRef(subForm, ref));
		}
	}

	// Special forms
	[SpecialForms.Def](operands, env) {
		const name = operands[0];
		this.#wrapExternal(() => assertType(SymConstructor, name));
		const value = operands[1];
		const interpedValue = this.#interp(value, env);
		env[name] = interpedValue;
		return interpedValue;
	}

	[SpecialForms.DefProc](operands, env) {
		const [signature, ...body] = operands;
		this.#wrapExternal(() => {
			assertType(ListConstructor, signature);
			assertType(SymConstructor, signature.first());
		});
		const name = signature.first();
		const params = signature.rest();
		const proc = this[SpecialForms.Proc]([params, ...body], env);
		proc.arity = params.includes(SpecialForms.Splice) ? Infinity : params.size;
		proc[Special.name] = name.description;
		this[SpecialForms.Def]([name, proc], env);
		return proc;
	}

	[SpecialForms.DefMacro](operands, env) {
		const proc = this[SpecialForms.DefProc](operands, env);
		proc[Special.macro] = true;
		return proc;
	}

	[SpecialForms.DefType](operands, env) {
		const [signature] = operands;
		this.#wrapExternal(() => {
			assertType(ListConstructor, signature);
			signature.forEach((symbol) => assertType(SymConstructor, symbol));
		});
		class Anonymous {}
		const name = signature.first();
		const params = signature.rest();
		const constructor = (...args) => {
			const target = new Anonymous();
			for (let i = 0; i < params.size; i += 1) {
				target[params.get(i).description] = args[i];
			}
			return target;
		};
		constructor[Special.name] = name.description;
		constructor[Special.jsConstructor] = Anonymous;
		constructor.signature = signature;
		Anonymous[Special.name] = name.description;
		Anonymous[Special.yaliConstructor] = constructor;
		return this[SpecialForms.Def]([name, constructor], env);
	}

	[SpecialForms.DefInterface](operands, env) {
		const signature = operands[0];
		const options = operands[1];
		const interpedOptions = this.#interp(options, env);
		const iface = this.#wrapExternal(
			() => new Interface(signature, interpedOptions)
		);
		return this[SpecialForms.Def]([signature.first(), iface], env);
	}

	[SpecialForms.DefImpl](operands, env) {
		const signature = operands[0];
		const impl = operands[1];
		this.#wrapExternal(() => assertType(ListConstructor, signature));
		const [iface, ...typeArgs] = this.#interpOperands([...signature], env);
		this.#wrapExternal(() => assertType(InterfaceConstructor, iface));
		const interpedImpl = this.#interp(impl, env);
		this.#wrapExternal(() => iface["def-impl"](IList(typeArgs), interpedImpl));
		return iface;
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

	async [SpecialForms.Async](operands, env) {
		throw new Error("TODO");
	}

	[SpecialForms.Await]() {
		// Idea return an Awaited (like recured)
		// only allow if in an async block
		// keep track of being in an async block as state
		this.#throw(new Error("Cannot use await outside of async!"));
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
		// Specialize proc implementation, based on body length
		let anonymous;
		if (body.length === 0) {
			anonymous = (...args) => {
				this.#assignBinding(paramsList, args, {});
			};
		} else if (body.length === 1) {
			const bodyForm = body[0];
			const interpreter = this;
			anonymous = function (...args) {
				const procEnv = env.extendEnv("proc");
				env[Special.this] = this;
				interpreter.#assignBinding(paramsList, IList(args), procEnv);
				return interpreter.#interp(bodyForm, procEnv);
			};
		} else {
			const interpreter = this;
			anonymous = function (...args) {
				const procEnv = env.extendEnv("proc");
				env[Special.this] = this;
				interpreter.#assignBinding(paramsList, IList(args), procEnv);
				let result;
				body.forEach((form) => (result = interpreter.#interp(form, procEnv)));
				return result;
			};
		}
		anonymous[Special.proc] = true;
		anonymous[Special.params] = params;
		anonymous[Special.body] = body;
		return anonymous;
	}

	[SpecialForms.MacroExpand](operands, env) {
		const macroApplication = operands[0];
		this.#wrapExternal(() => assertType(ListConstructor, macroApplication));
		const [macro, ...macroOperands] = macroApplication;
		const interpedMacro = this.#interp(macro, env);
		const procedMacro = this.#wrapExternal(() =>
			ProcConstructor(interpedMacro)
		);
		return this.#expandMacro(procedMacro, undefined, macroOperands);
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
		this.#throw(
			new Error("Cannot use splice outside of application or binding!")
		);
	}

	[SpecialForms.Dot](operands, env) {
		const [target, ...keys] = operands;
		const interpedTarget = this.#interp(target, env);
		const interpedKeys = this.#interpOperands(keys, env);
		let bindTarget;
		let result = interpedTarget;
		interpedKeys.forEach((key) => {
			bindTarget = result;
			result = result[key];
		});
		if (typeof result === "function" && bindTarget) {
			let bound = result.bind(bindTarget);
			bound.nobind = result;
			result = bound;
		}
		return result;
	}
}
