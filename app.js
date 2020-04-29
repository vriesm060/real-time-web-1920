require('dotenv').config({ path: './vars.env' });

var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var session = require('express-session')({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true
});
var sharedsession = require('express-socket.io-session');
var bodyParser = require('body-parser');
var {Client, Status} = require('@googlemaps/google-maps-services-js');
var uuid = require('short-uuid');

app.use(session);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

var client = new Client({});

// Create a temporary database to save trip info and user info: admin, regular users
var database = {
  trips: []
};

// Create a users list for all active users:
var users = [];

io.use(sharedsession(session, { autoSave: true }));

app.get('/', function (req, res) {
  io.once('connection', (socket) => {
    socket.emit('id', socket.handshake.session.id);
  });

  res.render('index');
});

app.post('/trip', function (req, res) {
  var trip = {
    id: uuid.generate(),
    expiration: Date.now() + (60 * 60 * 1000),
    name: {
      value: req.body.trip.replace(/\s+/g, '-').replace('/', '-').toLowerCase(),
      literal: req.body.trip
    },
    location: {
      value: req.body.location.replace(/\s+/g, '-').replace('/', '-').toLowerCase(),
      literal: req.body.location
    },
    route: {
      path: []
    },
    admins: [
      {
        id: req.body.socketId,
        username: req.body.username,
        admin: true
      }
    ]
  };

  database.trips.push(trip);
  res.redirect('/trip/' + trip.id);
});

app.get('/trip/:id', function (req, res) {
  var namespace = '/' + req.params.id;
  var url = req.get('host') + req.originalUrl;
  var trip = database.trips.find(trip => trip.id == req.params.id);

  io.of(namespace).use(sharedsession(session, { autoSave: true }));
  io.of(namespace).once('connection', (socket) => {
    // Update the trip's expiration date by an hour:
    trip.expiration += (60 * 60 * 1000);

    // Show to socket who is active:
    users.forEach(user => {
      if (user.namespace == namespace) {
        socket.emit('add user', user);
        socket.emit('add cursor', user);
      }
    });

    // Determine if socket is admin, if so, give admin rights and add admin to users list:
    var admin = trip.admins.find(admin => admin.id == socket.handshake.session.id);
    if (admin) {
      socket.join('admin');
      admin.namespace = namespace;
      users.push(admin);
      io.of(namespace).emit('add user', admin);
      socket.broadcast.emit('add cursor', admin);
    }

    // Show login modal to each client that isn't an admin:
    socket.emit('show login');
    io.of(namespace).to('admin').emit('hide login');

    // Add client's username to users list:
    socket.on('post user', (client) => {
      client.id = socket.handshake.session.id;
      client.admin = false;
      client.namespace = namespace;
      users.push(client);
      io.of(namespace).emit('add user', client);
      socket.broadcast.emit('add cursor', client);
    });

    if (admin) {
      console.log('Welcome ' + admin.username);
    } else {
      console.log('Welcome random user');
    }

    // Show other client's cursor in real-time:
    socket.on('cursor move', (latlng) => {
      socket.broadcast.emit('change cursor', {
        id: socket.handshake.session.id,
        latlng: latlng
      });
    });

    // Show other client's cursor clicked in real-time:
    socket.on('cursor click', (down) => {
      socket.broadcast.emit('pulse cursor', {
        id: socket.handshake.session.id,
        down: down
      });
    });

    // Catch route edits:
    socket.on('edit route', (latlng) => {
      console.log(latlng);
    });

    socket.on('disconnect', () => {
      // Remove user from users list:
      var curUser = users.find(user => user.id == socket.handshake.session.id);
      if (curUser && curUser.namespace == namespace) {
        users.splice(users.indexOf(curUser), 1);
        io.of(namespace).emit('user left', curUser);
        socket.broadcast.emit('remove cursor', curUser);
      }
    });
  });

  res.render('trip', {
    title: trip.name.literal,
    location: trip.location.literal,
    url: url
  });
});

server.listen(process.env.PORT);
