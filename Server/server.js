/* 	VoteIT (https://github.com/cthit/VoteIT)
	Created by Robin Sveningson, styrIT14/15  */




/* --------------------- INITIALIZE SERVER --------------------- */

//Must be false on realease version
var DEBUG = false;

//Web application framework for node.js
var express = require('express');
//The application
var app = express();
//System module
var sys = require('sys');
//Used to read console data
var stdin = process.openStdin();
//Used to parse the body of incoming POST requests (to retrieve data from forms)
var bodyParser = require('body-parser');
//Used to prevent the server from crashing on request overloading
var toobusy = require('toobusy');
//Used to handle file system
var fs = require('fs');

//Path to AccessCode dir
var ACCESS_CODE_DIR = 'accesscodes';

if(DEBUG) {
	//Used to log information about GET/POST requests
	var morgan = require('morgan');
	app.use(morgan('dev'));
}

//Inititalize bodyParser, set limit to 15kb
app.use(bodyParser.json({limit: 15000}));
app.use(bodyParser.urlencoded({limit: 15000, extended: true}));

//Handle all application errors
app.use (function (error, req, res, next){
    //Catch json error
    if(DEBUG)
    	msg('EXCEPTION [' + error.type + ']: ' + error.message);
    next();
});

//Initialize toobusy
app.use(function(req, res, next) {
	if (toobusy()) {
		res.send(503, 'I am busy right now, sorry.');
	} else {
		next();
	} 
});

//Initialize routes
require('./app/routes.js')(app);

//Set up ejs
app.set('view engine', 'ejs');
//Static directory for stylesheets and scripts
app.use('/public', express.static(__dirname + '/public'));

//Initialize SSE
var SSE = require('sse');
//Initialize HTTP
var http = require('http');
//Create server from HTTP
var server = http.createServer(app);
//Connected clients
var clients = [];

server.listen(8080, 'localhost', function() {
	var sse = new SSE(server);
	sse.on('connection', function(client) {
		clients.push(client);
		emitQuestion(false);
		client.on('close', function() {
			var index = clients.indexOf(client);
			if(index >= 0)
				clients.splice(index);
		});
	});
});
msg('Server running on port 8080...');

//Emit data to clients
function emitQuestion(empty) {
	for(var i = 0; i < clients.length; i++) {
		if(clients[i]) {
			if(empty)
				clients[i].send(JSON.stringify({ question: null, answers: null, numberOfRequired: null, vacantIndex: -1, blankIndex: -1 }));	
			else
				clients[i].send(JSON.stringify({ question: question, answers: possibleAnswers, numberOfRequired: numberOfRequired, vacantIndex: vacantIndex, blankIndex: blankIndex }));
		}
	}
}

//Initialize stdin
stdin.addListener('data', function(d) {
	handleInput(d.toString().substring(0, d.length-1));
});

initializeFilesystem();





/* --------------------- SERVER FUNCTIONALITY --------------------- */

//All the functions that should be reached by the routes.js file
module.exports = {
	validate: function (code) {
		return validateCode(code);
	},
	register: function(code, a) {
		return registerAnswers(code, a);
	},
	questionExists: function() {
		return questionRunning;
	},
	getQuestionParameters: function() {
		return [question, possibleAnswers, numberOfRequired, vacantIndex, blankIndex];
	},
	validAnswers: function(answers) {
		return checkValidAnswers(answers);
	},
	codeAnsweredQuestion: function(code) {
		return checkCodeAnsweredQuestion(code);
	}
};

/* Method used to post a message to the console. */
function msg(msg) {
	if(!unitTesting) {
		var strings = msg.split('\n');
		for(var i = 0; i < strings.length; i++)
			console.log('>>> ' + strings[i]);
	}
}

/* Post a message and exit. */
function error(str, host) {
	unitTesting = false;
	msg('ERROR in ' + host + '. ' +  str);
	process.exit(1);
}

/* Post a warning. */
function warning(str) {
	msg('[WARNING]: ' + str);
}

/* Used to initialize the access code directory and warn if there are many files. */
function initializeFilesystem() {
	if(!fs.existsSync(ACCESS_CODE_DIR)) {
		if(fs.mkdirSync(ACCESS_CODE_DIR))
			error('Not able to create directory.', 'create access code dir');
		else
			msg('Access code directory initialized.');
	} else
		msg('Access code directory initialized.');
	var files = fs.readdirSync(ACCESS_CODE_DIR);
	var count = 0;
	for(var i = 0; i < files.length; i++)
		if(endsWith(files[i], '.txt'))
			count++;
	if(count > 10) {
		warning('You seem to have a lot of access code files in the ' + ACCESS_CODE_DIR
			+ ' directory. You should probably consider removing old ones.');
	}
}

