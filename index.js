const puppeteer = require('puppeteer');
const restify = require("restify");
const config = require("config");
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

var _browser = null;

var browserCheck = (req, res, next) => {
	if (_browser) {
		console.log("Browser already open")
		req.browser = _browser;
		return next();
	}
	console.log("Need to launch browser")
	puppeteer.launch(config.puppeteer)
	.then(result => {
		_browser = req.browser = result;
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

server.post("/open", (req, res) => {
	if (!req.body.url) {
		console.error("url required")
		return res.send(500, { status: "error", message: "url required" })
	}
	var page = null;
	req.browser.newPage()
	.then(result => {
		page = result;
		return page.goto(req.body.url);
	})
	.then(result => {
		url = result.url;
		return page.addScriptTag({path: './scripts/jquery-3.2.1.min.js'});
	})
	.then(result => {
		res.send({ status: "ok", message: "page open", url })
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
	req.browser.pages()
	.then(pages => {
		req.page = pages[req.params.page_id];
		next();
	})
	.catch(err => {
		console.error(err)
		res.send(500, { status: "error", message: err.message })
	})
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
		const $ = window.$;
		return $(selector).text();
	}, selector)
	.then(text => {
		res.send({ status: "ok", text });
	})
	.catch(err => {
		console.error(err)
		res.send(500, { status: "error", message: err.message })
	})
})

// server.get("/page/:")

// server.post("/tab", (req, res) => {
// 	if (!req.body.url) {
// 		console.error("url required")
// 		return res.send(500, { status: "error", message: "url required" })
// 	}
// 	puppeteer.open(req.body.url)
// 	.then(result => {
// 		tabnumber = result;
// 	})
// 	.url()
// 	.then(url => {
// 		res.send({ status: "ok", message: "tab open", url, tabnumber })
// 	})
// 	.catch(err => {
// 		console.error(err)
// 		res.send(500, { status: "error", message: err.message })
// 	})
// })

// server.get("/tab/count", (req,res) => {
// 	puppeteer.tabCount(req.params.tabnumber)
// 	.then(count => {
// 		res.send({ status: "ok", count })
// 	})
// 	.catch(err => {
// 		console.error(err)
// 		res.send(500, { status: "error", message: err.message })
// 	})
// })

// server.del("/tab/:tabnumber", (req,res) => {
// 	console.log("Closing tab", req.params)
// 	puppeteer.closeTab(parseInt(req.params.tabnumber))
// 	.then(count => {
// 		res.send({ status: "ok", message: "tab closed" })
// 	})
// 	.catch(err => {
// 		console.error(err)
// 		res.send(500, { status: "error", message: err.message })
// 	})
// })

// server.get("/tab/:tabnumber", (req, res) => {
// 	puppeteer.switchToTab(req.params.tabnumber)
// 	.url()
// 	.then(url => {
// 		res.send({ status: "ok", message: "tab active", url, tabnumber })
// 	})
// 	.catch(err => {
// 		console.error(err)
// 		res.send(500, { status: "error", message: err.message })
// 	})
// })

// var getTabInfo = tabnumber => {
// 	return puppeteer.switchToTab(tabnumber)
// 	.url()
// 	.then(result => {
// 		url = result;
// 	})
// 	.status()
// 	.then(result => {
// 		status = result;
// 	})
// 	.title()
// 	.then(result => {
// 		title = result;
// 	})
// 	.then(() => {
// 		return ({ tabnumber, url, status, title })
// 	})
// }

// server.get("/tab", (req, res) => {
// 	puppeteer.tabCount()
// 	.then(tabcount => {
// 		queue = [];
// 		for (let x = 0; x < tabcount; x++) {
// 			queue.push(getTabInfo(x))
// 		}
// 		return Promise.all(queue);
// 	})
// 	.then(tabs => {
// 		res.send({ status: "ok", tabs });
// 	})
// 	.catch(err => {
// 		console.error(err)
// 		res.send(500, { status: "error", message: err.message })
// 	})
// })

server.post("/text", (req, res) => {
	if (!req.body.selector) {
		return res.send(500, { status: "error", message: "selector required" })
	}
	puppeteer.text(req.body.selector)
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