#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
let errorText = null;
console.log(chalk_1.default.green(figlet_1.default.textSync("Cooler Env", { horizontalLayout: "full" })));
const argv = (0, minimist_1.default)(process.argv.slice(2));
if (argv._.length === 0) {
    errorText = "Please enter a valid command";
    console.log(chalk_1.default.red(errorText));
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
else if (!errorText) {
    errorText = "Please enter a valid command";
    console.log(chalk_1.default.red(errorText));
}
__exportStar(require("./loadEnv"), exports);