/* Check if str ends with the suffix. */
function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

/* A structure that represents Commands from the server console. */
function Command(command, parameters, execute, confirm, desc, initialize) {
	if(!command || !isString(command))
		error('Command must be a string.', 'Command construction');
	if(!parameters || !isArrayOfType(parameters, Parameter))
		error('Parameters must be an array of the Parameter type.', 'Command construction');	
	if(!execute || !isFunction(execute))
		error('Execute must be a function.', 'Command construction');
	if(!isBoolean(confirm))
		error('Confirm must be a boolean.', 'Command construction');
	if(desc && !isString(desc))
		error('Description must be a string.', 'Command construction');

	this.command = command;
	this.parameters = parameters;
	this.execute = execute;
	this.confirm = confirm;
	this.desc = desc;
}

/* A structure that represents the parameters a Command from the server can have. */
function Parameter(promptQuestion, check, dynamicString) {
	if(!promptQuestion || !isString(promptQuestion))
		error('PromptQuestion must be a string.', 'Parameter construction');
	if(check && !isFunction(check))
		error('Check must be a function.', 'Parameter construction')
	if(dynamicString && !isFunction(dynamicString))
		error('DynamicString must be a function.', 'Command construction');

	this.promptQuestion = promptQuestion;
	if(!check)
		this.check = function() { return true; };
	else 
		this.check = check;
	if(!dynamicString)
		this.dynamicString = function() { return ''; };
	else
		this.dynamicString = dynamicString;
}

/* Check if the string is an integer. */
function stringIsInteger(s) {
  return !isNaN(parseInt(s)) && isFinite(s);
}

/* Check if the string is a boolean. The string is not supposed to be a traditional true/false
	boolean but a yes/no boolean instead. */
function stringIsBoolean(s) {
	if(s == "yes" || s == "no")
		return true;
	else
		return false;
}

/* Return a description of the given check function. Is used to present understandable error
	messages in the console. */
function getCheckDescription(check) {
	if(check == stringIsInteger)
		return 'is not an integer';
	else if(check == stringIsBoolean)
		return 'is not a boolean';
	else
		return '[no description]';
}

/* Check if the variable is a string. */
function isString(x) {
	return typeof x == 'string' || x instanceof String;
}

/* Check if the variable is a function. */
function isFunction(x) {
	return typeof(x) == 'function';
}

/* Check if the variable is a boolean. */
function isBoolean(x) {
	return typeof(x) == 'boolean';
}

/* Transform a yes/no string to a boolean. */
function getBooleanFromString(s) {
	if(s == "yes")
		return true;
	else
		return false;
}

/* Check if the given array is infact an array, and that it contains the given type. */
function isArrayOfType(array, type) {
	if(array.constructor === Array) {
		if(array.length > 0)
			return array[0] instanceof type;
		else
			return true;
	}
	return false;
}

/* All the available commands in the server console. */
var commands = [
	new Command('question -l', [
			new Parameter('Enter question:'),
			new Parameter('Enter answers separated by comma (without vacant and/or blanks):'),
			new Parameter('Enter number of required parameters:', stringIsInteger),
			new Parameter('Enable vacant?', stringIsBoolean),
			new Parameter('Enable blanks?', stringIsBoolean)
		], startQuestion, true, 'Create a new question.'),
	new Command('question', [
			new Parameter('Enter question:'),
			new Parameter('Enter answers separated by comma (without vacant and/or blanks):'),
			new Parameter('Enter number of required parameters:', stringIsInteger)
		], simpleQuestion, true, 'Create a short question. Vacant and blanks are defaulted to disabled.'),
	new Command('question -yn', [
			new Parameter('Enter question:')
		], yesNoQuestion, true, 'Create a yes/no question. Answers are defaulted yes/no. Number of required answers is defaulted to 1. Vacant and blanks are defaulted to disabled.'),
	new Command('initialize', [
			new Parameter('Enter number of access codes to be generated:', stringIsInteger)
		], initialize, true, 'Initialize the access codes that are needed to login to the voting system.'),
	new Command('close question', [], closeQuestion, true, 'Close the current question and display the result.'),
	new Command('status', [], showStatus, false, 'Show how many clients are connected and the result of the current question.'), 
	new Command('help', [], showHelp, false),
	new Command('codes', [], showCurrentAccessCodes, false, 'Display all available access codes and in which file they exist.'),
	new Command('import', [
			new Parameter('Choose which access codes document to import by giving is\'s number (located inside the brackets): \n'
				+ '------------ Access code documents: ------------\n', stringIsInteger, importDynamicString)
		], importAccessCodes, true, 'Import existing access codes.'),
	new Command('export', [], exportAccessCodes, false, 'Export all access codes to a new access code document.')
];

