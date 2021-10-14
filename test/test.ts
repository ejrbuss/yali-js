// This is a barebones test framework to keep this project dependency free
import assert from "assert";
import { execSync } from "child_process";
import {
	applyCode,
	BgGreen,
	Bright,
	FgBlack,
	FgGreen,
	FgRed,
	FgYellow,
} from "../src/ansi.js";
import { dirname } from "path";
import { fileURLToPath } from "url";

const Dirname = dirname(fileURLToPath(import.meta.url));

let passes = 0;

const Fails: [string, unknown][] = [];
const Errors: [string, unknown][] = [];

function printSuccess(name: string) {
	console.log(applyCode(FgGreen, ` ✔ ${name}`));
}

function printFail(name: string, error: unknown) {
	console.log(applyCode(FgRed, ` ✘ ${name}\n`));
	console.error(error);
	console.log();
}

function printError(name: string, error: unknown) {
	console.log(applyCode(FgYellow, ` ✘ ${name}\n`));
	console.error(error);
	console.log();
}

export function test(name: string, testFunction: Function) {
	try {
		testFunction();
		passes += 1;
		printSuccess(name);
	} catch (error) {
		if (error instanceof assert.AssertionError) {
			Fails.push([name, error]);
			printFail(name, error);
		} else {
			Errors.push([name, error]);
			printError(name, error);
		}
	}
}

export async function testMain() {
	let header = applyCode(FgBlack + Bright + BgGreen, " TEST ");
	let testFiles = execSync(`find ${Dirname}/**.js`)
		.toString()
		.trim()
		.split("\n");
	for (const testFile of testFiles) {
		try {
			const basename = testFile.replace(Dirname + "/", "");
			if (basename === "test.js") {
				continue;
			}
			console.log(`\n${header} Running tests in ${basename} ...\n`);
			await import(`./${basename}`);
		} catch (error) {
			console.log();
			console.error(error);
			process.exit(1);
		}
	}

	if (Fails.length > 0) {
		console.log(`\n${header} Test failures\n`);
		for (const [name, error] of Fails) {
			printFail(name, error);
		}
	}

	if (Errors.length > 0) {
		console.log(`\n${header} Test errors\n`);
		for (const [name, error] of Errors) {
			printError(name, error);
		}
	}

	let passesText = applyCode(FgGreen, passes);
	let failsText = applyCode(FgRed, Fails.length);
	let errorsText = applyCode(FgYellow, Errors.length);
	console.log(
		`\n${header} Passes: ${passesText} Fails: ${failsText} Errors: ${errorsText}\n`
	);
}

testMain();
