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

      // Select the start position of the trip:
      google.maps.event.addListener(self.map, 'click', (e) => {
        self.path.push(e.latLng);

        if (!self.startMarker) {
          self.startMarker = new google.maps.Marker({
            position: e.latLng,
            map: self.map,
            icon: {
              url: '/images/icons/start_point.svg',
              scaledSize: new google.maps.Size(60,60),
              anchor: new google.maps.Point(30,55)
            }
          });
        } else if (!self.finishMarker) {
          var polyline = new google.maps.Polyline({
            path: self.path.slice(self.path.length-2),
            geodesic: true,
            strokeColor: '#B3008C',
            strokeOpacity: 1,
            strokeWeight: 8,
            map: self.map
          });
          self.polylines.push(polyline);
        }
      });

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
