process.env.NODE_ENV = 'test';

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var server = require("../index.js");

chai.use(chaiHttp);

describe('Basics', () => {
	var page_id = null;

	describe("/POST open", () => {
		it("it should open a specific url in a new page", (done) => {
			chai.request(server)
			.post("/open")
			.send({ url: "https://www.google.com"})
			.end((err, res) => {
				res.should.have.status(200);
				res.body.status.should.equal('ok');
				res.body.message.should.equal('page open')
				res.body.should.have.property('url')
				res.body.should.have.property('_id')
				page_id = res.body._id;
				done();
			});
		});
	});

	describe("/GET page", () => {
		it("should get info on all the pages", done => {
			chai.request(server)
			.get("/page")
			.end((err, res) => {
				// console.log(res.body)
				res.should.have.status(200);
				res.body.status.should.equal('ok');
				res.body.should.have.property('pages')
				res.body.pages.should.be.an("object")
				done();
			});
		})
	});

	describe("/POST text", () => {
		it("should get text based on selector", done => {
			chai.request(server)
			.post(`/page/${ page_id }/text`)
			.send({ selector: "body" })
			.end((err, res) => {
				res.should.have.status(200);
				res.body.status.should.equal('ok');
				res.body.should.have.property('text')
				res.body.text.should.be.a("string")
				done();
			});
		})
	});

	describe("/POST attr", () => {
		it("should get attr based on selector", done => {
			chai.request(server)
			.post(`/page/${ page_id }/attr`)
			.send({ selector: "#hplogo", attr: "src" })
			.end((err, res) => {
				console.log(res.body)
				res.should.have.status(200);
				res.body.status.should.equal('ok');
				res.body.should.have.property('attr')
				res.body.attr.should.be.a("object")
				done();
			});
		})
	});

});