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
let currentSuite;

const Fails = [];
const Errors = [];

function printSuccess(name) {
	console.log(applyCode(FgGreen, ` ✔ ${name}`));
}

function printFail(name, error) {
	console.log(applyCode(FgRed, ` ✘ ${name}`));
}

function printError(name, error) {
	console.log(applyCode(FgYellow, ` ✘ ${name}`));
}

export function test(name, testFunction) {
	try {
		testFunction();
		passes += 1;
		printSuccess(name);
	} catch (error) {
		const qualifiedName = currentSuite + " - " + name;
		if (error instanceof assert.AssertionError) {
			Fails.push([qualifiedName, error]);
			printFail(name, error);
		} else {
			Errors.push([qualifiedName, error]);
			printError(name, error);
		}
		console.log();
		console.log(error);
		console.log();
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
			currentSuite = testFile.replace(Dirname + "/", "");
			if (currentSuite === "test.js") {
				continue;
			}
			console.log(`\n${header} Running tests in ${currentSuite} ...\n`);
			await import(`./${currentSuite}`);
		} catch (error) {
			console.log();
			console.log(error);
			process.exit(1);
		}
	}
	if (Fails.length > 0) {
		console.log(`\n${header} Test failures\n`);
		for (const [name] of Fails) {
			printFail(name);
		}
	}
	if (Errors.length > 0) {
		console.log(`\n${header} Test errors\n`);
		for (const [name] of Errors) {
			printError(name);
		}
	}
	let passesText = applyCode(FgGreen, passes);
	let failsText = applyCode(FgRed, Fails.length);
	let errorsText = applyCode(FgYellow, Errors.length);
	console.log(
		`\n${header} Passes: ${passesText} Fails: ${failsText} Errors: ${errorsText}\n`
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	testMain();
}
