export default {
  init: function () {
    var pathArray = window.location.pathname.split('/');
    this.main = io();
    this.namespace = io('/' + pathArray[pathArray.length-1]);
  }
};
