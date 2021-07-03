//const request = require('request');
global.XMLHttpRequest = undefined
const axiosLib = require('axios');
const https = require('https');
const fs = require('fs');
const loginSystem = require('express-oauth-login-system-server')
const express = require('express');
const config = require('./test-config')
const dbHandler = require('./db-handler');
const User = require('../database/User')
const OAuthClient = require('../database/OAuthClient')

var app = null

var server = null

const ORIGIN = 'https://localhost:5100'
const baseUrl = ORIGIN

// TODO
// fails - cors/auth  - use bad origin in request
// cookies set ? - check response for refresh_token, media_token, csrf-token
// CSRF - enable config csrf, check for cookie in response, send request with bad csrf and expect fail
// refresh by query token - signup get user and send refresh request with token in url, expect token in response
// signup validation  - missing name, avatar, username, password(and mismatch)
// forgot validation - missing username, password(and mismatch)
// token timeout on confirm/signup - register/forgot then hack timeout in db before attempting doconfirm/doforgot and expecting fail err msg
// /signinajax - ?? ditch /signin endpoitn ??  
// oauth routes - authorize/token * ignore self signed ssl

//axiosLib.defaults.adapter = require('axios/lib/adapters/http')

function getAxiosClient(token,cookies,origin) {
	var headers = {'Origin': origin ? origin : ORIGIN}
	if (token) {
		headers['Authorization'] =  'Bearer '+token
	}
	if (cookies) {
		headers['Cookie'] =  cookies.join("; ")
	}
	console.log(['AX',headers]) 
	var authClient = axiosLib.create({
		  baseURL: baseUrl,
		  timeout: 3000,
		  headers: headers,
		  withCredentials: true,
		  httpsAgent: new https.Agent({  
			rejectUnauthorized: false
		  }),
		  adapter: require('axios/lib/adapters/http')
		});
	return authClient
}

const axios = getAxiosClient()

/**
 * Connect to a new in-memory database before running any tests.
 */
beforeAll(async () => {
	var uri = await dbHandler.connect()
	const login = await loginSystem(Object.assign({},config, {databaseConnection:uri, authServer:ORIGIN, loginServer:ORIGIN+"/"}))
	app = express();
	app.use(login.router)
	const port=5100
	server =  https.createServer({
		key: fs.readFileSync('./tests/key.pem'),
		cert: fs.readFileSync('./tests/cert.pem'),
	}, app).listen(port, () => {
	  console.log(`Login server listening  at https://localhost:`+port)
	}) 
});

/**
 * Clear all test data after every test.
 */
afterEach(async () => await dbHandler.clearDatabase());

beforeEach(async () => {
	var clients = await OAuthClient.deleteMany({})
	var client = new OAuthClient({
			clientId: config.clientId, 
			clientSecret:config.clientSecret,
			name:config.clientName,
			website_url:config.clientWebsite,
			privacy_url:config.clientPrivacyPage,
			redirectUris:[],
			image:''
		})
	await client.save()
})

/**
 * Remove and close the db and server.
 */
afterAll(async () => {
	await dbHandler.closeDatabase()
	server.close()
});

/**
 * Test Helpers
 */
async function signupAndConfirmUser(name) {
	// post create new user
	var cres = await axios.post('/signup',{name: name,username:name,avatar:name,password:'aaa',password2:'aaa'})
	expect(cres.data.message).toBe('Check your email to confirm your sign up.')
	// check user in db
	var res = await User.findOne({name:name,username:name,avatar:name,password:'',tmp_password:'aaa'})
	expect(res.signup_token).toBeTruthy()
	expect(parseInt(res.signup_token_timestamp)).toBeGreaterThan(0)
	// do confirmation
	var rres = await axios.get('/doconfirm?code='+res.signup_token)
	return rres
}


/**
 * TESTS
 */

