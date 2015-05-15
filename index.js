// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 5000;

// Twitter

var Twit = require('twit');

var T = new Twit({
    consumer_key:         'aNhXxcqJWQn04XBCve05FKfIU'
  , consumer_secret:      'dGoVGXewjyQZAeRP06IihITTFuUP80LSmEq1RFbtWkbcnsr9Ws'
  , access_token:         '565769268-nwR6reR3z7AL9yqXqSGZzCKdfzj7GuXraGt7Ys77'
  , access_token_secret:  '16We0IzfDtOsLxfSeOetrlOWCzqAkda88SC6ZPGvvWPfF'
});

var streamTw = T.stream('statuses/filter', { track: '#lunik'});

//Sondage
var Sondage = {};

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;
var slow = 1000;
var AlreadyPostTweet = [];
io.on('connection', function (socket) {
	
//TWITTER

  streamTw.on('tweet', function (tweet) {
    if (tweet.user.screen_name == "GuillaumeLunik" && AlreadyPostTweet.indexOf(tweet.id_str) == -1) {
      console.log("New Tweet");
      AlreadyPostTweet.push(tweet.id_str);
      
      var toTweet = '<blockquote class="twitter-tweet" lang="fr"><a href="https://twitter.com/GuillaumeLunik/status/'+tweet.id_str+'"></blockquote><script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>';
      
      socket.broadcast.emit('new message', {
        username: "<Twitter>",
        message: toTweet
      });
    }
  });


  var addedUser = false;
  
  // when the client emits 'new message', this listens and executes
  socket.on('send message', function (data) { 
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data.message,
	    id: data.id,
      rang:data.rang
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
	username = username.replace(" ","_");
	username = username.replace(/[^a-zA-Z0-9-_-]/g,'');
	if(!username || username == "<Server>" || usernames[username]){
		username = "visiteur-"+Math.floor((Math.random() * 10000) + 1);;
	}
    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    usernames[username] = username;
    ++numUsers;
    addedUser = true;
	console.log(username+' join');
    socket.emit('login', {
      numUsers: numUsers,
	  username: username,
	  allUsers: usernames,
      slow: slow
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers,
	    allUsers: usernames
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function (data) {
    socket.broadcast.emit('typing', {
      username: socket.username,
      rang:data.rang
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
	  console.log(socket.username+' left');
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers,
	    allUsers: usernames
      });
    }
  });
  
  socket.on('kick',function (data) {
    console.log(socket.username+" kick "+data.username);
    socket.broadcast.emit('kick', {
        username: data.username,
      moderator: socket.username,
          rang: data.rang
    });
  });

  socket.on("delete",function(data){
    socket.broadcast.emit("delete",{
      ID:data.ID
    });
  });

  socket.on("broadcast",function(data){
    socket.broadcast.emit('new message', {
      username: "<Server>",
      message: data.message,
      id: data.id,
      rang:0
    });
  });

  socket.on("announce", function(data){
    socket.broadcast.emit('announce', {
      message: data.message,
      duree: data.duree*1000
    });
  });

  socket.on("playYt",function(data){
    socket.broadcast.emit('playYt', {
      video: data.video,
      duree: data.duree
    });
  });

  socket.on("slow",function(data){
    slow = data.slow;
    socket.broadcast.emit('slow', {
      slow: data.slow
    });
  });
});

function makeId(len) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for( var i=0; i < len; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}