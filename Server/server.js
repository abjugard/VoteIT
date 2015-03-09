var express = require('express');
var app = express();
var sys = require('sys');
var stdin = process.openStdin();
var morgan = require('morgan');
var bodyParser = require('body-parser');
var toobusy = require('toobusy');

//Log all requests to the console
app.use(morgan('dev')); 
app.use(bodyParser()); //Get information from forms in the html files

app.use(function(req, res, next) {
  if (toobusy()) {
	res.send(503, 'I am busy right now, sorry.');
  } else {
	next();
  } 
});

//Routes
require('./app/routes.js')(app);

app.set('view engine', 'ejs'); //Set up ejs
//Static directory for stylesheets and scripts
app.use('/public', express.static(__dirname + '/public'));

var server = require('http').createServer(app);
var io = require('socket.io')(server);
io.on('connection', function(socket){
  console.log('Socket connection established.');
  socket.on('disconnect', function(){
    console.log('Socket connection closed.');
  });
});
server.listen(8080);
console.log('Server running on port 8080...');

stdin.addListener('data', function(d) {
	initCommand(d.toString().substring(0, d.length-1));
});

/*var confirmCommand = 0;
var commandValue = '';
var questionParameters = [];
var questionCommand = 0;*/

function msg(msg) {
	console.log('>>> ' + msg);
}

var commands = [
	['question', 'Enter question:', 'Enter answers separated by comma (without vacant and/or blanks):', 'Enter number of required parameters:', 'Enable vacant?', 'Enable blanks?'],
	['initialize', 'Enter number of access codes to be generated:'],
	['close question']
];
var pendingCommand = false;
var commandIndex = -1;
var parameterIndex = -1;
var commandString = '';
var parameters = [];

function initCommand(command) {
	if(pendingCommand) {
		if(command == 'yes')
			executeCommand();
		else
			msg('Command aborted.');

		commandIndex = -1;
		parameterIndex = -1;
		pendingCommand = false;
		commandString = '';
		parameters = [];
	} else {
		if(commandIndex == -1) {
			for(var i = 0; i < commands.length; i++) {
				if(commands[i][0] == command) {
					commandString = command;
					commandIndex = i;
					parameterIndex = 0;
					if(commands[i].length > 1)
						msg(commands[i][1]);
					else {
						pendingCommand = true;
						msg('Do you really want to execute command: \'' + commandString + '\'?');
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
				commandString = '';
				parameters = [];
			} else if(parameterIndex == commands[commandIndex].length - 2) {
				parameters[parameterIndex] = command;
				pendingCommand = true;
				msg('Do you really want to execute command: \'' + commandString + '\'?');
			} else {
				parameters[parameterIndex] = command;
				parameterIndex++;
				if(parameterIndex < commands[commandIndex].length - 1)
					msg(commands[commandIndex][parameterIndex+1]);
			}
		}
	}
}

function executeCommand() {
	if(commandString == 'initialize' && parameters.length == 1)
		initialize(parameters[0]);
	else if(commandString == 'question' && parameters.length == 5)
		startQuestion(parameters[0], parameters[1], parameters[2], parameters[3], parameters[4]);
	else if(commandString == 'close question' && parameters.length == 0)
		endQuestion(true);
}

var accessCodes = [];

var values = [
	'0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W'
];

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

function randomCode() {
	code = '';
	for(var i = 0; i < 10; i++) {
		var random = Math.floor(Math.random() * (values.length - 1));
		code += values[random];
	}
	return code;
}

module.exports = {
	validate: function (code) {
		return validateCode(code);
	},
	register: function(code, a) {
		registerAnswer(code, a);
	},
	questionExists: function() {
		return question != '';
	},
	getQuestionParameters: function() {
		return [question, possibleAnswers, numberOfRequired, vacantIndex, blankIndex];
	},
	validAnswers: function(answers) {
		return checkValidAnswers(answers);
	},
	codeAnsweredQuestion: function(code) {
		return codesThatAnswered[validateCode(code)];
	}
};

function validateCode(code) {
	for(var i = 0; i < accessCodes.length; i++)
		if(accessCodes[i] == code)
			return i;
	return -1;
}

var codesThatAnswered = [];
var answers = [];
var vacantAnswers = [];
var blankAnswers = [];

function registerAnswer(code, a) {
	var index = validateCode(code);
	if(index != -1) {
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

function checkValidAnswers(answers) {
	var result = true;

	var givenAnswers = [];
	for(var i = 0; i < answers.length; i++)
		givenAnswers[i] = false;

	for(var i = 0; i < answers.length; i++) {
		var a = answers[i];
		if(i != vacantIndex && i != blankIndex && contains(a, givenAnswers))
			result = false;
	}

	return answers.length == numberOfRequired && result;
}

function contains(value, array) {
	for(var i = 0; i < array.length; i++)
		if(array[i] == value)
			return true;

	return false;
}

var question = '';
var possibleAnswers = [];
var numberOfRequired = -1;
var vacantIndex = -1;
var blankIndex = -1;
var questionRunning = false;

function startQuestion(q, a, n, v, b) {
	if(n > 9) {
		msg('Number of required answers can\'t be greater than 9.');
		msg('NO question created.');
		return;
	}

	if(questionRunning)
		endQuestion(false);

	question = q;
	possibleAnswers = a.split(',');
	numberOfRequired = n;
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

	io.emit('new question', { question: question, answers: possibleAnswers, numberOfRequired: numberOfRequired, vacantIndex: vacantIndex, blankIndex: blankIndex });
	msg('Created new question!');
}

function endQuestion(emit) {
	if(question != '') {
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
		io.emit('new question', { question: null, answers: null, numberOfRequired: null, vacantIndex: -1, blankIndex: -1 });
	
	msg('Question ended.');
	questionRunning = false;
	question = '';
	possibleAnswers = [];
	numberOfRequired = -1;
	vacantIndex = -1;
	blankIndex = -1;
}

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