//Used to confirm the execution of commands
var pendingCommand = false;
//Used to keep track of which command is pending
var currentCommand = null;
//Used to store all parameters for a command
var parameters = [];
//Used to keep track of which parameter is currently being retrieved in the console. */
var parameterIndex = -1;

/* Checks if the command needs more parameters. */
function hasCommandParameter() {
	return parameterIndex < currentCommand.parameters.length;
}

/* Returns the next parameter. */
function getCommandParameter() {
	if(!hasCommandParameter())
		return null;
	return currentCommand.parameters[parameterIndex].promptQuestion + currentCommand.parameters[parameterIndex].dynamicString();
}

/* Clear all data regarding commands from the console. */
function clearCommandData() {
	currentCommand = null;
	pendingCommand = false;
	parameters = [];
	parameterIndex = -1;
}

/* Abort the command that is currently being processed. */
function abortCommand(reason) {
	clearCommandData();
	if(reason)
		msg('Command aborted because ' + reason + '.');
	else
		msg('Command aborted.');
}

/* Validate and save the given parameter. */
function addParameter(value) {
	if(currentCommand.parameters[parameterIndex].check(value)) {
		parameters[parameterIndex] = value;
		parameterIndex++;
		return true;
	} else {
		abortCommand('parameter ' + getCheckDescription(currentCommand.parameters[parameterIndex].check));
		return false;
	}
}

/* Descides what to do with a command from the server console. */
function handleInput(input) {
	if(pendingCommand) {
		if((!input && currentCommand.parameters.length == 0) || (stringIsBoolean(input) && getBooleanFromString(input))) {
			currentCommand.execute(parameters);
			clearCommandData();
		} else
			abortCommand();

	} else {
		if(!currentCommand) {
			for(var i = 0; i < commands.length; i++) {
				if(commands[i].command == input) {
					currentCommand = commands[i];
					parameterIndex = 0;
					if(hasCommandParameter())
						msg(getCommandParameter());
					else {
						pendingCommand = true;
						if(currentCommand.confirm)
							msg('Do you really want to execute command: \'' + currentCommand.command + '\'?');
						else
							handleInput();
					}

					return;
				}
			}
			if(!currentCommand)
				msg('Invalid command.');
		} else {
			if(input == 'abort')
				abortCommand();
			else {
				if(addParameter(input)) {
					if(hasCommandParameter())
						msg(getCommandParameter());
					else {
						pendingCommand = true;

						if(currentCommand.confirm)
							msg('Do you really want to execute command: \'' + currentCommand.command + '\'?');
						else
							handleInput();
					}
				}
			}
		}
	}
}

//All accessCodes that currently exists
var accessCodes = [];
//All values that can be used by an accessCode
var values = [
	'0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W'
];
//Used to keep track on which file is currently being used.
var currentAccessCodesPath = '';
var ACCESS_CODE_DOC_PREFIX = 'Access code: ';
var ACCESS_CODE_LENGTH = 10;

/* Initialize n accessCodes. */
function initialize(parameters) {
	var n = parameters[0];

	msg('Initializing vote server for ' + n + ' participants...');
	msg('Generating codes...');

	generateCodes(n);

	msg('Codes generated:');

	for(var i = 0; i < accessCodes.length; i++)
		msg('[' + (i+1) + '] : ' + accessCodes[i]);

	exportAccessCodes();
    msg('Initialize complete.');
}

/* Generate the codes. */
function generateCodes(n) {
	accessCodes = [];
	for(var i = 0; i < n; i++)
		accessCodes[i] = randomCode();
}

/* Create a new access code document. */
function exportAccessCodes(parameters) {
	//Create the access.txt file with all codes
	var string = '';
	for(var i = 0; i < accessCodes.length; i++)
		string += '---------------------------\n\n' + ACCESS_CODE_DOC_PREFIX + accessCodes[i] + '\n\n';

	msg('Saving to file...');
	var path = ACCESS_CODE_DIR + '/' + getCurrentDateTime() + '.txt';
	writeToFile(string, path, function() {
		currentAccessCodesPath = path;
		msg('Successfully exported access codes.')
	});
}

/* Write data to file. */
function writeToFile(data, path, success) {
	var result = fs.writeFileSync(path, data);
    if(result)
        error(err, 'writing access codes to file');
    else
    	success();
}

