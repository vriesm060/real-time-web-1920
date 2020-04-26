export default {
  overlay: document.querySelector('.login-overlay'),
  init: function (namespace) {
    this.login = this.overlay.querySelector('.login');

    // Listen to the trip's namespace:
    namespace
      .on('show login', () => {
        this.overlay.classList.add('show');
      })

      .on('hide login', () => {
        this.overlay.classList.remove('show');
      });

    this.login.addEventListener('submit', (e) => {
      var post = {};
      var formdata = new FormData(e.target);

      for (var key of formdata.keys()) {
        post[key] = formdata.get(key);
      }

      // Add the client's username to the trip:
      namespace.emit('post user', post);
      this.overlay.classList.remove('show');
      e.preventDefault();
    });
  }
};
