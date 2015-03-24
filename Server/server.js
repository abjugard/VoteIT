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
var morgan = require('morgan');
//Used to parse the body of incoming POST requests (to retrieve data from forms)
var bodyParser = require('body-parser');
//Used to prevent the server from crashing on request overloading
var toobusy = require('toobusy');

//Initialize morgan
app.use(morgan('dev'));
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
//Handle socket events
io.on('connection', function(socket){
  console.log('Socket connection established.');
  socket.on('disconnect', function(){
    console.log('Socket connection closed.');
  });
});
//Start server on port 8080
server.listen(8080);
console.log('Server running on port 8080...');

//Initialize stdin
stdin.addListener('data', function(d) {
	initCommand(d.toString().substring(0, d.length-1));
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

//Available commands.
var commands = [
	['question', 'Enter question:', 'Enter answers separated by comma (without vacant and/or blanks):', 'Enter number of required parameters:', 'Enable vacant?', 'Enable blanks?'],
	['initialize', 'Enter number of access codes to be generated:'],
	['close question']
];
//Used to confirm the execution of commands
var pendingCommand = false;
//Used to keep track of which command is pending
var commandIndex = -1;
//Used to keep track of which parameter is being asked for in the console
var parameterIndex = -1;
//Used to store all parameters for a command
var parameters = [];

//Descides what to do with a string received from the console
function initCommand(command) {
	if(pendingCommand) {
		if(command == 'yes')
			executeCommand();
		else
			msg('Command aborted.');

		commandIndex = -1;
		parameterIndex = -1;
		pendingCommand = false;
		parameters = [];
	} else {
		if(commandIndex == -1) {
			for(var i = 0; i < commands.length; i++) {
				if(commands[i][0] == command) {
					commandIndex = i;
					parameterIndex = 0;
					if(commands[i].length > 1)
						msg(commands[i][1]);
					else {
						pendingCommand = true;
						msg('Do you really want to execute command: \'' + commands[commandIndex][0] + '\'?');
					}

					return;
				}
			}
			if(commandIndex == -1)
				msg('Invalid command.');
		} else {
			if(command == 'abort') {
				msg('Command aborted.');
				commandIndex = -1;
				parameterIndex = -1;
				pendingCommand = false;
				parameters = [];
			} else if(parameterIndex == commands[commandIndex].length - 2) {
				parameters[parameterIndex] = command;
				pendingCommand = true;
				msg('Do you really want to execute command: \'' + commands[commandIndex][0] + '\'?');
			} else {
				parameters[parameterIndex] = command;
				parameterIndex++;
				if(parameterIndex < commands[commandIndex].length - 1)
					msg(commands[commandIndex][parameterIndex+1]);
			}
		}
	}
}

//Execute the current pending command
function executeCommand() {
	// THIS CODE MUST BE CHANGED TO BE MORE GENERIC. This is just a temporary code
	var commandString = commands[commandIndex][0];
	if(commandString == 'initialize' && parameters.length == 1)
		initialize(parameters[0]);
	else if(commandString == 'question' && parameters.length == 5)
		startQuestion(parameters[0], parameters[1], parameters[2], parameters[3], parameters[4]);
	else if(commandString == 'close question' && parameters.length == 0)
		endQuestion(true);
}

//All accessCodes that currently exists
var accessCodes = [];
//All values that can be used by an accessCode
var values = [
	'0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W'
];

//Initialize n accessCodes
function initialize(n) {
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

		console.log('Registered answer: ' + a + ' for index: ' + index);
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
		if(!isNumeric(givenAnswers[i]) || givenAnswers[i] < 0 || givenAnswers[i] >= answers.length ||
			i != vacantIndex && i != blankIndex && tempArray[givenAnswers[i]])
			return false;
		tempArray[givenAnswers[i]] = true;
	}

	return true;
}

//Check if 'i' is numeric
function isNumeric(i) {
  return !isNaN(parseFloat(i)) && isFinite(i);
}

//Checks if the code has already been used to answer the question
function checkCodeAnsweredQuestion(code) {
	var index = validateCode(code);
	msg("code: " + code + " index: "+ index + " cta: " + codesThatAnswered[index]);
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
function startQuestion(q, a, n, v, b) {
	//Should be remaked to allow more answers
	if(n > 9) {
		msg('Number of required answers can\'t be greater than 9.');
		msg('No question created.');
		return;
	}

	if(questionRunning)
		endQuestion(false);

	question = q;
	possibleAnswers = a.split(',');
	numberOfRequired = n;

	//Should be replaced in the future when parameters are more generic
	if(v == 'yes') {
		var i = possibleAnswers.length;
		possibleAnswers[i] = 'Vakant';
		vacantIndex = i
	} else
		vacantIndex = -1;
	if(b == 'yes') {
		var i = possibleAnswers.length;
		possibleAnswers[i] = 'Blank';
		blankIndex = i
	} else
		blankIndex = -1;

	clearAnswers();
	questionRunning = true;

	//Send question via the socket connection
	io.emit('new question', { question: question, answers: possibleAnswers, numberOfRequired: numberOfRequired, vacantIndex: vacantIndex, blankIndex: blankIndex });
	msg('Created new question!');
}

/* Method used to end a question
	emit = whether or not to inform clients
*/
function endQuestion(emit) {
	if(questionRunning) {
		msg('Result of previous question \'' + question + '\'.');

		var total = calculateTotal();
		for(var i = 0; i < answers.length; i++)
			if(i != vacantIndex && i != blankIndex)
				msg('\'' + possibleAnswers[i] + '\': ' + answers[i] + ' votes (' + (answers[i] / total * 100) + '%).');
		for(var i = 0; i < vacantAnswers.length; i++)
			msg('\'Vacant ' + (i+1) + '\': ' + vacantAnswers[i] + ' votes (' + (vacantAnswers[i] / total * 100) + '%).');
		for(var i = 0; i < blankAnswers.length; i++)
			msg('\'Blank ' + (i+1) + '\': ' + blankAnswers[i] + ' votes (' + (blankAnswers[i] / total * 100) + '%).');
	}

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

//Temporary. For debugging only.
initialize(10);
startQuestion("Lorum ipsum dolor sit?", "a,b,c", 2, true, true);

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