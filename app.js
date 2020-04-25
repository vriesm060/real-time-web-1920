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
    admins: [
      {
        id: req.body.socketId,
        username: req.body.username
      }
    ]
  };

  database.trips.push(trip);
  res.redirect('/trip/' + trip.id);
});

app.get('/trip/:id', function (req, res) {
  var namespace = '/' + req.params.id;
  var url = req.protocol + '://' + req.get('host') + req.originalUrl;
  var trip = database.trips.find(trip => trip.id == req.params.id);
  var users = [];

  io.of(namespace).use(sharedsession(session, { autoSave: true }));
  io.of(namespace).once('connection', (socket) => {
    // Update the trip's expiration date by an hour:
    trip.expiration += (60 * 60 * 1000);

    // Determine if socket is admin, if so, give admin rights:
    var admin = trip.admins.find(admin => admin.id == socket.handshake.session.id);

    if (admin) socket.join('admin');

    if (admin) {
      console.log('Welcome ' + admin.username);
    } else {
      console.log('Welcome random user');
    }

  });

  res.render('trip', {
    title: trip.name.literal,
    url: url
  });
});
