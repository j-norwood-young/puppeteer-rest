const puppeteer = require('puppeteer');
const restify = require("restify");
const config = require("config");
const md5 = require("md5");
const server = restify.createServer();
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.authorizationParser());

var pages = {};

// Authorization
var authorization = (req, res, next) => {
	if (!config.users)
		return next();
	if (!req.authorization.basic)
		return res.send(403, { status: "error", message: "Forbidden" });
	var user = config.users.find(user => user.username === req.authorization.basic.username && user.password === req.authorization.basic.password);
	if (user)
		return next();
	res.send(403, { status: "error", message: "Forbidden" })
}

server.use(authorization);

var _browser = null;

var browserCheck = (req, res, next) => {
	if (_browser) {
		req.browser = _browser;
		return next();
	}
	console.log("Launching Puppeteer")
	console.time("launch-puppeteer")
	puppeteer.launch(config.puppeteer)
	.then(result => {
		_browser = req.browser = result;
		console.timeEnd("launch-puppeteer")
		next();
	}).catch(err => {
		console.error(err)
		res.send(500, { status: "error", message: err.message })
	});
};

server.use(browserCheck);

var pageInfo = page => {
	// console.log(page)
	return page.title()
	.then(title => {
		return {
			viewport: page.viewport(),
			url: page.url(),
			title
		}	
	})
}

var injectJquery = (page) => {
	return page.addScriptTag({path: './scripts/jquery-3.2.1.min.js'})
	.then(result => {

	})
}

server.post("/open", (req, res) => {
	if (!req.body.url) {
		console.error("url required")
		return res.send(500, { status: "error", message: "url required" })
	}
	console.time("opened " + req.body.url);
	const _id = md5(req.username + req.body.url);
	var page = pages[_id];
	if (page)
		return res.send({ status: "ok", message: "page already open", url: page.url, _id, date_created: page.date_created, date_updated: page.date_updated })
	req.browser.newPage()
	.then(result => {
		page = result;
		return page.setRequestInterception(true);
	})
	.then(result => {
		page.on('request', request => {
			if (!config.loadTypes)
				return request.continue();
			if (config.loadTypes.indexOf(request.resourceType) !== -1)
				request.continue();
			else
				request.abort();
		});
		return page.goto(req.body.url);
	})
	.then(result => {
		url = result.url;
		return injectJquery(page);
	})
	.then(result => {
		pages[_id] = { username: req.username, url, page, date_created: new Date(), date_updated: new Date() };
		if (req.body.reload) {
			pages[_id].reloadTimer = setInterval(() => {
				console.log("Reloading", pages[_id].url);
				pages[_id].page.reload()
				.then(result => {
					pages[_id].date_updated = new Date();
					return injectJquery(pages[_id].page);
				});
			}, (req.body.reload * 1000))
		}
		console.timeEnd("opened " + req.body.url);
		res.send({ status: "ok", message: "page open", url, _id, date_created: page.date_created, date_updated: page.date_updated })
	})
	.catch(err => {
		console.error(err)
		res.send(500, { status: "error", message: err.message })
	})
})

server.get("/page", (req, res) => {
	req.browser.pages()
	.then(pages => {
		res.send({ status: "ok", pages: pages.map(pageInfo) })
	})
	.catch(err => {
		console.error(err)
		res.send(500, { status: "error", message: err.message })
	})
})

var getPage = (req, res, next) => {
	if (!pages[req.params.page_id]) {
		console.error("Page not found")
		res.send(500, { status: "error", message: "Page not found - please send _id in url" })
		return;
	}
	req.page = pages[req.params.page_id].page;
	next();
}

server.get("/page/:page_id", getPage, (req, res) => {
	res.send(req.page);
})

server.post("/page/:page_id/text", getPage, (req, res) => {
	if (!req.body.selector) {
		return res.send(500, { status: "error", message: "selector required" })
	}
	let selector = req.body.selector;
	req.page.evaluate((selector) => {
		try {
			const $ = window.$;
			return $(selector).text();
		} catch(e) {
			console.error(e);
			return Promise.resolve(null);
		}
	}, selector)
	.then(text => {
		res.send({ status: "ok", text });
	})
	.catch(err => {
		console.error(err)
		res.send(500, { status: "error", message: err.message })
	})
})

server.post("/page/:page_id/attr", getPage, (req, res) => {
	if (!req.body.selector) {
		return res.send(500, { status: "error", message: "selector required" })
	}
	if (!req.body.attr) {
		return res.send(500, { status: "error", message: "attr required" })
	}
	let selector = req.body.selector;
	let attr = req.body.attr;
	req.page.evaluate((selector, attr) => {
		const $ = window.$;
		return $(selector).attr(attr);
	}, selector, attr)
	.then(text => {
		res.send({ status: "ok", text });
	})
	.catch(err => {
		console.error(err)
		res.send(500, { status: "error", message: err.message })
	})
})


server.listen(config.server.port, function() {
	console.log('%s listening at %s', server.name, server.url);
});

module.exports = server;