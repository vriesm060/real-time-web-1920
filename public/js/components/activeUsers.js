export default {
  root: false,
  list: document.querySelector('.active-users__list'),
  addUser: function (user, namespace) {
    var fragment = document.createDocumentFragment();
    var li = document.createElement('li');
    var a = document.createElement('a');
    var initial = document.createElement('span');
    var fullname = initial.cloneNode(true);

    li.classList.add(user.id);
    fragment.appendChild(li);

    a.classList.add('user');
    if (user.root) a.classList.add('root');
    if (user.admin) a.classList.add('admin');
    li.appendChild(a);

    initial.classList.add('user__initial');
    initial.textContent = user.username.slice(0,1);
    a.appendChild(initial);

    fullname.classList.add('user__fullname');
    fullname.textContent = user.username;
    a.appendChild(fullname);

    this.list.appendChild(fragment);

    a.addEventListener('mouseenter', (e) => {
      if (this.root && !a.classList.contains('root')) {
        this.userOptions(li, user.id, user.username, namespace);
      }
    });

    li.addEventListener('mouseleave', (e) => {
      if (this.root && !a.classList.contains('root')) {
        this.closeUserOption(li);
      }
    });
  },
  removeUser: function (user) {
    var curUser = Array.from(this.list.children).find(child => child.classList.contains(user.id));
    curUser.parentNode.removeChild(curUser);
  },
  userOptions: function (user, id, username, namespace) {
    var add = false;
    var userOption = document.createElement('button');

    userOption.classList.add('user-option');

    if (user.children[0].classList.contains('admin')) {
      add = false;
      userOption.classList.add('remove-admin');
      userOption.textContent = 'Verwijder ' + username + ' als Admin.';
    } else {
      add = true;
      userOption.classList.add('add-admin');
      userOption.textContent = 'Geef ' + username + ' Admin rechten.';
    }

    user.appendChild(userOption);

    userOption.addEventListener('click', (e) => {
      this.toggleAdmin(add, id, namespace);
      this.closeUserOption(user);
      e.preventDefault();
    });
  },
  toggleAdmin: function (add, id, namespace) {
    if (add) {
      namespace.emit('add admin', {
        id: id
      });
    } else {
      namespace.emit('remove admin', {
        id: id
      });
    }
  },
  closeUserOption: function (user) {
    var userOption = user.querySelector('.user-option');
    if (userOption) user.removeChild(userOption);
  },
  toggleClasslist: function (user) {
    var curUser = Array.from(this.list.children).find(child => child.classList.contains(user.id));
    if (user.admin) {
      curUser.children[0].classList.add('admin');
    } else {
      curUser.children[0].classList.remove('admin');
    }
  },
  init: function (namespace) {
    namespace.emit('request root update');
    namespace
      .on('enable root rights', () => {
        this.root = true;
      })
      .on('update admin rights', (user) => {
        this.toggleClasslist(user);
      })
      .on('add user', (user) => {
        this.addUser(user, namespace);
      })
      .on('user left', (user) => {
        this.removeUser(user);
      });
  }
};
