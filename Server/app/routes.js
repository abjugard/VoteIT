/* 	VoteIT (https://github.com/cthit/VoteIT)
	Created by Robin Sveningson, styrIT14/15  */

//Export function so server.js can use it
module.exports = function(app) {
	app.get('/', function(req, res) {
		res.render('index.ejs', {
			message : ''
		});
	});

	app.get('/vote', function(req, res) {
		res.send('Access denied.');
	});

	app.post('/', function(req, res){
		var server = require('../server');
		var code = req.body.access.code;

		var index = server.validate(code);
		if(index >= 0) {
			console.log('Login with index: ' + (index+1));
			if(server.questionExists()) {
				var parameters = server.getQuestionParameters();
				console.log(parameters[1].length);
				res.render('vote.ejs', { accessCode : code, question: parameters[0], answers: parameters[1], numberOfRequired: parameters[2], vacantIndex: parameters[3], blankIndex: parameters[4]});
			} else
				res.render('vote.ejs', { accessCode : code, question: null, answers: null, numberOfRequired: null, vacantIndex: -1, blankIndex: -1});
		} else
			res.render('index.ejs', {
				message : 'Invalid access code.'
			});
	});

	app.post('/vote', function(req, res) {
		var server = require('../server');
		var code = req.body.accessCode;
		var answers = req.body.answers;

		for(var i = 0; i < answers.length; i++)
			console.log('a: ' + answers[i]);
		
		if(server.validate(code) >= 0) {
			if(server.codeAnsweredQuestion()) {
				res.end('anweredError');
			} else if(server.validAnswers(answers)) {
				server.register(code, answers);
				res.end('success');	
			} else {
				res.end('corruptError')
			}
		} else
			res.render('index.ejs', {
				message : 'Invalid access code.'
			});
	});
};