//LIVE VERSION 8 Dashboard adapted 
var express    = require('express');
var mysql      = require('mysql');
var bodyParser = require('body-parser');
var apn = require('apn');
var fcm = require('fcm-push');
var admin = require("firebase-admin");
var nodemailer = require('nodemailer');
var ejs = require('ejs');
var fs = require('fs');
var xml2js = require('xml2js');
var distance = require('gps-distance');
var formidable = require('formidable');
var dateTime = require('node-datetime');
var join = require('path').join;
var http = require('http');
var path = require('path');
var moment = require('moment');
var sourcefile = require('./footcalini.js');
var translatorfile = require('/app/nodeprojects/github/androidtranslator.js')


//Get client variables
//*************************************************************************
var clubID = sourcefile.clubID;
var clubName = sourcefile.clubName;
var clubBaseNr = sourcefile.clubBaseNr;
var apisec = sourcefile.apisec;
var dbname = sourcefile.dbname;
var apachedir = sourcefile.apachedir;
var apiport = sourcefile.apiport;
var androidtranslator = translatorfile.translator;
var serveraddress = sourcefile.serveraddress;
//*************************************************************************

//set database connection parameters
//*************************************************************************
var connection = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'Hoegaarden',
  database : dbname
});
//*************************************************************************


var app = express();


  app.set('port', process.env.PORT || apiport);
  console.log(app.get('port'));
  app.use(bodyParser.urlencoded({ extended: false}));
  app.use(bodyParser.json());




/*Email setup*/
//*************************************************************************
var transporter = nodemailer.createTransport({
          host: 'mail.footcal.be',
          port: 587,
          auth: {
            user: "sven@footcal.be",
            pass: "4'Hoegaarden"
          }
});
//*************************************************************************

/*IOS push message set up*/
//*************************************************************************
var apnProvider = new apn.Provider({  
      token: {
          key: 'certs/apns.p8', // Path to the key p8 file
          keyId: 'AW53VE2WG7', // The Key ID of the p8 file (available at https://developer.apple.com/account/ios/certificate/key)
          teamId: '857J4HYVDU', // The Team ID of your Apple Developer Account (available at https://developer.apple.com/account/#/membership/)
      },
      production: true // Set to true if sending a notification to a production iOS app
  });  
//*************************************************************************

/*Authentication test routine*/

app.all("/*", function(req, res, next){
  console.log("all gehit !!");
  console.log(req.url);
  var sourceAddress = req.connection.remoteAddress.toString();

  console.log(sourceAddress);
  console.log(serveraddress);
  console.log(sourceAddress.indexOf(serveraddress));

  if (sourceAddress.indexOf(serveraddress) == -1){
    console.log("perfom Authentication !!");
  }

  next();

});

