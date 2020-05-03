import cursor from './cursor.js';

export default {
  'PUBLIC_KEY': 'AIzaSyDvdEQGcYau4ARuX1911u9d34CYPNaWn4k',
  path: [],
  polylines: [],
  initMap: function (namespace) {
    // Create the script tag:
    var self = this;
    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + this['PUBLIC_KEY'] + '&callback=initMap&libraries=drawing';
    script.defer = true;
    script.async = true;

    // Init Google Maps function:
    window.initMap = function () {
      var map = document.getElementById('map');
      var bounds;
      var scale = Math.pow(2, 17);

      // Init the map:
      self.map = new google.maps.Map(map, {
        center: { lat: 52.369270, lng: 4.909590 },
        zoom: 17
      });

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

      function addRouteSegment(path) {
        self.path = path;
        if (path.length > 0 && !self.startMarker) {
          self.startMarker = new google.maps.Marker({
            position: path[0],
            map: self.map,
            draggable: true,
            icon: {
              url: '/images/icons/start_point.svg',
              scaledSize: new google.maps.Size(60,60),
              anchor: new google.maps.Point(30,55)
            }
          });

          // Option to move startpoint:
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
        }

        if (path.length > 1) {
          var polyline = new google.maps.Polyline({
            path: path.slice(path.length-2),
            map: self.map,
            geodesic: true,
            editable: true,
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
            var deleteMenu = new DeleteMenu(polyline, e.latLng);
          });
        }
      }
      // addRouteSegment(self.path);

      // Calculate latLng from point on screen:
      google.maps.event.addDomListener(map, 'mousemove', (e) => {
        var neBoundInPx = self.map.getProjection().fromLatLngToPoint(bounds.ne);
        var swBoundInPx = self.map.getProjection().fromLatLngToPoint(bounds.sw);
        var worldPoint = new google.maps.Point(e.clientX / scale + swBoundInPx.x, e.clientY / scale + neBoundInPx.y);
        var latlng = self.map.getProjection().fromPointToLatLng(worldPoint);

        namespace.emit('cursor move', latlng);
      });

      // Calculate point on screen from latLng:
      namespace
        .on('change cursor', (client) => {
          var neBoundInPx = self.map.getProjection().fromLatLngToPoint(bounds.ne);
          var swBoundInPx = self.map.getProjection().fromLatLngToPoint(bounds.sw);
          var latlng = new google.maps.LatLng(client.latlng);
          var worldPoint = self.map.getProjection().fromLatLngToPoint(latlng);
          var point = new google.maps.Point((worldPoint.x - swBoundInPx.x) * scale, (worldPoint.y - neBoundInPx.y) * scale);

          cursor.changeCursorPosition(client.id, point);
        });

      // Broadcast when a client clicks on the map:
      google.maps.event.addDomListener(map, 'mousedown', (e) => {
        namespace.emit('cursor click', true);
      });

      // Broadcast when a client releases the click on the map:
      google.maps.event.addDomListener(map, 'mouseup', (e) => {
        namespace.emit('cursor click', false);
      });

      // Build the route when clicking on the map:
      google.maps.event.addListener(self.map, 'click', (e) => {
        namespace.emit('edit route', e.latLng);
      });

      namespace
        .on('add route segment', (path) => {
          addRouteSegment(path);
        })
        .on('change startMarker', (path) => {
          self.startMarker.setPosition(new google.maps.LatLng(path[0].lat, path[0].lng));
          if (self.polylines.length > 0) {
            self.polylines[0].getPath().i[0] = path[0];
            self.polylines[0].setPath(self.polylines[0].getPath().i);
          }
          self.path = path;
        })
        .on('change polyline', (data) => {
          self.polylines[data.polyline].setPath(data.polylinePath);
          self.path = data.path;

          if (data.idx == 0) {
            self.startMarker.setPosition(new google.maps.LatLng(data.path[data.idx].lat, data.path[data.idx].lng));
          }
        })
        .on('polyline deleted', (data) => {
          self.polylines[data.polyline].setMap(null);
          self.polylines.splice(data.polyline, 1);
          self.path = data.path;
        });

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
