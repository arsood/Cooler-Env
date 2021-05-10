# Cooler-Env

Cooler-Env is a CLI + module utility to help you manage your environment variables better. It is inspired by Ruby on Rails credentials, and operates similarly.

The point of Cooler-Env is to drastically reduce the amount of time a sensitive plain-text key is visible and to provide an intuitive interface to manage keys.

## Installation

Cooler-Env is a CLI utility and a module for use in your project. To install the CLI this can be done globally:

```
npm install cooler-env -g
```

The companion module can be installed to your project locally via:

```
npm install cooler-env --save
```

## Init

To set up a project for the first time with Cooler-Env you will need to perform an init. Here is a sample command:

```
cooler-env init -e development
```

This command will set up two files - a .enc file and a .key file. The .enc file is an encrypted binary containing all of your keys that can be safely committed to version control. The .key file is your secret key file that is used to decrypt the binary file.

WARNING: DO NOT CHECK THE .KEY FILE INTO VERSION CONTROL. PLEASE ADD TO GITIGNORE OTHERWISE YOUR KEYS CAN BE DECRYPTED AND EXPOSED.

### Options:

- e (_required_): Environment you want to set up variables for
- p (_optional_): Directory path you want to use for your encryption key and encrypted files. Defaults to "config".

## Add Key

When you're ready to add a new environment variable key you can use this command. It will open up an interactive interface to create a key and a value. Here is a sample command:

```
cooler-env add -e development
```

### Options:

- e (_required_): Environment you want to add variables for
- p (_optional_): Directory path you want to use for your encryption key and encrypted files. Defaults to "config".

## Edit Key

When you need to change an environment variable key you can use this command. It will open up an interactive interface to select a key to edit and to provide a new value for it. Here is a sample command:

```
cooler-env edit -e development
```

### Options:

- e (_required_): Environment you want to add variables for
- p (_optional_): Directory path you want to use for your encryption key and encrypted files. Defaults to "config".

## Delete Key

When you need to delete an environment variable key you can use this command. It will open up an interactive interface to select a key to delete. Here is a sample command:

```
cooler-env delete -e development
```

### Options:

- e (_required_): Environment you want to add variables for
- p (_optional_): Directory path you want to use for your encryption key and encrypted files. Defaults to "config".

## loadEnv

Cooler-Env comes with a helper function called `loadEnv` that is meant to load all of your environment variables into `process.env` and return a promise when complete. You will use this function in your application's code before using any of the environment variables.

This function takes two arguments: the first is your application's environment (usually passing `process.env.NODE_ENV`), and the second is optionally adding the directory path you want to use for your encryption key and encrypted files. This will default to "config".

Sample usage:

```javascript
const loadEnv = require("cooler-env/loadEnv");

loadEnv(process.env.NODE_ENV)
.then(() => {
  // All variables loaded and accessible in process.env!
});
```
