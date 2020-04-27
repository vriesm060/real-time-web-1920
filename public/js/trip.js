import socket from './components/socket.js';
import tripLogin from './components/tripLogin.js';
import activeUsers from './components/activeUsers.js';
import shareLink from './components/shareLink.js';
import map from './components/map.js';

(function () {
  const app = {
    init: function () {
      socket.init();
      tripLogin.init(socket.namespace);
      activeUsers.init(socket.namespace);
      shareLink.init();
      map.initMap();
    }
  };

  app.init();
}) ();
