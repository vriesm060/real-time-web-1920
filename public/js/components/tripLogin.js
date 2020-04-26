export default {
  overlay: document.querySelector('.login-overlay'),
  init: function (namespace) {
    namespace
      .on('show login', () => {
        this.overlay.classList.add('show');
      })

      .on('hide login', () => {
        this.overlay.classList.remove('show');
      })
  }
};