/* Generates a random code with length 10. */
function randomCode() {
	code = '';
	for(var i = 0; i < ACCESS_CODE_LENGTH; i++) {
		var random = Math.floor(Math.random() * (values.length - 1));
		code += values[random];
	}
	return code;
}

/* Method used to validate an accessCode.
	Returns -1 if code is invalid, otherwise the index of the code in the accessCode-array. */
function validateCode(code) {
	for(var i = 0; i < accessCodes.length; i++)
		if(accessCodes[i] == code)
			return i;
	return -1;
}

/* Get the current date and time in a nice format. */
function getCurrentDateTime() {
	var date = new Date();
	var month = date.getMonth() + 1;
	return date.getFullYear() + '-' + addZero(month)  + '-' + addZero(date.getDate()) + ' ' 
		+ addZero(date.getHours()) + ' ' + addZero(date.getMinutes()) + ' ' + addZero(date.getSeconds());
}

/* Adds a zero if needed. */
function addZero(i) {
	if(i < 10)
		return '0' + i;
	else
		return i;
}

/* Display current accessCodes to the console. */
function showCurrentAccessCodes(parameters) {
	msg('------------ Available access codes: ------------');
	msg('Available in file: \'' + currentAccessCodesPath + '\'');
	for(var i = 0; i < accessCodes.length; i++)
		msg('[' + (i+1) + '] : ' + accessCodes[i]);
}

var accessCodeDocuments = [];

/* Import already existing access codes. */
function importAccessCodes(parameters) {
	if(parameters[0] < 0 || parameters[0] >= accessCodeDocuments.length) {
		msg('Invalid index. Import aborted.');
		return;
	}
	var str = '' + fs.readFileSync(ACCESS_CODE_DIR + '/' + accessCodeDocuments[parameters[0]]);
	if(str) {
		accessCodes = [];
		var count = 0;
		var lines = str.split('\n');
		for(var i = 0; i < lines.length; i++) {
			var line = lines[i];
			if(line.indexOf(ACCESS_CODE_DOC_PREFIX) >= 0) {
				line = line.replace(ACCESS_CODE_DOC_PREFIX, '');
				if(line.length == ACCESS_CODE_LENGTH) {
					accessCodes[count] = line;
					count++;
				}
			}
		}
		currentAccessCodesPath = ACCESS_CODE_DIR + '/' + accessCodeDocuments[parameters[0]];
		msg('Successfully imported ' + count + ' access codes.');
	} else
		msg('Failed to load document.');
}

function importDynamicString() {
	var str = '';
	var allFiles = fs.readdirSync(ACCESS_CODE_DIR);
	accessCodeDocuments = [];
	if(allFiles) {
		var index = 0;
		for(var i = 0; i < allFiles.length; i++) {
			if(allFiles[i]) {
				if(endsWith(allFiles[i], '.txt')) {
					str += '[' + index + '] ' + allFiles[i];
					if(i != allFiles.length - 1)
						str += '\n';
					accessCodeDocuments[index] = allFiles[i];
					index++;
				}
			}
		}
		return str;
	}
	error('Was not able to open access code directory.', 'importDynamicString');
}

//All accessCodes that have registered an answer to the current question
var codesThatAnswered = [];
//All answers that have been registered
var givenAnswers = [];
//All vacant answers that have been registered
var givenVacantAnswers = [];
//All blank answers that have been registered
var givenBlankAnswers = [];

/* Registers a clients answers. The accessCode 'code' must be valid. The parameter 'a' should be an array of all answers. */
function registerAnswers(code, a) {
	if(questionRunning) {
		var index = validateCode(code);
		if(index >= 0) {
			codesThatAnswered[index] = true;

			var vacants = 0;
			var blanks = 0;
			for(var i = 0; i < a.length; i++) {
				if(a[i] == vacantIndex) {
					givenVacantAnswers[vacants]++;
					vacants++;
				} else if(a[i] == blankIndex) {
					givenBlankAnswers[blanks]++;
					blanks++;
				} else
					givenAnswers[a[i]]++;
			}

			return true;
		}
	}
	return false;
}

/* Clears all information regarding answers. */
function clearAnswers() {
	codesThatAnswered = [];
	givenAnswers = [];
	givenVacantAnswers = [];
	givenBlankAnswers = [];

	for(var i = 0; i < accessCodes.length; i++)
		codesThatAnswered[i] = false;
	for(var i = 0; i < possibleAnswers.length; i++)
		if(i != vacantIndex && i != blankIndex)
			givenAnswers[i] = 0;

	if(vacantIndex >= 0)
		for(var i = 0; i < numberOfRequired; i++)
			givenVacantAnswers[i] = 0;

	if(blankIndex >= 0)
		for(var i = 0; i < numberOfRequired; i++)
			givenBlankAnswers[i] = 0;
}

