export default {
  'PUBLIC_KEY': 'AIzaSyDvdEQGcYau4ARuX1911u9d34CYPNaWn4k',
  polylines: [],
  placeIdArray: [],
  snappedCoordinates: [],
  runSnapToRoad: function (path) {
    var pathValues = [];
    for (var i = 0; i < path.getLength(); i++) {
      pathValues.push(path.getAt(i).toUrlValue());
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
    this.placeIdArray = [];
    for (var i = 0; i < data.snappedPoints.length; i++) {
      var latlng = new google.maps.LatLng(
        data.snappedPoints[i].location.latitude,
        data.snappedPoints[i].location.longitude
      );
      this.snappedCoordinates.push(latlng);
      this.placeIdArray.push(data.snappedPoints[i].placeId);
    }
  },
  drawSnappedPolyline: function () {
    var snappedPolyline = new google.maps.Polyline({
      path: this.snappedCoordinates,
      strokeColor: '#B3008C',
      strokeWeight: 8,
      strokeOpacity: 1
    });

    snappedPolyline.setMap(this.map);
    this.polylines.pop();
    this.polylines.push(snappedPolyline);
  },
  initMap: function () {
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
        var worldPoint = new google.maps.Point(700 / scale + swBoundInPx.x, 500 / scale + neBoundInPx.y);
        var latlng = self.map.getProjection().fromPointToLatLng(worldPoint);

        console.log(latlng.lat(), latlng.lng());
      });

      // Draw polyline manager:
      self.drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.POLYLINE,
        drawingControl: true,
        drawingControlOptions: {
          position: google.maps.ControlPosition.TOP_CENTER,
          drawingModes: [
            google.maps.drawing.OverlayType.POLYLINE
          ]
        },
        polylineOptions: {
          strokeColor: '#B3008C',
          strokeWeight: 6,
          strokeOpacity: .3
        }
      });
      self.drawingManager.setMap(self.map);

      // Snap-to-road after drawing polyline:
      self.drawingManager.addListener('polylinecomplete', (poly) => {
        var path = poly.getPath();
        self.polylines.push(poly);
        self.placeIdArray = [];
        self.runSnapToRoad(path);
        poly.setMap(null);
      });
    }
    document.head.appendChild(script);
  }
};
