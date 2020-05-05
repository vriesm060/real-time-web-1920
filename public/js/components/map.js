import cursor from './cursor.js';

export default {
  'PUBLIC_KEY': 'AIzaSyDvdEQGcYau4ARuX1911u9d34CYPNaWn4k',
  admin: false,
  firstTime: true,
  path: [],
  polylines: [],
  initMap: function (namespace) {
    // Create the script tag:
    var self = this;
    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + this['PUBLIC_KEY'] + '&callback=initMap&libraries=drawing';
    script.defer = true;
    script.async = true;

    namespace.on('update firstTime', (firstTime) => {
      self.firstTime = firstTime;
    });

    // Init Google Maps function:
    window.initMap = function () {
      var map = document.getElementById('map');
      var bounds;
      var scale = Math.pow(2, 17);

      // Request map location:
      namespace.emit('request map location');

      // Request firstTime update:
      namespace.emit('request firstTime update');

      // Init the map:
      self.map = new google.maps.Map(map, {
        zoom: 18,
        disableDefaultUI: true,
        styles: [
          {
            featureType: 'poi.business',
            stylers: [{visibility: 'off'}]
          },
        ]
      });

      // Request admin update from server:
      namespace.emit('request admin update');

      // Request path data update from server:
      namespace.emit('request update path data');

      // Request places update from server:
      namespace.emit('request update places');

      // Change map bounds:
      google.maps.event.addListener(self.map, 'bounds_changed', (e) => {
        var getBounds = self.map.getBounds();
        bounds = {
          ne: getBounds.getNorthEast(),
          sw: getBounds.getSouthWest()
        };
      });

      // Change map zoom:
      google.maps.event.addListener(self.map, 'zoom_changed', (e) => {
        scale = Math.pow(2, self.map.getZoom());
      });

      // Calculate latLng from point on screen:
      google.maps.event.addDomListener(map, 'mousemove', (e) => {
        if (self.admin) {
          var neBoundInPx = self.map.getProjection().fromLatLngToPoint(bounds.ne);
          var swBoundInPx = self.map.getProjection().fromLatLngToPoint(bounds.sw);
          var worldPoint = new google.maps.Point(e.clientX / scale + swBoundInPx.x, e.clientY / scale + neBoundInPx.y);
          var latlng = self.map.getProjection().fromPointToLatLng(worldPoint);
          namespace.emit('cursor move', latlng);
        }
      });

      // Broadcast when a client clicks on the map:
      google.maps.event.addDomListener(map, 'mousedown', (e) => {
        if (self.admin) namespace.emit('cursor click', true);
      });

      // Broadcast when a client releases the click on the map:
      google.maps.event.addDomListener(map, 'mouseup', (e) => {
        if (self.admin) namespace.emit('cursor click', false);
      });

      // Build the route when clicking on the map:
      google.maps.event.addListener(self.map, 'click', (e) => {
        if (self.firstTime && self.tutorialModal) {
          self.tutorialModal.close(document.querySelector('.tutorial-modal'));
        }

        if (self.path.length == 0) {
          self.tutorialModal = new TutorialModal('polyline');
        } else {
          self.firstTime = false;
        }

        if (self.admin) namespace.emit('edit route', {
          latLng: e.latLng,
          firstTime: self.firstTime
        });
      });

      // Function to add new route segments:
      function addRouteSegment(latLng) {
        if (self.path.length > 0) {
          if (self.path.indexOf(latLng) == 0) {
            self.startMarker = new google.maps.Marker({
              position: latLng,
              map: self.map,
              draggable: self.admin ? true : false,
              icon: {
                url: '/images/icons/start_point.svg',
                scaledSize: new google.maps.Size(60,60),
                anchor: new google.maps.Point(30,55)
              }
            });

            // Option to move start marker:
            google.maps.event.addListener(self.startMarker, 'drag', (e) => {
              // Grab first polyline if exist and change first latLng into new latLng:
              if (self.polylines.length > 0) {
                self.polylines[0].getPath().i[0] = e.latLng;
                self.polylines[0].setPath(self.polylines[0].getPath().i);
              }
            });

            // Update path array with new latLng on dragend:
            google.maps.event.addListener(self.startMarker, 'dragend', (e) => {
              namespace.emit('edit startMarker', e.latLng);
            });
          } else if (self.path.indexOf(latLng) > 0) {
            var polyline = new google.maps.Polyline({
              path: self.path.slice(self.path.indexOf(latLng)-1, self.path.indexOf(latLng)+1),
              map: self.map,
              geodesic: true,
              editable: self.admin ? true : false,
              strokeColor: '#B3008C',
              strokeOpacity: 1,
              strokeWeight: 8
            });
            self.polylines.push(polyline);

            var polylineIdx, idx;

            // Define the indices:
            google.maps.event.addListener(polyline, 'mousedown', (e) => {
              if (e.vertex == undefined && e.edge == undefined) return;
              if (polyline.getPath().i.indexOf(e.latLng) !== -1) {
                polylineIdx = polyline.getPath().i.indexOf(e.latLng);
                idx = self.path.map(latlng => latlng.lat).indexOf(e.latLng.lat());
              } else {
                polylineIdx = e.edge + 1;
                idx = self.path.map(latlng => latlng.lat).indexOf(polyline.getPath().i[polylineIdx].lat());
              }
            });

            // Update the path array with new latLng coords if a polyline has an edit:
            google.maps.event.addListener(polyline, 'mouseup', (e) => {
              if (e.vertex == undefined && e.edge == undefined) return;
              namespace.emit('edit polyline', {
                polyline: self.polylines.indexOf(polyline),
                polylinePath: polyline.getPath().i,
                idx: idx,
                remove: e.vertex >= 0 ? 1 : 0,
                newLatLng: polyline.getPath().i[polylineIdx]
              });
            });

            // When client clicks the undo button after altering the polyline, coords won't be updated again (!)
            // Either remove this option or work out the problem

            // Option to delete polyline:
            google.maps.event.addListener(polyline, 'click', (e) => {
              if (self.admin) {
                var deleteMenu = new DeleteMenu(polyline, e.latLng);
              }
            });
          }
        }
      }

      // Add places:
      function addPlaceNearby(place, i) {
        var openNow = place.openNow == true
          ? '<br><strong>Nu open</strong>' : place.openNow == false
          ? '<br><strong>Gesloten</strong>'
          : '';

        var infoWindow = new google.maps.InfoWindow({
          maxWidth: 125,
          content: place.name + openNow
        });

        setTimeout(function () {
          var placeMarker = new google.maps.Marker({
            position: place.location,
            animation: google.maps.Animation.DROP,
            map: self.map
          });

          google.maps.event.addListener(placeMarker, 'mouseover', (e) => {
            infoWindow.open(self.map, placeMarker);
          });

          google.maps.event.addListener(placeMarker, 'mouseout', (e) => {
            infoWindow.close();
          });
        }, i * 500);
      }

      // Namespace listeners:
      namespace
        .on('add map location', (latLng) => {
          self.map.setCenter(latLng);
        })

        .on('enable admin rights', () => {
          self.admin = true;
        })

        .on('update admin rights', (user) => {
          if (user.admin) {
            self.admin = true;
          } else {
            self.admin = false;
          }
        })

        .on('update path data', (path) => {
          // Catch updated path data and display on the map:
          self.path = path;
          path.forEach(latLng => addRouteSegment(latLng));

          if (self.admin && self.firstTime) {
            if (self.path.length == 0) {
              self.tutorialModal = new TutorialModal('startMarker');
            } else {
              self.tutorialModal = new TutorialModal('polyline');
            }
          }
        })

        .on('update places', (places) => {
          places.forEach((place, i) => {
            addPlaceNearby(place, i);
          });
        })

        .on('change cursor', (client) => {
          // Calculate point on screen from latLng:
          var neBoundInPx = self.map.getProjection().fromLatLngToPoint(bounds.ne);
          var swBoundInPx = self.map.getProjection().fromLatLngToPoint(bounds.sw);
          var latlng = new google.maps.LatLng(client.latlng);
          var worldPoint = self.map.getProjection().fromLatLngToPoint(latlng);
          var point = new google.maps.Point((worldPoint.x - swBoundInPx.x) * scale, (worldPoint.y - neBoundInPx.y) * scale);
          cursor.changeCursorPosition(client.id, point);
        })

        .on('add route segment', (path) => {
          // Add a route segment:
          self.path = path;
          addRouteSegment(path[path.length-1]);
        })

        .on('add places', (places) => {
          places.forEach((place, i) => {
            addPlaceNearby(place, i);
          });
        })

        .on('change startMarker', (path) => {
          // Change the position of the start marker:
          self.startMarker.setPosition(new google.maps.LatLng(path[0].lat, path[0].lng));
          if (self.polylines.length > 0) {
            self.polylines[0].getPath().i[0] = path[0];
            self.polylines[0].setPath(self.polylines[0].getPath().i);
          }
          self.path = path;
        })

        .on('change polyline', (data) => {
          // Change the polyline:
          self.polylines[data.polyline].setPath(data.polylinePath);
          self.path = data.path;

          if (data.idx == 0) {
            self.startMarker.setPosition(new google.maps.LatLng(data.path[data.idx].lat, data.path[data.idx].lng));
          }
        })

        .on('polyline deleted', (data) => {
          // Delete a polyline:
          self.polylines[data.polyline].setMap(null);
          self.polylines.splice(data.polyline, 1);
          self.path = data.path;
        });

      // Create a tutorial modal:
      function TutorialModal(type) {
        var fragment = document.createDocumentFragment();
        var modal = document.createElement('div');
        var p = document.createElement('p');
        var button = document.createElement('button');

        modal.classList.add('tutorial-modal');
        fragment.appendChild(modal);

        if (type == 'startMarker') {
          p.innerHTML = 'Klik op de map om een <strong>start positie</strong> te maken';
        } else if (type == 'polyline') {
          p.innerHTML = 'Klik op de map om een <strong>lijn aan de route</strong> toe te voegen';
        }

        modal.appendChild(p);

        button.classList.add('close-btn');
        button.innerHTML = '&times;';
        modal.appendChild(button);
        document.body.appendChild(fragment);

        button.addEventListener('click', (e) => {
          this.close(modal);
          e.preventDefault();
        });
      }

      TutorialModal.prototype.close = function (modal) {
        modal.parentNode.removeChild(modal);
        self.tutorialModal = undefined;
      }

      // Create the delete menu:
      function DeleteMenu(polyline, latLng) {
        var neBoundInPx = self.map.getProjection().fromLatLngToPoint(bounds.ne);
        var swBoundInPx = self.map.getProjection().fromLatLngToPoint(bounds.sw);
        var worldPoint = self.map.getProjection().fromLatLngToPoint(latLng);
        var point = new google.maps.Point((worldPoint.x - swBoundInPx.x) * scale, (worldPoint.y - neBoundInPx.y) * scale);
        var button = document.createElement('button');

        button.classList.add('delete-menu');
        button.type = 'button';
        button.textContent = 'Verwijderen';
        button.style.left = (point.x + 10) + 'px';
        button.style.top = (point.y + 10) + 'px';
        document.body.appendChild(button);

        google.maps.event.addDomListener(button, 'click', (e) => {
          namespace.emit('delete polyline', {
            polyline: self.polylines.indexOf(polyline),
            latLngs: polyline.getPath().i
          });
          this.close(e.target);
          e.preventDefault();
        });

        google.maps.event.addListener(self.map, 'click', (e) => {
          this.close(button);
        });
      }

      // Close the delete menu:
      DeleteMenu.prototype.close = function (elem) {
        elem.parentNode.removeChild(elem);
      }
    }
    document.head.appendChild(script);
  }
};