/* Check if the answers are valid (should always be true unless frontend code has been changed by user). */
function checkValidAnswers(answers) {
	if(answers.length == 0 || answers.length != numberOfRequired || !questionRunning)
		return false;

	var tempArray = [];
	for(var i = 0; i < answers.length; i++)
		tempArray[i] = false;

	for(var i = 0; i < answers.length; i++) {
		if(!stringIsInteger(answers[i]) || answers[i] < 0 || answers[i] >= possibleAnswers.length ||
			answers[i] != vacantIndex && answers[i] != blankIndex && tempArray[answers[i]])
			return false;
		tempArray[answers[i]] = true;
	}

	return true;
}

/* Checks if the code has already been used to answer the question. */
function checkCodeAnsweredQuestion(code) {
	var index = validateCode(code);
	if(index >= 0)
		return codesThatAnswered[index];
	return false;
}

//The current question
var question = '';
//All the possible answers
var possibleAnswers = [];
//How many answers that are required by the user
var numberOfRequired = -1;
//-1 if vacants are disabled, otherwise the index of the 'vacant' answer in the answers array
var vacantIndex = -1;
//-1 if blanks are disabled, otherwise the index of the 'blank' answer in the answers array
var blankIndex = -1;
//Keeps track on whether a question exists
var questionRunning = false;

/* Method used to create a simple yes/no question. */
function yesNoQuestion(parameters) {
	startQuestion([parameters[0], 'ja,nej', 1, false, false]);
}

/* Method used to create a question with no blank/vacant. */
function simpleQuestion(parameters) {
	startQuestion([parameters[0], parameters[1], parameters[2], false, false]);
}

/* Method used to start a new question
	
	OBS! The 'vacant' and 'blank' alternatives are added by this method to the answers array, so that the GUI
	can present all answers without having to add the Vacant and Blank options itself. */
function startQuestion(parameters) {
	var a = parameters[1].split(',');

	//Should be remaked to allow more answers
	if(a.length > 36) {
		msg('Number of required answers can\'t be greater than 36.');
		msg('No question created.');
		return;
	}

	if(questionRunning)
		endQuestion(false);

	question = parameters[0];
	possibleAnswers = a;
	numberOfRequired = parameters[2];

	if(getBooleanFromString(parameters[3])) {
		var i = possibleAnswers.length;
		possibleAnswers[i] = 'Vakant';
		vacantIndex = i;
	} else
		vacantIndex = -1;

	if(getBooleanFromString(parameters[4])) {
		var i = possibleAnswers.length;
		possibleAnswers[i] = 'Blank';
		blankIndex = i;
	} else
		blankIndex = -1;

	clearAnswers();
	questionRunning = true;

	//Send question via the socket connection
	emitQuestion(false);
	msg('Created new question!');
}

/* Used to add the emit=true as a parameter. */
function closeQuestion() {
	endQuestion(true);
}

/* Method used to end a question.
	emit = whether or not to inform clients. */
function endQuestion(emit) {
	if(questionRunning)
		showQuestionResult('previous');

	if(emit)
		//Send an empty question to the clients
		emitQuestion(true);
	
	msg('Question closed.');
	questionRunning = false;
	question = '';
	possibleAnswers = [];
	numberOfRequired = -1;
	vacantIndex = -1;
	blankIndex = -1;
}

/* Displays the result of the question. */
function showQuestionResult(str) {
	msg('Result of ' + str + ' question \'' + question + '\'.');

	var total = calculateTotal();
	for(var i = 0; i < givenAnswers.length; i++)
		if(i != vacantIndex && i != blankIndex)
			msg('\'' + possibleAnswers[i] + '\': ' + givenAnswers[i] + ' votes (' + getPercentage(givenAnswers[i], total) + '%).');
	for(var i = 0; i < givenVacantAnswers.length; i++)
		msg('\'Vacant ' + (i+1) + '\': ' + givenVacantAnswers[i] + ' votes (' + getPercentage(givenVacantAnswers[i], total) + '%).');
	for(var i = 0; i < givenBlankAnswers.length; i++)
		msg('\'Blank ' + (i+1) + '\': ' + givenBlankAnswers[i] + ' votes (' + getPercentage(givenBlankAnswers[i], total) + '%).');

	var numberOfAnswers = 0;
	for(var i = 0; i < codesThatAnswered.length; i++)
		if(codesThatAnswered[i])
			numberOfAnswers++;
	msg('Number of answers: ' + numberOfAnswers + '/' + accessCodes.length);
}

/* Get percentage. */
function getPercentage(n, total) {
	return n / total * 100;
}

