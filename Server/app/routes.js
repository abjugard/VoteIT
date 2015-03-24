/* 	VoteIT (https://github.com/cthit/VoteIT)
	Created by Robin Sveningson, styrIT14/15  */

//Export function so server.js can use it
module.exports = function(app) {
	app.get('/', function(req, res) {
		if(req.query.message) {
			if(req.query.message == "invalid")
				res.render('index.ejs', {
					message: 'Invalid access code.'
				});
		} else
			res.render('index.ejs', {
				message: ''
			});
	});

	app.post('/', function(req, res){
		var code = req.body.accessCode;
		var answers = req.body.answers;

		if(code) {
			var server = require('../server');
			var index = server.validate(code);

			if(index >= 0) {
				var parameters = server.getQuestionParameters();
				if(code && answers) {
					answers = answers.split(',');
					if(server.codeAnsweredQuestion(code)) {
						res.send({result: 'anweredError'});
					} else if(server.validAnswers(answers)) {
						server.register(code, answers);
						res.send({result: 'success'});
					} else {
						res.send({result: 'corruptError'});
					}
				} else {
					//if(server.questionExists()) {
						res.render('vote.ejs', { accessCode: code });//, question: parameters[0], answers: parameters[1], numberOfRequired: parameters[2], vacantIndex: parameters[3], blankIndex: parameters[4]});
					//} else {
						//res.render('vote.ejs', { accessCode: code}); //, question: null, answers: null, numberOfRequired: null, vacantIndex: -1, blankIndex: -1});
					//}
				}
			} else {
				if(code && answers)
					res.send({result: 'codeError'});
				else
					res.render('index.ejs', {
						message: 'Invalid access code.'
					});
			}
		}

		res.end("Access denied.");
	});
};