import cursor from './cursor.js';

export default {
  'PUBLIC_KEY': 'AIzaSyDvdEQGcYau4ARuX1911u9d34CYPNaWn4k',
  startBtn: document.querySelector('.start-btn'),
  path: [],
  polylines: [],
  snappedCoordinates: [],
  runSnapToRoad: function (path) {
    var pathValues = [];
    for (var i = 0; i < path.length; i++) {
      pathValues.push(path[i].toUrlValue());
    }

    var url = 'https://roads.googleapis.com/v1/snapToRoads?path='
      + pathValues.join('|')
      + '&interpolate=true&key='
      + this['PUBLIC_KEY'];

    fetch (url)
      .then(res => res.json())
      .then(data => {
        this.processSnapToRoadResponse(data);
        this.drawSnappedPolyline();
      })
      .catch(err => {
        console.log(err);
      });
  },
  processSnapToRoadResponse: function (data) {
    this.snappedCoordinates = [];
    for (var i = 0; i < data.snappedPoints.length; i++) {
      var latlng = new google.maps.LatLng(
        data.snappedPoints[i].location.latitude,
        data.snappedPoints[i].location.longitude
      );
      this.snappedCoordinates.push(latlng);
    }

    // Add finish marker:
    this.finishMarker = new google.maps.Marker({
      position: this.snappedCoordinates[this.snappedCoordinates.length-1],
      map: this.map,
      icon: {
        url: '/images/icons/finish_point.svg',
        scaledSize: new google.maps.Size(60,60)
      }
    });
  },
  drawSnappedPolyline: function () {
    var snappedPolyline = new google.maps.Polyline({
      path: this.snappedCoordinates,
      strokeColor: '#B3008C',
      strokeOpacity: 1,
      strokeWeight: 8,
      map: this.map
    });
  },
  initMap: function (namespace) {
    // Create the script tag:
    var self = this;
    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + this['PUBLIC_KEY'] + '&callback=initMap&libraries=drawing';
    script.defer = true;
    script.async = true;

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
        // namespace.emit('edit route', e.latLng);

        // Push the latest coords of the route in the path array:
        self.path.push(e.latLng);

        // Select the start position of the trip on first click or add a polyline to the route:
        if (!self.startMarker) {
          self.startMarker = new google.maps.Marker({
            position: e.latLng,
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
            self.path.splice(0, 1, e.latLng);
          });

        } else if (!self.finishMarker) {
          var polyline = new google.maps.Polyline({
            path: self.path.slice(self.path.length-2),
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
            if (polyline.getPath().i.indexOf(e.latLng) !== -1) {
              polylineIdx = polyline.getPath().i.indexOf(e.latLng);
              idx = self.path.indexOf(e.latLng);
            } else {
              polylineIdx = e.edge + 1;
              idx = self.path.indexOf(polyline.getPath().i[polylineIdx]);
            }
          });

          // Update the path array with new latLng coords if a polyline has an edit:
          google.maps.event.addListener(polyline, 'mouseup', (e) => {
            if (e.vertex == undefined && e.edge == undefined) return;
            var remove = e.vertex >= 0 ? 1 : 0;
            self.path.splice(idx, remove, polyline.getPath().i[polylineIdx]);

            // Move startMarker if first vertex has been moved:
            if (self.path.indexOf(e.latLng) == 0) {
              self.startMarker.setPosition(e.latLng);
            }
          });

          // When client clicks the undo button after altering the polyline, coords won't be updated again (!)
          // Either remove this option or work out the problem

          // Option to delete polyline:
          google.maps.event.addListener(polyline, 'click', (e) => {
            var deleteMenu = new DeleteMenu(polyline, e.latLng);
          });
        }
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
          this.deletePolyline(polyline);
          this.close(e.target);
          e.preventDefault();
        });
      }

      // Delete the polyline:
      DeleteMenu.prototype.deletePolyline = function (polyline) {
        for (var i = 1; i < polyline.getPath().i.length; i++) {
          self.path.splice(self.path.indexOf(polyline.getPath().i[i]), 1);
        }
        self.polylines.splice(self.polylines.indexOf(polyline), 1);
        polyline.setMap(null);
      }

      // Close the delete menu:
      DeleteMenu.prototype.close = function (elem) {
        elem.parentNode.removeChild(elem);
      }

      // Run snapToRoads when clicking start:
      google.maps.event.addDomListener(self.startBtn, 'click', (e) => {
        // Run snapToRoads:
        if (self.path.length > 1) self.runSnapToRoad(self.path);

        // Remove old polylines:
        self.polylines.forEach(polyline => polyline.setMap(null));

        e.preventDefault();
      });
    }
    document.head.appendChild(script);
  }
};
