var http = require('http');
var https = require('https');
var fs = require('fs');
var sourcefile = require('./footcal.js');
var app = sourcefile.exportapp;

/*
http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
*/

https.createServer({
            key: fs.readFileSync("/etc/letsencrypt/live/footcal.be/privkey.pem"),
            cert: fs.readFileSync("/etc/letsencrypt/live/footcal.be/fullchain.pem"),
            ca: fs.readFileSync("/etc/letsencrypt/live/footcal.be/chain.pem")
     }, app).listen(app.get('port'), function(){
  console.log("Express SSL server listening on port " + app.get('port'));
});