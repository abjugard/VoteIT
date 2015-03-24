/* 	VoteIT (https://github.com/cthit/VoteIT)
	Created by Robin Sveningson, styrIT14/15  */


/* --------------------- INITIALIZE SERVER --------------------- */

//Web application framework for node.js
var express = require('express');
//The application
var app = express();
//System module
var sys = require('sys');
//Used to read console data
var stdin = process.openStdin();
//Used to log information about GET/POST requests
//var morgan = require('morgan');
//Used to parse the body of incoming POST requests (to retrieve data from forms)
var bodyParser = require('body-parser');
//Used to prevent the server from crashing on request overloading
var toobusy = require('toobusy');

//Initialize morgan
//app.use(morgan('dev'));
//Inititalize bodyParser
app.use(bodyParser()); 

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

//Create the HTTP server
var server = require('http').createServer(app);
//Create the socket listener
var io = require('socket.io')(server);
var connections = 0;
//Handle socket events
io.on('connection', function(socket){
	connections++;
	socket.emit('new question', { question: question, answers: possibleAnswers, numberOfRequired: numberOfRequired, vacantIndex: vacantIndex, blankIndex: blankIndex });
	socket.on('disconnect', function(){
		connections--;
	});
});

io.use(function(socket, next) {
	var code = socket.request._query.code;
	if(validateCode(code) >= 0)
		next();
	else
		next(new Error('Invalid access code.'));
});

//Start server on port 8080
server.listen(8080);
console.log('Server running on port 8080...');

//Initialize stdin
stdin.addListener('data', function(d) {
	handleInput(d.toString().substring(0, d.length-1));
});





/* --------------------- Methods --------------------- */