/*IOS push messages*/
//*************************************************************************
app.post("/footcal/iosanulpush",function(req,res){
  var teamID = req.body.teamid;
  var date = req.body.date;
  var teamName = req.body.teamname;
  var eventType = req.body.eventType;
  var locKey = "%1$@ " + "%2$@ " + eventType;
  console.log(date);
  console.log(teamName);
  console.log(eventType);
  var notification2 = new apn.Notification();
  notification2.topic = 'be.degronckel.FootCal';
  notification2.expiry = Math.floor(Date.now() / 1000) + 3600;
  notification2.sound = 'ping.aiff';
  notification2.titleLocKey = "Annulation";
  notification2.locKey = locKey;
  notification2.locArgs = [date, teamName];
  console.log(teamID);
  var connquery = "SELECT tokens.accountID, tokens.token, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.send_anul = 1 AND tokens.device_type = 'Apple'";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

          if (clubID != row.active_clubID){
            //notification2.titleLocKey = "%1$@ Annulation";
            //notification2.titleLocArgs = [clubName];
            notification2.subtitle = "[" + clubName + "]";
          }

          apnProvider.send(notification2, row.token).then(function(result) { 
            console.log(result);
            console.log(result.failed);
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/footcal/iosanulpush2",function(req,res){
  var teamID = req.body.teamid;
  var date = req.body.date;
  var teamName = req.body.teamname;
  var eventID = req.body.eventid;
  var title = "annulation";
  
  var connquery = "SELECT tokens.accountID, tokens.token, tokens.active_clubID, tokens.device_language FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.send_anul = 1 AND tokens.device_type = 'Apple'";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

          var notification2 = new apn.Notification();
          notification2.topic = 'be.degronckel.FootCal';
          notification2.expiry = Math.floor(Date.now() / 1000) + 3600;
          notification2.sound = 'ping.aiff';

          if (clubID != row.active_clubID){
            notification2.subtitle = "[" + clubName + "]";
          } 

          console.log("active clubeID :" + row.active_clubID);
          console.log(notification2.subtitle);  
          
          var locTitle = androidtranslator[row.device_language][title];

          var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          connection.query(connquery2, function(err, rows2, fields){
            if (!err){
                
                notification2.title = locTitle;
                notification2.body = date + " " + teamName + " " + rows2[0].club_event_name;
                notification2.aps.category = "anul";
                notification2.aps.eventID = eventID;

                apnProvider.send(notification2, row.token).then(function(result) { 
                console.log(result);
                console.log(result.failed);
                });
            } else {
              console.log('Error while performing Query.');
            }
          });   

          
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});


app.post("/footcal/ioslivepush",function(req,res){
  var teamID = req.body.teamid;
  var body = req.body.body;
  var title = req.body.title;
  var teamName = req.body.teamname;
  

  console.log("ioslivepush gehit !!");
  var connquery = "SELECT tokens.accountID, tokens.token, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.device_type = 'Apple' AND tokens.send_livemode = 1";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
          var notification3 = new apn.Notification();
          notification3.topic = 'be.degronckel.FootCal';
          notification3.expiry = Math.floor(Date.now() / 1000) + 3600;
          notification3.sound = 'ping.aiff';
          notification3.titleLocKey = title;
          notification3.titleLocArgs = [teamName];
          notification3.body = body;
          if (clubID != row.active_clubID){
            //notification3.titleLocKey = "%2$@ " + title;
            //notification3.titleLocArgs = [teamName,clubName];
            notification3.subtitle = "[" + clubName + "]";
          }
          apnProvider.send(notification3, row.token).then(function(result) { 
            console.log(result);
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/footcal/iosgoallivepush",function(req,res){
  var teamID = req.body.teamid;
  var body = req.body.body;
  var title = req.body.title;
  var teamName = req.body.teamname;
  var playerName = req.body.playername;
  var assistName = req.body.assistname;
  var homeGoals = req.body.homegoals;
  var awayGoals = req.body.awaygoals;
  
  console.log("ioslivegoalpush gehit !!");
  var connquery = "SELECT tokens.accountID, tokens.token, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.device_type = 'Apple' AND tokens.send_livemode = 1";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
          var notification5 = new apn.Notification();
          notification5.topic = 'be.degronckel.FootCal';
          notification5.expiry = Math.floor(Date.now() / 1000) + 3600;
          notification5.sound = 'ping.aiff';
          notification5.titleLocKey = title;
          notification5.titleLocArgs = [teamName];
          notification5.locKey = body;
          if (assistName != "none"){
            notification5.locArgs = [playerName, assistName, homeGoals, awayGoals];
          } else {
            notification5.locArgs = [playerName, homeGoals, awayGoals];
          }
          if (clubID != row.active_clubID){
            //notification5.titleLocKey = "%2$@ " + title;
            //notification5.titleLocArgs = [teamName,clubName];
            notification5.subtitle = "[" + clubName + "]";
          }
          apnProvider.send(notification5, row.token).then(function(result) { 
            console.log(result);
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});


app.post("/footcal/iospushdatemove",function(req,res){
  var teamID = req.body.teamid;
  var body = req.body.body;
  var oldDate = req.body.olddate;
  var newDate = req.body.newdate;
  var teamName = req.body.teamname;
  var eventID = req.body.eventid;
  console.log("iospushdatemove gehit !");
  
  //notification4.locArgs = [oldDate, newDate, teamName];
  console.log(teamID);
  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.send_anul = 1 AND tokens.device_type = 'Apple'";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
          var notification4 = new apn.Notification();
          notification4.topic = 'be.degronckel.FootCal';
          notification4.expiry = Math.floor(Date.now() / 1000) + 3600;
          notification4.sound = 'ping.aiff';
          notification4.titleLocKey = 'event moved';
          notification4.locKey = body;
          if (clubID != row.active_clubID){
            //notification4.titleLocKey = "%1$@ event moved";
            //notification4.titleLocArgs = [clubName];
            notification4.subtitle = "[" + clubName + "]";
          }
          var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          connection.query(connquery2, function(err, rows, fields){
            if (!err){
                notification4.locArgs = [oldDate, newDate, teamName, rows[0].club_event_name];
                apnProvider.send(notification4, row.token).then(function(result) { 
                  console.log(result);
                });
            } else {
              console.log('Error while performing Query.');
            }
          });  
          
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});


app.post("/footcal/iosselectionpush",function(req,res){
  var playerID = req.body.playerid;
  var body = req.body.body;
  var title = req.body.title;
  var playerName = req.body.playername;
  var teamName = req.body.teamname;
  var opponentName = req.body.opponentname;
  var date = req.body.date;
  
  connection.query("SELECT tokens.accountID, tokens.token, tokens.active_clubID FROM tokens LEFT JOIN linkedPlayers ON tokens.accountID = linkedPlayers.accountID WHERE linkedPlayers.playerID = ? AND tokens.send = 1 AND tokens.device_type = 'Apple'", req.body.playerid, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

          var notification6 = new apn.Notification();
          notification6.topic = 'be.degronckel.FootCal';
          notification6.expiry = Math.floor(Date.now() / 1000) + 3600;
          notification6.sound = 'ping.aiff';
          notification6.titleLocKey = title;
          notification6.locKey = body;
          notification6.locArgs = [playerName, teamName, opponentName, date];

          if (clubID != row.active_clubID){
            notification6.subtitle = "[" + clubName + "]";
          }
          apnProvider.send(notification6, row.token).then(function(result) { 
            console.log(result);
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

/*
app.post("/footcal/iosselectionpush",function(req,res){
  var playerID = req.body.playerid;
  var body = req.body.body;
  var title = req.body.title;
  var playerName = req.body.playername;
  var teamName = req.body.teamname;
  var eventID = req.body.eventid;
  var date = req.body.date;
  
  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.send_anul = 1 AND tokens.device_type = 'Apple'";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

          var notification6 = new apn.Notification();
          notification6.topic = 'be.degronckel.FootCal';
          notification6.expiry = Math.floor(Date.now() / 1000) + 3600;
          notification6.sound = 'ping.aiff';
          notification6.titleLocKey = title;
          notification6.locKey = body;
          if (clubID != row.active_clubID){
            notification6.subtitle = "[" + clubName + "]";
          }

          var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          connection.query(connquery2, function(err, rows2, fields){
            if (!err){
                
                notification6.locArgs = [playerName, teamName, rows2[0].club_event_name, date];

                apnProvider.send(notification6, row.token).then(function(result) { 
                  console.log(result);
                });
            } else {
              console.log('Error while performing Query.');
            }
          });     
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});
*/

app.post("/footcal/iosselectiontrainingpush",function(req,res){
  var playerID = req.body.playerid;
  var body = req.body.body;
  var title = req.body.title;
  var playerName = req.body.playername;
  var teamName = req.body.teamname;
  var eventID = req.body.eventid;
  var date = req.body.date;
  
  connection.query("SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN linkedPlayers ON tokens.accountID = linkedPlayers.accountID WHERE linkedPlayers.playerID = ? AND tokens.send = 1 AND tokens.device_type = 'Apple'", req.body.playerid, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

          var notification6 = new apn.Notification();
          notification6.topic = 'be.degronckel.FootCal';
          notification6.expiry = Math.floor(Date.now() / 1000) + 3600;
          notification6.sound = 'ping.aiff';
          notification6.titleLocKey = title;
          notification6.locKey = body;
          if (clubID != row.active_clubID){
            notification6.subtitle = "[" + clubName + "]";
          }

          var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          connection.query(connquery2, function(err, rows2, fields){
            if (!err){
                
                notification6.locArgs = [playerName, teamName, rows2[0].club_event_name, date];

                apnProvider.send(notification6, row.token).then(function(result) { 
                  console.log(result);
                });
            } else {
              console.log('Error while performing Query.');
            }
          });     
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/footcal/ioslocationchangepush",function(req,res){
  var body = req.body.body;
  var title = req.body.title;
  var teamID = req.body.teamid;
  var eventID = req.body.eventid;
  var teamName = req.body.teamname;
  var date = req.body.date;
  var newLocationName = req.body.newlocationname;
  
  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.send_anul = 1 AND tokens.device_type = 'Apple'";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

          var notification6 = new apn.Notification();
          notification6.topic = 'be.degronckel.FootCal';
          notification6.expiry = Math.floor(Date.now() / 1000) + 3600;
          notification6.sound = 'ping.aiff';
          notification6.titleLocKey = title;
          notification6.locKey = body;
          if (clubID != row.active_clubID){
            notification6.subtitle = "[" + clubName + "]";
          }

          var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          connection.query(connquery2, function(err, rows2, fields){
            if (!err){
                
                notification6.locArgs = [teamName, rows2[0].club_event_name, date, newLocationName];

                apnProvider.send(notification6, row.token).then(function(result) { 
                  console.log(result);
                });
            } else {
              console.log('Error while performing Query.');
            }
          });     
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/footcal/iosextrainfoegamepush",function(req,res){
  var teamID = req.body.teamid;
  var body = req.body.body;
  var teamName = req.body.teamname;
  var date = req.body.date;

  console.log(teamID);
  console.log(body);
  console.log(teamName);
  console.log(date);
  
  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.send_anul = 1 AND tokens.device_type = 'Apple'";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

          var notification6 = new apn.Notification();
          notification6.topic = 'be.degronckel.FootCal';
          notification6.expiry = Math.floor(Date.now() / 1000) + 3600;
          notification6.sound = 'ping.aiff';
          notification6.titleLocKey = 'extra info game %1$@ %2$@';
          notification6.titleLocArgs = [teamName, date];
          notification6.body = body;
          
          if (clubID != row.active_clubID){
            notification6.subtitle = "[" + clubName + "]";
          }

          apnProvider.send(notification6, row.token).then(function(result) { 
            console.log(result);
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/footcal/iosextrainfoeventpush",function(req,res){
  var teamID = req.body.teamid;
  var eventID = req.body.eventid;
  var body = req.body.body;
  var teamName = req.body.teamname;
  var date = req.body.date;
  
  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.send_anul = 1 AND tokens.device_type = 'Apple'";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

            var notification4 = new apn.Notification();
            notification4.topic = 'be.degronckel.FootCal';
            notification4.expiry = Math.floor(Date.now() / 1000) + 3600;
            notification4.sound = 'ping.aiff';
            notification4.titleLocKey = 'extra info event %1$@ %2$@ %3$@';
            notification4.body = body;

          if (clubID != row.active_clubID){
            notification4.subtitle = "[" + clubName + "]";
          }

          var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          connection.query(connquery2, function(err, rows, fields){
            if (!err){
                notification4.titleLocArgs = [teamName, rows[0].club_event_name, date];
                apnProvider.send(notification4, row.token).then(function(result) { 
                  console.log(result);
                });
            } else {
              console.log('Error while performing Query.');
            }
          });  
          
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.get("/skberlaar/iostestpush/:accountid",function(req,res){
  var accountID = req.params.accountid;
  var notification2 = new apn.Notification();
  notification2.topic = 'be.degronckel.FootCal';
  notification2.expiry = Math.floor(Date.now() / 1000) + 3600;
  notification2.sound = 'ping.aiff';
  notification2.title = 'Test';
  notification2.body = 'Test bericht van sk Berlaar.  Bericht goed ontvangen ?  Stuur "ok" naar 0478959152 (Sven DG)';
  console.log("iospush2 gehit !!");
  console.log(accountID);
  connection.query("SELECT token from tokens WHERE device_type = 'Apple' AND accountID = ?", req.params.accountid, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
          apnProvider.send(notification2, row.token).then(function(result) { 
            console.log(result);
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});


app.get("/skberlaar/loctestpush",function(req,res){
  
  var notification2 = new apn.Notification();
  notification2.topic = 'be.degronckel.FootCal';
  notification2.expiry = Math.floor(Date.now() / 1000) + 3600;
  notification2.sound = 'ping.aiff';
  notification2.locKey = 'Goto address: %1$@';
  notification2.locArgs = ["Sven"];
  
  connection.query("SELECT token from tokens WHERE device_type = 'Apple' AND accountID = 4", function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
          apnProvider.send(notification2, row.token).then(function(result) { 
            console.log(result);
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

/*ANDROID push message setup*/

var fcmSender = new fcm('AAAAPK8iGGM:APA91bEJUBP-ilZOqYz_5roVMdx3KkjKC6Av5H-p3LsT9kb9Y1gBTNeQP76HBUj7ky7bc8h72E0nMaaSPUISf8Cp0sUvdyle0F2-aPsI1wafilUqGXlnIqHpk7bGBWuUKovH637ltoYl');

var serviceAccount = require("/app/nodeprojects/github/keys/firebase-footcal-firebase-adminsdk-ut2e7-91293ddf03.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://fir-footcal.firebaseio.com"
});

/*ANDROID push messages*/

app.post("/footcal/androidanulpush",function(req,res){
var teamID = req.body.teamid;
var date = req.body.date;
var teamName = req.body.teamname;
var eventID = req.body.eventid;
var title = "annulation";
console.log(teamID);

  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.device_type = 'Android' AND tokens.send_livemode = 1";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
        if (clubID != row.active_clubID){
            title = "club_annulation";
          } else {
            title = "annulation";
          }
        var locTitle = androidtranslator[row.device_language][title];
        locTitle = locTitle.replace("%1", "[" + clubName.toLowerCase() + "]");

        var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          connection.query(connquery2, function(err, rows2, fields){
            if (!err){
                //var body = androidtranslator[row.device_language][eventType];
                //body = body.replace("%1", date);
                //body = body.replace("%2", teamName);

                var body = date + " " + teamName + " " + rows2[0].club_event_name;  

                var fcmMessage = {
                  to: row.token,
                  notification: {
                    title: locTitle,
                    body: body,
                    sound: 'true'
                  }
                };
                console.log(fcmMessage);
                fcmSender.send(fcmMessage, function(err, response){
                if (err) {
                  console.log("Something has gone wrong!" , err);
                } else {
                 console.log("Successfully sent with response: ", response);
                }
                });
                
            } else {
              console.log('Error while performing Query.');
            }
          });

      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});



app.get("/footcal/androidlivepushtest",function(req,res){

var my_name = "Sven";
var language = "en";
var text = "game_start";

//console.log(androidtranslator);

var message = {
    to: 'dfF5YoUw2M0:APA91bEx-A3caCELHBhi-f4OukTF7ufD2uX1SCkGoFNSPDWVltb5Pv5ucsNkkaAGjp-9Jn0q3l2XWg7Q_wNO5Ivfn5SaqzQ4xnxFiVzmapnuaa4jaQpAL-WaHrjfEBOE_ADVrhTK_A0v', // required fill with device token or topics 
    notification: {
        title: 'Eerste nodejs test',
        body: 'FootCal is the best !!',
        sound: 'true'
    }
};

fcmSender.send(message, function(err, response){
    if (err) {
        console.log("Something has gone wrong!" , err);
    } else {
        console.log("Successfully sent with response: ", response);
    }
});
});

app.post("/footcal/androidlivepush",function(req,res){
var teamID = req.body.teamid;
var body = req.body.body;
var title = req.body.title;
var sendTitle = "";
var teamName = req.body.teamname;

  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.device_type = 'Android' AND tokens.send_livemode = 1";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
        if (clubID != row.active_clubID){
            sendTitle = "club_" + title;
          } else {
            sendTitle = title;
          } 
        var locTitle = androidtranslator[row.device_language][sendTitle];
        console.log(locTitle);
        locTitle = locTitle.replace("%1", teamName);
        locTitle = locTitle.replace("%2", "[" + clubName.toLowerCase() + "]");
        var fcmMessage = {
          to: row.token,
          notification: {
            title: locTitle,
            body: body,
            sound: 'true'
          }
        };
        console.log(fcmMessage);

        fcmSender.send(fcmMessage, function(err, response){
        if (err) {
          console.log("Something has gone wrong!" , err);
        } else {
         console.log("Successfully sent with response: ", response);
        }
        });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});


app.post("/footcal/androidgoallivepush",function(req,res){
var teamID = req.body.teamid;
var body = req.body.body;
var title = req.body.title;
var sendTitle = "";
var teamName = req.body.teamname;
var playerName = req.body.playername;
var assistName = req.body.assistname;
var homeGoals = req.body.homegoals;
var awayGoals = req.body.awaygoals;

  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.device_type = 'Android' AND tokens.send_livemode = 1";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
        if (clubID != row.active_clubID){
            sendTitle = "club_" + title;
          } else {
            sendTitle = title;
          }
        var locTitle = androidtranslator[row.device_language][sendTitle];
        locTitle = locTitle.replace("%1", teamName);
        locTitle = locTitle.replace("%2", "[" + clubName.toLowerCase() + "]");
        var locBody = androidtranslator[row.device_language][body];
        console.log(body);
        console.log(locBody);
        if (assistName != "none") {
          locBody = locBody.replace("%1", playerName);
          locBody = locBody.replace("%2", assistName);
          locBody = locBody.replace("%3", homeGoals);
          locBody = locBody.replace("%4", awayGoals);

        } else {
          locBody = locBody.replace("%1", playerName);
          locBody = locBody.replace("%2", homeGoals);
          locBody = locBody.replace("%3", awayGoals);
        }
        var fcmMessage = {
          to: row.token,
          notification: {
            title: locTitle,
            body: locBody,
            sound: 'true'
          }
        };
        console.log(fcmMessage);
        
        fcmSender.send(fcmMessage, function(err, response){
        if (err) {
          console.log("Something has gone wrong!" , err);
        } else {
         console.log("Successfully sent with response: ", response);
        }
        });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});


app.post("/footcal/androidddatemovepush",function(req,res){
var teamID = req.body.teamid;
var teamName = req.body.teamname;
var body = req.body.body;
var olddate = req.body.olddate;
var newdate = req.body.newdate;
var eventID = req.body.eventid;
var title = "event_moved";
var sendTitle = "";

  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.device_type = 'Android' AND tokens.send_livemode = 1";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log("Android tokens :");
      console.log(rows)
      rows.forEach(function(row, i) {
        if (clubID != row.active_clubID){
            sendTitle = "club_" + title;
          } else {
            sendTitle = title;
          }
        var locTitle = androidtranslator[row.device_language][sendTitle];
        locTitle = locTitle.replace("%1", "[" + clubName.toLowerCase() + "]");

          var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          connection.query(connquery2, function(err, rows2, fields){
            if (!err){
                console.log("breakpoint :");
                console.log(row.device_language);
                console.log(body);
                var locBody = androidtranslator[row.device_language][body];
                locBody = locBody.replace("%1", olddate);
                locBody = locBody.replace("%2", newdate);
                locBody = locBody.replace("%3", teamName);
                locBody = locBody.replace("%4", rows2[0].club_event_name);
                var fcmMessage = {
                  to: row.token,
                  notification: {
                    title: locTitle,
                    body: locBody,
                    sound: 'true'
                  }
                };
                console.log(fcmMessage);
                
                fcmSender.send(fcmMessage, function(err, response){
                if (err) {
                  console.log("Something has gone wrong!" , err);
                } else {
                 console.log("Successfully sent with response: ", response);
                }
                });
            } else {
              console.log('Error while performing Query.');
            }
          }); 
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/footcal/androidselectionpush",function(req,res){
var playerID = req.body.playerid;
var body = req.body.body;
var title = req.body.title;
var playerName = req.body.playername;
var teamName = req.body.teamname;
var opponentName = req.body.opponentname;
var date = req.body.date;
var sendTitle = "";
var titleArgs = JSON.stringify([""]);
var clubNameBracket = "[" + clubName + "]";


var testarray = [playerName, teamName, opponentName, date];
var testarraystring = JSON.stringify(testarray);
  
  connection.query("SELECT tokens.accountID, tokens.token, tokens.active_clubID FROM tokens LEFT JOIN linkedPlayers ON tokens.accountID = linkedPlayers.accountID WHERE linkedPlayers.playerID = ? AND tokens.send = 1 AND tokens.device_type = 'Android'", req.body.playerid, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

        if (clubID != row.active_clubID){
            sendTitle = "club_" + title;
            titleArgs = JSON.stringify([clubNameBracket]);
          } else {
            sendTitle = title;
          }

         var payload = {
            notification: {
              titleLocKey: sendTitle,
              titleLocArgs: titleArgs,
              bodyLocKey: body,
              bodyLocArgs: testarraystring,
              sound: 'true'
            }
          };

          var options = {
            priority: "high",
            timeToLive: 60 * 60 *24
          };   


        admin.messaging().sendToDevice(row.token, payload, options)
          .then(function(response) {
            console.log("Successfully sent message:", response);
            //res.end(JSON.stringify(response));
          })
          .catch(function(error) {
            console.log("Error sending message:", error);
            //res.end(JSON.stringify(error));
        });

      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});


app.post("/footcal/androidselectiontrainingpush",function(req,res){
var playerID = req.body.playerid;
var body = req.body.body;
var title = req.body.title;
var playerName = req.body.playername;
var teamName = req.body.teamname;
var eventID = req.body.eventid;
var date = req.body.date;
var sendTitle = "";
var titleArgs = JSON.stringify([""]);
var clubNameBracket = "[" + clubName + "]";

  connection.query("SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN linkedPlayers ON tokens.accountID = linkedPlayers.accountID WHERE linkedPlayers.playerID = ? AND tokens.send = 1 AND tokens.device_type = 'Android'", req.body.playerid, function(err, rows, fields) {
    if (!err){
      //res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

        if (clubID != row.active_clubID){
            sendTitle = "club_" + title;
            titleArgs = JSON.stringify([clubNameBracket]);
          } else {
            sendTitle = title;
          }
          
          var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          console.log(connquery2);
          connection.query(connquery2, function(err, rows2, fields){
            if (!err){
                
                var payload = {
            notification: {
              titleLocKey: sendTitle,
              titleLocArgs: titleArgs,
              bodyLocKey: body,
              bodyLocArgs: JSON.stringify([playerName, teamName, rows2[0].club_event_name, date]),
              sound: 'true'
            }
          };

          var options = {
            priority: "high",
            timeToLive: 60 * 60 *24
          };   


        admin.messaging().sendToDevice(row.token, payload, options)
          .then(function(response) {
            console.log("Successfully sent message:", response);
            res.end(JSON.stringify(response));
          })
          .catch(function(error) {
            console.log("Error sending message:", error);
            res.end(JSON.stringify(error));
        });

                
            } else {
              console.log('Error while performing Query2.');
              console.log(err);
            }
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/footcal/androidlocationchangepush",function(req,res){
var body = req.body.body;
var title = req.body.title;
var teamID = req.body.teamid;
var eventID = req.body.eventid;
var teamName = req.body.teamname;
var date = req.body.date;
var newLocationName = req.body.newlocationname;
var sendTitle = "";
var titleArgs = [];
console.log(teamName);
console.log(date);
console.log(newLocationName);

  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.device_type = 'Android'";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      //res.end(JSON.stringify(rows));
      
      rows.forEach(function(row, i) {

        if (clubID != row.active_clubID){
            sendTitle = "club_" + title;
            titleArgs = "[" + clubName + "]";
          } else {
            sendTitle = title;
          }

          var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          connection.query(connquery2, function(err, rows2, fields){
            if (!err){
                
                var payload = {
            notification: {
              titleLocKey: sendTitle,
              titleLocArgs: JSON.stringify(titleArgs),
              bodyLocKey: body,
              bodyLocArgs: JSON.stringify([teamName, rows2[0].club_event_name, date, newLocationName]),
              sound: 'true'
            }
          };

          var options = {
            priority: "high",
            timeToLive: 60 * 60 *24
          };   


        admin.messaging().sendToDevice(row.token, payload, options)
          .then(function(response) {
            console.log("Successfully sent message:", response);
            res.end(JSON.stringify(response));
          })
          .catch(function(error) {
            console.log("Error sending message:", error);
            res.end(JSON.stringify(error));
        });

                
            } else {
              console.log('Error while performing Query.');
            }
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/footcal/androidextrainfogamepush",function(req,res){
var teamID = req.body.teamid;
var body = req.body.body;
var teamName = req.body.teamname;
var date = req.body.date;
var testarray = [teamName, date];
var testarraystring = JSON.stringify(testarray);

console.log(teamID);
console.log(body);
console.log(teamName);
console.log(date);

var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.send_anul = 1 AND tokens.device_type = 'Android'";

  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
          /*
          if (clubID != row.active_clubID){
            sendTitle = "club_" + title;
            titleArgs = JSON.stringify([clubNameBracket]);
          } else {
            sendTitle = title;
          }*/

         var payload = {
            notification: {
              titleLocKey: 'extra_info_game',
              titleLocArgs: testarraystring,
              body: body,
              sound: 'true'
            }
          };

          var options = {
            priority: "high",
            timeToLive: 60 * 60 *24
          };   


        admin.messaging().sendToDevice(row.token, payload, options)
          .then(function(response) {
            console.log("Successfully sent message:", response);
            //res.end(JSON.stringify(response));
          })
          .catch(function(error) {
            console.log("Error sending message:", error);
            //res.end(JSON.stringify(error));
        });

      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.post("/footcal/androidextrainfoeventpush",function(req,res){
var teamID = req.body.teamid;
var eventID = req.body.eventid;
var body = req.body.body;
var teamName = req.body.teamname;
var date = req.body.date;

  var connquery = "SELECT tokens.accountID, tokens.token, tokens.device_language, tokens.active_clubID FROM tokens LEFT JOIN accounts ON tokens.accountID = accounts.account_ID WHERE accounts.favorites REGEXP '[[:<:]]" + teamID + "[[:>:]]' AND tokens.send = 1 AND tokens.device_type = 'Android'";
  connection.query(connquery, function(err, rows, fields) {
    if (!err){
      //res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {
        /*
        if (clubID != row.active_clubID){
            sendTitle = "club_" + title;
            titleArgs = "[" + clubName + "]";
          } else {
            sendTitle = title;
          }*/

          var connquery2 = "SELECT club_event_types.club_event_name_" + row.device_language + " as club_event_name FROM events LEFT JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.event_ID = " + eventID;
          connection.query(connquery2, function(err, rows2, fields){
            if (!err){
                
              var payload = {
              notification: {
              titleLocKey: 'extra_info_event',
              titleLocArgs: JSON.stringify([teamName, rows2[0].club_event_name, date]),
              body: body,
              sound: 'true'
            }
          };

          var options = {
            priority: "high",
            timeToLive: 60 * 60 *24
          };   


        admin.messaging().sendToDevice(row.token, payload, options)
          .then(function(response) {
            console.log("Successfully sent message:", response);
            res.end(JSON.stringify(response));
          })
          .catch(function(error) {
            console.log("Error sending message:", error);
            res.end(JSON.stringify(error));
        });

                
            } else {
              console.log('Error while performing Query.');
            }
          });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

app.get("/footcal/androidtestpush/:accountid",function(req,res){
var accountID = req.params.accountid;
  connection.query("SELECT token from tokens WHERE device_type = 'Android' AND accountID = ?", req.params.accountid, function(err, rows, fields) {
    if (!err){
      res.end(JSON.stringify(rows));
      console.log(rows)
      rows.forEach(function(row, i) {

      var fcmMessage = {
          to: row.token,
          notification: {
            title: 'Test !',
            body: 'Test bericht van FootCal',
            sound: 'true'
          }
        };
      console.log(fcmMessage);
        
      fcmSender.send(fcmMessage, function(err, response){
      if (err) {
        console.log("Something has gone wrong!" , err);
      } else {
       onsole.log("Successfully sent with response: ", response);
        }
      });
      });
    }else{
      console.log('Error while performing Query.');
    }
 });
});

/*Email handling*/

app.put("/email/recoverpassword/:accountid",function(req,res){
var toaddress = req.body.toaddress;
var newpassword = req.body.newpassword;
var put = {
      password: req.body.hashedpassword,
      pw_recovered: 1
};
var mailOptions = {
  from: 'noreply@footcal.be',
  to: toaddress,
  subject: 'FootCal password reset',
  text: 'Hello, \n\n Your password has been reset to : ' + newpassword + '\n\n\n Kind regards, \n FootCal'
};
transporter.sendMail(mailOptions, function(error, info){
    if(error){
      console.log(error);
      res.end(JSON.stringify(error));
    }else{
      console.log('Message sent: ' + info.response);
      res.end(JSON.stringify(info.response));
      connection.query('UPDATE accounts SET ? WHERE account_ID = ?',[put, req.params.accountid], function(err,result) {
        if (!err){
          console.log(result);
          res.end(JSON.stringify(result.changedRows));
        }else{
          console.log('Error while performing Query.');
        }
      });
    };
});
});

app.put("/email/recoverpasswordloc/:accountid",function(req,res){
var toaddress = req.body.toaddress;
var newpassword = req.body.newpassword;
var subject = req.body.subject;
var body = req.body.body;
var put = {
      password: req.body.hashedpassword,
      pw_recovered: 1
};
console.log(body);
var mailOptions = {
  from: 'noreply@footcal.be',
  to: toaddress,
  subject: subject,
  text: body
};
transporter.sendMail(mailOptions, function(error, info){
    if(error){
      console.log(error);
      res.end(JSON.stringify(error));
    }else{
      console.log('Message sent: ' + info.response);
      res.end(JSON.stringify(info.response));
      connection.query('UPDATE accounts SET ? WHERE account_ID = ?',[put, req.params.accountid], function(err,result) {
        if (!err){
          console.log(result);
          res.end(JSON.stringify(result.changedRows));
        }else{
          console.log('Error while performing Query.');
        }
      });
    };
});
});

app.get("/email/test",function(req,res){

var htmltemplate = fs.readFileSync('wedstrijdblad.html',{encoding:'utf-8'});
var teams = {hometeam : 'SK BERLAAR', awayteam : 'FC HERENTHOUT', matchtype : "KAMPIOENSCHAP", departement : "U10A Gewestelijke", series : "H", gamedate : "01/05/2017", location : "SK BERLAAR", delegee : "Johan Wijns", T1 : "Sven De Gronckel", homegoals : "5", awaygoals : "2" };
var players = [
    { lastname: "De Gronckel", firstname: "Mats", goals: "2"},
    { lastname: "Ceuppers", firstname: "Ilya", goals: "1"},
    { lastname: "Mariën", firstname: "Bram", goals: "0"},
    { lastname: "", firstname: "", goals: ""},
    { lastname: "", firstname: "", goals: ""}
];
var scores = [
    { timestamp: "4", name: "Mats De Gronckel"},
    { timestamp: "6", name: "Ilya Ceuppers"},
    { timestamp: "10", name: "Mats De Gronckel"},
    { timestamp: "13", name: "Bram Mariën"},
    { timestamp: "21", name: "Ilya Ceuppers"}
];

//var htmloutput = ejs.render(htmltemplate, teams);

var htmloutput = ejs.render(htmltemplate, {
  hometeam : 'SK BERLAAR',
  awayteam : 'FC HERENTHOUT',
  matchtype : "KAMPIOENSCHAP",
  departement : "U10A Gewestelijke",
  series : "H",
  gamedate : "01/05/2017",
  location : "SK BERLAAR",
  delegee : "Johan Wijns",
  T1 : "Sven De Gronckel",
  homegoals : "5",
  awaygoals : "2",
  players: players,
  scores: scores
  });

var mailOptions = {
  from: 'pokergroupsinfo@gmail.com',
  to: 'sven.degronckel@skynet.be',
  subject: 'Wedstrijd verslag',
  text: '',
  html: htmloutput
};
transporter.sendMail(mailOptions, function(error, info){
    if(error){
      console.log(error);
      res.end(JSON.stringify(error));
    }else{
      console.log('Message sent: ' + info.response);
      res.end(JSON.stringify(info.response));
    };
});
});


app.get("/export/:eventid",function(req,res){
var eventID = req.params.eventid;
var htmltemplate = fs.readFileSync('wedstrijdblad.html',{encoding:'utf-8'});

/*email address query*/

connection.query("SELECT gameReportEmails FROM settings", function(err, rows, fields) {

  if (!err && rows.length > 0){

  var gameReportEmailString = rows[0].gameReportEmails;

/*matchinfoquery*/
connection.query("SELECT events.referee, events.teamID, club_event_types.club_event_name_nl as event_type, events.match_type, events.confirmed_players, CONVERT(DATE_FORMAT(events.date,'%d-%m-%Y'), CHAR(50)) as event_date, CONVERT(DATE_FORMAT(events.date,'%H:%i'), CHAR(50)) as event_time, COALESCE(results.homegoals, 1000) as homegoals, COALESCE(results.awaygoals, 1000) as awaygoals, CONVERT(COALESCE(concat(opponentteam.prefix, ' ', opponentteam.name), 'none'), CHAR(50)) as opponent_name, CONVERT(COALESCE(concat(opponentplace.prefix, ' ', opponentplace.name), COALESCE(homelocations.name,'')), CHAR(50)) as event_location FROM events LEFT JOIN club_event_types ON events.event_type = club_event_types.club_event_type_ID LEFT JOIN results ON events.event_ID = results.eventID LEFT JOIN opponents AS opponentteam ON events.opponentID = opponentteam.opponent_ID LEFT JOIN opponents AS opponentplace ON events.locationID = opponentplace.opponent_ID LEFT JOIN homelocations on events.homelocationID = homelocations.homelocation_ID WHERE event_ID = ?", eventID, function(err, rows, fields) {

  if (!err){
    var teamID = rows[0].teamID;
    //var confirms = "(" + rows[0].confirmed_players + ",1" + ",2" +")";
    //var confirms1 = "(" + rows[0].confirmed_players + ")";
    var eventTypeDB = rows[0].event_type;
    var eventDateDB = rows[0].event_date;
    var eventTimeDB = rows[0].event_time;
    var homegoalsDB = rows[0].homegoals;
    var awaygoalsDB = rows[0].awaygoals;
    var matchtypeDB = rows[0].match_type;
    var locationDB = rows[0].event_location;
    var opponentnameDB = rows[0].opponent_name;
    var refereeDB = rows[0].referee;
    var hometeamDB = '';
    var awayteamDB = '';

    if (refereeDB == 'none'){
        refereeDB = "Niet gekend"
    }

    if (matchtypeDB == 'home'){
        hometeamDB = clubName;
        awayteamDB = opponentnameDB;  
    }else{
        hometeamDB = opponentnameDB;
        awayteamDB = clubName;
    }
    /*teaminfoquery*/
    connection.query('SELECT teams.team_name, teams.team_division, teams.team_series, trainer.first_name as trainer_first_name, trainer.last_name as trainer_last_name, trainer.email_address as trainer_email_address, delegee.first_name as delegee_first_name, delegee.last_name as delegee_last_name, delegee.email_address as delegee_email_address, COALESCE(trainer2.email_address, "none") as trainer2_email_address, COALESCE(delegee2.email_address, "none") as delegee2_email_address FROM teams LEFT JOIN staff as trainer ON T1_ID = trainer.staff_ID LEFT JOIN staff AS trainer2 ON T2_ID = trainer2.staff_ID LEFT JOIN staff AS delegee ON D1_ID = delegee.staff_ID LEFT JOIN staff AS delegee2 ON D2_ID = delegee2.staff_ID WHERE team_ID = ?', teamID, function(err, rows, fields) {
       
       if (!err){
          var teamnameDB = rows[0].team_name;
          var teamdivisionDB = rows[0].team_division;
          var teamseriesDB = rows[0].team_series;
          var trainernameDB = rows[0].trainer_first_name + " " + rows[0].trainer_last_name;
          var delegeenameDB = rows[0].delegee_first_name + " " + rows[0].delegee_last_name;
          var ccEmailAddressArray = [];
          ccEmailAddressArray.push(rows[0].trainer_email_address);
          ccEmailAddressArray.push(rows[0].delegee_email_address);

          if (rows[0].trainer2_email_address != 'none') {ccEmailAddressArray.push(rows[0].trainer2_email_address);}
          if (rows[0].delegee2_email_address != 'none') {ccEmailAddressArray.push(rows[0].delegee2_email_address);}


          /*playersquery*/  
          //var connquery = "SELECT players.first_name as firstname, players.last_name as lastname, COALESCE((SELECT goals.goals from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + eventID + "), 0) as goals FROM players where players.player_ID IN " + confirms1;
          //var connquery = "SELECT players.first_name as firstname, players.last_name as lastname, COALESCE((SELECT COUNT(*) from goals_new WHERE goals_new.playerid = players.player_ID AND goals_new.eventID = " + eventID + "), 0) as goals FROM players where players.player_ID IN " + confirms1 + "GROUP BY players.last_name";
          var connquery = "SELECT players.first_name as firstname, players.last_name as lastname, COALESCE((SELECT COUNT(*) from goals_new WHERE goals_new.playerid = players.player_ID AND goals_new.eventID = " + eventID + "), 0) as goals FROM players LEFT JOIN event_presences ON players.player_ID = event_presences.playerID WHERE event_presences.eventID = " + eventID + " AND event_presences.confirmed = 1 GROUP BY players.last_name";
          connection.query(connquery, function(err, rows, fields) {

            if (!err){
              var players = rows;


              /*scoresquery*/
              //var connquery2 = "SELECT players.first_name, players.last_name, COALESCE((SELECT goals.goals from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + eventID + "), 0) as goals, COALESCE((SELECT goals.timestamps from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + eventID + "), 'none') as timestamps FROM players where players.player_ID IN " + confirms + " AND COALESCE((SELECT goals.goals from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + eventID + "), 0) <> '0'"
              var connquery2 = "SELECT concat(players.first_name, ' ', players.last_name) as name, goals_new.timestamp FROM goals_new LEFT JOIN players ON goals_new.playerID = players.player_ID WHERE goals_new.eventID = " + eventID + " ORDER BY goals_new.timestamp ASC";
              connection.query(connquery2, function(err, rows, fields) {

                if (!err){
                  
                    //var scoresarray = [];
                    var scoresarray = rows;
                    for(var i=0; i < scoresarray.length; i++) {
                      scoresarray[i].name = scoresarray[i].name.replace('Opponent', 'Tegenstander');
                      
                    }
                    /*
                    rows.forEach(function(row, i) {

                        var timestampstring = row.timestamps;
                        var timestamparray = timestampstring.split(",");
                        
                        timestamparray.forEach(function(timestampitem,i) {

                            var tempscoredic = {

                                timestamp: timestampitem,
                                name: row.first_name + " " + row.last_name

                            };
                            scoresarray.push(tempscoredic);

                        });
                        scoresarray.sort(function(a,b){return a.timestamp-b.timestamp});

                    }); 
                    */
                  if (players.length > scoresarray.length) {
                      //fill out the scoresarray
                      var difference =  players.length - scoresarray.length;
                      var emptyscoredic = {

                                timestamp: "",
                                name: ""

                            };
                      for (i = 0; i < difference; i++) {
                          scoresarray.push(emptyscoredic);
                      }

                  } else if (players.length < scoresarray.length) {
                      //fill out the playersarray
                      var difference =  scoresarray.length - players.length;
                      var emptyplayersdic = {
                            lastname: "",
                            firstname: "",
                            goals: ""
                      };
                      for (i = 0; i < difference; i++) {
                            players.push(emptyplayersdic);
                      }

                  }

                  var htmloutput = ejs.render(htmltemplate, {

                  clubname : clubName,
                  clubbasenr : clubBaseNr, 
                  hometeam : hometeamDB,
                  awayteam : awayteamDB,
                  matchtype : eventTypeDB,
                  departement : teamnameDB + " " + teamdivisionDB,
                  series : teamseriesDB,
                  gamedate : eventDateDB,
                  gametime : eventTimeDB,
                  location : locationDB,
                  delegee : delegeenameDB,
                  T1 : trainernameDB,
                  homegoals : homegoalsDB,
                  awaygoals : awaygoalsDB,
                  players: players,
                  scores: scoresarray,
                  referee: refereeDB
                  });


                  var dt = dateTime.create();
                  var formatted = dt.format('d_m_Y_H_M_S');

                  //var fileName = 'gamereports/' + teamnameDB + '_' + formatted + '.html';
                  
                  //var fileName = '/Applications/MAMP/htdocs/' + apachedir + '/gamereports/' + teamnameDB + '_' + formatted + '.html';   
                  var fileName = '/var/www/footcal.be/public_html/' + apachedir + '/gamereports/' + teamnameDB + '_' + formatted + '.html';  

                  fileName = fileName.replace(" ", "_"); 


                  fs.writeFile(fileName, htmloutput, function(err){
                      if (err){
                          console.log(err);
                      } else {
                        console.log("The file was saved");
                      }

                  });  

                  var mailOptions = {
                    from: 'gamereport@footcal.be',
                    to: gameReportEmailString,
                    cc: ccEmailAddressArray,
                    subject: 'Wedstrijd verslag' + ' ' + teamnameDB,
                    text: 'Het wedstrijdverslag vind je in attach.',
                    //html: htmloutput,
                    attachments: [
                      {path: fileName

                      }
                    ]
                  };
                  transporter.sendMail(mailOptions, function(error, info){
                      if(error){
                        console.log(error);
                        res.end(JSON.stringify(error));
                      }else{
                        console.log('Message sent: ' + info.response);
                        var outputArray = [];
                        var outputDic = {
                            response: info.response
                        };
                        outputArray.push(outputDic);
                        console.log(outputArray);
                        res.end(JSON.stringify(outputDic));
                      };
                  });

                  
                }else{
                  console.log('Error while performing Query.1');
                  var outputArray = [];
              var outputDic = {
                   response: "failed"
                    };
              outputArray.push(outputDic);
              console.log(outputArray);
              res.end(JSON.stringify(outputDic)); 
                }
              });
            }else{
              console.log('Error while performing Query.2');
              var outputArray = [];
              var outputDic = {
                   response: "failed"
                    };
              outputArray.push(outputDic);
              console.log(outputArray);
              res.end(JSON.stringify(outputDic)); 
            }
          });/*playersquery*/ 
        }else{
          console.log('Error while performing Query.3');
          var outputArray = [];
              var outputDic = {
                   response: "failed"
                    };
              outputArray.push(outputDic);
              console.log(outputArray);
              res.end(JSON.stringify(outputDic)); 
        }
    });/*teaminfoquery*/
  }else{
    console.log('Error while performing Query.4');
    console.log(err);
    var outputArray = [];
              var outputDic = {
                   response: "failed"
                    };
              outputArray.push(outputDic);
              console.log(outputArray);
              res.end(JSON.stringify(outputDic)); 
  }
  });/*matchinfoquery*/
  }else{
    console.log('Error while performing Query.5');
    var outputArray = [];
              var outputDic = {
                   response: "failed"
                    };
              outputArray.push(outputDic);
              console.log(outputArray);
              res.end(JSON.stringify(outputDic)); 
  }
});
});



app.get("/tournamentexport/:teventid",function(req,res){
var tournamentEventID = req.params.teventid;
var htmltemplate = fs.readFileSync('wedstrijdblad.html',{encoding:'utf-8'});


/*email address query*/

connection.query("SELECT gameReportEmails FROM settings", function(err, rows, fields) {

  if (!err && rows.length > 0){

  var gameReportEmailString = rows[0].gameReportEmails;

/*matchinfoquery*/
connection.query("SELECT tournamentevents.referee, tournamentevents.teamID, tournamentevents.match_type, tournamentevents.confirmed_players, CONVERT(DATE_FORMAT(tournamentevents.date,'%d-%m-%Y'), CHAR(50)) as event_date, CONVERT(DATE_FORMAT(tournamentevents.date,'%H:%i'), CHAR(50)) as event_time, COALESCE(tournamentresults.homegoals, 1000) as homegoals, COALESCE(tournamentresults.awaygoals, 1000) as awaygoals, CONVERT(COALESCE(concat(opponentteam.prefix, ' ', opponentteam.name), 'none'), CHAR(50)) as opponent_name, CONVERT(COALESCE(concat(opponentplace.prefix, ' ', opponentplace.name), COALESCE(homelocations.name,'')), CHAR(50)) as event_location FROM tournamentevents LEFT JOIN tournamentresults ON tournamentevents.tournamentevent_ID = tournamentresults.tournamenteventID LEFT JOIN opponents AS opponentteam ON tournamentevents.opponentID = opponentteam.opponent_ID LEFT JOIN opponents AS opponentplace ON tournamentevents.locationID = opponentplace.opponent_ID LEFT JOIN events on events.event_ID = tournamentevents.eventID LEFT JOIN homelocations on events.homelocationID = homelocations.homelocation_ID WHERE tournamentevent_ID = ?", tournamentEventID, function(err, rows, fields) {

  if (!err){
    var teamID = rows[0].teamID;
    //var confirms = "(" + rows[0].confirmed_players + ",1" + ",2" +")";
    //var confirms1 = "(" + rows[0].confirmed_players + ")";
    var eventTypeDB = "Tornooi Wedstrijd";
    var eventDateDB = rows[0].event_date;
    var eventTimeDB = rows[0].event_time;
    var homegoalsDB = rows[0].homegoals;
    var awaygoalsDB = rows[0].awaygoals;
    var matchtypeDB = rows[0].match_type;
    var locationDB = rows[0].event_location;
    var opponentnameDB = rows[0].opponent_name;
    var refereeDB = rows[0].referee;
    var hometeamDB = '';
    var awayteamDB = '';

    if (refereeDB == 'none'){
        refereeDB = "Niet gekend"
    }

    if (matchtypeDB == 'home'){
        hometeamDB = clubName;
        awayteamDB = opponentnameDB;  
    }else{
        hometeamDB = opponentnameDB;
        awayteamDB = clubName;
    }
    /*teaminfoquery*/
    connection.query('SELECT teams.team_name, teams.team_division, teams.team_series, trainer.first_name as trainer_first_name, trainer.last_name as trainer_last_name, trainer.email_address as trainer_email_address, delegee.first_name as delegee_first_name, delegee.last_name as delegee_last_name, delegee.email_address as delegee_email_address, COALESCE(trainer2.email_address, "none") as trainer2_email_address, COALESCE(delegee2.email_address, "none") as delegee2_email_address FROM teams LEFT JOIN staff as trainer ON T1_ID = trainer.staff_ID LEFT JOIN staff AS trainer2 ON T2_ID = trainer2.staff_ID LEFT JOIN staff AS delegee ON D1_ID = delegee.staff_ID LEFT JOIN staff AS delegee2 ON D2_ID = delegee2.staff_ID WHERE team_ID = ?', teamID, function(err, rows, fields) {
       
       if (!err){
          var teamnameDB = rows[0].team_name;
          var teamdivisionDB = rows[0].team_division;
          var teamseriesDB = rows[0].team_series;
          var trainernameDB = rows[0].trainer_first_name + " " + rows[0].trainer_last_name;
          var delegeenameDB = rows[0].delegee_first_name + " " + rows[0].delegee_last_name;
          var ccEmailAddressArray = [];
          ccEmailAddressArray.push(rows[0].trainer_email_address);
          ccEmailAddressArray.push(rows[0].delegee_email_address);

          if (rows[0].trainer2_email_address != 'none') {ccEmailAddressArray.push(rows[0].trainer2_email_address);}
          if (rows[0].delegee2_email_address != 'none') {ccEmailAddressArray.push(rows[0].delegee2_email_address);}


          /*playersquery*/  
          //var connquery = "SELECT players.first_name as firstname, players.last_name as lastname, COALESCE((SELECT tournamentgoals.goals from tournamentgoals WHERE tournamentgoals.playerid = players.player_ID AND tournamentgoals.tournamenteventID = " + tournamentEventID + "), 0) as goals FROM players where players.player_ID IN " + confirms1;
          //var connquery = "SELECT players.first_name as firstname, players.last_name as lastname, COALESCE((SELECT COUNT(*) from tournamentgoals_new WHERE tournamentgoals_new.playerid = players.player_ID AND tournamentgoals_new.tournamenteventID = " + tournamentEventID + "), 0) as goals FROM players where players.player_ID IN " + confirms1 + "GROUP BY players.last_name";
          var connquery = "SELECT players.first_name as firstname, players.last_name as lastname, COALESCE((SELECT COUNT(*) from tournamentgoals_new WHERE tournamentgoals_new.playerid = players.player_ID AND tournamentgoals_new.tournamenteventID = " + tournamentEventID + "), 0) as goals FROM players LEFT JOIN tournamentevent_presences ON players.player_ID = tournamentevent_presences.playerID WHERE tournamentevent_presences.tournamenteventID = " + tournamentEventID + " AND tournamentevent_presences.confirmed = 1 GROUP BY players.last_name";
          connection.query(connquery, function(err, rows, fields) {

            if (!err){
              var players = rows;


              /*scoresquery*/
              //var connquery2 = "SELECT players.first_name, players.last_name, COALESCE((SELECT tournamentgoals.goals from tournamentgoals WHERE tournamentgoals.playerid = players.player_ID AND tournamentgoals.tournamenteventID = " + tournamentEventID + "), 0) as goals, COALESCE((SELECT tournamentgoals.timestamps from tournamentgoals WHERE tournamentgoals.playerid = players.player_ID AND tournamentgoals.tournamenteventID = " + tournamentEventID + "), 'none') as timestamps FROM players where players.player_ID IN " + confirms + " AND COALESCE((SELECT tournamentgoals.goals from tournamentgoals WHERE tournamentgoals.playerid = players.player_ID AND tournamentgoals.tournamenteventID = " + tournamentEventID + "), 0) <> '0'"
              var connquery2 = "SELECT concat(players.first_name, ' ', players.last_name) as name, tournamentgoals_new.timestamp FROM tournamentgoals_new LEFT JOIN players  ON tournamentgoals_new.playerID = players.player_ID WHERE tournamentgoals_new.tournamenteventID = " + tournamentEventID + " ORDER BY tournamentgoals_new.timestamp ASC";
              connection.query(connquery2, function(err, rows, fields) {

                if (!err){
                  
                    var scoresarray = rows;
                    for(var i=0; i < scoresarray.length; i++) {
                      scoresarray[i].name = scoresarray[i].name.replace('Opponent', 'Tegenstander');
                      
                    }
                    /*  
                    var scoresarray = [];
                    rows.forEach(function(row, i) {

                        var timestampstring = row.timestamps;
                        var timestamparray = timestampstring.split(",");
                        
                        timestamparray.forEach(function(timestampitem,i) {

                            var tempscoredic = {

                                timestamp: timestampitem,
                                name: row.first_name + " " + row.last_name

                            };
                            scoresarray.push(tempscoredic);

                        });
                        scoresarray.sort(function(a,b){return a.timestamp-b.timestamp});

                    }); 
                    */

                  if (players.length > scoresarray.length) {
                      //fill out the scoresarray
                      var difference =  players.length - scoresarray.length;
                      var emptyscoredic = {

                                timestamp: "",
                                name: ""

                            };
                      for (i = 0; i < difference; i++) {
                          scoresarray.push(emptyscoredic);
                      }

                  } else if (players.length < scoresarray.length) {
                      //fill out the playersarray
                      var difference =  scoresarray.length - players.length;
                      var emptyplayersdic = {
                            lastname: "",
                            firstname: "",
                            goals: ""
                      };
                      for (i = 0; i < difference; i++) {
                            players.push(emptyplayersdic);
                      }

                  }

                  var htmloutput = ejs.render(htmltemplate, {

                  clubname : clubName,
                  clubbasenr : clubBaseNr,   
                  hometeam : hometeamDB,
                  awayteam : awayteamDB,
                  matchtype : eventTypeDB,
                  departement : teamnameDB + " " + teamdivisionDB,
                  series : teamseriesDB,
                  gamedate : eventDateDB,
                  gametime : eventTimeDB,
                  location : locationDB,
                  delegee : delegeenameDB,
                  T1 : trainernameDB,
                  homegoals : homegoalsDB,
                  awaygoals : awaygoalsDB,
                  players: players,
                  scores: scoresarray,
                  referee: refereeDB
                  });


                  var dt = dateTime.create();
                  var formatted = dt.format('d_m_Y_H_M_S');

                  var fileName = '/var/www/footcal.be/public_html/' + apachedir + '/gamereports/' + teamnameDB + '_' + formatted + '.html';
                  //var fileName = '/Applications/MAMP/htdocs/skberlaar/gamereports/' + teamnameDB + '_' + formatted + '.html';   

                  fileName = fileName.replace(" ", "_"); 


                  fs.writeFile(fileName, htmloutput, function(err){
                      if (err){
                          console.log(err);
                      } else {
                        console.log("The file was saved");
                      }

                  });  

                  var mailOptions = {
                    from: 'gamereport@footcal.be',
                    to: gameReportEmailString,
                    cc: ccEmailAddressArray,
                    subject: 'Wedstrijd verslag' + ' ' + teamnameDB,
                    text: 'Het wedstrijdverslag vind je in attach.',
                    //html: htmloutput,
                    attachments: [
                      {path: fileName

                      }
                    ]
                  };
                  transporter.sendMail(mailOptions, function(error, info){
                      if(error){
                        console.log(error);
                        res.end(JSON.stringify(error));
                      }else{
                        console.log('Message sent: ' + info.response);
                        var outputArray = [];
                        var outputDic = {
                            response: info.response
                        };
                        outputArray.push(outputDic);
                        console.log(outputArray);
                        res.end(JSON.stringify(outputDic));
                      };
                  });

                  
                }else{
                  console.log('Error while performing Query.1');
                  var outputArray = [];
              var outputDic = {
                   response: "failed"
                    };
              outputArray.push(outputDic);
              console.log(outputArray);
              res.end(JSON.stringify(outputDic)); 
                }
              });
            }else{
              console.log('Error while performing Query.2');
              var outputArray = [];
              var outputDic = {
                   response: "failed"
                    };
              outputArray.push(outputDic);
              console.log(outputArray);
              res.end(JSON.stringify(outputDic)); 
            }
          });/*playersquery*/ 
        }else{
          console.log('Error while performing Query.3');
          var outputArray = [];
              var outputDic = {
                   response: "failed"
                    };
              outputArray.push(outputDic);
              console.log(outputArray);
              res.end(JSON.stringify(outputDic)); 
        }
    });/*teaminfoquery*/
  }else{
    console.log('Error while performing Query.4');
    var outputArray = [];
              var outputDic = {
                   response: "failed"
                    };
              outputArray.push(outputDic);
              console.log(outputArray);
              res.end(JSON.stringify(outputDic)); 
  }
  });/*matchinfoquery*/
  }else{
    console.log('Error while performing Query.5');
    var outputArray = [];
              var outputDic = {
                   response: "failed"
                    };
              outputArray.push(outputDic);
              console.log(outputArray);
              res.end(JSON.stringify(outputDic)); 
  }
  });/*email query*/
});



/*APN's*/

app.get("/apn/info/:accountid/:deviceid",function(req,res){
  var data = {
        accountID: req.params.accountid,
        deviceID: req.params.deviceid
    };
connection.query('SELECT COUNT(*) as controle from tokens WHERE accountID = ? AND device_ID = ?', [data.accountID, data.deviceID], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/apn/sendflag/:accountid/:deviceid",function(req,res){
  var data = {
        accountID: req.params.accountid,
        deviceID: req.params.deviceid
    };
connection.query('SELECT send from tokens WHERE accountID = ? AND device_ID = ?',[data.accountID, data.deviceID], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/apn/sendflags/:accountid/:deviceid",function(req,res){
  var data = {
        accountID: req.params.accountid,
        deviceID: req.params.deviceid
    };
connection.query('SELECT send, send_anul, send_livemode from tokens WHERE accountID = ? AND device_ID = ?',[data.accountID, data.deviceID], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/apn/new",function(req,res){
  var post = {
        accountID: req.body.accountID,
        device_name: req.body.devicename,
        device_ID: req.body.deviceID,
        token: req.body.token,
        device_type: req.body.devicetype,
        device_language: req.body.language
    };
    console.log(post);
  connection.query('DELETE FROM tokens WHERE device_name = ? AND device_ID = ?', [req.body.devicename,req.body.deviceID], function(err,result) {
    if (!err){
      console.log(result);
      connection.query('INSERT INTO tokens SET ?', post, function(err,result) {
        if (!err){
          console.log(result);
          res.end(JSON.stringify(result.insertId));
        }else{
          console.log('Error while performing Query1.');
        }
      });
    }else{
      console.log('Error while performing Query1.');
    }
  });
});

app.put("/apn/:accountid/:deviceid",function(req,res){
  var put = {
        token: req.body.token
    };
    console.log(put);
connection.query('UPDATE tokens SET ? WHERE accountID = ? and device_ID = ?',[put, req.params.accountid, req.params.deviceid], function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/apn/sendflag/:accountid/:deviceid",function(req,res){
  var put = {
        send: req.body.send
    };
    console.log(put);
connection.query('UPDATE tokens SET ? WHERE accountID = ? and device_ID = ?',[put, req.params.accountid, req.params.deviceid], function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/apn/sendflags/:accountid/:deviceid",function(req,res){
  var put = {
        send: req.body.send,
        send_anul: req.body.sendanul,
        send_livemode: req.body.sendlivemode
    };
    console.log(put);
connection.query('UPDATE tokens SET ? WHERE accountID = ? and device_ID = ?',[put, req.params.accountid, req.params.deviceid], function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/apn/language/:accountid/:deviceid",function(req,res){
  var put = {
        device_language: req.body.language
    };
    console.log(put);
connection.query('UPDATE tokens SET ? WHERE accountID = ? and device_ID = ?',[put, req.params.accountid, req.params.deviceid], function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result.changedRows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/apn/clubid/:accountid/:deviceid",function(req,res){
  var put = {
        active_clubID: req.body.clubid
    };
    console.log(put);
connection.query('UPDATE tokens SET ? WHERE accountID = ? and device_ID = ?',[put, req.params.accountid, req.params.deviceid], function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*APP SETTINGS*/

app.get("/settings",function(req,res){
connection.query("SELECT *, CONVERT(DATE_FORMAT(notifDate,'%d-%m-%Y %H:%i'), CHAR(50)) as notifDateString from settings", function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/settings/background",function(req,res){
connection.query("SELECT backgroundURL from settings", function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
    console.log(err);
  }
  });
});

app.put("/settings",function(req,res){
  var put = {
        homeTeamName: req.body.teamname,
        color1: req.body.color1,
        color2: req.body.color2,
        navtextcolor: req.body.navtextcolor,
        headertextcolor: req.body.headertextcolor,
        showOutfit: req.body.showoutfit,
        outfitUrl: req.body.outfiturl,
        showWebsite: req.body.showwebsite,
        websiteUrl: req.body.websiteurl,
        showNotif: req.body.shownotif,
        notifText: req.body.notiftext
    };
    console.log(put);

connection.query("UPDATE settings SET notifDate = STR_TO_DATE('" + req.body.notifdate + "', '%d-%m-%Y %H:%i'), ? WHERE settings_ID = 1", put, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/php/settings",function(req,res){
  var put = {
        homeTeamName: req.body.teamname,
        showOutfit: req.body.showoutfit,
        outfitUrl: req.body.outfiturl,
        showWebsite: req.body.showwebsite,
        websiteUrl: req.body.websiteurl,
        showNotif: req.body.shownotif,
        notifText: req.body.notiftext,
        advanced_player_login: req.body.advancedlogin
    };
    console.log(put);

connection.query("UPDATE settings SET notifDate = STR_TO_DATE('" + req.body.notifdate + "', '%d-%m-%Y %H:%i'), ? WHERE settings_ID = 1", put, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/settings/colors",function(req,res){
  var put = {
        theme_mode: req.body.thememode,
        navgrad1: req.body.navgrad1,
        navgrad2: req.body.navgrad2,
        color1: req.body.color1,
        color2: req.body.color2,
        navtextcolor: req.body.navtextcolor,
        headertextcolor: req.body.headertextcolor,
        backgrad1: req.body.backgrad1,
        backgrad2: req.body.backgrad2
    };
    console.log(put);

connection.query("UPDATE settings SET ? WHERE settings_ID = 1", put, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/settings/background",function(req,res){
  var put = {
        backgroundURL: req.body.backgroundurl
    };
    console.log(put);
connection.query("UPDATE settings SET ? WHERE settings_ID = 1", put, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/settings/gamereportemail",function(req,res){
  var put = {
        gameReportEmails: req.body.emailaddresses
    };
    console.log(put);
connection.query("UPDATE settings SET ? WHERE settings_ID = 1", put, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/settings/eventtypechange",function(req,res){
connection.query("UPDATE settings SET eventTypeChanger = eventTypeChanger + 1 WHERE settings_ID = 1", function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*PHP ACCOUNTS*/

app.get("/phpaccounts/all",function(req,res){
  
    console.log("gehit !")
connection.query('SELECT * from phpaccounts', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/phpaccounts/phpaccountid/:phpaccountid",function(req,res){
  var data = {
        phpaccountid: req.params.phpaccountid
    };
    console.log(data.email)
connection.query('SELECT * from phpaccounts WHERE phpaccount_ID = ?', data.phpaccountid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/phpaccounts/email/:email",function(req,res){
  var data = {
        email: req.params.email
    };
    console.log(data.email)
connection.query('SELECT * from phpaccounts WHERE email_address = ?', data.email, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/phpaccounts/new",function(req,res){
  var post = {
        email_address: req.body.emailaddress,
        password: req.body.password,
        user_role: req.body.userrole
    };
    console.log(post);
connection.query('INSERT INTO phpaccounts SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/phpaccounts/edit/:phpaccountid",function(req,res){
  var put = {
        email_address: req.body.emailaddress,
        password: req.body.password,
        user_role: req.body.userrole
    };
    console.log(put);
connection.query('UPDATE phpaccounts SET ? WHERE phpaccount_ID = ?', [put, req.params.phpaccountid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.delete("/phpaccount/:phpaccountid",function(req,res){
  var data = {
        phpaccountid: req.params.phpaccountid
    };
    console.log(data.phpaccountid);
connection.query('DELETE FROM phpaccounts WHERE phpaccount_ID = ?', data.phpaccountid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*ACCOUNTS*/


app.get("/accounts/check/:email",function(req,res){
  var data = {
        email: req.params.email
    };
    console.log(data.email)
connection.query('SELECT COUNT(*) as controle from accounts WHERE email_address = ?', data.email, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/accounts/email/:email",function(req,res){
  var data = {
        email: req.params.email
    };
    console.log(data.email)
connection.query('SELECT CONVERT(accounts.account_ID,CHAR(50)) AS accountID, accounts.userroleID, accounts.name, accounts.last_name, accounts.email_address, accounts.password, accounts.pw_recovered, accounts.fblogin, accounts.fbpic_url, accounts.favorites, accounts.clubfavorites, userroles.user_role, userroles.rights_level from accounts JOIN userroles ON accounts.userroleID = userroles.userrole_ID WHERE accounts.email_address = ?', data.email, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/accounts/appleid/:appleid",function(req,res){
  var data = {
        appleid: req.params.appleid
    };
    console.log(data.email)
connection.query('SELECT CONVERT(accounts.account_ID,CHAR(50)) AS accountID, accounts.userroleID, accounts.name, accounts.last_name, accounts.email_address, accounts.password, accounts.pw_recovered, accounts.fblogin, accounts.fbpic_url, accounts.favorites, accounts.clubfavorites, userroles.user_role, userroles.rights_level from accounts JOIN userroles ON accounts.userroleID = userroles.userrole_ID WHERE accounts.appleUserID = ?', data.appleid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/accounts/count",function(req,res){
connection.query('SELECT COUNT(*) as number from accounts', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/accounts/forcedlogout/:accountid",function(req,res){
connection.query('SELECT forced_logout, clear_favorites from accounts WHERE account_ID = ?', req.params.accountid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/accounts/new",function(req,res){
  var post = {
        name: req.body.name,
        last_name: req.body.lastname,
        email_address: req.body.emailaddress,
        password: req.body.password,
        logged_in: 1
    };
    console.log(post);
connection.query('INSERT INTO accounts SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.post("/accounts/fbnew",function(req,res){
  var post = {
        name: req.body.name,
        last_name: req.body.lastname,
        email_address: req.body.emailaddress,
        fblogin: 1,
        fbpic_url: req.body.pictureurl,
        logged_in: 1
    };
    console.log(post);
connection.query('INSERT INTO accounts SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
    console.log(err);
  }
  });
});

app.post("/accounts/applenew",function(req,res){
  var post = {
        name: req.body.name,
        last_name: req.body.lastname,
        email_address: req.body.emailaddress,
        appleUserID: req.body.appleId,
        logged_in: 1
    };
    console.log(post);
connection.query('INSERT INTO accounts SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
    console.log(err);
  }
  });
});

app.put("/accounts/fbpic/:id",function(req,res){
  var put = {
        fbpic_url: req.body.fbpicurl
    };
connection.query('UPDATE accounts SET ? WHERE account_ID = ?',[put, req.params.id], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/accounts/login/:id",function(req,res){
connection.query('UPDATE accounts SET logged_in = 1 WHERE account_ID = ?',req.params.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/accounts/logout/:id",function(req,res){
connection.query('UPDATE accounts SET logged_in = 0, forced_logout = 0 WHERE account_ID = ?',req.params.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/accounts/clearfavorites/:id",function(req,res){
connection.query("UPDATE accounts SET clear_favorites = 0, favorites = 'none' WHERE account_ID = ?",req.params.id, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/accounts/userrole/:id",function(req,res){
  var put = {
        userroleID: req.body.userroleID
    };
connection.query('UPDATE accounts SET ? WHERE account_ID = ?',[put, req.params.id], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/accounts/newpassword/:id",function(req,res){
  var put = {
        password: req.body.password,
        pw_recovered: 0
    };
connection.query('UPDATE accounts SET ? WHERE account_ID = ?',[put, req.params.id], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/accounts/newfavorites/:id",function(req,res){
  var put = {
        favorites: req.body.favorites
    };
connection.query('UPDATE accounts SET ? WHERE account_ID = ?',[put, req.params.id], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/accounts/newclubfavorites/:id",function(req,res){
  var put = {
        clubfavorites: req.body.clubfavorites
    };
    console.log('clubfavorites update gehit !!');
    console.log(put);
    console.log(req.params.id);
connection.query('UPDATE accounts SET ? WHERE account_ID = ?',[put, req.params.id], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*USER ROLES*/

app.get("/userroles/accountid/:accountid",function(req,res){
  var data = {
        accountid: req.params.accountid
    };
connection.query('SELECT userroles.user_role, userroles.userrole_ID, userroles.rights_level FROM userroles JOIN accounts ON userroles.userrole_ID = accounts.userroleID WHERE accounts.account_ID = ?', data.accountid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/userroles/all",function(req,res){
connection.query('SELECT user_role, password, userrole_ID, rights_level FROM userroles', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/userroles/php/all",function(req,res){
connection.query('SELECT userrole_ID, user_role as Profiel, password as Paswoord FROM userroles WHERE userrole_ID <> 1', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/userroles/password/:userroleid",function(req,res){
  var put = {
        password: req.body.password
    };
    console.log(put);
connection.query('UPDATE userroles SET ? WHERE userrole_ID = ?', [put, req.params.userroleid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*USER ROLES PRIVELEGES*/

app.get("/userroleprivs/all",function(req,res){
connection.query('SELECT * FROM userrole_privs', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/userroleprivs/part1",function(req,res){
connection.query('SELECT userrole_priv_ID, rights_level, user_role, SD1, PR1, GO1, CCI1, DCI1, MED1, GR1, MGO1, LM1, DR1, RE1, I1, EA1, LC1, GR2 FROM userrole_privs', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/userroleprivs/part2",function(req,res){
connection.query('SELECT userrole_priv_ID, rights_level, user_role, CM1, T1, P1, OP1, CD1, TD1, PD1, OD1, CCM1, CT1, CP1, CO1 FROM userrole_privs', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/userroleprivs/:rightslevel",function(req,res){
connection.query('SELECT SD1, PR1, GO1, CM1, T1, P1, OP1, CD1, TD1, PD1, OD1, CCI1, DCI1, MED1, GR1, MGO1, LM1, DR1, RE1, I1, EA1, LC1, GR2, CCM1, CT1, CP1, CO1 FROM userrole_privs WHERE rights_level = ?',req.params.rightslevel, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/userroleprivsparents",function(req,res){
connection.query('SELECT SD1, PR1, GO1, CM1, T1, P1, OP1, CD1, TD1, PD1, OD1, CCI1, DCI1, MED1, GR1, MGO1, LM1, DR1, RE1, I1, EA1, LC1, GR2, CCM1, CT1, CP1, CO1 FROM userrole_privs WHERE rights_level = 1 OR rights_level = 2 OR rights_level = 3', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});



app.put("/userroleprivs/edit/:userroleprivid",function(req,res){
  var put = {
        SD1: req.body.sd1,
        PR1: req.body.pr1,
        GO1: req.body.go1,
        CM1: req.body.cm1,
        T1: req.body.t1,
        P1: req.body.p1,
        OP1: req.body.op1,
        CD1: req.body.cd1,
        TD1: req.body.td1,
        PD1: req.body.pd1,
        OD1: req.body.od1,
        CCI1: req.body.cci1,
        MED1: req.body.med1,
        GR1: req.body.gr1,
        MGO1: req.body.td1,
        LM1: req.body.lm1,
        DR1: req.body.dr1,
        RE1: req.body.re1,
        I1: req.body.i1,
        EA1: req.body.ea1,
        LC1: req.body.lc1,
        GR2: req.body.gr2,
        CCM1: req.body.ccm1,
        CT1: req.body.ct1,
        CP1: req.body.cp1,
        CO1: req.body.co1,
        MTS1: req.body.mts1
    };
    console.log(put);
connection.query('UPDATE userrole_privs SET ? where userrole_priv_ID = ?', [put, req.params.userroleprivid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/userroleprivs/update/:rightslevel",function(req,res){
  console.log(req.body);
connection.query('UPDATE userrole_privs SET ? where rights_level = ?', [req.body, req.params.rightslevel], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*TEAMS*/

app.get("/teams/all",function(req,res){
connection.query('SELECT team_ID, team_vvID, team_name, team_series, team_vvseriesID, team_division, assists, trainingmod_allowed FROM teams ORDER BY team_order ASC', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/teams/php/all",function(req,res){
connection.query('SELECT team_ID, team_name as Ploeg, team_series as Reeks, team_division as Afdeling, CASE WHEN team_vvID = 0 THEN 2 ELSE autoupdate END as AutoUpdate, team_order as Volgorde FROM teams ORDER BY team_order ASC', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/teams/accountid/:accountid",function(req,res){
connection.query('SELECT DISTINCT team_ID, team_name, team_series, team_division, assists, trainingmod_allowed FROM teams INNER JOIN players ON teams.team_ID = players.teamID INNER JOIN linkedPlayers ON players.player_ID = linkedPlayers.playerID WHERE linkedPlayers.accountID = ? ORDER BY LPAD(lower(team_name), 10,0) ASC', req.params.accountid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/teams/info/:teamid",function(req,res){
connection.query('SELECT teams.team_name, teams.team_division, teams.team_series, staff.staff_ID, staff.first_name, staff.last_name, staff.title, staff.email_address, staff.gsm, staff.pic_url FROM teams JOIN staff ON teams.T1_ID = staff.staff_ID OR teams.D1_ID = staff.staff_ID OR teams.T2_ID = staff.staff_ID OR teams.D2_ID = staff.staff_ID or teams.Co_ID = staff.staff_ID where teams.team_ID = ?', req.params.teamid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/teams/teaminfo/:teamid",function(req,res){
connection.query('SELECT team_name, team_division, team_series FROM teams WHERE team_ID = ?', req.params.teamid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/teams/teamsettings/:teamid",function(req,res){
connection.query('SELECT assists, trainingmod_allowed, teampic_url FROM teams WHERE team_ID = ?', req.params.teamid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/teams/favorites/:favorites",function(req,res){
  console.log(req.params.favorites);
  var connquery = "SELECT team_name, team_ID, teampic_url FROM teams WHERE team_ID IN " + req.params.favorites + " ORDER BY team_order ASC" ;
  console.log(connquery);
connection.query(connquery, req.params.favorites, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/teams/count",function(req,res){
connection.query('SELECT COUNT(*) as number from teams', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/teams/reverseteamid/:teamid",function(req,res){
connection.query('SELECT team_ID, team_name FROM teams WHERE team_ID <> ? AND EXISTS (SELECT 1 FROM players WHERE players.teamID = teams.team_ID) ORDER BY LPAD(lower(team_name), 10,0) ASC', req.params.teamid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/teams/new",function(req,res){
  var post = {
        team_name: req.body.teamname,
        T1_ID: req.body.T1ID,
        T2_ID: req.body.T2ID,
        D1_ID: req.body.D1ID,
        D2_ID: req.body.D2ID,
        Co_ID: req.body.CoID,
        team_division: req.body.teamdivision,
        team_series: req.body.teamseries
    };
    console.log(post);
connection.query('INSERT INTO teams SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/teams/edit/:teamid",function(req,res){
  var put = {
        T1_ID: req.body.T1ID,
        T2_ID: req.body.T2ID,
        D1_ID: req.body.D1ID,
        D2_ID: req.body.D2ID,
        Co_ID: req.body.CoID,
        team_division: req.body.teamdivision,
        team_series: req.body.teamseries,
        assists: req.body.assists,
        trainingmod_allowed: req.body.trainingmod
    };
    console.log(put);
connection.query('UPDATE teams SET ? where team_ID = ?', [put, req.params.teamid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/teams/phpedit/:teamid",function(req,res){
  var put = {
        T1_ID: req.body.T1ID,
        T2_ID: req.body.T2ID,
        D1_ID: req.body.D1ID,
        D2_ID: req.body.D2ID,
        Co_ID: req.body.CoID,
        team_name: req.body.teamname,
        team_division: req.body.teamdivision,
        team_series: req.body.teamseries,
        assists: req.body.assists,
        trainingmod_allowed: req.body.trainingmod
    };
    console.log(put);
connection.query('UPDATE teams SET ? where team_ID = ?', [put, req.params.teamid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/teams/phpupdateseries/:teamid",function(req,res){
  var put = {
        team_series: req.body.teamseries,
        team_vvseriesID: req.body.teamvvseriesid,
        team_vvID: req.body.teamvvid
    };
    console.log(put);
connection.query('UPDATE teams SET ? where team_ID = ?', [put, req.params.teamid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/teams/phpupdateautoupdate/:teamid",function(req,res){
  var put = {
        autoupdate: req.body.autoupdate
    };
    console.log(put);
connection.query('UPDATE teams SET ? where team_ID = ?', [put, req.params.teamid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/teams/removestaff/:staffid",function(req,res){
connection.query('UPDATE teams SET T1_ID = IF(T1_ID = ?, 0, T1_ID), T2_ID = IF(T2_ID = ?, 0, T2_ID), D1_ID = IF(D1_ID = ?, 0, D1_ID), D2_ID = IF(D2_ID = ?, 0, D2_ID), Co_ID = IF(Co_ID = ?, 0, Co_ID)', [req.params.staffid, req.params.staffid, req.params.staffid, req.params.staffid, req.params.staffid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/teams/removeplayer/:playerid",function(req,res){
connection.query('UPDATE players SET teamID = 0 WHERE player_ID = ?', [req.params.playerid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/teams/teampic/:teamid",function(req,res){
var put = {
    teampic_url: req.body.teampicurl
};
connection.query('UPDATE teams SET ? WHERE team_ID = ?', [put, req.params.teamid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/teams/teamorder/:teamid",function(req,res){
var put = {
    team_order: req.body.teamorder
};
connection.query('UPDATE teams SET ? WHERE team_ID = ?', [put, req.params.teamid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/teams/:teamid",function(req,res){
  var data = {
        teamid: req.params.teamid
    };
    console.log(data.id);
connection.query('DELETE FROM teams WHERE team_ID = ?', data.teamid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*STAFF*/

app.get("/staff/all",function(req,res){
connection.query('SELECT * FROM staff ORDER BY last_name ASC', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/staff/limit/:offset/:limit",function(req,res){
connection.query('SELECT staff_ID, first_name as "Naam", last_name as "Familienaam", title as "Functie", email_address as "Email adres", gsm as "GSM" FROM staff ORDER BY Familienaam ASC LIMIT ?, ?',[parseInt(req.params.offset), parseInt(req.params.limit)], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/staff/staffid/:staffid",function(req,res){
connection.query('SELECT * FROM staff WHERE staff_ID = ?', req.params.staffid ,function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/staff/trainers",function(req,res){
connection.query('SELECT * FROM staff WHERE title LIKE "T%" ORDER BY last_name DESC', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/staff/delegees",function(req,res){
connection.query('SELECT * FROM staff WHERE title LIKE "D%" ORDER BY last_name ASC', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/staff/coordinators",function(req,res){
connection.query('SELECT * FROM staff WHERE title LIKE "C%" ORDER BY last_name ASC', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/staff/count",function(req,res){
connection.query('SELECT COUNT(*) as number from staff', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/staff/new",function(req,res){
  var post = {
        first_name: req.body.firstname,
        last_name: req.body.lastname,
        title: req.body.title,
        email_address: req.body.emailaddress,
        gsm: req.body.gsm
    };
    console.log(post);
connection.query('INSERT INTO staff SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/staff/edit/:staffid",function(req,res){
  var put = {
        first_name: req.body.firstname,
        last_name: req.body.lastname,
        title: req.body.title,
        email_address: req.body.emailaddress,
        gsm: req.body.gsm,
        pic_url: req.body.picurl
    };
    console.log(put);
connection.query('UPDATE staff SET ? WHERE staff_ID = ?', [put, req.params.staffid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/staff/image/:staffid",function(req,res){
  var put = {
        pic_url: req.body.picurl
    };
    console.log(put);
connection.query('UPDATE staff SET ? WHERE staff_ID = ?', [put, req.params.staffid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/staff/:staffid",function(req,res){
  var data = {
        staffid: req.params.staffid
    };
    console.log(data.id);
connection.query('DELETE FROM staff WHERE staff_ID = ?', data.staffid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*LINKED PLAYERS*/

app.get("/linkedplayers/byaccount/:accountid",function(req,res){
connection.query('SELECT playerID FROM linkedPlayers WHERE linkedPlayers.accountID = ?', req.params.accountid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/linkedplayers/:accountid",function(req,res){
connection.query('SELECT players.*, COALESCE(teams.team_name, "Geen Team") as teamName FROM players INNER JOIN linkedPlayers on players.player_ID = linkedPlayers.playerID LEFT JOIN teams ON players.teamID = teams.team_ID WHERE linkedPlayers.accountID = ? ORDER BY LPAD(lower(teamName), 10,0) ASC, players.last_name ASC', req.params.accountid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/checklinkedadmin/:accountid/:playerid",function(req,res){
connection.query('SELECT admin FROM linkedPlayers WHERE linkedPlayers.accountID = ? && linkedPlayers.playerID = ?', [req.params.accountid,req.params.playerid], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/linkedplayers/teamid/extraright/:accountid",function(req,res){
connection.query('SELECT DISTINCT players.teamID, MAX(linkedPlayers.admin) + 1 as extraright FROM linkedPlayers LEFT JOIN players ON linkedPlayers.playerID = players.player_ID WHERE linkedPlayers.accountID = ? GROUP BY players.teamID', req.params.accountid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/linkedplayers/playerid/extraright/:accountid",function(req,res){
connection.query('SELECT linkedPlayers.playerID, linkedPlayers.admin + 1 as extraright FROM linkedPlayers WHERE linkedPlayers.accountID = ?', req.params.accountid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/linkedplayers/maxright/:accountid",function(req,res){
connection.query('SELECT COALESCE(MAX(Admin) + 1, 0) as maxadmin FROM linkedPlayers WHERE accountID = ?', req.params.accountid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/linkedplayers/new",function(req,res){
  var post = {
        accountID: req.body.accountid,
        playerID: req.body.playerid,
        admin: req.body.admin
    };
    console.log(post);
connection.query("INSERT INTO linkedPlayers SET ?", post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/linkedplayers/:playerid/:accountid",function(req,res){
  var data = {
        playerid: req.params.playerid,
        accountid: req.params.accountid
    };
    console.log(data.playerid);
    console.log(data.accountid);
connection.query('DELETE FROM linkedPlayers WHERE playerID = ? AND accountID = ?', [data.playerid, data.accountid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*PLAYERS*/

app.get("/players/all",function(req,res){
connection.query('SELECT players.*, COALESCE(teams.team_name, "Geen Team") as teamName FROM players LEFT JOIN teams ON players.teamID = teams.team_ID WHERE players.player_ID > 2 ORDER BY teams.team_order ASC, players.last_name ASC', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/players/php/all",function(req,res){
connection.query('SELECT players.player_ID, players.first_name, players.last_name, players.street, players.street_nr, players.postal_code, players.town, COALESCE(teams.team_name, CASE WHEN teamID = 0 THEN "Geen Team" ELSE "Gedeactiveerd" END) as teamName FROM players LEFT JOIN teams ON players.teamID = teams.team_ID WHERE players.player_ID > 2 ORDER BY LPAD(lower(teamName), 10,0) ASC, players.last_name ASC', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/players/php/limit/:offset/:limit",function(req,res){
  console.log(req.params.offset);
  console.log(req.params.limit);
connection.query('SELECT DISTINCT players.player_ID, players.first_name as "Naam", players.last_name as "Familienaam", players.street as "Straat", players.street_nr as "Nr", players.postal_code as "Postcode", players.town as "Woonplaats", COALESCE(teams.team_name, CASE WHEN teamID = 0 THEN "Geen Ploeg" ELSE "Niet Actief" END) as Ploeg, COALESCE(CASE WHEN linkedPlayers.accountID > 0 THEN "Ja" END, "Nee") as Gelinkt FROM players LEFT JOIN teams ON players.teamID = teams.team_ID LEFT JOIN linkedPlayers ON players.player_ID = linkedPlayers.playerID WHERE players.player_ID > 2 ORDER BY teams.team_order ASC, players.last_name ASC LIMIT ?, ?',[parseInt(req.params.offset), parseInt(req.params.limit)], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/players/export/all",function(req,res){
connection.query('SELECT players.first_name, players.last_name, CONVERT(DATE_FORMAT(players.birth_date,"%d-%m-%Y"), CHAR(50)) as birth_date_string, players.birth_place, players.street, players.street_nr, players.postal_code, players.town, CONVERT(DATE_FORMAT(players.membership_date,"%d-%m-%Y"), CHAR(50)) as membership_date_string, players.membership_nr, COALESCE(GROUP_CONCAT(players_emails.email_address), "No Email") as Emails FROM players LEFT JOIN players_emails ON players_emails.playerID = players.player_ID WHERE players.player_ID > 2 GROUP BY players.player_ID ORDER BY players.birth_date', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/players/php/fullname/:fullname",function(req,res){
connection.query('SELECT players.player_ID, players.first_name as "Naam", players.last_name as "Familienaam", players.street as "Straat", players.street_nr as "Nr", players.postal_code as "Postcode", players.town as "Woonplaats", COALESCE(teams.team_name, CASE WHEN teamID = 0 THEN "Geen Ploeg" ELSE "Niet Actief" END) as Ploeg FROM players LEFT JOIN teams ON players.teamID = teams.team_ID WHERE CONCAT(players.first_name, " ", players.last_name) LIKE ?', req.params.fullname, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/players/playerid/:playerid",function(req,res){
connection.query('SELECT players.*, CONVERT(DATE_FORMAT(players.birth_date,"%d-%m-%Y"), CHAR(50)) as birth_date_string, CONVERT(DATE_FORMAT(players.membership_date,"%d-%m-%Y"), CHAR(50)) as membership_date_string, COALESCE(teams.team_name, "Geen Team") as team_name FROM players LEFT JOIN teams ON players.teamID = teams.team_ID WHERE players.player_ID = ?', req.params.playerid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/players/teamid/:teamid",function(req,res){
connection.query('SELECT player_ID, first_name, last_name, pic_url FROM players where teamID = ? ORDER BY last_name', req.params.teamid, function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*
app.get("/players/teamid/:teamid/:eventid",function(req,res){
connection.query('SELECT player_ID, first_name, last_name, pic_url, COALESCE(event_presences.event_presence_ID, "none") as presenceID FROM players LEFT JOIN event_presences ON players.player_ID = event_presences.playerID AND event_presences.eventID = ? WHERE players.teamID = ? ORDER BY last_name', [req.params.eventid,req.params.teamid], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});
*/

app.get("/players/otherteam/teamid/:teamid",function(req,res){
connection.query('SELECT player_ID, first_name, last_name, pic_url FROM players where (teamID <> ?) AND (player_ID > 2) ORDER BY last_name', req.params.teamid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

//will not be used anymore !!
app.get("/confirmedplayergoals/eventid/:eventid",function(req,res){
connection.query('SELECT confirmed_players FROM events where event_ID = ?', req.params.eventid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    if (rows[0].confirmed_players != 'none'){
      var confirms = '(' + rows[0].confirmed_players + ',2' + ')';
      console.log(confirms);
      var connquery = "SELECT players.player_ID, players.first_name, players.last_name, players.pic_url, COALESCE((SELECT COUNT(*) from goals_new WHERE goals_new.playerid = players.player_ID AND goals_new.eventID = " + req.params.eventid + "), 0) as goals FROM players where players.player_ID IN " + confirms + " GROUP BY players.last_name ORDER BY CASE WHEN players.player_ID = 2 THEN 1 ELSE 0 END, players.last_name";
      console.log(connquery);
      connection.query(connquery, confirms, function(err, rows, fields) {
      /*connection.end();*/
       if (!err){
       console.log('The solution is: ', rows);
       console.log(confirms);
        res.end(JSON.stringify(rows));
        }else{
          console.log('Error while performing Query.');
        }
      }); 
    } else {
      var emptyArray = [];
      res.end(JSON.stringify(emptyArray));
    }
  }else{
    console.log('Error while performing Query.');
  }
  });
});

//this will replace the previous api route
app.get("/confirmedplayergoalsnew/eventid/:eventid",function(req,res){
var connquery = "SELECT players.player_ID, players.first_name, players.last_name, players.pic_url, COALESCE((SELECT COUNT(*) from goals_new WHERE goals_new.playerid = players.player_ID AND goals_new.eventID = " + req.params.eventid + "), 0) as goals FROM players LEFT JOIN event_presences ON players.player_ID = event_presences.playerID WHERE (event_presences.eventID = " + req.params.eventid + " AND event_presences.confirmed = 1) OR players.player_ID = 2 GROUP BY CONCAT(players.last_name, ' ', players.first_name) ORDER BY CASE WHEN players.player_ID = 2 THEN 1 ELSE 0 END, players.last_name";
connection.query(connquery, function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    if (rows.length < 2){
      var emptyArray = [];
      res.end(JSON.stringify(emptyArray));
    } else {
      res.end(JSON.stringify(rows));
    }
    
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/confirmedplayers/eventid/:eventid",function(req,res){
connection.query('SELECT confirmed_players FROM events where event_ID = ?', req.params.eventid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    if (rows[0].confirmed_players != 'none'){
      var confirms = '(' + rows[0].confirmed_players + ',2' + ')';
      console.log(confirms);
      var connquery = "SELECT players.player_ID, players.first_name, players.last_name, players.pic_url, CONVERT(COALESCE((SELECT goals.goals_ID from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + req.params.eventid + "), 'none'), CHAR(50)) as goals_ID, COALESCE((SELECT goals.goals from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + req.params.eventid + "), 0) as goals, COALESCE((SELECT goals.timestamps from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + req.params.eventid + "), 'none') as timestamps, COALESCE((SELECT goals.assists from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + req.params.eventid + "), 'none') as assists FROM players where players.player_ID IN " + confirms + " GROUP BY players.last_name ORDER BY CASE WHEN players.player_ID = 2 THEN 1 ELSE 0 END, players.last_name";
      console.log(connquery);
      connection.query(connquery, confirms, function(err, rows, fields) {
      /*connection.end();*/
       if (!err){
       console.log('The solution is: ', rows);
       console.log(confirms);
        res.end(JSON.stringify(rows));
        }else{
          console.log('Error while performing Query.');
        }
      }); 
    } else {
      var emptyArray = [];
      res.end(JSON.stringify(emptyArray));
    }
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/phpconfirmedplayers/eventid/:eventid",function(req,res){
connection.query('SELECT confirmed_players FROM events where event_ID = ?', req.params.eventid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    if (rows[0].confirmed_players != 'none'){
      var confirms = '(' + rows[0].confirmed_players + ')';
      console.log(confirms);
      var connquery = "SELECT players.player_ID, players.first_name, players.last_name, players.pic_url, CONVERT(COALESCE((SELECT goals.goals_ID from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + req.params.eventid + "), 'none'), CHAR(50)) as goals_ID, COALESCE((SELECT goals.goals from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + req.params.eventid + "), 0) as goals, COALESCE((SELECT goals.timestamps from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + req.params.eventid + "), 'none') as timestamps FROM players where players.player_ID IN " + confirms + " GROUP BY players.last_name ORDER BY players.last_name";
      console.log(connquery);
      connection.query(connquery, confirms, function(err, rows, fields) {
      /*connection.end();*/
       if (!err){
       console.log('The solution is: ', rows);
       console.log(confirms);
        res.end(JSON.stringify(rows));
        }else{
          console.log('Error while performing Query.');
        }
      }); 
    } else {
      var emptyArray = [];
      res.end(JSON.stringify(emptyArray));
    }
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/players/count",function(req,res){
connection.query('SELECT COUNT(*) as number from players WHERE player_ID > 2', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/players/new",function(req,res){
  var firstname = req.body.firstname;
  var lastname = req.body.lastname;
  firstname = firstname.replace("'","''");
  lastname = lastname.replace("'","''");
  var post = {
        first_name: firstname,
        last_name: lastname,
        birth_date: req.body.birthdate,
        birth_place: req.body.birthplace
    };
    console.log(post);
    var connquery = "INSERT INTO players SET birth_date = STR_TO_DATE('" + post.birth_date + "','%d-%m-%Y'), first_name = '" +  post.first_name + "', last_name = '" +  post.last_name + "', birth_place = '" +  post.birth_place + "'";
connection.query(connquery, post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/players/edit/:playerid",function(req,res){
  var put = {
        teamID: req.body.teamid,
        first_name: req.body.firstname,
        last_name: req.body.lastname,
        birth_place: req.body.birthplace,
        street: req.body.street,
        street_nr: req.body.streetnr,
        postal_code: req.body.postalcode,
        town: req.body.town,
        membership_nr: req.body.membershipnr
    };
    console.log(put);
connection.query("UPDATE players SET birth_date = STR_TO_DATE('" + req.body.birthdate + "', '%d-%m-%Y'), membership_date = STR_TO_DATE('" + req.body.membershipdate + "', '%d-%m-%Y'), ? WHERE player_ID = ?", [put, req.params.playerid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/players/image/:playerid",function(req,res){
  var put = {
        pic_url: req.body.picurl
    };
    console.log(put);
connection.query('UPDATE players SET ? WHERE player_ID = ?', [put, req.params.playerid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/players/deactivate",function(req,res){
  connection.query('UPDATE players SET teamID = -1 WHERE player_ID = ?', req.body.playerid, function(err,result) {
    if (!err){
      console.log(result);
      connection.query('SELECT accountID FROM linkedPlayers WHERE playerID = ?', req.body.playerid, function(err, rows, fields) {
        if (!err){
          console.log(rows);
          rows.forEach(function(row,i){
              connection.query('UPDATE accounts SET userroleID = 1, forced_logout = 1 WHERE account_ID = ?', row.accountID, function(err,result) {
                if (!err){
                  console.log(result);
                  
                }else{
                  console.log('Error while performing 3th Query.');
                }
              });
          });
          connection.query('DELETE FROM linkedPlayers WHERE playerID = ?', req.body.playerid, function(err,result) {
            if (!err){
              console.log(result);
              res.end(JSON.stringify(result));
            }else{
              console.log('Error while performing 4th Query.');
            }
          });

        }else{
          console.log('Error while performing 2nd Query.');
        }
      });

    }else{
      console.log('Error while performing 1st Query.');
    }
  });
});

app.delete("/players/:playerid",function(req,res){
  var data = {
        playerid: req.params.playerid
    };
    console.log(data.id);
connection.query('DELETE FROM players WHERE player_ID = ?', data.playerid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*PLAYERS_EMAILS*/

app.get("/playersemail/playerid/:playerid",function(req,res){
connection.query('SELECT * FROM players_emails where playerID = ?', req.params.playerid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/playersemail/php/playerid/:playerid",function(req,res){
connection.query('SELECT email_ID, playerID, email_address as "Email adres", owner as "Email houder" FROM players_emails where playerID = ?', req.params.playerid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/playersemail/emailid/:emailid",function(req,res){
connection.query('SELECT * FROM players_emails where email_ID = ?', req.params.emailid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/playersemail/teamid/:teamid",function(req,res){
connection.query('SELECT players_emails.email_address FROM players LEFT JOIN players_emails ON players.player_ID = players_emails.playerID WHERE players.teamID = ? AND players_emails.email_address is not null', req.params.teamid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/playersemail/teamid/eventid/:teamid/:eventid",function(req,res){
  //get all email addressess of fixed teamplayers minus the declined ones, minus the unselected ones and plus the extra players.
var teamID = req.params.teamid;
var eventID = req.params.eventid;
var playerIDarray = [];
var playerIDString = '';
var declinedPlayersString = '';
var unselectedPlayersString = '';
var extraPlayersString = '';
var declinedPlayersArray = [];
var unselectedPlayersArray = [];
var extraPlayersArray = [];

connection.query('SELECT players.player_ID FROM players WHERE teamID = ?', teamID, function(err, rows, fields) {
  if (!err){
    rows.forEach(function(row, i) {
      playerIDarray.push(row.player_ID.toString());
    });

    //Query2
    connection.query('SELECT declined_players, extra_players, unselected_players FROM events WHERE event_ID = ?', eventID, function(err, rows, fields) {
      if (!err){
       console.log('The solution is: ', rows);
        declinedPlayersString = rows[0].declined_players;
        extraPlayersString = rows[0].extra_players;
        unselectedPlayersString = rows[0].unselected_players;


        if (declinedPlayersString != 'none'){
          declinedPlayersArray = declinedPlayersString.split(",");
          declinedPlayersArray.forEach(function(declinedPlayerID, i){
              if (playerIDarray.indexOf(declinedPlayerID) > -1){
                console.log("gehit !");
                playerIDarray.splice(playerIDarray.indexOf(declinedPlayerID), 1);
              }
          });
        }

        if (unselectedPlayersString != 'none'){
          unselectedPlayersArray = unselectedPlayersString.split(",");
          unselectedPlayersArray.forEach(function(unselectedPlayerID,i){
              if (playerIDarray.indexOf(unselectedPlayerID) > -1){
                playerIDarray.splice(playerIDarray.indexOf(unselectedPlayerID), 1);
              }
          });
         }

        if (extraPlayersString != 'none'){
          extraPlayersArray = extraPlayersString.split(",");
          extraPlayersArray.forEach(function(extraPlayerID, i){
            playerIDarray.push(extraPlayerID);
          });
        }  
        
        playerIDString = '(' + playerIDarray.join() + ')';
        var connQuery = "SELECT players_emails.email_address FROM players_emails WHERE players_emails.email_address is not null AND players_emails.playerID IN " + playerIDString;  
        connection.query(connQuery, teamID, function(err, rows, fields) {
          if (!err){
            console.log('The solution is: ', rows);
            res.end(JSON.stringify(rows));
          }else{
            console.log('Error while performing Query3.');
          }
        });
      }else{
        console.log('Error while performing Query2.');
      }
    });
  }else{
    console.log('Error while performing Query1.');
  }
  });
});



app.post("/playersemail/new",function(req,res){
  var owner;
  owner = req.body.owner;
  if (req.body.owner == "Speler" || req.body.owner == "Joueur"){
      owner = "Player";
  }
  if (req.body.owner == "Moeder" || req.body.owner == "Mère"){
      owner = "Mother";
  }
  if (req.body.owner == "Vader" || req.body.owner == "Père"){
      owner = "Father";
  }
  if (req.body.owner == "Andere" || req.body.owner == "Autre"){
      owner = "Other";
  }
  var post = {
        playerID: req.body.playerid,
        email_address: req.body.emailaddress,
        owner: owner
    };
    console.log(post);
connection.query('INSERT INTO players_emails SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/playersemail/emailid/:emailid",function(req,res){
  var put = {
        email_address: req.body.emailaddress,
        owner: req.body.owner
    };
    console.log(put);
connection.query('UPDATE players_emails SET ? WHERE email_ID = ?', [put, req.params.emailid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.delete("/playersemail/:emailid",function(req,res){
  var data = {
        emailid: req.params.emailid
    };
connection.query('DELETE FROM players_emails WHERE email_ID = ?', data.emailid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*PLAYERS_GSM*/

app.get("/playersgsm/playerid/:playerid",function(req,res){
connection.query('SELECT * FROM players_gsms where playerID = ?', req.params.playerid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/playersgsm/php/playerid/:playerid",function(req,res){
connection.query('SELECT gsm_ID, playerID, gsm_number as "GSM nummer", owner as "GSM houder" FROM players_gsms where playerID = ?', req.params.playerid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/playersgsm/gsmid/:gsmid",function(req,res){
connection.query('SELECT * FROM players_gsms where gsm_ID = ?', req.params.gsmid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/playersgsm/new",function(req,res){
  var owner;
  owner = req.body.owner;
  if (req.body.owner == "Speler" || req.body.owner == "Joueur"){
      owner = "Player";
  }
  if (req.body.owner == "Moeder" || req.body.owner == "Mère"){
      owner = "Mother";
  }
  if (req.body.owner == "Vader" || req.body.owner == "Père"){
      owner = "Father";
  }
  if (req.body.owner == "Andere" || req.body.owner == "Autre"){
      owner = "Other";
  }
  var post = {
        playerID: req.body.playerid,
        gsm_number: req.body.gsmnumber,
        owner: owner
    };
    console.log(post);
connection.query('INSERT INTO players_gsms SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/playersgsm/gsmid/:gsmid",function(req,res){
  var put = {
        gsm_number: req.body.gsmnumber,
        owner: req.body.owner
    };
    console.log(put);
connection.query('UPDATE players_gsms SET ? WHERE gsm_ID = ?', [put, req.params.gsmid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.delete("/playersgsm/:gsmid",function(req,res){
  var data = {
        gsmid: req.params.gsmid
    };
connection.query('DELETE FROM players_gsms WHERE gsm_ID = ?', data.gsmid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});



/*EVENTS*/

app.post("/events/teamid/year/eventtype/:teamid/:year/:language",function(req,res){
  console.log("hit");
  if (req.params.year == "Beide") {
    var yearsearchstring = "%";
  } else {
     var yearsearchstring = req.params.year;
  };
  console.log("body :");
  console.log(req.body);
  var eventtypearray = req.body.eventtypearray;
  console.log("eventtypearray :");
  console.log(eventtypearray);
  var eventtype = '(' + eventtypearray.join() + ')';
  var data = {
        teamid: req.params.teamid,
        year: yearsearchstring,
        eventtype: eventtype
  };
  console.log(data);
  var language = req.params.language;
  var connquery = "SELECT events.event_ID, club_event_types.event_type, club_event_types.club_event_name_" + language + " as club_event_name ,events.match_type, events.locationID, events.homelocationID, CONVERT(DATE_FORMAT(events.date,'%d-%m-%Y'), CHAR(50)) as event_date, CONVERT(DATE_FORMAT(events.date,'%H:%i'), CHAR(50)) as event_time, COALESCE(results.homegoals, 1000) as homegoals, COALESCE(results.awaygoals, 1000) as awaygoals, CONVERT(COALESCE(results.result_ID, 'none'), CHAR(50)) as resultID, CONVERT(COALESCE(opponentteam.prefix, 'none'), CHAR(50)) as opponent_prefix, CONVERT(COALESCE(opponentteam.name, 'none'), CHAR(50)) as opponent_name, CONVERT(COALESCE(concat(opponentplace.prefix, ' ', opponentplace.name), homelocations.name), CHAR(50)) as event_location, events.comments, events.dressing_room, events.referee, events.annulation, events.feedbacklocked FROM events LEFT JOIN club_event_types ON events.event_type = club_event_types.club_event_type_ID LEFT JOIN results ON events.event_ID = results.eventID LEFT JOIN opponents AS opponentteam ON events.opponentID = opponentteam.opponent_ID LEFT JOIN opponents AS opponentplace ON events.locationID = opponentplace.opponent_ID LEFT JOIN homelocations ON events.homelocationID = homelocations.homelocation_ID WHERE (events.teamID = " + data.teamid + ") AND (YEAR(events.date) LIKE '" + data.year + "') AND (club_event_types.club_event_name_" + language +  " IN " + data.eventtype + ") ORDER BY events.date ASC";
  console.log(connquery);
connection.query(connquery, [data.teamid, data.year, data.eventtype], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
    console.log(err);
  }
  });
});


app.post("/events/teamid/year/eventtype/android/:teamid/:year/:language",function(req,res){
  console.log("hit");
  if (req.params.year == "Beide") {
    var yearsearchstring = "%";
  } else {
     var yearsearchstring = req.params.year;
  };
  var eventtypedic = req.body[0];
  var eventtypestring = req.body[0].eventtypearray;
  eventtypestring = eventtypestring.replace('[',"");
  eventtypestring = eventtypestring.replace(']',"");
  eventtypearray = eventtypestring.split(",");
  var eventtype = '(' + eventtypearray.join() + ')';
  var data = {
        teamid: req.params.teamid,
        year: yearsearchstring,
        eventtype: eventtype
  };
  console.log(data);
  var language = req.params.language;
  var connquery = "SELECT events.event_ID, club_event_types.event_type, club_event_types.club_event_name_" + language + " as club_event_name, events.match_type, events.locationID, events.homelocationID, CONVERT(DATE_FORMAT(events.date,'%d-%m-%Y'), CHAR(50)) as event_date, CONVERT(DATE_FORMAT(events.date,'%H:%i'), CHAR(50)) as event_time, COALESCE(results.homegoals, 1000) as homegoals, COALESCE(results.awaygoals, 1000) as awaygoals, CONVERT(COALESCE(results.result_ID, 'none'), CHAR(50)) as resultID, CONVERT(COALESCE(opponentteam.prefix, 'none'), CHAR(50)) as opponent_prefix, CONVERT(COALESCE(opponentteam.name, 'none'), CHAR(50)) as opponent_name, CONVERT(COALESCE(concat(opponentplace.prefix, ' ', opponentplace.name), homelocations.name), CHAR(50)) as event_location, events.comments, events.dressing_room, events.referee, events.annulation, events.feedbacklocked FROM events LEFT JOIN club_event_types ON events.event_type = club_event_types.club_event_type_ID LEFT JOIN results ON events.event_ID = results.eventID LEFT JOIN opponents AS opponentteam ON events.opponentID = opponentteam.opponent_ID LEFT JOIN opponents AS opponentplace ON events.locationID = opponentplace.opponent_ID LEFT JOIN homelocations ON events.homelocationID = homelocations.homelocation_ID WHERE (events.teamID = " + data.teamid + ") AND (YEAR(events.date) LIKE '" + data.year + "') AND (club_event_types.club_event_name_" + language +  " IN " + data.eventtype + ") ORDER BY events.date ASC";
  console.log(connquery);
connection.query(connquery, [data.teamid, data.year, data.eventtype], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/phpevents/teamid/year/:teamid/:year/:month",function(req,res){
  console.log("hit php events");
  if (req.params.year == "Beide") {
    var yearsearchstring = "%";
  } else {
     var yearsearchstring = req.params.year;
  };
  if (req.params.month == "Alle") {
    var monthsearchstring = "%";
  } else {
    var monthsearchstring = req.params.month;
  }
  
  var data = {
        teamid: req.params.teamid,
        year: yearsearchstring,
        month: monthsearchstring
  };
  console.log(data);
  var connquery = "SELECT events.event_ID, events.event_type, events.match_type, events.locationID, CONVERT(DATE_FORMAT(events.date,'%d-%m-%Y'), CHAR(50)) as event_date, CONVERT(DATE_FORMAT(events.date,'%H:%i'), CHAR(50)) as event_time, COALESCE(results.homegoals, 1000) as homegoals, COALESCE(results.awaygoals, 1000) as awaygoals, CONVERT(COALESCE(results.result_ID, 'none'), CHAR(50)) as resultID, CONVERT(COALESCE(opponentteam.prefix, 'none'), CHAR(50)) as opponent_prefix, CONVERT(COALESCE(opponentteam.name, 'none'), CHAR(50)) as opponent_name, CONVERT(COALESCE(concat(opponentplace.prefix, ' ', opponentplace.name), 'none'), CHAR(50)) as event_location, events.comments, events.dressing_room, events.referee, events.annulation FROM events LEFT JOIN results ON events.event_ID = results.eventID LEFT JOIN opponents AS opponentteam ON events.opponentID = opponentteam.opponent_ID LEFT JOIN opponents AS opponentplace ON events.locationID = opponentplace.opponent_ID WHERE (events.teamID = " + data.teamid + ") AND (YEAR(events.date) LIKE '" + data.year + "') AND (MONTH(events.date) LIKE '" + data.month + "') ORDER BY events.date ASC";
  console.log(connquery);
connection.query(connquery, [data.teamid, data.year], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/events/php/teamcalendar/:teamid",function(req,res){
connection.query("SELECT CONVERT(DATE_FORMAT(events.date,'%d-%m-%Y'), CHAR(50)) as Datum, CONVERT(DATE_FORMAT(events.date,'%H:%i'), CHAR(50)) as Tijd, club_event_types.club_event_name_nl as Type, (CASE WHEN events.event_type = 8 THEN CONCAT(opponents_location.prefix, ' ', opponents_location.name) ELSE (CASE WHEN events.match_type = 'home' THEN CONCAT(teams.team_name, ' - ', opponents.prefix, ' ', opponents.name) ELSE CONCAT(opponents.prefix, ' ', opponents.name, ' - ', teams.team_name) END) END) as 'Kalender Item' FROM events LEFT JOIN opponents ON events.opponentID = opponents.opponent_ID LEFT JOIN opponents as opponents_location ON events.locationID = opponents_location.opponent_ID LEFT JOIN teams ON events.teamID = teams.team_ID LEFT JOIN club_event_types ON events.event_type = club_event_types.club_event_type_ID WHERE (events.event_type = 8 OR events.event_type = 1 OR events.event_type = 2) and events.teamID = ?", req.params.teamid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/events/confirmedplayers/:eventid",function(req,res){
connection.query('SELECT confirmed_players, declined_players, extra_players, unselected_players, confirmed_transport, declined_transport FROM events WHERE event_ID = ?', req.params.eventid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/events/weekevents/:weekday/:language",function(req,res){
var weekDay = req.params.weekday;
var language = req.params.language;
console.log(weekDay);
var connquery = "SELECT events.event_ID, club_event_types.event_type, club_event_types.club_event_name_" + language + " as club_event_name, events.match_type, events.teamID, teams.team_name, events.locationID, events.homelocationID, CONVERT(DATE_FORMAT(events.date,'%d-%m-%Y'), CHAR(50)) as event_date, CONVERT(DATE_FORMAT(events.date,'%H:%i'), CHAR(50)) as event_time, COALESCE(results.homegoals, 1000) as homegoals, COALESCE(results.awaygoals, 1000) as awaygoals, CONVERT(COALESCE(results.result_ID, 'none'), CHAR(50)) as resultID, CONVERT(COALESCE(opponentteam.prefix, 'none'), CHAR(50)) as opponent_prefix, CONVERT(COALESCE(opponentteam.name, 'none'), CHAR(50)) as opponent_name, CONVERT(COALESCE(concat(opponentplace.prefix, ' ', opponentplace.name), homelocations.name), CHAR(50)) as event_location, events.comments, events.dressing_room, events.referee, events.annulation, events.feedbacklocked FROM events LEFT JOIN club_event_types ON events.event_type = club_event_types.club_event_type_ID LEFT JOIN teams ON events.teamID = teams.team_ID LEFT JOIN results ON events.event_ID = results.eventID LEFT JOIN opponents AS opponentteam ON events.opponentID = opponentteam.opponent_ID LEFT JOIN opponents AS opponentplace ON events.locationID = opponentplace.opponent_ID LEFT JOIN homelocations ON events.homelocationID = homelocations.homelocation_ID WHERE WEEK(events.date,1) = WEEK('" +  weekDay + "',1) AND club_event_types.weekoverview_visible = '1' AND events.annulation <> '1' ORDER BY events.date ASC, LPAD(lower(teams.team_name), 10,0) ASC";
connection.query(connquery, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/events/dayevents/:weekday/:language",function(req,res){
var weekDay = req.params.weekday;
var language = req.params.language;
console.log(weekDay);
var connquery = "SELECT events.event_ID, club_event_types.event_type, club_event_types.club_event_name_" + language + " as club_event_name, events.match_type, events.teamID, teams.team_name, events.locationID, events.homelocationID, CONVERT(DATE_FORMAT(events.date,'%d-%m-%Y'), CHAR(50)) as event_date, CONVERT(DATE_FORMAT(events.date,'%H:%i'), CHAR(50)) as event_time, COALESCE(results.homegoals, 1000) as homegoals, COALESCE(results.awaygoals, 1000) as awaygoals, CONVERT(COALESCE(results.result_ID, 'none'), CHAR(50)) as resultID, CONVERT(COALESCE(opponentteam.prefix, 'none'), CHAR(50)) as opponent_prefix, CONVERT(COALESCE(opponentteam.name, 'none'), CHAR(50)) as opponent_name, CONVERT(COALESCE(concat(opponentplace.prefix, ' ', opponentplace.name), homelocations.name), CHAR(50)) as event_location, events.comments, events.dressing_room, events.referee, events.annulation, events.feedbacklocked FROM events LEFT JOIN club_event_types ON events.event_type = club_event_types.club_event_type_ID LEFT JOIN teams ON events.teamID = teams.team_ID LEFT JOIN results ON events.event_ID = results.eventID LEFT JOIN opponents AS opponentteam ON events.opponentID = opponentteam.opponent_ID LEFT JOIN opponents AS opponentplace ON events.locationID = opponentplace.opponent_ID LEFT JOIN homelocations ON events.homelocationID = homelocations.homelocation_ID WHERE DATE(date) = '" + weekDay + "' AND events.annulation <> '1' ORDER BY events.date ASC, teams.team_order ASC";
connection.query(connquery, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/events/extraplayers/:eventid",function(req,res){
  connection.query('SELECT extra_players FROM events WHERE event_ID = ?', req.params.eventid, function(err, rows, fields) {
      if (!err){
      console.log('The solution is: ', rows);
        var extras = '(' + rows[0].extra_players + ')';
        console.log(extras);
        var connquery = "SELECT player_ID, first_name, last_name, pic_url FROM players where player_ID IN " + extras;  
        connection.query(connquery, function(err, rows, fields) {
          if (!err){
            console.log('The solution is: ', rows);
            res.end(JSON.stringify(rows));
          }else{
            console.log('Error while performing Query.');
          }
        });
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/events/totalplayers/:eventid/:teamid",function(req,res){
connection.query('SELECT player_ID, first_name, last_name, pic_url FROM players where teamID = ?', req.params.teamid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    var players1 = rows;
    connection.query('SELECT extra_players FROM events WHERE event_ID = ?', req.params.eventid, function(err, rows, fields) {
      if (!err){
      console.log('The solution is: ', rows);
      if (rows[0].extra_players != 'none'){
        var extras = '(' + rows[0].extra_players + ')';
        console.log(extras);
        var connquery = "SELECT player_ID, first_name, last_name, pic_url FROM players where player_ID IN " + extras;  
        connection.query(connquery, function(err, rows, fields) {
          if (!err){
            console.log('The solution is: ', rows);
            var players2 = rows;
            var totalplayers = players1.concat(players2);
            res.end(JSON.stringify(totalplayers));
          }else{
            console.log('Error while performing Query.');
          }
        });
      } else {
        res.end(JSON.stringify(players1));
      }
  }else{
    console.log('Error while performing Query.');
  }
  });

  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/events/testdate/:date", function(req,res){

var daysArray = ["Monday", "Wednesday"]
var startDate = moment(req.params.date, "DD-MM-YYYY HH:mm");
var endDate = moment("02-10-2017 19:30", "DD-MM-YYYY HH:mm");
var startDateString = startDate.format("DD-MM-YYYY").toString();
console.log(startDateString);

while (startDate.isSameOrBefore(endDate)) {

  if (daysArray.includes(startDate.format("dddd"))){
    console.log(startDate.format("dddd"));
    console.log(startDate.format("DD-MM-YYYY").toString());
  }

  startDate.add(1, 'days');

}

res.end(JSON.stringify(startDateString));

});

app.post("/events/trainingrepeat/new",function(req,res){
  var post = {
        teamID: req.body.teamid,
        event_type: req.body.eventtype,
        date: req.body.date,
        match_type: req.body.matchtype,
        opponentID: req.body.opponentid,
        locationID: req.body.locationid,
        homelocationID: req.body.homelocationid,
        comments: req.body.comments
    };
    console.log(post);
    var daysArray  = req.body.daysarray;
    console.log("daysarray : ")
    console.log(daysArray);
    var startDate = moment(req.body.date, "DD-MM-YYYY HH:mm");
    var endDate = moment(req.body.enddate, "DD-MM-YYYY HH:mm");

    while (startDate.isSameOrBefore(endDate)) {

      if (daysArray.includes(startDate.format("dddd"))){
        var trainingDateString = startDate.format("DD-MM-YYYY HH:mm").toString();
        console.log(trainingDateString);  

        var connquery = "INSERT INTO events SET date = STR_TO_DATE('" + trainingDateString + "','%d-%m-%Y  %H:%i'), teamID = '" + post.teamID + "', event_type = '" + post.event_type + "', match_type = '" + post.match_type + "', opponentID = '" + post.opponentID + "', locationID = '" + post.locationID + "', homelocationID = '" + post.homelocationID + "', comments = '" + post.comments + "'";
        console.log(connquery);
        connection.query(connquery, post, function(err,result) {
    
        if (!err){
          console.log(result);
          var testDate = startDate;
          testDate.add(1, 'days');
          if (!testDate.isSameOrBefore(endDate)){
            res.end(JSON.stringify(result));
          }
          
        }else{
          console.log('Error while performing Query.');
        }
        });

      }

    startDate.add(1, 'days');

    }

});


app.post("/events/new",function(req,res){
  var post = {
        teamID: req.body.teamid,
        event_type: req.body.eventtype,
        date: req.body.date,
        match_type: req.body.matchtype,
        opponentID: req.body.opponentid,
        locationID: req.body.locationid,
        homelocationID: req.body.homelocationid,
        comments: req.body.comments
    };
    console.log(post);
    var connquery = "INSERT INTO events SET date = STR_TO_DATE('" + post.date + "','%d-%m-%Y  %H:%i'), teamID = '" + post.teamID + "', event_type = '" + post.event_type + "', match_type = '" + post.match_type + "', opponentID = '" + post.opponentID + "', locationID = '" + post.locationID + "', homelocationID = '" + post.homelocationID + "', comments = '" + post.comments + "'";
    console.log(connquery);
connection.query(connquery, post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/events/phpnew",function(req,res){
  var post = {
        vvid: req.body.vvid,
        teamID: req.body.teamid,
        event_type: req.body.eventtype,
        date: req.body.date,
        match_type: req.body.matchtype,
        opponentID: req.body.opponentid,
        locationID: req.body.locationid,
        homelocationID: req.body.homelocationid,
        comments: req.body.comments
    };
    console.log(post);
    var connquery = "INSERT INTO events SET vvid = '" + post.vvid + "' ,date = STR_TO_DATE('" + post.date + "','%d-%m-%Y  %H:%i'), teamID = '" + post.teamID + "', event_type = '" + post.event_type + "', match_type = '" + post.match_type + "', opponentID = '" + post.opponentID + "', locationID = '" + post.locationID + "', homelocationID = '" + post.homelocationID + "', comments = '" + post.comments + "'";
    console.log(connquery);
connection.query(connquery, post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/events/phpnewupdateevent",function(req,res){
  var vvid = req.body.vvid;
  var post = {
        vvid: req.body.vvid,
        teamID: req.body.teamid,
        event_type: req.body.eventtype,
        date: req.body.date,
        match_type: req.body.matchtype,
        opponentID: req.body.opponentid,
        locationID: req.body.locationid,
        homelocationID: req.body.homelocationid,
        comments: req.body.comments
    };
    console.log(post);
  //check if this vvid already exists
  connection.query("SELECT event_ID FROM events WHERE vvid = ?",vvid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    
    if (rows.length > 0) {
      //event already exists, update the event
          var connquery = "UPDATE events SET date = STR_TO_DATE('" + post.date + "','%d-%m-%Y  %H:%i'), teamID = '" + post.teamID + "', event_type = '" + post.event_type + "', match_type = '" + post.match_type + "', opponentID = '" + post.opponentID + "', locationID = '" + post.locationID + "', homelocationID = '" + post.homelocationID + "', comments = '" + post.comments + "' WHERE vvid = '" + vvid + "'";
          console.log(connquery);
          connection.query(connquery, function(err,result) {
          /*connection.end();*/
          if (!err){
            console.log(result);
            res.end(JSON.stringify(result));
          }else{
            console.log('Error while performing UpdateQuery.');
          }
          });
    } else {
      //event does not exist yet, insert the event
          var connquery = "INSERT INTO events SET vvid = '" + post.vvid + "' ,date = STR_TO_DATE('" + post.date + "','%d-%m-%Y  %H:%i'), teamID = '" + post.teamID + "', event_type = '" + post.event_type + "', match_type = '" + post.match_type + "', opponentID = '" + post.opponentID + "', locationID = '" + post.locationID + "', homelocationID = '" + post.homelocationID + "', comments = '" + post.comments + "'";
          console.log(connquery);
          connection.query(connquery, post, function(err,result) {
          /*connection.end();*/
          if (!err){
            console.log(result);
            res.end(JSON.stringify(result));
          }else{
            console.log('Error while performing InsertQuery.');
          }
          });
    }
  }else{
    console.log('Error while performing GetVVIDQuery.');
  }
  });     
});

app.put("/events/location/:eventid",function(req,res){
  var put = {
        locationID: req.body.locationid,
        homelocationID: req.body.homelocationid
    };
    console.log(put);
connection.query('UPDATE events SET ? WHERE event_ID = ?', [put, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/events/annulation/:eventid",function(req,res){
  var put = {
        annulation: req.body.annulation
    };
    console.log(put);
connection.query('UPDATE events SET ? WHERE event_ID = ?', [put, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/events/feedbacklock/:eventid",function(req,res){
  var put = {
        feedbacklocked: req.body.feedbacklocked
    };
    console.log(put);
connection.query('UPDATE events SET ? WHERE event_ID = ?', [put, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/events/confirmation/:eventid",function(req,res){
  var put = {
        confirmed_players: req.body.confirmedplayers,
        declined_players: req.body.declinedplayers
    };
    console.log(put);
connection.query('UPDATE events SET ? WHERE event_ID = ?', [put, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/events/transport/:eventid",function(req,res){
  var put = {
        confirmed_transport: req.body.confirmedtransport,
        declined_transport: req.body.declinedtransport
    };
    console.log(put);
connection.query('UPDATE events SET ? WHERE event_ID = ?', [put, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/events/unselectplayers/:eventid",function(req,res){
  var put = {
        unselected_players: req.body.unselectedplayers
    };
    console.log(put);
connection.query('UPDATE events SET ? WHERE event_ID = ?', [put, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/events/extraplayers/:eventid",function(req,res){
  var put = {
        extra_players: req.body.extraplayers
    };
    console.log(put);
connection.query('UPDATE events SET ? WHERE event_ID = ?', [put, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/events/eventdate/:eventid",function(req,res){
  connection.query("UPDATE events SET date = STR_TO_DATE('" + req.body.date + "', '%d-%m-%Y  %H:%i') WHERE event_ID = ?", req.params.eventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/events/comments/:eventid",function(req,res){
  var put = {
        comments: req.body.comments
    };
    console.log(put);
connection.query('UPDATE events SET ? WHERE event_ID = ?', [put, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/events/dressingroom/:eventid",function(req,res){
  var put = {
        dressing_room: req.body.dressingroom
    };
    console.log(put);
connection.query('UPDATE events SET ? WHERE event_ID = ?', [put, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/events/referee/:eventid",function(req,res){
  var put = {
        referee: req.body.referee
    };
    console.log(put);
connection.query('UPDATE events SET ? WHERE event_ID = ?', [put, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.delete("/events/:eventid",function(req,res){
  var data = {
        eventid: req.params.eventid
    };
    console.log(data.id);
connection.query('DELETE FROM events WHERE event_ID = ?', data.eventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*EVENT PRESENCES*/

app.get("/eventpresences/eventid/:eventid",function(req,res){
connection.query('SELECT * FROM event_presences where eventID = ?', req.params.eventid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/eventpresences/extraplayers/:eventid",function(req,res){
connection.query('SELECT player_ID, first_name, last_name, pic_url FROM players LEFT JOIN event_presences ON players.player_ID = event_presences.playerID WHERE event_presences.eventID = ? AND event_presences.extra_player = 1', req.params.eventid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/eventpresences/new",function(req,res){
  var selected = "0";
  if (req.body.unselected == "0" && req.body.extraplayer == "0"){
      selected = "1";
  }
  var post = {
        eventID: req.body.eventid,
        playerID: req.body.playerid,
        confirmed: req.body.confirmed,
        declined: req.body.declined,
        extra_player: req.body.extraplayer,
        selected: selected,
        unselected: req.body.unselected,
        trans_confirmed: req.body.transconfirmed,
        trans_declined: req.body.transdeclined
    };
    console.log(post);
connection.query('DELETE FROM event_presences WHERE eventID = ? AND playerID = ?', [post.eventID, post.playerID], function(err,result) {
/*connection.end();*/
  if (!err){
    connection.query('INSERT INTO event_presences SET ?', post, function(err,result) {
/*connection.end();*/
      if (!err){
        console.log(result);
        res.end(JSON.stringify(result));
      }else{
        console.log('Error while performing Query.');
      }
    });
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/eventpresences/new2",function(req,res){
  var post = {
        eventID: req.body.eventid,
        playerID: req.body.playerid,
        confirmed: req.body.confirmed,
        declined: req.body.declined,
        extra_player: req.body.extraplayer,
        unselected: req.body.unselected,
        selected: req.body.selected,
        trans_confirmed: req.body.transconfirmed,
        trans_declined: req.body.transdeclined
    };
    console.log(post);
connection.query('DELETE FROM event_presences WHERE eventID = ? AND playerID = ?', [post.eventID, post.playerID], function(err,result) {
/*connection.end();*/
  if (!err){
    connection.query('INSERT INTO event_presences SET ?', post, function(err,result) {
/*connection.end();*/
      if (!err){
        console.log(result);
        res.end(JSON.stringify(result));
      }else{
        console.log('Error while performing Query.');
      }
    });
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/eventpresences/selectall",function(req,res){
connection.query('SELECT player_ID FROM players where players.teamID = ?', req.body.teamid, function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    //res.end(JSON.stringify(rows));
    rows.forEach(function(row, i) {
          var post = {
                eventID: req.body.eventid,
                playerID: row.player_ID,
                selected: 1
          };
          connection.query('DELETE FROM event_presences WHERE eventID = ? AND playerID = ?', [post.eventID, post.playerID], function(err,result) {
          if (!err){
            connection.query('INSERT INTO event_presences SET ?', post, function(err,result) {
              if (!err){
                console.log(result);
                //res.end(JSON.stringify(result));
              }else{
                console.log('Error while performing Query3.');
              }
            });
          }else{
            console.log('Error while performing Query2.');
          }
          });
    });
    res.end(JSON.stringify({insertId: 1}));
  }else{
    console.log('Error while performing Query1.');
  }
});
});

app.post("/eventpresences/confirmall",function(req,res){
connection.query("SELECT players.player_ID, COALESCE(event_presences.extra_player, '0') as extra_player FROM players LEFT JOIN event_presences ON event_presences.playerID = players.player_ID where players.teamID = ? and event_presences.eventID = ?", [req.body.teamid, req.body.eventid], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    //res.end(JSON.stringify(rows));
    connection.query('SELECT playerID as player_ID, extra_player FROM event_presences WHERE eventID = ? and extra_player = ?', [req.body.eventid, req.body.teamid], function(err, rows2, fields) {
      if (!err){

         rows2.forEach(function(row2, i) {
            rows.push(row2);
         });
         console.log('The solution is: ', rows);

         rows.forEach(function(row, i) {
         var post = {
                eventID: req.body.eventid,
                playerID: row.player_ID,
                confirmed: 1,
                extra_player: row.extra_player
          };
          connection.query('DELETE FROM event_presences WHERE eventID = ? AND playerID = ?', [post.eventID, post.playerID], function(err,result) {
          if (!err){
            connection.query('INSERT INTO event_presences SET ?', post, function(err,result) {
              if (!err){
                console.log(result);
                //res.end(JSON.stringify(result));
              }else{
                console.log('Error while performing Query3.');
              }
            });
          }else{
            console.log('Error while performing Query2.');
          }
          });
          }); 

      }else{
        console.log('Error while performing Query1,5.');
      }

    });

    res.end(JSON.stringify({insertId: 1}));
  }else{
    console.log('Error while performing Query1.');
  }
});
});

app.post("/eventpresences/reset/:eventid",function(req,res){
  var data = {
        eventid: req.params.eventid
    };
    console.log(data);
    console.log(data.eventid);
connection.query('DELETE FROM event_presences WHERE eventID = ?', data.eventid, function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/eventpresences/:eventid/:playerid",function(req,res){
  var data = {
        eventid: req.params.eventid,
        playerid: req.params.playerid
    };
    console.log(data.id);
connection.query('DELETE FROM event_presences WHERE eventID = ? AND playerID = ?', [data.eventid,data.playerid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*HOMELOCATIONS*/

app.get("/homelocations/all",function(req,res){
connection.query('SELECT * FROM homelocations', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/homelocations/php/all",function(req,res){
connection.query('SELECT homelocation_ID, name as "Naam", street as "Straat", street_nr as "Nr", postal_code as "Postcode", town as "Plaats" FROM homelocations', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/homelocations/homelocationid/:homelocationid",function(req,res){
connection.query('SELECT * FROM homelocations where homelocation_ID = ?', req.params.homelocationid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/homelocations/new",function(req,res){
  var post = {
        name: req.body.name,
        street: req.body.street,
        street_nr: req.body.streetnr,
        postal_code: req.body.postalcode,
        town: req.body.town
    };
    console.log(post);
connection.query('INSERT INTO homelocations SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/homelocations/homelocationid/:homelocationid",function(req,res){
  var put = {
        name: req.body.name,
        street: req.body.street,
        street_nr: req.body.streetnr,
        postal_code: req.body.postalcode,
        town: req.body.town
    };
    console.log(put);
connection.query('UPDATE homelocations SET ? WHERE homelocation_ID = ? ', [put, req.params.homelocationid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});



/*OPPONENTS*/

app.get("/opponents/all",function(req,res){
connection.query('SELECT opponent_ID, concat(prefix, " ", name) as fullName, name FROM opponents ORDER BY name ASC', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/opponents/opponentid/:opponentid",function(req,res){
connection.query('SELECT *, concat(prefix, " ", name) as fullName FROM opponents where opponent_ID = ?', req.params.opponentid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/opponents/basenr/:basenr",function(req,res){
connection.query('SELECT opponent_ID FROM opponents where base_nr = ?', req.params.basenr, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/opponents/count",function(req,res){
connection.query('SELECT COUNT(*) as number from opponents', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/opponents/limit/:offset/:limit",function(req,res){
  console.log(req.params.offset);
  console.log(req.params.limit);
connection.query('SELECT opponent_ID, concat(prefix, " ", name) as "Club Naam" FROM opponents ORDER BY name ASC LIMIT ?, ?',[parseInt(req.params.offset), parseInt(req.params.limit)], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
    console.log(err);
  }
  });
});

app.post("/opponents/new",function(req,res){
  var post = {
        base_nr: req.body.basenr,
        prefix: req.body.prefix,
        name: req.body.name,
        street: req.body.street,
        street_nr: req.body.streetnr,
        postal_code: req.body.postalcode,
        town: req.body.town
    };
    console.log(post);
connection.query('INSERT INTO opponents SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/opponents/opponentid/:opponentid",function(req,res){
  var put = {
        base_nr: req.body.basenr,
        prefix: req.body.prefix,
        name: req.body.name,
        street: req.body.street,
        street_nr: req.body.streetnr,
        postal_code: req.body.postalcode,
        town: req.body.town
    };
    console.log(put);
connection.query('UPDATE opponents SET ? WHERE opponent_ID = ? ', [put, req.params.opponentid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*GOALS*/

app.get("/goals/opponent/:eventid",function(req,res){
connection.query('SELECT goals_ID, goals, timestamps FROM goals WHERE (playerID = 1) AND (eventID = ?)', req.params.eventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/goals/gameassists/:eventid/:teamid",function(req,res){
connection.query("SELECT player_ID, pic_url, full_name, assistcount FROM (SELECT players.player_ID, CONCAT(players.first_name, ' ', players.last_name) as full_name, players.pic_url, ROUND(SUM((LENGTH(goals.assists) - LENGTH(REPLACE(goals.assists, players.player_ID, ''))) / LENGTH(players.player_ID)), 0) as assistcount FROM goals JOIN players ON goals.teamID = players.teamID WHERE players.teamID = ? AND goals.eventID = ? GROUP BY full_name ORDER By assistcount DESC) as x WHERE assistcount <> 0", [req.params.teamid, req.params.eventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/goals/gamegoals/:eventid",function(req,res){
connection.query("SELECT players.player_ID, concat(players.first_name, ' ', players.last_name) as full_name, players.pic_url, goals.goals FROM goals RIGHT JOIN players on goals.playerID = players.player_ID WHERE players.player_ID > 2 AND goals.eventID = ? ORDER BY goals.goals DESC", req.params.eventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/goals/gameresume/:eventid",function(req,res){
var eventID = req.params.eventid;
connection.query("SELECT events.confirmed_players FROM events WHERE event_ID = ?", req.params.eventid, function(err, rows, fields) {
  if (!err){
    console.log(rows);
    var confirms = "(" + rows[0].confirmed_players + ",1" + ",2" +")";
    
    var connquery1 = "SELECT players.player_ID, CONCAT(players.first_name, ' ', players.last_name) as full_name FROM players WHERE players.player_ID IN" + confirms;
    connection.query(connquery1, function(err, rows, fields){
        if (!err){
            
            var confirmedplayersdic = {};

            rows.forEach(function(row, b){
              confirmedplayersdic[row.player_ID] = row.full_name;
            });


            var connquery2 = "SELECT players.player_ID, players.first_name, players.last_name, COALESCE((SELECT goals.goals from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + eventID + "), 0) as goals, COALESCE((SELECT goals.timestamps from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + eventID + "), 'none') as timestamps, COALESCE((SELECT goals.assists from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + eventID + "), 'none') as assists FROM players where players.player_ID IN " + confirms + " AND COALESCE((SELECT goals.goals from goals WHERE goals.playerid = players.player_ID AND goals.eventID = " + eventID + "), 0) <> '0'";
              connection.query(connquery2, function(err, rows, fields) {
              if (!err){
              
                            var scoresarray = [];
                            rows.forEach(function(row, a) {

                                var timestampstring = row.timestamps;
                                var timestamparray = timestampstring.split(",");
                                var assiststring = row.assists;
                                var assistarray = [];
                                var assistnamearray = [];

                                if (assiststring != 'none'){
                                    assistarray = assiststring.split(",");
                                    assistarray.forEach(function(assistID, y){
                                      if (assistID == 0){
                                          assistnamearray.push("none");
                                      } else {
                                          assistnamearray.push(confirmedplayersdic[assistID]);
                                      }
                                    });
                                }
                                console.log(assistnamearray);

                                timestamparray.forEach(function(timestampitem,i) {

                                    var assistitem = '';
                                    if (assiststring != 'none'){
                                      assistitem = assistnamearray[i];  
                                    } else {
                                      assistitem = "none";
                                    }

                                    var tempscoredic = {

                                        timestamp: timestampitem,
                                        name: row.first_name + " " + row.last_name,
                                        player_id: row.player_ID,
                                        assistName: assistitem

                                    };
                                    scoresarray.push(tempscoredic);

                                });
                                scoresarray.sort(function(a,b){return a.timestamp-b.timestamp});

                            });   


            res.end(JSON.stringify(scoresarray));
              }else{
                console.log('Error2 while performing Query.');
                //console.log(err);
            }
            });
        } else {
          console.log('Error1 while performing Query.');
        }
    });

  }else{
    console.log('Error0 while performing Query.');
  }
  });
});


app.get("/goals/finalscore/:eventid",function(req,res){
  var query = "SELECT owngoals, opponentgoals FROM (SELECT COALESCE(SUM(goals), 0) as owngoals FROM goals WHERE eventID = " + req.params.eventid + " AND goals.playerID <> 1) as owngoals, (SELECT COALESCE(SUM(goals),0) as opponentgoals FROM goals WHERE eventID = " + req.params.eventid + " AND goals.playerID = 1) as opponentgoals";
connection.query(query, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/goals/new",function(req,res){
  var post = {
        eventID: req.body.eventid,
        playerID: req.body.playerid,
        goals: req.body.goals,
        timestamps: req.body.timestamps,
        assists: req.body.assists,
        teamID: req.body.teamid
    };
    console.log(post);
connection.query('INSERT INTO goals SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/goals/goalsid/:goalsid",function(req,res){
  var put = {
        goals: req.body.goals,
        timestamps: req.body.timestamps,
        assists: req.body.assists
    };
    console.log(put);
connection.query('UPDATE goals SET ? WHERE goals_ID = ? ', [put, req.params.goalsid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/goals/:goalsid",function(req,res){
  var data = {
        goalsid: req.params.goalsid
    };
    console.log(data.id);
connection.query('DELETE FROM goals WHERE goals_ID = ?', data.goalsid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*GOALS_NEW*/

app.get("/goals_new/opponent/:eventid",function(req,res){
connection.query('SELECT COUNT(*) as goals FROM goals_new WHERE (playerID = 1) AND (eventID = ?)', req.params.eventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/goals_new/finalscore/:eventid",function(req,res){
  var query = "SELECT owngoals, opponentgoals FROM (SELECT COUNT(*) as owngoals FROM goals_new WHERE goals_new.eventID = " + req.params.eventid + " AND goals_new.playerID <> 1) as owngoals, (SELECT COUNT(*) as opponentgoals FROM goals_new WHERE goals_new.eventID = " + req.params.eventid + " AND goals_new.playerID = 1) as opponentgoals";
connection.query(query, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/goals_new/goals/:eventid/:playerid",function(req,res){
connection.query("SELECT goals_new.goals_ID, goals_new.timestamp, COALESCE(concat(players.first_name, ' ', players.last_name), 'none') as assist_name FROM goals_new LEFT JOIN players ON goals_new.assistID = players.player_ID WHERE goals_new.eventID = ? AND goals_new.playerID = ? ORDER BY goals_new.timestamp ASC", [req.params.eventid, req.params.playerid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/goals_new/gameresume/:eventid",function(req,res){
connection.query("SELECT goals_new.timestamp, goals_new.playerID, concat(goalplayers.first_name, ' ', goalplayers.last_name) as player_name, COALESCE(concat(assistplayers.first_name, ' ', assistplayers.last_name), 'none') as assist_name FROM goals_new LEFT JOIN players as assistplayers ON goals_new.assistID = assistplayers.player_ID LEFT JOIN players as goalplayers ON goals_new.playerID = goalplayers.player_ID WHERE goals_new.eventID = ? ORDER BY goals_new.timestamp ASC", req.params.eventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/goals_new/gameassists/:eventid",function(req,res){
connection.query("SELECT goals_new.assistID, concat(players.first_name, ' ', players.last_name) as player_name, players.pic_url, COUNT(*) as assists FROM goals_new LEFT JOIN players ON goals_new.assistID = players.player_ID WHERE goals_new.assistID > 2 AND goals_new.eventID = ? GROUP BY goals_new.assistID ORDER BY assists DESC", req.params.eventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/goals_new/gamegoals/:eventid",function(req,res){
connection.query("SELECT goals_new.playerID, concat(players.first_name, ' ', players.last_name) as player_name, players.pic_url, COUNT(*) as goals FROM goals_new LEFT JOIN players ON goals_new.playerID = players.player_ID WHERE goals_new.playerID > 2 AND goals_new.eventID = ? GROUP BY goals_new.playerID ORDER BY goals DESC", req.params.eventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.post("/goals_new/new",function(req,res){
  var post = {
        eventID: req.body.eventid,
        playerID: req.body.playerid,
        timestamp: req.body.timestamp,
        assistID: req.body.assistid,
        teamID: req.body.teamid
    };
    console.log(post);
connection.query('INSERT INTO goals_new SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.delete("/goals_new/:goalsid",function(req,res){
  var data = {
        goalsid: req.params.goalsid
    };
    console.log(data.id);
connection.query('DELETE FROM goals_new WHERE goals_ID = ?', data.goalsid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*RESULTS*/

app.post("/results/new",function(req,res){
  var post = {
        eventID: req.body.eventid,
        homegoals: req.body.homegoals,
        awaygoals: req.body.awaygoals
    };
    console.log(post);
connection.query('INSERT INTO results SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/results/resultid/:resultid",function(req,res){
  var put = {
        homegoals: req.body.homegoals,
        awaygoals: req.body.awaygoals
    };
    console.log(put);
connection.query('UPDATE results SET ? WHERE result_ID = ? ', [put, req.params.resultid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*TOURNAMENTEVENTS*/

app.get("/tournamentevents/:eventid",function(req,res){
  console.log("gehit !!!!");
  console.log(req.params.eventid);
connection.query("SELECT tournamentevents.tournamentevent_ID, tournamentevents.eventID, tournamentevents.match_type, CONVERT(DATE_FORMAT(tournamentevents.date,'%d-%m-%Y'), CHAR(50)) as tournamentevent_date, CONVERT(DATE_FORMAT(tournamentevents.date,'%H:%i'), CHAR(50)) as tournamentevent_time, COALESCE(tournamentresults.homegoals, 1000) as homegoals, COALESCE(tournamentresults.awaygoals, 1000) as awaygoals, CONVERT(COALESCE(tournamentresults.tournamentresult_ID, 'none'), CHAR(50)) as tournamentresultID, CONVERT(COALESCE(opponentteam.prefix, 'none'), CHAR(50)) as opponent_prefix, CONVERT(COALESCE(opponentteam.name, 'none'), CHAR(50)) as opponent_name,  tournamentevents.comments, tournamentevents.dressing_room, tournamentevents.referee FROM tournamentevents LEFT JOIN tournamentresults ON tournamentevents.tournamentevent_ID = tournamentresults.tournamenteventID LEFT JOIN opponents AS opponentteam ON tournamentevents.opponentID = opponentteam.opponent_ID  WHERE tournamentevents.eventID = ? ORDER BY tournamentevents.date ASC", req.params.eventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/tournamentevents/confirmedplayers/:teventid",function(req,res){
connection.query('SELECT confirmed_players, declined_players, extra_players FROM tournamentevents WHERE tournamentevent_ID = ?', req.params.teventid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

//will not be used anymore !
app.get("/confirmedplayergoalsold/tournamenteventid/:teventid",function(req,res){
connection.query('SELECT confirmed_players FROM tournamentevents where tournamentevent_ID = ?', req.params.teventid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    if (rows[0].confirmed_players != 'none'){
      var confirms = '(' + rows[0].confirmed_players + ',2' + ')';
      console.log(confirms);
      var connquery = "SELECT players.player_ID, players.first_name, players.last_name, players.pic_url, COALESCE((SELECT COUNT(*) from tournamentgoals_new WHERE tournamentgoals_new.playerid = players.player_ID AND tournamentgoals_new.tournamenteventID = " + req.params.teventid + "), 0) as tournamentgoals FROM players where players.player_ID IN " + confirms + " GROUP BY players.last_name ORDER BY CASE WHEN players.player_ID = 2 THEN 1 ELSE 0 END, players.last_name";
      console.log(connquery);
      connection.query(connquery, confirms, function(err, rows, fields) {
      /*connection.end();*/
       if (!err){
       console.log('The solution is: ', rows);
       console.log(confirms);
        res.end(JSON.stringify(rows));
        }else{
          console.log('Error while performing Query.');
        }
      }); 
    } else {
      var emptyArray = [];
      res.end(JSON.stringify(emptyArray));
    }
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/confirmedplayergoals/tournamenteventid/:teventid",function(req,res){

connection.query('SELECT players.player_ID, players.first_name, players.last_name, players.pic_url, COALESCE((SELECT COUNT(*) from tournamentgoals_new WHERE tournamentgoals_new.playerid = players.player_ID AND tournamentgoals_new.tournamenteventID = ?), 0) as tournamentgoals FROM players LEFT JOIN tournamentevent_presences ON players.player_ID = tournamentevent_presences.playerID WHERE (tournamentevent_presences.tournamenteventID = ? AND tournamentevent_presences.confirmed = 1) OR players.player_ID = 2 GROUP BY players.last_name ORDER BY CASE WHEN players.player_ID = 2 THEN 1 ELSE 0 END, players.last_name', [req.params.teventid,req.params.teventid], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

//this will replace the previous api route
app.get("/confirmedplayergoalsnew/tournamenteventid/:teventid",function(req,res){

connection.query("SELECT players.player_ID, players.first_name, players.last_name, players.pic_url, COALESCE((SELECT COUNT(*) from tournamentgoals_new WHERE tournamentgoals_new.playerid = players.player_ID AND tournamentgoals_new.tournamenteventID = ?), 0) as tournamentgoals FROM players LEFT JOIN tournamentevent_presences ON players.player_ID = tournamentevent_presences.playerID WHERE (tournamentevent_presences.tournamenteventID = ? AND tournamentevent_presences.confirmed = 1) OR players.player_ID = 2 GROUP BY CONCAT(players.last_name, ' ', players.first_name) ORDER BY CASE WHEN players.player_ID = 2 THEN 1 ELSE 0 END, players.last_name", [req.params.teventid,req.params.teventid], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/confirmedplayers/tournamenteventid/:teventid",function(req,res){
connection.query('SELECT confirmed_players FROM tournamentevents where tournamentevent_ID = ?', req.params.teventid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    if (rows[0].confirmed_players != 'none'){
      var confirms = '(' + rows[0].confirmed_players + ',2' + ')';
      console.log(confirms);
      var connquery = "SELECT players.player_ID, players.first_name, players.last_name, players.pic_url, CONVERT(COALESCE((SELECT tournamentgoals.tournamentgoals_ID from tournamentgoals WHERE tournamentgoals.playerid = players.player_ID AND tournamentgoals.tournamenteventID = " + req.params.teventid + "), 'none'), CHAR(50)) as tournamentgoals_ID, COALESCE((SELECT tournamentgoals.goals from tournamentgoals WHERE tournamentgoals.playerid = players.player_ID AND tournamentgoals.tournamenteventID = " + req.params.teventid + "), 0) as tournamentgoals, COALESCE((SELECT tournamentgoals.timestamps from tournamentgoals WHERE tournamentgoals.playerid = players.player_ID AND tournamentgoals.tournamenteventID = " + req.params.teventid + "), 'none') as timestamps, COALESCE((SELECT tournamentgoals.assists from tournamentgoals WHERE tournamentgoals.playerid = players.player_ID AND tournamentgoals.tournamenteventID = " + req.params.teventid + "), 'none') as assists FROM players where players.player_ID IN " + confirms + " GROUP BY players.last_name ORDER BY CASE WHEN players.player_ID = 2 THEN 1 ELSE 0 END, players.last_name";
      console.log(connquery);
      connection.query(connquery, confirms, function(err, rows, fields) {
      /*connection.end();*/
       if (!err){
       console.log('The solution is: ', rows);
       console.log(confirms);
        res.end(JSON.stringify(rows));
        }else{
          console.log('Error while performing Query.');
        }
      }); 
    } else {
      var emptyArray = [];
      res.end(JSON.stringify(emptyArray));
    }
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/tournamentevents/extraplayers/:teventid",function(req,res){
  connection.query('SELECT extra_players FROM tournamentevents WHERE tournamentevent_ID = ?', req.params.teventid, function(err, rows, fields) {
      if (!err){
      console.log('The solution is: ', rows);
        var extras = '(' + rows[0].extra_players + ')';
        console.log(extras);
        var connquery = "SELECT player_ID, first_name, last_name, pic_url FROM players where player_ID IN " + extras;  
        connection.query(connquery, function(err, rows, fields) {
          if (!err){
            console.log('The solution is: ', rows);
            res.end(JSON.stringify(rows));
          }else{
            console.log('Error while performing Query.');
          }
        });
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/tournamentevents/new",function(req,res){
  var post = {
        eventID: req.body.eventid,
        teamID: req.body.teamid,
        date: req.body.date,
        match_type: req.body.matchtype,
        opponentID: req.body.opponentid,
        locationID: req.body.locationid
    };
    console.log(post);
    var connquery = "INSERT INTO tournamentevents SET eventID = '" + post.eventID + "', locationID = '" + post.locationID + "', date = STR_TO_DATE('" + post.date + "','%d-%m-%Y  %H:%i'), teamID = '" + post.teamID + "', match_type = '" + post.match_type + "', opponentID = '" + post.opponentID + "'";
    console.log(connquery);
connection.query(connquery, post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/tournamentevents/confirmation/:teventid",function(req,res){
  var put = {
        confirmed_players: req.body.confirmedplayers,
        declined_players: req.body.declinedplayers
    };
    console.log(put);
connection.query('UPDATE tournamentevents SET ? WHERE tournamentevent_ID = ?', [put, req.params.teventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/tournamentevents/extraplayers/:teventid",function(req,res){
  var put = {
        extra_players: req.body.extraplayers
    };
    console.log(put);
connection.query('UPDATE tournamentevents SET ? WHERE tournamentevent_ID = ?', [put, req.params.teventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/tournamentevents/eventdate/:teventid",function(req,res){
  connection.query("UPDATE tournamentevents SET date = STR_TO_DATE('" + req.body.date + "', '%d-%m-%Y  %H:%i') WHERE tournamentevent_ID = ?", req.params.teventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/tournamentevents/comments/:teventid",function(req,res){
  var put = {
        comments: req.body.comments
    };
    console.log(put);
connection.query('UPDATE tournamentevents SET ? WHERE tournamentevent_ID = ?', [put, req.params.teventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/tournamentevents/referee/:teventid",function(req,res){
  var put = {
        referee: req.body.referee
    };
    console.log(put);
connection.query('UPDATE tournamentevents SET ? WHERE tournamentevent_ID = ?', [put, req.params.teventid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/tournamentevents/:teventid",function(req,res){
  var data = {
        teventid: req.params.teventid
    };
    console.log(data.id);
connection.query('DELETE FROM tournamentevents WHERE tournamentevent_ID = ?', data.teventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*TOURNAMENT EVENT PRESENCES*/

app.get("/tournamenteventpresences/tournamenteventid/:tournamenteventid",function(req,res){
connection.query('SELECT * FROM tournamentevent_presences where tournamenteventID = ?', req.params.tournamenteventid, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/tournamenteventpresences/extraplayers/:tournamenteventid",function(req,res){
connection.query('SELECT player_ID, first_name, last_name, pic_url FROM players LEFT JOIN tournamentevent_presences ON players.player_ID = tournamentevent_presences.playerID WHERE tournamentevent_presences.tournamenteventID = ? AND tournamentevent_presences.extra_player = 1', req.params.tournamenteventid, function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/tournamenteventpresences/new",function(req,res){
  var post = {
        tournamenteventID: req.body.tournamenteventid,
        playerID: req.body.playerid,
        confirmed: req.body.confirmed,
        declined: req.body.declined,
        extra_player: req.body.extraplayer,
        unselected: req.body.unselected
    };
    console.log(post);
connection.query('DELETE FROM tournamentevent_presences WHERE tournamenteventID = ? AND playerID = ?', [post.tournamenteventID, post.playerID], function(err,result) {
/*connection.end();*/
  if (!err){
    connection.query('INSERT INTO tournamentevent_presences SET ?', post, function(err,result) {
/*connection.end();*/
      if (!err){
        console.log(result);
        res.end(JSON.stringify(result));
      }else{
        console.log('Error while performing Query.');
      }
    });
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/tournamenteventpresences/new2",function(req,res){
  var post = {
        tournamenteventID: req.body.tournamenteventid,
        playerID: req.body.playerid,
        confirmed: req.body.confirmed,
        declined: req.body.declined,
        extra_player: req.body.extraplayer,
        selected: req.body.selected,
        unselected: req.body.unselected
    };
    console.log(post);
connection.query('DELETE FROM tournamentevent_presences WHERE tournamenteventID = ? AND playerID = ?', [post.tournamenteventID, post.playerID], function(err,result) {
/*connection.end();*/
  if (!err){
    connection.query('INSERT INTO tournamentevent_presences SET ?', post, function(err,result) {
/*connection.end();*/
      if (!err){
        console.log(result);
        res.end(JSON.stringify(result));
      }else{
        console.log('Error while performing Query.');
      }
    });
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/tournamenteventpresences/selectall",function(req,res){
connection.query('SELECT player_ID FROM players where players.teamID = ?', req.body.teamid, function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    //res.end(JSON.stringify(rows));
    rows.forEach(function(row, i) {
          var post = {
                tournamenteventID: req.body.tournamenteventid,
                playerID: row.player_ID,
                selected: 1
          };
          connection.query('DELETE FROM tournamentevent_presences WHERE tournamenteventID = ? AND playerID = ?', [post.tournamenteventID, post.playerID], function(err,result) {
          if (!err){
            connection.query('INSERT INTO tournamentevent_presences SET ?', post, function(err,result) {
              if (!err){
                console.log(result);
                //res.end(JSON.stringify(result));
              }else{
                console.log('Error while performing Query3.');
              }
            });
          }else{
            console.log('Error while performing Query2.');
          }
          });
    });
    res.end(JSON.stringify({insertId: 1}));
  }else{
    console.log('Error while performing Query1.');
  }
});
});

app.post("/tournamenteventpresences/reset/:tournamenteventid",function(req,res){
  var data = {
        tournamenteventid: req.params.tournamenteventid
    };
    console.log(data);
connection.query('DELETE FROM tournamentevent_presences WHERE tournamenteventID = ?', data.tournamenteventid, function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/tournamenteventpresences/:tournamenteventid/:playerid",function(req,res){
  var data = {
        tournamenteventid: req.params.tournamenteventid,
        playerid: req.params.playerid
    };
    console.log(data.id);
connection.query('DELETE FROM tournamentevent_presences WHERE tournamenteventID = ? AND playerID = ?', [data.tournamenteventid,data.playerid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*TOURNAMENTRESULTS*/

app.post("/tournamentresults/new",function(req,res){
  var post = {
        tournamenteventID: req.body.tournamenteventid,
        homegoals: req.body.homegoals,
        awaygoals: req.body.awaygoals
    };
    console.log(post);
connection.query('INSERT INTO tournamentresults SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.put("/tournamentresults/resultid/:resultid",function(req,res){
  var put = {
        homegoals: req.body.homegoals,
        awaygoals: req.body.awaygoals
    };
    console.log(put);
connection.query('UPDATE tournamentresults SET ? WHERE tournamentresult_ID = ? ', [put, req.params.resultid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*TOURNAMENTGOALS*/

app.get("/tournamentgoals/opponent/:teventid",function(req,res){
connection.query('SELECT tournamentgoals_ID, goals, timestamps FROM tournamentgoals WHERE (playerID = 1) AND (tournamenteventID = ?)', req.params.teventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.post("/tournamentgoals/new",function(req,res){
  var post = {
        tournamenteventID: req.body.tournamenteventid,
        playerID: req.body.playerid,
        goals: req.body.goals,
        timestamps: req.body.timestamps,
        assists: req.body.assists
    };
    console.log(post);
connection.query('INSERT INTO tournamentgoals SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/tournamentgoals/tournamentgoalsid/:tgoalsid",function(req,res){
  var put = {
        goals: req.body.goals,
        timestamps: req.body.timestamps,
        assists: req.body.assists
    };
    console.log(put);
connection.query('UPDATE tournamentgoals SET ? WHERE tournamentgoals_ID = ? ', [put, req.params.tgoalsid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/tournamentgoals/:tgoalsid",function(req,res){
  var data = {
        tgoalsid: req.params.tgoalsid
    };
    console.log(data.id);
connection.query('DELETE FROM tournamentgoals WHERE tournamentgoals_ID = ?', data.tgoalsid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*TOURNAMENTGOALS NEW*/

app.get("/tournamentgoals_new/opponent/:teventid",function(req,res){
connection.query('SELECT COUNT(*) as goals FROM tournamentgoals_new WHERE (playerID = 1) AND (tournamenteventID = ?)', req.params.teventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/tournamentgoals_new/finalscore/:teventid",function(req,res){
  var query = "SELECT owngoals, opponentgoals FROM (SELECT COUNT(*) as owngoals FROM tournamentgoals_new WHERE tournamentgoals_new.tournamenteventID = " + req.params.teventid + " AND tournamentgoals_new.playerID <> 1) as owngoals, (SELECT COUNT(*) as opponentgoals FROM tournamentgoals_new WHERE tournamentgoals_new.tournamenteventID = " + req.params.teventid + " AND tournamentgoals_new.playerID = 1) as opponentgoals";
connection.query(query, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/tournamentgoals_new/goals/:teventid/:playerid",function(req,res){
connection.query("SELECT tournamentgoals_new.tournamentgoals_ID, tournamentgoals_new.timestamp, COALESCE(concat(players.first_name, ' ', players.last_name), 'none') as assist_name FROM tournamentgoals_new LEFT JOIN players ON tournamentgoals_new.assistID = players.player_ID WHERE tournamentgoals_new.tournamenteventID = ? AND tournamentgoals_new.playerID = ? ORDER BY tournamentgoals_new.timestamp ASC", [req.params.teventid, req.params.playerid], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/tournamentgoals_new/gameresume/:teventid",function(req,res){
connection.query("SELECT tournamentgoals_new.timestamp, tournamentgoals_new.playerID, concat(goalplayers.first_name, ' ', goalplayers.last_name) as player_name, COALESCE(concat(assistplayers.first_name, ' ', assistplayers.last_name), 'none') as assist_name FROM tournamentgoals_new LEFT JOIN players as assistplayers ON tournamentgoals_new.assistID = assistplayers.player_ID LEFT JOIN players as goalplayers ON tournamentgoals_new.playerID = goalplayers.player_ID WHERE tournamentgoals_new.tournamenteventID = ? ORDER BY tournamentgoals_new.timestamp ASC", req.params.teventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/tournamentgoals_new/gameassists/:teventid",function(req,res){
connection.query("SELECT tournamentgoals_new.assistID, concat(players.first_name, ' ', players.last_name) as player_name, players.pic_url, COUNT(*) as assists FROM tournamentgoals_new LEFT JOIN players ON tournamentgoals_new.assistID = players.player_ID WHERE tournamentgoals_new.assistID > 2 AND tournamentgoals_new.tournamenteventID = ? GROUP BY tournamentgoals_new.assistID ORDER BY assists DESC", req.params.teventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/tournamentgoals_new/gamegoals/:teventid",function(req,res){
connection.query("SELECT tournamentgoals_new.playerID, concat(players.first_name, ' ', players.last_name) as player_name, players.pic_url, COUNT(*) as goals FROM tournamentgoals_new LEFT JOIN players ON tournamentgoals_new.playerID = players.player_ID WHERE tournamentgoals_new.playerID > 2 AND tournamentgoals_new.tournamenteventID = ? GROUP BY tournamentgoals_new.playerID ORDER BY goals DESC", req.params.teventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/tournamentgoals_new/new",function(req,res){
  var post = {
        tournamenteventID: req.body.tournamenteventid,
        playerID: req.body.playerid,
        assistID: req.body.assistid,
        timestamp: req.body.timestamp,
        teamID: req.body.teamid
    };
    console.log(post);
connection.query('INSERT INTO tournamentgoals_new SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.delete("/tournamentgoals_new/:tgoalsid",function(req,res){
  var data = {
        tgoalsid: req.params.tgoalsid
    };
    console.log(data.id);
connection.query('DELETE FROM tournamentgoals_new WHERE tournamentgoals_ID = ?', data.tgoalsid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


/*CLUB_EVENT_TYPES*/


app.get("/clubeventtypes/all/:language",function(req,res){
var query = 'SELECT club_event_type_ID, club_event_name_' + req.params.language + ' as club_event_name, active from club_event_types';
  
connection.query(query, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/clubeventtypes/active/:language",function(req,res){
var query = 'SELECT club_event_type_ID, club_event_name_' + req.params.language + ' as club_event_name, event_type from club_event_types WHERE active = 1';
connection.query(query, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/clubeventtypes/matches/active/:language",function(req,res){
var query = 'SELECT club_event_type_ID, club_event_name_' + req.params.language + ' as club_event_name, event_type from club_event_types WHERE active = 1 AND (event_type LIKE "%game" OR event_type LIKE "cup")';
connection.query(query, function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.end(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.put("/clubeventtypes/:clubeventtypeid",function(req,res){
  var put = {
        //weekoverview_visible: req.body.weekoverviewvisible,
        active: req.body.active
    };
    console.log(put);
  connection.query('UPDATE club_event_types SET ? WHERE club_event_type_ID = ?', [put, req.params.clubeventtypeid], function(err,result) {
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*FILE UPLOAD*/

app.post("/image/upload",function(req,res){

var form = new formidable.IncomingForm();
var fileNameImage = "";
//form.uploadDir = '/Applications/MAMP/htdocs/skberlaar/images/';
form.uploadDir = '/var/www/footcal.be/public_html/' + apachedir + "/images/";

form.parse(req,function(err, fields, files){
  console.log(fields);
  console.log("filename : ");
  console.log(fields.picURL);
  fileNameImage = fields.picURL;
  //fileNameImage = fileNameImage + '.png';
  fs.rename(files.file.path, path.join(form.uploadDir, fileNameImage), function(err){

  });

});


form.on('error', function(err){
  console.log('An error has occured : \n' + err);
});

form.on('end', function(){
  res.end(JSON.stringify("success"));
});

});


app.post("/image/android/upload",function(req,res){

console.log(req.body.picurl);
console.log(req.body.photo);
//res.end(JSON.stringify("success"));
var uploadDir = '/var/www/footcal.be/public_html/' + apachedir + "/images/";

var imageBuffer = new Buffer(req.body.photo, 'base64');
fs.writeFile(uploadDir + req.body.picurl, imageBuffer, function(err) { 
  res.end(JSON.stringify("success"));
});


});


app.post("/image/delete",function(req,res){

var imageName = req.body.imagename;
var fullImageName = '/var/www/footcal.be/public_html/' + apachedir + '/images/' + imageName;
//var fullImageName = '/Applications/MAMP/htdocs/skberlaar/images/' + imageName

fs.unlink(fullImageName, function(error){

  if (!error){
    console.log('Image deleted');
    var outputArray = [];
    var outputDic = {
    response: 'Success'
    };
    outputArray.push(outputDic);
    res.end(JSON.stringify(outputDic));
  } else {
    console.log('Image deleted failed !');
    var outputArray = [];
    var outputDic = {
    response: 'Failure'
    };
    outputArray.push(outputDic);
    res.end(JSON.stringify(outputDic));
  }

});

});


/*Game reports file listing*/

app.get("/files/gamereports",function(req,res){

//var path = '/Applications/MAMP/htdocs/FootCal/' + apachedir + '/gamereports';
var path = '/var/www/footcal.be/public_html/' + apachedir + '/gamereports'

  fs.readdir(path, function(err, items){
    console.log(items);
    res.end(JSON.stringify(items));

  });

});

app.get("/files/gamereportyears",function(req,res){

//var path = '/Applications/MAMP/htdocs/FootCal/' + apachedir + '/gamereports';
var path = '/var/www/footcal.be/public_html/' + apachedir + '/gamereports'
var yearArray = [];

  fs.readdir(path, function(err, items){
    console.log(items);

    items.forEach(function(item, i) {

        var fileNameArray = item.split("_");
        if (fileNameArray.length > 3){
          if (yearArray.indexOf(fileNameArray[4]) == -1){
              yearArray.push(fileNameArray[4]);
          }
        }

    });

    res.end(JSON.stringify(yearArray));

  });

});


app.post("/files/gamereports/delete",function(req,res){
var fileName = req.body.filename;

var fullFileName = '/var/www/footcal.be/public_html/' + apachedir + '/gamereports/' + fileName;
//var fullFileName = '/Applications/MAMP/htdocs/FootCal/' + apachedir + '/gamereports/' + fileName

fs.unlink(fullFileName, function(error){

  if (!error){
    console.log('File deleted');
    var outputArray = [];
    var outputDic = {
    response: 'Success'
    };
    outputArray.push(outputDic);
    res.end(JSON.stringify(outputDic));
  } else {
    console.log('File deleted failed !');
    var outputArray = [];
    var outputDic = {
    response: 'Failure'
    };
    outputArray.push(outputDic);
    res.end(JSON.stringify(outputDic));
  }

});

});

/*XML - GPX parser*/

app.get("/xmltest",function(req,res){
  
var parser = new xml2js.Parser({explicitRoot: false, mergeAttrs: true}); 
var outputArray = [];
var dir = "/Applications/MAMP/htdocs/skberlaar/gpxfiles/";

fs.readFile("temp/seppe.gpx", function(err,data){
  parser.parseString(data, function(err, result){

      //console.dir(result);
      var prevDate;
      var track = result.trk;
      var trackseg = track[0].trkseg;
      var trackpt = trackseg[0].trkpt;
      var path = [];

      console.log(trackpt);

      for(var item of trackpt){
        var outputSeconds;
        var extension = item.extensions;

        var lat = item.lat[0];
        var lon = item.lon[0];
        path.push([lat, lon]);

        if (extension != undefined){

          var realTime = item.time[0];
          console.log(realTime);  
          var momentTime = moment(realTime);

          var timeString = momentTime.format("HH:mm:ss").toString();
          //console.log(timeString);

          if (prevDate === undefined){
              outputSeconds = 0;
          } else {
              outputSeconds = momentTime.diff(prevDate, "seconds") + outputSeconds;
          }
          prevDate = momentTime;
          console.log(outputSeconds);  
          //var gpxtpxkey = Object.keys(extension[0])[0];
          //var gpxtpx = Object.values(extensionDic)[0];
          var extensionDic = extension[0];
          var gpxtpx = extensionDic["gpxtpx:TrackPointExtension"];
          var hr = gpxtpx[0]["gpxtpx:hr"][0];
          console.log(hr);

          var outputDic = {"timeStamp": outputSeconds, "hartRate": hr};
          outputArray.push(outputDic);

        }
      }

      console.log("Distance travelled :" + distance(path) + " km");  
      var outputDic2 = {"timeStamp": 100, "hartRate": "100"};
      console.log(outputDic2);
      outputArray.push(outputDic2);
      res.end(JSON.stringify(outputArray));
  });

});
});


/*GPX uploads*/

app.get("/gpxuploads/eventid/:eventid",function(req,res){
connection.query('SELECT eventID, playerID, file_name FROM gpxuploads WHERE eventID = ?', req.params.eventid, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.post("/gpxuploads/new",function(req,res){
  var post = {
        eventID: req.body.eventid,
        playerID: req.body.playerid,
        file_name: req.body.filename
    };
    console.log(post);
connection.query('INSERT INTO gpxuploads SET ?', post, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.delete("/gpxuploads/:eventid/:playerid",function(req,res){
  var data = {
        eventID: req.params.eventid,
        playerID: req.params.playerid
    };
    console.log(data.id);
connection.query('DELETE FROM gpxuploads WHERE eventID = ? AND playerID = ?', [data.eventID, data.playerID], function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

/*GPX data*/

app.get("/gpxdata/players/eventid/:eventid",function(req,res){
  var data = {
        eventID: req.params.eventid
    };
connection.query('SELECT players.player_ID, players.first_name, players.last_name, players.pic_url, gpxuploads.file_name from gpxuploads LEFT JOIN players ON players.player_ID = gpxuploads.playerID WHERE gpxuploads.eventID = ? ORDER BY players.last_name', data.eventID, function(err,result) {
/*connection.end();*/
  if (!err){
    console.log(result);
    res.end(JSON.stringify(result));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/gpxdata/filename/:filename",function(req,res){
var data = {
      filename: req.params.filename
  };
var dir = "/Applications/MAMP/htdocs/skberlaar/gpxfiles/";
//var dir = "/var/www/html/gpxfiles/";

var parser = new xml2js.Parser({explicitRoot: false, mergeAttrs: true}); 
var outputArray = [];

fs.readFile(dir + data.filename, function(err,data){
  parser.parseString(data, function(err, result){

      //console.dir(result);
      var prevDate;
      var track = result.trk;
      var trackseg = track[0].trkseg;
      var trackpt = trackseg[0].trkpt;
      var path = [];

      console.log(trackpt);

      for(var item of trackpt){
        var outputSeconds;
        var extension = item.extensions;

        var lat = item.lat[0];
        var lon = item.lon[0];
        path.push([lat, lon]);

        if (extension != undefined){

          var realTime = item.time[0];
          console.log(realTime);  
          var momentTime = moment(realTime);

          var timeString = momentTime.format("HH:mm:ss").toString();
          //console.log(timeString);

          if (prevDate === undefined){
              outputSeconds = 0;
          } else {
              outputSeconds = momentTime.diff(prevDate, "seconds") + outputSeconds;
          }
          prevDate = momentTime;
          console.log(outputSeconds);  
          //var gpxtpxkey = Object.keys(extension[0])[0];
          //var gpxtpx = Object.values(extensionDic)[0];
          var extensionDic = extension[0];
          var gpxtpx = extensionDic["gpxtpx:TrackPointExtension"];
          var hr = gpxtpx[0]["gpxtpx:hr"][0];
          console.log(hr);

          var outputDic = {"timeStamp": outputSeconds, "hartRate": hr}
          outputArray.push(outputDic);

        }
      }

      console.log("Distance travelled :" + distance(path) + " km");  
      outputArray[0]['distance'] = String(distance(path));

      res.end(JSON.stringify(outputArray));
  });

});

});



/*DASHBOARD*/


app.get("/dashboard/playerstaffcount",function(req,res){
connection.query('SELECT (SELECT COUNT(*) from players WHERE player_ID > 2) as players, (SELECT COUNT(*) from staff) as staff', function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    var outputArray = [];
    var outputDic = {"group": "Players", "count": rows[0].players}
    outputArray.push(outputDic);
    var outputDic2 = {"group": "Staff", "count": rows[0].staff}
    outputArray.push(outputDic2);

    res.end(JSON.stringify(outputArray));
  }else{
    console.log('Error while performing Query.');
  }
  });
});



app.get("/dashboard/teamplayers",function(req,res){
connection.query("SELECT COUNT(players.player_ID) as count, COALESCE(teams.team_name,'No Team') as teamName FROM players LEFT JOIN teams ON teams.team_ID = players.teamID WHERE players.player_ID > 2 GROUP BY teamName", function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    var outputArray = [];
    rows.forEach(function(row, i) {
        var outputDic = {"team" : row.teamName, "count" : row.count};
        outputArray.push(outputDic);
    });
    
    res.send(JSON.stringify(outputArray));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/dashboard/teamresults/:eventtype",function(req,res){
if (req.params.eventtype == 'All'){
  req.params.eventtype = '%';
}

connection.query("SELECT REPLACE(teams.team_name,' ','') as team_name, ((SELECT COUNT(results.result_ID) as winshome FROM results JOIN events ON events.event_ID = results.eventID WHERE events.match_type = 'home' AND events.event_type LIKE ? AND results.homegoals > results.awaygoals AND events.teamID = teams.team_ID) + (SELECT COUNT(results.result_ID) as winshome FROM results JOIN events ON events.event_ID = results.eventID WHERE events.match_type = 'away' AND events.event_type LIKE ? AND results.homegoals < results.awaygoals AND events.teamID = teams.team_ID)) as wingames, ((SELECT COUNT(results.result_ID) as winshome FROM results JOIN events ON events.event_ID = results.eventID WHERE events.match_type = 'home' AND events.event_type LIKE ? AND results.homegoals < results.awaygoals AND events.teamID = teams.team_ID) + (SELECT COUNT(results.result_ID) as winshome FROM results JOIN events ON events.event_ID = results.eventID WHERE events.match_type = 'away' AND events.event_type LIKE ? AND results.homegoals > results.awaygoals AND events.teamID = teams.team_ID)) as lostgames, ((SELECT COUNT(results.result_ID) as winshome FROM results JOIN events ON events.event_ID = results.eventID WHERE events.match_type = 'home' AND events.event_type LIKE ? AND results.homegoals = results.awaygoals AND events.teamID = teams.team_ID) + (SELECT COUNT(results.result_ID) as winshome FROM results JOIN events ON events.event_ID = results.eventID WHERE events.match_type = 'away' AND events.event_type LIKE ? AND results.homegoals = results.awaygoals AND events.teamID = teams.team_ID)) as drawgames FROM teams GROUP BY teams.team_name ORDER BY teams.team_order ASC", [req.params.eventtype,req.params.eventtype,req.params.eventtype,req.params.eventtype,req.params.eventtype,req.params.eventtype], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.send(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/dashboard/teamgoals/:eventtype",function(req,res){
if (req.params.eventtype == 'All'){
  req.params.eventtype = '%';
}
connection.query("SELECT teams.team_name, ((SELECT COALESCE(SUM(results.homegoals),0) as homegoals1 FROM results JOIN events ON events.event_ID = results.eventID WHERE events.match_type = 'home' AND events.event_type LIKE ? AND events.teamID = teams.team_ID) + (SELECT COALESCE(SUM(results.awaygoals),0) as awaygoals1 FROM results JOIN events ON events.event_ID = results.eventID WHERE events.match_type = 'away' AND events.event_type LIKE ? AND events.teamID = teams.team_ID)) as goalsfor, ((SELECT COALESCE(SUM(results.awaygoals),0) as awaygoals2 FROM results JOIN events ON events.event_ID = results.eventID WHERE events.match_type = 'home' AND events.event_type LIKE ? AND events.teamID = teams.team_ID) + (SELECT COALESCE(SUM(results.homegoals),0) as winshome FROM results JOIN events ON events.event_ID = results.eventID WHERE events.match_type = 'away' AND events.event_type LIKE ? AND events.teamID = teams.team_ID)) as goalsagainst FROM teams GROUP BY teams.team_name", [req.params.eventtype,req.params.eventtype,req.params.eventtype,req.params.eventtype], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    res.send(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});


app.get("/dashboard/teamscorers/:eventtype/:teamname",function(req,res){
if (req.params.eventtype == 'All'){
  req.params.eventtype = '%';
}
console.log(req.params.teamname);
connection.query("SELECT teams.team_ID FROM teams WHERE teams.team_name = ?", req.params.teamname,function(err, rows, fields) {
  if (!err){
    var teamID = rows[0].team_ID;
    console.log(teamID);
    connection.query("SELECT CONCAT(players.first_name, ' ', players.last_name) as fullname, (SELECT COUNT(goals_new.goals_ID) as goals FROM goals_new JOIN events ON events.event_ID = goals_new.eventID WHERE events.event_type LIKE ? AND goals_new.teamID = ? AND goals_new.playerID > 2 AND goals_new.playerID = players.player_ID) as scoredgoals, (SELECT COUNT(goals_new.goals_ID) as goals FROM goals_new JOIN events ON events.event_ID = goals_new.eventID WHERE events.event_type LIKE ? AND goals_new.teamID = ? AND goals_new.playerID > 2 AND goals_new.assistID = players.player_ID) as assists FROM players WHERE players.player_ID > 2 AND EXISTS (SELECT 1 FROM event_presences LEFT jOIN events ON event_presences.eventID = events.event_ID WHERE events.teamID = ? AND event_presences.confirmed = 1 AND event_presences.playerID = players.player_ID) GROUP BY CONCAT(players.first_name, ' ', players.last_name) ORDER BY scoredgoals DESC", [req.params.eventtype,teamID,req.params.eventtype,teamID,teamID], function(err, rows, fields) {
    /*connection.end();*/
      if (!err){
        console.log('The solution is: ', rows);
        res.send(JSON.stringify(rows));
      }else{
        console.log('Error while performing Query2.');
      }
      });
  } else {
    console.log('Error while performing Query1.');
  }
});
});

app.get("/dashboard/playersearch/:playerstring",function(req,res){
  var playerstring = '%' + req.params.playerstring + '%';
connection.query("SELECT CONCAT(players.first_name, ' ', players.last_name) as fullname, player_ID FROM players WHERE players.player_ID > 2 AND (players.first_name LIKE ? OR players.last_name LIKE ?)", [playerstring, playerstring], function(err, rows, fields) {
/*connection.end();*/
  if (!err){
    console.log('The solution is: ', rows);
    
    res.send(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/dashboard/teamattendees/:teamid/:date",function(req,res){
connection.query("SELECT CONCAT(players.first_name, ' ', players.last_name) as fullname, (SELECT COUNT(event_presences.confirmed) FROM event_presences JOIN events ON event_presences.eventID = events.event_ID JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.date < ? AND events.teamID = ? AND event_presences.playerID = players.player_ID AND event_presences.confirmed = 1 AND event_presences.unselected <> 1 AND club_event_types.event_type = 'training' AND events.annulation = 0) as confirmedTrainings, (SELECT COUNT(event_presences.confirmed) FROM event_presences JOIN events ON event_presences.eventID = events.event_ID JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.date < ? AND events.teamID = ? AND event_presences.playerID = players.player_ID AND event_presences.confirmed = 1 AND event_presences.unselected <> 1 AND club_event_types.event_type <> 'training' AND events.annulation = 0) as confirmedGames, (SELECT COUNT(event_presences.confirmed) FROM event_presences JOIN events ON event_presences.eventID = events.event_ID JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.date < ? AND events.teamID = ? AND event_presences.playerID = players.player_ID AND event_presences.declined = 1 AND event_presences.unselected <> 1 AND club_event_types.event_type = 'training' AND events.annulation = 0) as declinedTrainings, (SELECT COUNT(event_presences.confirmed) FROM event_presences JOIN events ON event_presences.eventID = events.event_ID JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.date < ? AND events.teamID = ? AND event_presences.playerID = players.player_ID AND event_presences.declined = 1 AND event_presences.unselected <> 1 AND club_event_types.event_type <> 'training' AND events.annulation = 0) as declinedGames FROM players WHERE players.teamID = ? ORDER BY confirmedTrainings DESC", [req.params.date,req.params.teamid,req.params.date,req.params.teamid,req.params.date,req.params.teamid,req.params.date,req.params.teamid,req.params.teamid], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    res.send(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/dashboard/trainingcount/:teamid/:date",function(req,res){
connection.query("SELECT COUNT(*) as trainings from events JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.date < ? AND events.teamID = ? AND club_event_types.event_type = 'training' AND events.annulation = 0", [req.params.date,req.params.teamid], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    res.send(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

app.get("/dashboard/gamescount/:teamid/:date",function(req,res){
connection.query("SELECT COUNT(*) as games from events JOIN club_event_types ON club_event_types.club_event_type_ID = events.event_type WHERE events.date < ? AND events.teamID = ? AND club_event_types.event_type <> 'training' AND events.annulation = 0", [req.params.date,req.params.teamid], function(err, rows, fields) {
  if (!err){
    console.log('The solution is: ', rows);
    res.send(JSON.stringify(rows));
  }else{
    console.log('Error while performing Query.');
  }
  });
});

module.exports.exportapp = app;

/*
http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
*/