/* Calculates the total answers given. */
function calculateTotal() {
	var total = 0;
	for(var i = 0; i < givenAnswers.length; i++)
		total += givenAnswers[i];
	for(var i = 0; i < givenVacantAnswers.length; i++)
		total += givenVacantAnswers[i];
	for(var i = 0; i < givenBlankAnswers.length; i++)
		total += givenBlankAnswers[i];
	return total;
}

/* Display the server's current status in the console. */
function showStatus() {
	msg('------------ Status: ------------');
	msg('Number of connections: ' + clients.length);
	msg('Question active: ' + questionRunning);
	if(questionRunning)
		showQuestionResult('current');
}

/* Display the help in the server console. */
function showHelp() {
	msg('------------ Available commands: ------------');
	for(var i = 0; i < commands.length; i++)
		if(commands[i].command != 'help')
			msg('Command \'' + commands[i].command + '\': ' + commands[i].desc);
}





/* --------------------- UNIT TESTING --------------------- */

//Used to stop console messages when performing unit tests
var unitTesting = false;
//Perform unit tests
if(DEBUG) {
	unitTesting = true;
	var result = performUnitTests();
	if(result)
		error(result, 'Unit Tests');
	else {
		unitTesting = false;
		msg('Unit tests were successfull.')
	}
}

function performUnitTests() {
	var a = testAccessCodes();
	var b = testQuestions();
	var c = testregisterAnswerss();

	clearAnswers();
	closeQuestion();

	return a || b || c;
}

function testAccessCodes() {
	var n = 12;
	//Test default
	if(!accessCodes || accessCodes.length > 0)
		return 'Access codes should be an empty array.';

	initialize([n]);

	//Make sure the correct amount of codes was generated
	if(!accessCodes || accessCodes.length != n)
		return 'Access codes should be an array with '+n+' codes.';

	//Make sure each code has the correct format
	for(var i = 0; i < n; i++)
		if(!accessCodes[i] || accessCodes[i].length != ACCESS_CODE_LENGTH || validateCode(accessCodes[i]) != i)
			return 'Access code should be a valid code and have the length ' + ACCESS_CODE_LENGTH + '.';

	//Make sure validateCode doesn't work for other codes
	for(var i = 0; i < 10; i++)
		if(validateCode(randomCode()) != -1)
			return 'Something is wrong with validateCode.';

	//Test import and export
	var oldCodes = [];
	for(var i = 0; i < n; i++)
		oldCodes[i] = accessCodes[i];
	accessCodes = [];
	importDynamicString();
	importAccessCodes([accessCodeDocuments.length-1]);
	for(var i = 0; i < n; i++)
		if(oldCodes[i] != accessCodes[i])
			return 'Import/Export failed.';
}

function testQuestions() {
	var a = '';
	for(var i = 0; i < 35; i++)
		a += i + ',';
	a += 'a';

	//Test a question without vacant and blank
	startQuestion(['q', a, 2, 'no', 'no']);
	if(question != 'q' || !possibleAnswers || possibleAnswers == [] || numberOfRequired != 2 ||
			blankIndex != -1 || vacantIndex != -1 || !questionRunning)
		return 'Was not able to start a question properly.';

	//Test a question with vacant and blank
	startQuestion(['q', a, 2, 'yes', 'yes']);
	if(question != 'q' || !possibleAnswers || possibleAnswers == [] || numberOfRequired != 2 ||
			vacantIndex != 36 || possibleAnswers[36] != 'Vakant' || blankIndex != 37 || 
			possibleAnswers[37] != 'Blank' || !questionRunning)
		return 'Was not able to start a question properly.';

	//Test endQuestion
	endQuestion(false);
	if(question != '' || possibleAnswers.length != 0 || numberOfRequired != -1 || vacantIndex != -1 ||
			blankIndex != -1 || questionRunning)
		return 'Was not able to close a question properly.';

	//Test yes/no question
	yesNoQuestion('q');
	if(question != 'q' || !possibleAnswers || possibleAnswers == [] || possibleAnswers.length != 2 ||
			possibleAnswers[0] != 'ja' || possibleAnswers[1] != 'nej' || numberOfRequired != 1 ||
			vacantIndex != -1 || blankIndex != -1 || !questionRunning)
		return 'Was not able to start a yes/no question properly.';

	//Test simple question
	simpleQuestion(['q', a, 2]);
	if(question != 'q' || !possibleAnswers || possibleAnswers == [] || numberOfRequired != 2 ||
			vacantIndex != -1 || blankIndex != -1 || !questionRunning)
		return 'Was not able to start a simple question properly.';

	//Test the number of possible answers limit
	a += ',b';
	startQuestion(['q', a, 2, 'yes', 'yes']);
	if(question != 'q' || !possibleAnswers || possibleAnswers == [] || numberOfRequired != 2 ||
			vacantIndex != -1 || blankIndex != -1 || !questionRunning)
		return 'Was not able to start a question properly.';
}