//All the functions that should be reached by the routes.js file
module.exports = {
	validate: function (code) {
		return validateCode(code);
	},
	register: function(code, a) {
		registerAnswer(code, a);
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
	console.log('>>> ' + msg);
}

function error(str, host) {
	msg('ERROR in ' + host + '. ' +  str);
	process.exit(1);
}

function Command(command, parameters, execute, confirm) {
	if(!command || !isString(command))
		error('Command must be a string.', 'Command construction');
	if(!parameters || !isArrayOfType(parameters, Parameter))
		error('Parameters must be an array of the Parameter type.', 'Command construction');	
	if(!execute || !isFunction(execute))
		error('Execute must be a function.', 'Command construction');
	if(!isBoolean(confirm))
		error('Confirm must be a boolean.', 'Command construction');

	this.command = command;
	this.parameters = parameters;
	this.execute = execute;
	this.confirm = confirm;
}

function Parameter(promptQuestion, check) {
	if(!promptQuestion || !isString(promptQuestion))
		error('PromptQuestion must be a string.', 'Parameter construction');
	if(check && !isFunction(check))
		error('Check must be a function.', 'Parameter construction')

	this.promptQuestion = promptQuestion;
	if(!check)
		this.check = function() { return true; };
	else 
		this.check = check;
}

//Check if 'x' is numeric
function stringIsInteger(s) {
  return !isNaN(parseInt(s)) && isFinite(s);
}

function stringIsBoolean(s) {
	if(s == "yes" || s == "no")
		return true;
	else
		return false;
}

function isString(x) {
	return typeof x == 'string' || x instanceof String;
}

function isFunction(x) {
	return typeof(x) == 'function';
}

function isBoolean(x) {
	return typeof(x) == 'boolean';
}

function getCheckDescription(check) {
	if(check == stringIsInteger)
		return 'is not an integer';
	else if(check == stringIsBoolean)
		return 'is not a boolean';
	else
		return '[no description]';
}

function getBooleanFromString(s) {
	if(s == "yes")
		return true;
	else
		return false;
}

function isArrayOfType(array, type) {
	if(array.constructor === Array) {
		if(array.length > 0)
			return array[0] instanceof type;
		else
			return true;
	}
	return false;
}

var commands = [
	new Command('question', [
		new Parameter('Enter question:'),
		new Parameter('Enter answers separated by comma (without vacant and/or blanks):'),
		new Parameter('Enter number of required parameters:', stringIsInteger),
		new Parameter('Enable vacant?', stringIsBoolean),
		new Parameter('Enable blanks?', stringIsBoolean)
	], startQuestion, true),
	new Command('initialize', [
		new Parameter('Enter number of access codes to be generated:', stringIsInteger)
	], initialize, true),
	new Command('close question', [], closeQuestion, true),
	new Command('status', [], showStatus, false)
];

//Used to confirm the execution of commands
var pendingCommand = false;
//Used to keep track of which command is pending
var currentCommand = null;
//Used to store all parameters for a command
var parameters = [];
var parameterIndex = -1;


function hasCommandParameter() {
	return parameterIndex < currentCommand.parameters.length;
}

function getCommandParameter() {
	if(!hasCommandParameter())
		return null;
	return currentCommand.parameters[parameterIndex].promptQuestion;
}

function clearCommandData() {
	currentCommand = null;
	pendingCommand = false;
	parameters = [];
	parameterIndex = -1;
}

function abortCommand(reason) {
	clearCommandData();
	if(reason)
		msg('Command aborted because ' + reason + '.');
	else
		msg('Command aborted.');
}

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

//Descides what to do with a string received from the console
function handleInput(input) {
	if(pendingCommand) {
		if(!input || (stringIsBoolean(input) && getBooleanFromString(input))) {
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

//Initialize n accessCodes
function initialize(parameters) {
	var n = parameters[0];

	msg('Initializing vote server for ' + n + ' participants...');
	msg('Generating codes...');

	for(var i = 0; i < n; i++)
		accessCodes[i] = randomCode();

	msg('Codes generated:');
	var string = '';

	for(var i = 0; i < accessCodes.length; i++) {
		msg('[' + (i+1) + '] : ' + accessCodes[i]);
		string += '\n---------------------------\n\n' + 'accessCode: ' + accessCodes[i] + '\n';
	}

	//Create the access.txt file with all codes
	msg('Saving to file...');
	var fs = require('fs');
	fs.writeFile('access.txt', string, function(err) {
	    if(err) {
	        msg(err);
	    } else {
	        msg('File was saved successfully.');
	        msg('Initialize complete.');
	    }
	});
}

//Generates a random code with length 10
function randomCode() {
	code = '';
	for(var i = 0; i < 10; i++) {
		var random = Math.floor(Math.random() * (values.length - 1));
		code += values[random];
	}
	return code;
}

/* Method used to validate an accessCode.
	Returns -1 if code is invalid, otherwise the index of the code in the accessCode-array.
*/
function validateCode(code) {
	for(var i = 0; i < accessCodes.length; i++)
		if(accessCodes[i] == code)
			return i;
	return -1;
}

//All accessCodes that have registered an answer to the current question
var codesThatAnswered = [];
//All answers that have been registered
var answers = [];
//All vacant answers that have been registered
var vacantAnswers = [];
//All blank answers that have been registered
var blankAnswers = [];

//Registers a clients answers. The accessCode 'code' must be valid. The parameter 'a' should be an array of all answers.
function registerAnswer(code, a) {
	var index = validateCode(code);
	if(index >= 0) {
		codesThatAnswered[index] = true;

		var vacants = 0;
		var blanks = 0;
		for(var i = 0; i < a.length; i++) {
			if(a[i] == vacantIndex) {
				vacantAnswers[vacants]++;
				vacants++;
			} else if(a[i] == blankIndex) {
				blankAnswers[blanks]++;
				blanks++;
			} else
				answers[a[i]]++;
		}
	}
}

//Clears all information regarding answers
function clearAnswers() {
	codesThatAnswered = [];
	answers = [];
	vacantAnswers = [];
	blankAnswers = [];

	for(var i = 0; i < accessCodes.length; i++)
		codesThatAnswered[i] = false;
	for(var i = 0; i < possibleAnswers.length; i++)
		answers[i] = 0;

	if(vacantIndex >= 0)
		for(var i = 0; i < numberOfRequired; i++)
			vacantAnswers[i] = 0;

	if(blankIndex >= 0)
		for(var i = 0; i < numberOfRequired; i++)
			blankAnswers[i] = 0;
}

//Check if the answers are valid (should always be true unless frontend code has been changed by user)
function checkValidAnswers(givenAnswers) {
	if(givenAnswers.length == 0 || givenAnswers.length != numberOfRequired)
		return false;

	var tempArray = [];
	for(var i = 0; i < answers.length; i++)
		tempArray[i] = false;

	for(var i = 0; i < givenAnswers.length; i++) {
		var answer = givenAnswers[i];
		if(!stringIsInteger(givenAnswers[i]) || givenAnswers[i] < 0 || givenAnswers[i] >= answers.length ||
			i != vacantIndex && i != blankIndex && tempArray[givenAnswers[i]])
			return false;
		tempArray[givenAnswers[i]] = true;
	}

	return true;
}

//Checks if the code has already been used to answer the question
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

/* Method used to start a new question
	
	OBS! The 'vacant' and 'blanc' alternative are added by this method to the answers array, so that the GUI
	can present all answers without having to add the Vacant and Blanc option itself.

	q = the question string
	a = all the answers in an array
	n = number of required answers
	v = vacant parameter
	n = blank parameter
*/
function startQuestion(parameters) {
	var a = parameters[1].split(',');

	//Should be remaked to allow more answers
	if(a.length > 9) {
		msg('Number of required answers can\'t be greater than 9.');
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
	io.emit('new question', { question: question, answers: possibleAnswers, numberOfRequired: numberOfRequired, vacantIndex: vacantIndex, blankIndex: blankIndex });
	msg('Created new question!');
}

function closeQuestion() {
	endQuestion(true);
}

/* Method used to end a question
	emit = whether or not to inform clients
*/
function endQuestion(emit) {
	if(questionRunning)
		showQuestionResult('previous');

	if(emit)
		//Send an empty question to the clients
		io.emit('new question', { question: null, answers: null, numberOfRequired: null, vacantIndex: -1, blankIndex: -1 });
	
	msg('Question ended.');
	questionRunning = false;
	question = '';
	possibleAnswers = [];
	numberOfRequired = -1;
	vacantIndex = -1;
	blankIndex = -1;
}

function showQuestionResult(str) {
	msg('Result of ' + str + ' question \'' + question + '\'.');

	var total = calculateTotal();
	for(var i = 0; i < answers.length; i++)
		if(i != vacantIndex && i != blankIndex)
			msg('\'' + possibleAnswers[i] + '\': ' + answers[i] + ' votes (' + (answers[i] / total * 100) + '%).');
	for(var i = 0; i < vacantAnswers.length; i++)
		msg('\'Vacant ' + (i+1) + '\': ' + vacantAnswers[i] + ' votes (' + (vacantAnswers[i] / total * 100) + '%).');
	for(var i = 0; i < blankAnswers.length; i++)
		msg('\'Blank ' + (i+1) + '\': ' + blankAnswers[i] + ' votes (' + (blankAnswers[i] / total * 100) + '%).');

	var numberOfAnswers = 0;
	for(var i = 0; i < codesThatAnswered.length; i++)
		if(codesThatAnswered[i])
			numberOfAnswers++;
	msg('Number of answers: ' + numberOfAnswers + '/' + accessCodes.length);
}

//Calculates the total answers given
function calculateTotal() {
	var total = 0;
	for(var i = 0; i < answers.length; i++)
		total += answers[i];
	for(var i = 0; i < vacantAnswers.length; i++)
		total += vacantAnswers[i];
	for(var i = 0; i < blankAnswers.length; i++)
		total += blankAnswers[i];
	return total;
}

function showStatus() {
	msg('------------ Status: ------------');
	msg('Number of connections: ' + connections);
	msg('Question active: ' + questionRunning);
	if(questionRunning)
		showQuestionResult('current');
}

//Temporary. For debugging only.
initialize([10]);
//startQuestion(["Lorum ipsum dolor sit?", "a,b,c", 2, true, true]);

/*function testQuestionLogic() {
	var question1 = 'Asd asd asd?';
	var question2 = 'Dobabidatap?';
	var answers1 = ['a', 'b', 'c', 'd', 'e'];
	var answers2 = ['1', '2', '3'];

	initialize(10);

	startQuestion(question1, answers1);

	registerAnswer(accessCodes[0], 0);
	registerAnswer(accessCodes[1], 0);
	registerAnswer(accessCodes[2], 0);
	registerAnswer(accessCodes[3], 0);

	registerAnswer(accessCodes[4], 2);

	registerAnswer(accessCodes[5], 4);

	registerAnswer(accessCodes[6], 3);
	registerAnswer(accessCodes[7], 3);
	registerAnswer(accessCodes[8], 3);
	registerAnswer(accessCodes[9], 3);

	console.log('should be: 4x0, 1x2, 1x4, 4x3 -- a,b,c,d,e');

	startQuestion(question2, answers2);

	registerAnswer(accessCodes[0], 1);
	registerAnswer(accessCodes[1], 1);
	registerAnswer(accessCodes[2], 1);
	registerAnswer(accessCodes[3], 1);

	registerAnswer(accessCodes[4], 2);
	registerAnswer(accessCodes[5], 2);
	registerAnswer(accessCodes[6], 2);
	registerAnswer(accessCodes[7], 2);
	registerAnswer(accessCodes[8], 2);
	registerAnswer(accessCodes[9], 2);

	endQuestion();
	console.log('should be: 4x1, 6x2 -- 1,2,3');
}*/