require('dotenv').config({ path: './vars.env' });

var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var session = require('express-session')({
  secret: process.env.SESSION_SECRET || 'my-secret',
  resave: true,
  saveUninitialized: true
});
var sharedsession = require('express-socket.io-session');
var bodyParser = require('body-parser');
var {Client, Status} = require('@googlemaps/google-maps-services-js');
var uuid = require('short-uuid');
var MongoClient = require('mongodb').MongoClient;
var uri = 'mongodb+srv://max:' + process.env.MONGO_PW + '@trippiecluster-qqgdb.mongodb.net/test?retryWrites=true&w=majority';
var client = new MongoClient(uri, { useNewUrlParser: true }, { useUnifiedTopology: true });

app.use(session);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

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
  // Create trip object:
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
    path: [],
    admins: [
      {
        id: req.body.socketId,
        username: req.body.username,
        admin: true
      }
    ]
  };

  client.connect(err => {
    if (err) throw err;
    var db = client.db('trippie');
    db.collection('trips').insertOne(trip, (err, result) => {
      if (err) throw err;
      res.redirect('/trip/' + trip.id);
    });
  });
});

app.get('/trip/:id', function (req, res) {
  var namespace = '/' + req.params.id;
  var url = req.get('host') + req.originalUrl;

  client.connect(err => {
    if (err) throw err;
    var db = client.db('trippie');
    db.collection('trips').findOne({ id: req.params.id }, (err, result) => {
      if (err) throw err;
      res.render('trip', {
        title: result.name.literal,
        location: result.location.literal,
        url: url
      });
      client.close();
    });
  });

  // io.of(namespace).use(sharedsession(session, { autoSave: true }));
  // io.of(namespace).once('connection', (socket) => {
  //   // Update the trip's expiration date by an hour:
  //   trip.expiration += (60 * 60 * 1000);
  //
  //   // Show to socket who is active:
  //   users.forEach(user => {
  //     if (user.namespace == namespace) {
  //       socket.emit('add user', user);
  //       socket.emit('add cursor', user);
  //     }
  //   });
  //
  //   // Determine if socket is admin, if so, give admin rights and add admin to users list:
  //   var admin = trip.admins.find(admin => admin.id == socket.handshake.session.id);
  //   if (admin) {
  //     socket.join('admin');
  //     admin.namespace = namespace;
  //     users.push(admin);
  //     io.of(namespace).emit('add user', admin);
  //     socket.broadcast.emit('add cursor', admin);
  //   }
  //
  //   // Show login modal to each client that isn't an admin:
  //   socket.emit('show login');
  //   io.of(namespace).to('admin').emit('hide login');
  //
  //   // Add client's username to users list:
  //   socket.on('post user', (client) => {
  //     client.id = socket.handshake.session.id;
  //     client.admin = false;
  //     client.namespace = namespace;
  //     users.push(client);
  //     io.of(namespace).emit('add user', client);
  //     socket.broadcast.emit('add cursor', client);
  //   });
  //
  //   if (admin) {
  //     console.log('Welcome ' + admin.username);
  //   } else {
  //     console.log('Welcome random user');
  //   }
  //
  //   // Show other client's cursor in real-time:
  //   socket.on('cursor move', (latlng) => {
  //     socket.broadcast.emit('change cursor', {
  //       id: socket.handshake.session.id,
  //       latlng: latlng
  //     });
  //   });
  //
  //   // Show other client's cursor clicked in real-time:
  //   socket.on('cursor click', (down) => {
  //     socket.broadcast.emit('pulse cursor', {
  //       id: socket.handshake.session.id,
  //       down: down
  //     });
  //   });
  //
  //
  //
  //
  //   // Catch route edits:
  //   socket.on('edit route', (latLng) => {
  //     console.log(latLng);
  //     trip.path.push(latLng);
  //     io.of(namespace).emit('add route segment', trip.path);
  //   });
  //
  //   socket.on('edit startMarker', (latLng) => {
  //     trip.path.splice(0, 1, latLng);
  //     io.of(namespace).emit('change startMarker', trip.path);
  //   });
  //
  //   socket.on('edit polyline', (data) => {
  //     trip.path.splice(data.idx, data.remove, data.newLatLng);
  //     io.of(namespace).emit('change polyline', {
  //       polyline: data.polyline,
  //       polylinePath: data.polylinePath,
  //       idx: data.idx,
  //       path: trip.path
  //     });
  //   });
  //
  //   socket.on('delete polyline', (data) => {
  //     for (var i = 1; i < data.latLngs.length; i++) {
  //       trip.path.splice(trip.path.indexOf(data.latLngs[i]), 1);
  //     }
  //     io.of(namespace).emit('polyline deleted', {
  //       polyline: data.polyline,
  //       path: trip.path
  //     });
  //   });
  //
  //
  //
  //
  //   socket.on('disconnect', () => {
  //     // Remove user from users list:
  //     var curUser = users.find(user => user.id == socket.handshake.session.id);
  //     if (curUser && curUser.namespace == namespace) {
  //       users.splice(users.indexOf(curUser), 1);
  //       io.of(namespace).emit('user left', curUser);
  //       socket.broadcast.emit('remove cursor', curUser);
  //     }
  //   });
  // });
});

server.listen(process.env.PORT || 3000);
