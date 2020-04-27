export default {
  elem: document.querySelector('.share-link'),
  init: function () {
    this.input = this.elem.querySelector('input[type="text"]');
    this.button = this.elem.querySelector('button[type="button"]');

    // Copy the url link:
    this.button.addEventListener('click', (e) => {
      this.input.select();
      this.input.setSelectionRange(0, 99999); // For mobile devices
      document.execCommand('copy');
      e.preventDefault();
    });
  }
};
