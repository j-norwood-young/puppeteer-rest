const request = require("request-promise-native");
const cheerio = require('cheerio')
const restify = require("restify");
const config = require("config");
const md5 = require("md5");
const server = restify.createServer();
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.authorizationParser());

var pages = {};

// Authorization
var authorization = (req, res, next) => {
	if (!config.users) return next();
	if (!req.authorization.basic)
		return res.send(403, { status: "error", message: "Forbidden" });
	var user = config.users.find(
		user =>
			user.username === req.authorization.basic.username &&
			user.password === req.authorization.basic.password
	);
	if (user) return next();
	res.send(403, { status: "error", message: "Forbidden" });
};

server.use(authorization);

var loadPage = (page) => {
	return request(page.url)
	.then(result => {
		page.date_updated = new Date();
		page.content = result;
		return page;
	});		
}

server.post("/open", (req, res) => {
	if (!req.body.url) {
		console.error("url required");
		return res.send(500, { status: "error", message: "url required" });
	}
	var url = req.body.url;
	console.time("opened " + url);
	const _id = md5(req.username + url);
	if (pages[_id])
		return res.send({
			status: "ok",
			message: "page already open",
			url,
			_id,
			date_created: pages[_id].date_created,
			date_updated: pages[_id].date_updated
		});
	var page = {
		_id,
		username: req.username,
		url,
		date_created: new Date(),
		date_updated: new Date(),
		reload_secs: req.body.reload
	}
	loadPage(page)
	.then(result => {
		pages[_id] = result;
		console.timeEnd("opened " + url);
		res.send({
			status: "ok",
			message: "page open",
			url,
			_id
		});
	})
	.catch(err => {
		console.error(err);
		res.send(500, {
			status: "error",
			message: err
		});
	})
});

server.get("/page", (req, res) => {
	res.send({ status: "ok", pages });	
});

var getPage = (req, res, next) => {
	if (!pages[req.params.page_id]) {
		console.error("Page not found");
		res.send(500, {
			status: "error",
			message: "Page not found - please send _id in url"
		});
		return;
	}
	req.page = pages[req.params.page_id];
	next();
};

server.get("/page/:page_id", getPage, (req, res) => {
	res.send(req.page);
});

var ensureSelector = (req, res, next) => {
	if (!req.body || !req.body.selector) {
		return res.send(500, { status: "error", message: "selector required" });
	}
	next();
}
server.post("/page/:page_id/text", ensureSelector, getPage, (req, res) => {
	let selector = req.body.selector;
	$ = cheerio.load(req.page.content);
	try {
		console.log({ url: req.page.url, selector });
		var text = $(selector).text();
	} catch(err) {
		console.error(err);
		return res.send(500, { status: "error", message: "error finding text for url " + req.page.url});
	}
	res.send({ status: "ok", text });
});

server.post("/page/:page_id/attr", ensureSelector, getPage, (req, res) => {
	let selector = req.body.selector;
	$ = cheerio.load(req.page.content);
	try {
		var attr = $(selector).attr();
	} catch(err) {
		console.error(err);
		return res.send(500, { status: "error", message: "error finding attr for url " + req.page.url});
	}
	return res.send({ status: "ok", attr });
});

server.post("/page/:page_id/html", ensureSelector, getPage, (req, res) => {
	let selector = req.body.selector;
	$ = cheerio.load(req.page.content);
	try {
		var html = $(selector).html();
	} catch(err) {
		console.error(err);
		return res.send(500, { status: "error", message: "error finding html for url " + req.page.url});
	}
	return res.send({ status: "ok", html });
});

server.listen(config.server.port, function() {
	console.log("%s listening at %s", server.name, server.url);
});

// var timer = setInterval(() => {
// 	pages.forEach(page => {

// 	})
// }, 10000)

module.exports = server;