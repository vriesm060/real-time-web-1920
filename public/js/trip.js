import socket from './components/socket.js';
import tripLogin from './components/tripLogin.js';
import activeUsers from './components/activeUsers.js';

(function () {
  const app = {
    init: function () {
      socket.init();
      tripLogin.init(socket.namespace);
      activeUsers.init(socket.namespace);
    }
  };

  app.init();
}) ();
