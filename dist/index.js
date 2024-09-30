#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const minimist_1 = __importDefault(require("minimist"));
const clear_1 = __importDefault(require("clear"));
const figlet_1 = __importDefault(require("figlet"));
const init_1 = __importDefault(require("./commands/init"));
const edit_1 = __importDefault(require("./commands/edit"));
const add_1 = __importDefault(require("./commands/add"));
const delete_1 = __importDefault(require("./commands/delete"));
(0, clear_1.default)();
console.log(chalk_1.default.green(figlet_1.default.textSync("Cooler Env", { horizontalLayout: "full" })));
const argv = (0, minimist_1.default)(process.argv.slice(2));
if (argv._.length === 0) {
    console.log(chalk_1.default.red("Please enter a valid command"));
    process.exit(0);
}
const availableCommands = {
    init: init_1.default,
    edit: edit_1.default,
    add: add_1.default,
    delete: delete_1.default,
};
if (availableCommands[argv._[0]]) {
    availableCommands[argv._[0]](argv);
}
else {
    console.log(chalk_1.default.red("Please enter a valid command"));
    process.exit(0);
}
