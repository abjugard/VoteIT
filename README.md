# VoteIT
Voting website hosted on a node.js server

Created by Robin Sveningson, styrIT14/15.


### Basic concept

See file 'abstract.md'.


### How to run

1. Clone repository
2. Install node.js and npm (http://nodejs.org/download/)
3. Locate repo directory
4. Install dependencies: 'npm install'
5. Run server: 'node server.js'


### Available commands

* 'help': Show all available commands.
* 'question': Create a new question.
* 'question -s': Create a short question. Vacant and blanks are defaulted to disabled.
* 'question -yn': Create a yes/no question. Answers are defaulted yes/no. Number of required answers is defaulted to 1. Vacant and blanks are defaulted to disabled.
* 'initialize': Initialize the access codes that are needed to login to the voting system, also exports them to the filesystem.
* 'close question': Close the current question and display the result.
* 'status': Show how many clients are connected and the result of the current question.
* 'codes': Display all available access codes and where to find them in the filesystem.
* 'import': Import access codes from an access code document in the filesystem.
* 'export': Export the currently available acccess codes to an access code document in the filesystem.