function testregisterAnswerss() {
	var a = testRegisteredAnswersInit();
	var b = testClearRegisteredAnswers();
	var c = testCheckValidAnswer();
	var d = testRegisterAnswer();
	return a || b || c || d;
}

function testRegisteredAnswersInit() {
	initialize([10]);
	startQuestion(['q', 'a,b,c', 2, 'yes', 'yes']);

	//Test default values when starting a new question
	if(codesThatAnswered.length !=  10 || givenAnswers.length != 3 || givenVacantAnswers.length != 2 || givenBlankAnswers.length != 2)
		return 'Default values for the registeredAnswers variables was incorrect.';

	for(var i = 0; i < codesThatAnswered.length; i++)
		if(codesThatAnswered[i])
			return 'Codes-that-answered should all default to false.';

	for(var i = 0; i < givenAnswers.length; i++)
		if(givenAnswers[i] != 0)
			return 'Answers should all default to 0.';

	for(var i = 0; i < givenVacantAnswers.length; i++)
		if(givenVacantAnswers[i] != 0)
			return 'Vacant-answers should all default to 0.';

	for(var i = 0; i < givenBlankAnswers.length; i++)
		if(givenBlankAnswers[i] != 0)
			return 'Blank-answers should all default to 0.';

	//Test checkCodeAnsweredQuestion
	for(var i = 0; i < accessCodes.length; i++)
		if(checkCodeAnsweredQuestion(accessCodes[i]))
			return 'No codes should have answered the question.';

	for(var i = 0; i < accessCodes.length; i++)
		registerAnswers(accessCodes[i], [0]);

	for(var i = 0; i < accessCodes.length; i++)
		if(!checkCodeAnsweredQuestion(accessCodes[i]))
			return 'All codes should have answered the question.';
}

function testClearRegisteredAnswers() {
	//Test clearAnswers (note that the question remains, but the given answers are wiped out)
	clearAnswers();
	if(codesThatAnswered.length !=  10 || givenAnswers.length != 3 || givenVacantAnswers.length != 2 || givenBlankAnswers.length != 2)
		return 'Default values for the registeredAnswers variables was incorrect.';
}

function testCheckValidAnswer() {
	initialize([10]);
	startQuestion(['q', 'a,b,c', 2, 'yes', 'yes']);

	//Zero answers
	if(checkValidAnswers([]))
		return 'Empty answer array should be rejected.';

	//Too few answers
	if(checkValidAnswers([1]))
		return 'Too few answers should be rejected.';

	//Too many answers
	if(checkValidAnswers([0,1,2]))
		return 'Too many answers should be rejected.';

	//Exact amount of answers
	if(!checkValidAnswers([0,1]))
		return 'Exact amount of answers should be accepted.';

	//Question running check
	questionRunning = false;
	if(checkValidAnswers([0,1]))
		return 'Question running = false should prevent answers to be accepted.';
	questionRunning = true;

	//Answers are integers
	if(checkValidAnswers(['a', 'b']))
		return 'Should not accept strings as answers.';

	//Test negative answers
	if(checkValidAnswers([-1, -2]))
		return 'Answers should be rejected if negative.';

	//Test too large answers (a,b,c,vacant,blank = 0 to 4)
	if(checkValidAnswers([5, 5]))
		return 'Answers should be rejected if too large.';
	if(checkValidAnswers([4, 5]))
		return 'Answers should be rejected if too large.';

	//Test two of the same answers (that aren't blank/vacant)
	if(checkValidAnswers([0,0]))
		return 'Answers that are the same should be rejected.';

	//Test two of the same answers (that are blank/vacant)
	if(!checkValidAnswers([3,3]))
		return 'Two vacants should be accepted.';
	if(!checkValidAnswers([4,4]))
		return 'Two blanks should be accepted.';

	//Test vacants/blanks when not enabled
	startQuestion(['q', 'a,b,c', 2, 'no', 'no']);
	if(checkValidAnswers([3,3]))
		return 'Two vacants should not be accepted.';
	if(checkValidAnswers([4,4]))
		return 'Two blanks should not be accepted.';
	if(checkValidAnswers([3,4]))
		return 'One blank and one vacant should not be accepted.';
}