describe('login system routes', () => {
    it('responds with status 404 on invalid endoint',async () => {
		var meres = null
		try {
			meres = await axios.get('/badendpoint')
		} catch (e) {
			expect(e.response.status).toEqual(404)
		}
	})
	
	//it('passes CORS checks for test endpoint with bad origin',async () => {
		////var meres = null
		//var badClient = getAxiosClient(null,null,'http://localhost:8000')
		//var meres = await axios.get('/test')
		//expect(meres.status).toEqual(200)
		//expect(meres.data.OK).toEqual(true)
	//})
	
	it('fails CORS checks for signin, doconfirm, recover, dorecover, signinajax, logout, me, saveuser endpoints with bad origin',async () => {
		var meres = null
		var rres = await signupAndConfirmUser('john')
		var token=rres.data.user.token.access_token
		var badClient = getAxiosClient(token,null,'http://localhost:8000')
		//signin
		try {
			meres = await badClient.post('/signin',{username:'john',password:'aaa'})
			
		} catch (e) {
			expect(e.response.status).toEqual(500)
			expect(e.response.data.message).toEqual('Not allowed by CORS')
		}
		//// doconfirm
		//try {
			//meres = await badClient.post('/doconfirm',{code:'sdfg4345df'})
			
		//} catch (e) {
			//expect(e.response.status).toEqual(500)
			//expect(e.response.data.message).toEqual('Not allowed by CORS')
		//}
		//forgot
		try {
			meres = await badClient.post('/recover',{username:'john',password:'aaa',password2:'aaa'})
			
		} catch (e) {
			expect(e.response.status).toEqual(500)
			
			expect(e.response.data.message).toEqual('Not allowed by CORS')
		}
		// doforgot
		//try {
			//meres = await badClient.post('/dorecover',{code:'lkj;oa89sdf0'})
			
		//} catch (e) {
			//expect(e.response.status).toEqual(500)
			//expect(e.response.data.message).toEqual('Not allowed by CORS')
		//}
		// signinajax
		try {
			meres = await badClient.post('/signinajax',{username:'john',password:'aaa'})
			
		} catch (e) {
			expect(e.response.status).toEqual(500)
			expect(e.response.data.message).toEqual('Not allowed by CORS')
		}
		// logout
		try {
			meres = await badClient.post('/logout')
			
		} catch (e) {
			expect(e.response.status).toEqual(500)
			expect(e.response.data.message).toEqual('Not allowed by CORS')
		}
		// me
		try {
			meres = await badClient.post('/me')
			
		} catch (e) {
			expect(e.response.status).toEqual(500)
			expect(e.response.data.message).toEqual('Not allowed by CORS')
		}
		// saveuser
		try {
			meres = await badClient.post('/saveuser',{_id:'2234234',username:'john',password:'aaa'})
			
		} catch (e) {
			expect(e.response.status).toEqual(500)
			expect(e.response.data.message).toEqual('Not allowed by CORS')
		}
	})
    
    it('can get a token through user signup flow then load /me endpoint',async () => {
		var rres = await signupAndConfirmUser('john')
		var token=rres.data.user.token.access_token
		// test me endpoint
		var authClient = getAxiosClient(token)
		var meres = await authClient.post('/me')
		expect(meres.data.name).toEqual('john')
	})
    
    it('can change password through forgot password flow',async () => {
		await signupAndConfirmUser('bill')
		// start recover with new pw bbb
		var meres = await axios.post('/recover',{name:'bill',email:'bill',password:'bbb',password2:'bbb'})
		res = await User.findOne({name:'bill',username:'bill'})
		expect(res.recover_password_token).toBeTruthy()
		expect(parseInt(res.recover_password_token_timestamp)).toBeGreaterThan(0)
		
		// do recover
		var dores = await axios.get('/dorecover?code=' + res.recover_password_token)
		var ares = await User.findOne({name:'bill',username:'bill'})
		expect(ares.recover_password_token).not.toBeTruthy()
		expect(ares.password).toBe('bbb')
	})
	
	
	 it('can save user changes',async () => {
		var rres = await signupAndConfirmUser('bill')
		var token=rres.data.user.token.access_token
		//// save changes
		var authClient = getAxiosClient(token)
		var cres = await authClient.post('/saveuser',{_id:rres.data.user._id, name: 'jill',username:'jill',avatar:'jill'})
		expect(cres.data.message).toBe('Saved changes')
	})
    
    
     it('can load buttons',async () => {	
		// post create new user
		var cres = await axios.get('/buttons')
		//console.log(cres.data)
		expect(cres.data.buttons).toEqual('google,twitter,facebook,github,amazon')	
	})
	
	it('can get a token using refresh token cookies',async () => {
		var rres = await signupAndConfirmUser('jane')
		var token=rres.data.user.token.access_token
		var cookies = rres.headers["set-cookie"]
		//axios.defaults.headers.Cookie = cookie;
		var authClient = getAxiosClient(null,cookies)
		var rres = await authClient.get('/refresh_token')
		expect(rres.data.access_token).toBeTruthy()
	})
    
    
	it('can logout',async () => {
		var rres = await signupAndConfirmUser('jane')
		var token=rres.data.user.token.access_token
		var cookies = rres.headers["set-cookie"]
		//axios.defaults.headers.Cookie = cookie;
		var cookieClient = getAxiosClient(null,cookies)
		var cres = await cookieClient.get('/refresh_token')
		expect(cres.data.access_token).toBeTruthy()
		var authClient = getAxiosClient(token)
		var logoutRes = await authClient.post('/logout')
		// TODO update refresh cookie from ..
		cres = await cookieClient.get('/refresh_token')
		expect(cres.data.access_token).not.toBeTruthy()
	})
});
