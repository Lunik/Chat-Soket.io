$(function() {
  var VERSION = "1.8.4.5";
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var SLOW;
  var COLORS = new JsonRead("Colors");

  var SMILEY = new JsonRead("Smiley");
  var BANNED_WORDS = new JsonRead("BannedWords");
  var PASSWORDS = new JsonRead("Password");

  // Initialize varibles
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $connectedUser = $('.connected'); //Liste connecté
  var $inputMessage = $('.inputMessage'); // Input message input box
  var $username = $(".username");
  var IsSound = false;

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var usernames;
  var connected = false;
  var lvl = 0;
  var typing = false;
  var lastTypingTime;
  var lastMessage;
  var $currentInput = $usernameInput.focus();

  var socket = io();


  //lit un fichier .json
  function JsonRead(nom) {
	  // Création de l'objet XmlHttpRequest
      var xhr = getXMLHttpRequest();
      
      // Chargement du fichier
	  xhr.open("GET", 'json/' + nom + '.json', false);
	  xhr.send(null);
	  if(xhr.readyState != 4 || (xhr.status != 200 && xhr.status != 0))  // Code == 0 en local
      throw new Error("Impossible de charger la list nommée \"" + nom + "\" (code HTTP : " + xhr.status + ").");

    var JsonData = xhr.responseText;

	  // Analyse des données
	  var Data = JSON.parse(JsonData);
    this.title = Data.title;
    this.liste = Data.liste;

  }

  //renvoi le nombre d'etoiles indiqué dans un string
  function nbStars(nb){
	  var res="";
	  for(var i=0;i<nb;i++){
		  res += "*";
	  }
	  return res;
  }

  //
  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "1 connected";
    } else {
      message += data.numUsers + " connected";
    }
    log(message);
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());
    if(username.length >=3) {
      // If the username is valid
      if (username) {
        $loginPage.fadeOut();
        $chatPage.show();
        $loginPage.off('click');
        $currentInput = $inputMessage.focus();

        // Tell the server your username
        socket.emit('add user', username);
        lastMessage = new Date();
      } else {
        document.getElementById("msg_form").innerHTML = "Already used Username";
      }
    }
  }
  
  //Netoyage du message
  function cleanMessage(message) {
    var messageLow = message.toLowerCase().split("<").join("*").split(">").join("*");
    //trouve les mots a ban
    for(var key in BANNED_WORDS.liste){
      messageLow = messageLow.split(BANNED_WORDS.liste[key]).join(nbStars(BANNED_WORDS.liste[key].length));
    }
    //Enlevage des mot banni
    for(var i=0;i<message.length;i++){
      if(messageLow[i] == "*")
        message = message.substring(0,i)+"*"+message.substring(i+1,message.length);
    }
    message = cleanTweet(message);
    return message;
  }

  function cleanTweet(message){
    message = message.split('class="twitter-tweet"').join('class="twitter-tweet" data-cards="hidden"');
    return message;
  }
  //Genere un ID aleatoire
  function makeId(len) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < len; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  }

  // Sends a chat message
  function sendMessage () {
    lastMessage = new Date();
    var message = $inputMessage.val();
    var return_command;
    var res_command;
    var toPost;
    var ID = makeId(10);

    // Prevent markup from being injected into the message
    if(lvl>=1 && lvl<3) {
      message = cleanInput(message).substring(0, 1000);
    }else if(lvl>=3) {
      message = cleanInput(message);
    }else {
      message = cleanInput(message).substring(0, 500);
    }

    if ($inputMessage.attr("type") == "password") {
      $inputMessage.attr("type","");
    }
    //execution des commandes
    if (message[0] == "/") {
      return_command = read_command(message);
      if (return_command.post) {
          message = return_command.message;
          toPost= {username: username, message: message,id:ID};
        } else {
          res_command = exe_command(return_command);
          message = res_command;
          toPost= {username: "<Server>", message: message,id:ID};
        }
    } else {
      return_command = {message:"none", post: true};
      toPost= {username: username, message: message,id:ID};
      if(lvl<3)
        toPost.message = message = cleanMessage(toPost.message);
      else {
        message = toPost.message;
      }
	  }

	  //Netoie le message
    
    // if there is a non-empty message and a socket connection
    if (message) {
      $inputMessage.val('');
		  addChatMessage(toPost);
		  if(connected && return_command.post){
     		// tell server to execute 'new message' and send along one parameter
      	socket.emit('send message', {message:message,id:ID,rang:lvl});
		}
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
	  var return_command;
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }
    var $iconeDiv = $('<span class="icon"/>');
    //console.log(data.rang);
    if(data.username != "<Server>"){
    if (data.rang>=0) {
      if (data.rang>=1) {
        $iconeDiv.html('<img src="images/rang/lvl-'+data.rang+'.png" />');
      }
    } else {
      if (lvl>=1) {
        $iconeDiv.html('<img src="images/rang/lvl-'+lvl+'.png" />');
      }
    }}
      
    var $usernameDiv = $('<span class="username"/>')
      .text(data.username+" :")
      .css('color', getUsernameColor(data.username));

	  data.message = addSmiley(data.message);

	  var $messageBodyDiv = $('<span class="messageBody">')
		  .html(data.message);

	  var $adminDiv;
	  if(lvl>=2){
	  	$adminDiv = $('<span class="adminDiv">').html("Delete");
	  } else {
	  	$adminDiv = "";
	  }
    //return_command = {post: true};
    //console.log($messageBodyDiv);

    var typingClass = data.typing ? 'typing' : '';
    var CDate = new Date();
    CDate = CDate.getHours()+":"+CDate.getMinutes()+":"+CDate.getSeconds();
    var $dateDiv = $('<span class="dateDiv">').html(CDate);

    if(data.mention){
      if (data.id) {
        data.id = "-"+data.id;
        var $messageDiv = $('<li class="message'+data.id+' mention"/>')
                  .data('username', data.username)
                  .addClass(typingClass)
                  .append($iconeDiv,$usernameDiv, $messageBodyDiv, $dateDiv, $adminDiv);
              playsound("mention");
      }
    } else {
      if(data.id){
        data.id = "-"+data.id;
          var $messageDiv = $('<li class="message'+data.id+'"/>')
            .data('username', data.username)
          .addClass(typingClass)
            .append($iconeDiv,$usernameDiv, $messageBodyDiv, $dateDiv, $adminDiv);
      } else {
        var $messageDiv = $('<li class="message"/>')
          .data('username', data.username)
          .addClass(typingClass)
            .append($iconeDiv,$usernameDiv, $messageBodyDiv, $dateDiv, $adminDiv);
      }
    }
    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = '...';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

	//traite les commandes
  function read_command(message){
    var split_msg = message.split(" ");
    var command = split_msg[0].split("/")[1];
    switch (command) {
      case "img":
        var url = split_msg[1];
        return {message:"<a href='"+url+"' target='_blank'><img src='"+url+"' class='img'/></a>",
          post: true};
      case "http:":
        var url = split_msg[0].substring(1,1000);
        return {message:"<a href='"+url+"' target='_blank'>"+url+"</a>",
          post:true};
      case "yt":
        if (lvl>=1) {
          var url = split_msg[1];
          var code = url.split("v=")[1];
          if (!code) {
            var code = url.split("youtu.be/")[1];
            if(!code){
              var code = url.split("embed/")[1];
            }
          }
          code = code.split("&")[0];
          return {message:"<iframe width='560' height='315' src='//www.youtube.com/embed/"+code+"' frameborder='0' allowfullscreen></iframe>",
          post:true};
        } else {
          return {message: "Unknown command",
            post: false};
        }
        break;
      case "ping":
       return {message:"ping",
        post:false};
      case "help":
        return {message:"help",
          post:false};
      case "version":
        return {message:"version",
          post:false};
      case "quit":
        return {message:"quit",
          post:false};
      case "clear":
        return {message:"clear",
          post:false};
      case "pass":
        $inputMessage.attr("type","password");
        return {message:"pass",
          parametre:split_msg[1],
          post:false};
      case "kick":
        if (lvl>=2) {
          return {
            message: "kick",
            parametre: split_msg[1],
            post: false
          };
        } else {
          return {message: "Unknown command",
            post: false};
        }
      case "tw":
        if(lvl>=1){
          return {message:'<blockquote class="twitter-tweet" data-cards="hidden" lang="fr"><a href="https://twitter.com/GuillaumeLunik/status/'+split_msg[1]+'"></blockquote> <script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>',
          post: true}
        } else {
          return {message: "Unknown command",
            post: false};
        }
        break;
      case "poule":
        if(lvl>=1) {
          return {
            message: "<img src='http://guillaume-lunik.fr/images/poule.png' class='img'/>",
            post: true
          };
        } else {
          return {message: "Unknown command",
            post: false};
        }
      case "ls":
        return {message: "ls",
        post: false};
      case "say":
        if(lvl>=2) {
          return {
            message: "say",
            parametre: split_msg,
            post: false
          };
        } else {
          return {message: "Unknown command",
            post: false};
        }
      case "announce":
        if(lvl>=2){
          return {
            message: "announce",
            parametre: split_msg,
            post:false
          };
        } else {
          return {message: "Unknown command",
            post: false};
        }
      case "playYt":
        if(lvl>=1){
          var url = split_msg[1];
          var code = url.split("v=")[1];
          if (!code) {
            var code = url.split("youtu.be/")[1];
            if(!code){
              var code = url.split("embed/")[1];
            }
          }
          code = code.split("&")[0];
          return {
            message: "playYt",
            parametre: code,
            post:false};
        } else {
          return {message: "Unknown command",
            post: false};
        }
      case "slow":
        if(lvl>=2){
          return {message: "slow",
            parametre: split_msg[1],
            post: false};
        } else {
          return {message: "Unknown command",
            post: false};
        }

      default:
        return {message: "Unknown command",
          post: false};
    }

  }

  //Execute les commandes
  function exe_command(command){
    var cmd = command.message;
    var parametre = command.parametre;
    var res_command ="";
    switch (cmd) {
      case "ping":
        playsound("ping");
        res_command = "Pong";
        break;
      case "help":
        res_command = help();
        break;
      case "version":
        res_command = "Version - "+VERSION;
        break;
      case "quit":
        playsound("quit");
        socket.disconnect();
        location.reload();
        break;
      case "clear":
        res_command = "Chat clear";
        $messages.html("");
        break;
      case "pass":
        if(parametre && hash(parametre) == PASSWORDS.liste.Admin){
          //Set Admin
          $inputMessage.attr("type","");
          if(lvl != 3){
            lvl = 3;
            res_command = "Connected as Admin";
          } else {
            res_command = "Already Connected as Admin";
          }
        } else if(parametre && hash(parametre) == PASSWORDS.liste.Moderator){
          //Set Moderator
          $inputMessage.attr("type","");
          if(lvl != 2){
            lvl = 2;
            res_command = "Connected as Moderator";
          } else {
            res_command = "Already Connected as Moderator";
          }
        } else if(parametre && hash(parametre) == PASSWORDS.liste.KnownUser){
          //Set KnownUser
          $inputMessage.attr("type","");
          if(lvl != 1){
            lvl = 1;
            res_command = "Connected as KnownUser";
          } else {
            res_command = "Already Connected as KnownUser";
          }
        } else {
          if(parametre)
            res_command = "Wrong Password";
        }
        break;
      case "kick":
        console.log({username:parametre.trim(),rang:lvl});
        socket.emit('kick', {username:parametre.trim(),rang:lvl});
        res_command = "Kick "+parametre;
        break;
      case "ls":
        //console.log(usernames);
        res_command = "<span style='text-decoration:underline; font-weight: bold;'>Utilisateurs connectés:</span> ";
        for(var key in usernames){
          //console.log(key);
          res_command += " <span style='color:"+getUsernameColor(usernames[key])+"; font-weight:700;'>"+usernames[key]+" </span>|";
        }
        res_command = res_command.substring(0,res_command.length-1);
        break;
      case "say":
        var message = parametre.join(" ").split("/say")[1];
        if(message) {
          message = message.substring(1, message.length);
          res_command = 'Broadcast: "' + message + '"';
          socket.emit("broadcast", {message: message, id: makeId(10), rang: lvl});
        } else {
          res_command = "Invalide Syntax";
        }
        break;
      case "announce":
        var timeOut = parseInt(parametre[1]);
        if(timeOut) {
          var message = parametre.join(" ").split("/announce")[1];
          message = message.split(timeOut)[1].trim();
          message = cleanTweet(message);
          if (message) {
            res_command = 'Announce: "' + message + '"';
            socket.emit("announce", {message: message, duree: timeOut});
          } else {
            res_command = "Invalide Syntax";
            playsound("error");
          }
        } else {
          res_command = "Invalide Syntax";
          playsound("error");
        }
        break;
      case "playYt":
        var url = parametre;
        if(url){
          res_command = 'Play: "' + url + '"';
          var duration,plop;
          $.ajax({
            url: "http://gdata.youtube.com/feeds/api/videos/"+url+"?v=2&alt=json",
            dataType: "jsonp",
            success: function (data) {
              duration = parseInt(data.entry.media$group.yt$duration.seconds);
              socket.emit('playYt',{
                video: "<iframe width='560' height='315' src='http://www.youtube.com/embed/"+url+"?autoplay=1&controls=0' frameborder='0'></iframe>",
                duree: duration
              });
            }
          });
        } else {
          res_command = "Invalide Syntax";
          playsound("error");
        }
        break;
      case "slow":
        var slow = parametre;
        if(slow>0){
          SLOW = slow;
          socket.emit('slow',{
            slow: slow
          });
          res_command = "Slow passé à "+Math.round(slow/1000)+" secondes";
        } else {
          res_command = "Invalide Syntax";
        }
        break;
      default:
        res_command = "Unknown Command";
        playsound("error");
        break;
    }
    return res_command;
  }

  //Hash un string
  function hash(pass) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < pass.length; i++) {
       hash = pass.charCodeAt(i) + (hash << 5) - hash;
    }
    return hash;
  }

  //Ajoute les smiley
  function addSmiley(message){
	  var j=0;
	  var messageWSmiley = message;
	  for(var key in SMILEY.liste){
      if(SMILEY.liste[key])
		    messageWSmiley = messageWSmiley.split(key).join("<img src='smiley/"+SMILEY.liste[key]+".gif' class='smiley'/>");
      else
        messageWSmiley = messageWSmiley.split(key).join(key);
	  }
	  return messageWSmiley;
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing',{username:username,rang:lvl});
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.liste.length);
    return COLORS.liste[index];
  }

	//met a jour la liste
  function updateChatList(users){
	  $connectedDiv = $('.connected');
	  $connectedDiv.text("User List");
	  $.each(users, function(index,value){
		  $connectedDiv = $('.connected');
		  $connectedDiv.append("<div class='userlist' style='color:"
		  +getUsernameColor(value)+";'>"+value+"</div>");
    });

  }

  //retourne les commandes sous forme de text
  function help(){
	  var res_help = "<ul><li>...</li>"
	  +"<li><span class='nom_cmd'>Show commands:</span>"
    +"<span class='syntax_cmd'>/help</span></li>"
    +"<li><span class='nom_cmd'>Version:</span>"
    +"<span class='syntax_cmd'>/version</span></li>"
    +"<li><span class='nom_cmd'>Pong:</span>"
    +"<span class='syntax_cmd'>/ping</span></li>"
    +"<li><span class='nom_cmd'>Clear chat:</span>"
    +"<span class='syntax_cmd'>/clear</span></li>"
    +"<li><span class='nom_cmd'>Print image:</span>"
    +"<span class='syntax_cmd'>/img #url</span></li>"
    +"<li><span class='nom_cmd'>Print link:</span>"
	  +"<span class='syntax_cmd'>/#url</span></li>"
	  +"<li><span class='nom_cmd'>Leave:</span>"
	  +"<span class='syntax_cmd'>/quit</span></li>"
    +"<li><span class='nom_cmd'>Connected list:</span>"
    +"<span class='syntax_cmd'>/ls</span></li>";
      if (lvl>=1) {
        res_help += "<li><span class='nom_cmd'>Print Youtube video:</span>"
        +"<span class='syntax_cmd'>/yt #url</span></li>"
        +"<li><span class='nom_cmd'>Print Tweet:</span>"
        +"<span class='syntax_cmd'>/tw #code</span></li>"
        +"<li><span class='nom_cmd'>Connection :</span>"
        +"<span class='syntax_cmd'>/pass #password</span></li>"
        +"<li><span class='nom_cmd'>Play Youtube video :</span>"
        +"<span class='syntax_cmd'>/playYt #url</span></li>";
      }
      if(lvl>=2){
        res_help += "<li><span class='nom_cmd'>Kick:</span>"
        +"<span class='syntax_cmd'>/kick @#username</span></li>"
        +"<li><span class='nom_cmd'>Announcement:</span>"
        +"<span class='syntax_cmd'>/announce #duration(in seconds) #message</span></li>"
        +"<li><span class='nom_cmd'>Broadcast :</span>"
        +"<span class='syntax_cmd'>/say #message</span></li>";
      }
	  if(lvl>=3){

	  }
	  res_help += "</ul>";
	  return res_help;
  }

  //Ajoute les smileys dans la bare de gauche
  $(function (){
	  $.each(SMILEY.liste, function(index,value){
      $connectedDiv = $('.Lsmiley');
      $proposalDiv = $('.smileyProposal');
      $proposalDiv.append('<option value="'+index+'"></option>');
      if(value) {
        $connectedDiv.append("<span class='smileylist'><img src='smiley/" + value + ".gif' class='smiley' id='" + index + "'/></span>");
      }else {
        $connectedDiv.append("<span class='smileylist'><span class='smiley' id='" + index + "'>" + index + "</span></span>");
      }
    });
  });
  // Keyboard events

  var EasterShiftCount = 1;
  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
      updateTitle("Cleen");
    }
    // When the client hits ENTER on their keyboard
	  switch (event.which) {
		  case 13:
			  if (username) {
          if(((new Date()) - lastMessage) > SLOW) {
            sendMessage();
            socket.emit('stop typing');
            typing = false;
          }
        } else {
          setUsername();
        }
        break;
		  case 37:
			  But_Smiley();
			  break;
		  case 39:
			  But_Connected();
			  break;
      case 16:
        if(EasterShiftCount>=5){
          playsound("mention");
        } else {
          EasterShiftCount++;
        }
		  default:
			  break;
    }
    //Reset EasterShiftCount
    if(event.which != 16)
      EasterShiftCount = 1;
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  function visibilite(thingId){
	  var targetElement;
	  targetElement = document.getElementById(thingId) ;
	  if (targetElement.style.opacity == 0){
      targetElement.style.display = "";
      setTimeout(function(){
        targetElement.style.opacity = 1 ;
      },100);
      return "unHide";
	  } else {
		  targetElement.style.opacity = 0 ;
      setTimeout(function(){
        targetElement.style.display = "none";
      },600);
      return "Hide";
	  }
  }

  var IsSound = true;
  function playsound(name){
    //console.log(IsSound);
    var sound = new Howl({
      urls: ['sound/'+name+'.mp3']
    })
    if(IsSound && connected){
      sound.play();
    }

  }
  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

	//ajout de la mention quand clic sur pseudo dans le chat
  $messages.on("click",".username",function(){
	  var text = $(this).text();
	  var name = text.split(" ")[0];
	  var inputtext = $inputMessage.val();
	  $inputMessage.val(inputtext+" @"+name+" ");
	  $currentInput.focus();
  });

	//ajout de la mention quand clic sur pseudo dans la liste
  $(".connected").on("click",".userlist",function(){
	  var text = $(this).text();
	  var name = text.split(" ")[0];
	  var inputtext = $inputMessage.val();
	  $inputMessage.val(inputtext+" @"+name+" ");
	  $currentInput.focus();
  });

  //Ajout du smiley dans le chat
  $(".Lsmiley").on("click",".smiley",function(){
	  var smiley = $(this).attr('id');
	  var inputtext = $inputMessage.val();
	  $inputMessage.val(inputtext+" "+smiley+" ");
	  $currentInput.focus();
	  $(".but_smiley").trigger("click");
  });

  $(".but_smiley").click(But_Smiley);

  function But_Smiley() {
	  var but = ".but_smiley";
	  visibilite('smiley_list');
	  if($(but).val() == 'Smiley'){
		  $(but).val('-');
		  $(but).css("left","200px");
	  } else {
		  $(but).val('Smiley');
		  $(but).css("left","0px");
	  }
  }

  $(".but_co").click(But_Connected);

  function But_Connected() {
	  var but = ".but_co";
	  visibilite('co_list');
	  if($(but).val() == 'Connected'){
	  	$(but).val('-');
	  	$(but).css("right","150px");
	  } else {
	  	$(but).val('Connected');
	  	$(but).css("right","0px");
	  }
  }

  $(".messages").on("click",".adminDiv",function(){
	  var messageId = $(this).parent().get(0).className.split("-")[1].split(" ")[0];
      //console.log(messageId);
	  if(lvl>=2){
	  	socket.emit("delete",{ID:messageId});
	  	$(".message-"+messageId+" span.messageBody").html("Message Supprimé").attr("id","deleted");
	  	$(".message-"+messageId+" span.adminDiv").html("");
	  }
  });

  $('.but_sound').click(function(){
    if(this.id == "unmute") {
      $('.but_sound').attr('id', "mute").css('background-image', "url('images/sound/mute.png')");
      IsSound = false;
    } else {
      $('.but_sound').attr('id', "unmute").css('background-image', "url('images/sound/unmute.png')");
      IsSound = true;
    }
  });

  $('.announce').on("click",".but_closeAnnounce",function(){
    visibilite("announceDiv");
    setTimeout(function(){
      $('.announce').html('');
    },600);
  });

  function updateTitle(data){
    var title = document.title;
    var ID = title.indexOf("(");
    var IF = title.indexOf(")");
    switch (data) {
      case "New_message":
        if (ID >= 0 && IF >= 0) {
          var nb = parseInt(title.substr(ID + 1, IF - 1)) + 1;
          document.title = '(' + nb + ') ' + title.substring(IF + 1, 100);
        } else {
          document.title = "(1) " + title;
        }
        break;
      case "Cleen":
        document.title = document.title.substring(IF+1,100);
        break;
      default:
        break;
    }
  }

  function announce(message,duree){
    var announceImg = "<img src='images/announce.png' />";
    var closeBut = "<input type='submit' class='but_closeAnnounce' value='x'>";
    $(".announce").html(closeBut+announceImg+message);
    if($('.announce').css("opacity") == 0) {
      visibilite("announceDiv");
      setTimeout(function(){
        visibilite("announceDiv");
        if($('.announce').html() == ""){
          setTimeout(function(){
            visibilite("announceDiv");
          },100);
        }
      },duree*1000);
    }
  }
  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    playsound("login");
    IsSound = true;
	  connected = true;
	  username = data.username;
	  usernames = data.allUsers;
    SLOW = data.slow;
	  updateChatList(usernames);
    // Display the welcome message
    var message = "Welcome to Socket.IO Chat";
	  if(username.split("-")[0] == "visiteur"){
	  	message = "Invalid Username";
	  }
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    playsound("new_msg");
    updateTitle("New_message");
	  if(data.message.indexOf("@"+username+" ") != -1){
	  	data.mention = true;
	  } else {
	  	data.mention = false;
	  }
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    playsound("join");
      log(data.username + ' joined');
      addParticipantsMessage(data);
	  usernames = data.allUsers;
	  updateChatList(usernames);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    playsound("leave");
      log(data.username + ' left');
      addParticipantsMessage(data);
      removeChatTyping(data);
	  usernames = data.allUsers;
	  updateChatList(usernames);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing''', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

	//si le serveur deco
  socket.on('disconnect', function () {
	  addChatMessage({
	  	username: "<Server>",
	  	message: "Server down... Please Wait..."
	  });
    setTimeout(function(){location.reload()},5000);
  });

  socket.on('kick', function (data) {
	  if ("@"+username == data.username && lvl<data.rang) {
	  	socket.disconnect();
	  	addChatMessage({
	  		username: "<Server>",
	  		message: "Kicked by <span style='color:"+getUsernameColor(data.moderator)+"; font-weight:700;'>"+data.moderator+"</span>"
	  	});
	  }
  });

  socket.on('delete', function (data) {
	  $(".message-"+data.ID+" span.messageBody").html("Message Supprimé").attr("id","deleted");
  });

  socket.on('announce', function (data){
    announce(data.message,data.duree);
  });

  socket.on('playYt', function(data){
    announce(data.video,data.duree);
  });

  socket.on('slow', function(data){
    SLOW = data.slow;
    addChatMessage({
      username: "<Server>",
      message: "Slow de "+Math.round(data.slow/1000)+" secondes"
    });
  });
});