function testRegisterAnswer() {
	initialize([10]);
	startQuestion(['q', 'a,b,c', 2, 'yes', 'yes']);

	//Test questionRunning
	questionRunning = false;
	if(registerAnswers(accessCodes[0], [1,1]))
		return 'Should not accept answers when no question is running.';
	questionRunning = true;

	//Test valid accessCode
	if(registerAnswers(randomCode(), [1,1]))
		return 'Should not accept answers if invalid code.';

	//Test codesThatAnswered is set to true
	registerAnswers(accessCodes[0], [1,1]);
	if(!checkCodeAnsweredQuestion(accessCodes[0]))
		return 'Register answers must set codesThatAnswered to true.';

	clearAnswers();
	
	//Test natural answers
	for(var i = 0; i < accessCodes.length; i++)
		registerAnswers(accessCodes[i], [0,1]);
	if(givenAnswers[0] != accessCodes.length || givenAnswers[1] != accessCodes.length)
		return 'Did not register natural answers correctly.';
	for(var i = 0; i < givenAnswers.length; i++)
		if(i > 1 && givenAnswers[i] != 0)
			return 'Register should not affect other answers than 0 and 1.';

	clearAnswers();

	//Test all vacants
	for(var i = 0; i < accessCodes.length; i++)
		registerAnswers(accessCodes[i], [3,3]);
	if(givenVacantAnswers.length != 2 || givenVacantAnswers[0] != accessCodes.length ||
			givenVacantAnswers[1] != accessCodes.length)
		return 'Was not able to register all vacant answers.';
	for(var i = 0; i < givenAnswers.length; i++)
		if(givenAnswers[i] != 0)
			return 'When registering all vacant answers the givenAnswers should all be 0.';

	clearAnswers();

	//Test all blanks
	for(var i = 0; i < accessCodes.length; i++)
		registerAnswers(accessCodes[i], [4,4]);
	if(givenBlankAnswers.length != 2 || givenBlankAnswers[0] != accessCodes.length ||
			givenBlankAnswers[1] != accessCodes.length)
		return 'Was not able to register all blank answers.';
	for(var i = 0; i < givenAnswers.length; i++)
		if(givenAnswers[i] != 0)
			return 'When registering all blank answers the givenAnswers should all be 0.';

	clearAnswers();

	//Try mixed answers
	registerAnswers(accessCodes[0], [1,0]);
	registerAnswers(accessCodes[1], [1,3]);
	registerAnswers(accessCodes[2], [3,4]);
	registerAnswers(accessCodes[3], [4,4]);
	registerAnswers(accessCodes[4], [2,1]);
	registerAnswers(accessCodes[5], [0,1]);
	registerAnswers(accessCodes[6], [2,1]);
	registerAnswers(accessCodes[7], [2,3]);
	registerAnswers(accessCodes[8], [3,4]);
	registerAnswers(accessCodes[9], [0,1]);

	//Test all codes answered
	for(var i = 0; i < accessCodes.length; i++)
		if(!codesThatAnswered[i])
			return 'All codes should have answered.';

	//Test correct lengths
	if(givenAnswers.length != 3 || givenVacantAnswers.length != 2 || givenBlankAnswers.length != 2)
		return 'Answer arrays have the incorrect length.';

	/* Expected result: answers[0] = 3, answers[1] = 6, answers[2] = 3, vacants[0] = 4, vacants[1] = 0
		blanks[0]= 3, blanks[1] = 1, total = 20 */

	//Test correct answers
	if(givenAnswers[0] != 3 || givenAnswers[1] != 6 || givenAnswers[2] != 3 || givenVacantAnswers[0] != 4
			|| givenVacantAnswers[1] != 0 || givenBlankAnswers[0] != 3 || givenBlankAnswers[1] != 1)
		return 'Registered incorrect values on mixed answers.';

	//Test total
	if(calculateTotal() != 20)
		return 'Total should be 20.';

	//Test percentages
	if(getPercentage(givenAnswers[0], calculateTotal()) != 15 ||
			getPercentage(givenAnswers[1], calculateTotal()) != 30 ||
			getPercentage(givenAnswers[2], calculateTotal()) != 15 ||
			getPercentage(givenVacantAnswers[0], calculateTotal()) != 20 ||
			getPercentage(givenVacantAnswers[1], calculateTotal()) != 0 ||
			getPercentage(givenBlankAnswers[0], calculateTotal()) != 15 ||
			getPercentage(givenBlankAnswers[1], calculateTotal()) != 5)
		return 'Percentages is incorrect.';
}





/* --------------------- DEBBUGGING --------------------- */

if(DEBUG) {
	initialize([10]);
	startQuestion(['Lorum ipsum dolor sit?', 'a,b,c', 2, 'yes', 'yes']);
}