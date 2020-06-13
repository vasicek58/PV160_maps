<template>
  <div>
    <div id="map">
      <MglMap :accessToken="accessToken" :mapStyle="mapStyle" @load="onMapLoaded"/>
    </div>
    <div>
      <img :src="colorMapImg" id="map-color-legend">
    </div>
    <h3 class='time-legend' id="time1">{{time1}}</h3><h3 class='time-legend' id="time2">{{time2}}</h3>
  </div>
</template>

<script>
import Mapbox from "mapbox-gl";
import { MglMap } from "vue-mapbox";

export default {
  name: 'MyMap',
  components: {
    MglMap
  },
  props: {

    /**
     * Expected trajectory data format:
     * 
     * {  name: name of the dataset (string), 
     *    lat: starting point (float), 
     *    lon: starting point (float), 
     *    geojson: array of geojson objects, one for each trajectory (see below)  }
     * 
     * geojson = {
     *      type: 'FeatureCollection',
     *      features: [{              <- only one feature for each trajectory expected, accessed always as features[0]
     *        type: 'Feature',
     *        properties: {
     *          name: '',             <- a string identifier
     *          time: []              <- array of timestamps (millisec. since 1. 1. 1970)
     *        },
     *        geometry: {
     *          coordinates: [],      <- array of coordiates corresponding to the timestamps, in the format [[lon, lat], ... ]
     *          type: 'LineString'
     *        },
     *      }]
     *    }
     */

    trajectories: {
      required: true,
      default: null
    },

    /**
     * D3 color mapping function, see https://github.com/d3/d3-scale-chromatic (use the d3.interpolate* functions)
     */
    colorMap: {
      type: Function,
      required: true 
    },

    /**
     * URL to the color map image, such as https://raw.githubusercontent.com/d3/d3-scale-chromatic/master/img/RdYlGn.png
     */
    colorMapImg: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      accessToken: 'pk.eyJ1IjoiamF5dmFzNTgiLCJhIjoiY2s4YzBsdHpxMDluczNmbnJlbDl6MnI5bSJ9.jmbb2fYiFBHMLVy0Pq1XKA',
      mapStyle: 'mapbox://styles/mapbox/streets-v11',
      //datapoint: null,
      marker: null,
      time1: "",
      time2: ""
    };
  },
  watch: {
    trajectories: function() {
      this.dataChanged();
    }
  },
  methods: {
    onMapLoaded(evt) {

      //  store the map object to be able to manipulate it later
      //  it cannot be stored as this.map, because tha would make the map component reactive and it would break
      //  see https://stackoverflow.com/questions/50824353/mapbox-style-changes-breaks-on-zoom-when-a-layer-is-added
      
      //  this is the way to make it non-reactive and still be able to access and manipulate it
      //  https://stackoverflow.com/questions/45814507/how-to-set-a-component-non-reactive-data-in-vue-2
      this.$options.map = evt.map;

      //this.$options.map.on('click', 'line', );
    },

    // mouse interaction event to show tooltip
    lineClicked(trajectories, e) {

      // find the segment on which the clicked point lies
      let lambda = -1, segment = -1;
      let l = Number.parseInt(e.features[0].source.slice(4));

      let times = trajectories.geojson[l].features[0].properties.time;
      let coords = trajectories.geojson[l].features[0].geometry.coordinates;

      // find the nearest point -- determine which segment is the most suitable
      let min_dist = Number.MAX_VALUE, min_idx = -1;
      for (let pt=0; pt < coords.length; pt++) {
        let d = e.lngLat.distanceTo(new this.mapbox.LngLat(coords[pt][0], coords[pt][1]));

        if (d < min_dist) {
          min_dist = d;
          min_idx = pt;
        }
      }

      let param1 = 2, param2 = 100, param3 = 2, param4 = 100;

      if (min_idx > 0) {
        param1 = (e.lngLat.lng - coords[min_idx][0]) / (coords[min_idx-1][0] - coords[min_idx][0]);
        param2 = (e.lngLat.lat - coords[min_idx][1]) / (coords[min_idx-1][1] - coords[min_idx][1]);
      }
      if (min_idx < coords.length-1) {
        param3 = (e.lngLat.lng - coords[min_idx+1][0]) / (coords[min_idx][0] - coords[min_idx+1][0]);
        param4 = (e.lngLat.lat - coords[min_idx+1][1]) / (coords[min_idx][1] - coords[min_idx+1][1]);
      }

      if (((param3 < 0 && param4 < 0) || (param3 > 1 && param4 > 1)) || Math.abs(param1 - param2) < Math.abs(param3 - param4)) {
        lambda = (param1 + param2) / 2;
        segment = min_idx;
      } else {
        lambda = (param3 + param4) / 2;
        segment = min_idx+1;
      }

      // interpolate time
      let time_interpolated = Math.round(times[segment-1] * lambda + times[segment] * (1 - lambda));

      //console.log('Line ' + l + ', coef: ' + coef_1 + ': ' +  new Date(times[idx_1]))

      if (Object.prototype.hasOwnProperty.call(this.$options, 'popup')) {
        this.$options.popup.remove();
      } 

      this.$options.popup = new this.mapbox.Popup()
              .setLngLat(e.lngLat)
              .setHTML('<h3>' + trajectories.geojson[l].features[0].properties.name.replace('_', ' ') + '</h3>' + new Date(time_interpolated))
              .addTo(this.$options.map);
    },

    /**
     * Checks if two line segments are intersecting and if so, returns a structure of additional elements for the line segment algorithm
     */
    checkIntersection(seg1, seg2) {

      let a = seg1.start;
      let b = seg1.end;
      let c = seg2.start;
      let d = seg2.end;

      let denom = (a.y - b.y) * (c.x - d.x) - (a.x - b.x) * (c.y - d.y);

      if (denom == 0) return null;

      let lambda = ((b.x - d.x) * (c.y - d.y) + d.y * (c.x - d.x) - b.y * (c.x - d.x)) / denom;
      let mu = (lambda * (a.x - b.x) + b.x - d.x) / (c.x - d.x);

      // this skips cases where the intersecting point is an endpoint of one fo the segments
      if (lambda <= 0.00001 || lambda >= 0.99999  || mu <= 0.00001 || mu >= 0.99999 ) {
        return null;
      }

      let x = lambda * a.x + (1 - lambda) * b.x;
      let y = lambda * a.y + (1 - lambda) * b.y;
      
      let newSeg1 = {
        start: null,
        end: b,
        id: seg1.id + '_1'
      }

      let newSeg2 = {
        start: null,
        end: d,
        id: seg2.id + '_1'
      }

      let int1 = {
        x: x,
        y: y,
        role: 'end',
        seg: seg1,
        intersecting: seg1.id + "+" + seg2.id,
        lambda: lambda,
        mu: mu
      }
      let int2 = {
        x: x,
        y: y,
        role: 'end',
        seg: seg2
      }
      let int3 = {
        x: x,
        y: y,
        role: 'start',
        seg: newSeg1
      }
      let int4 = {
        x: x,
        y: y,
        role: 'start',
        seg: newSeg2
      }

      seg1.id = seg1.id + '_0';
      seg2.id = seg2.id + '_0';
      seg1.end = int1;
      seg2.end = int2;
      newSeg1.start = int3;
      newSeg2.start = int4;

      return {
        newSeg1: newSeg1,
        newSeg2: newSeg2,
        point1: int1,
        point2: int2,
        point3: int3, 
        point4: int4
      };
    },

    /**
     * Returns an array of intersection points computed using the sweep line algorithm.
     * Each intersection point contains: 
     * 
     * x - longitude
     * y - latitude
     * intersecting - a string containing ids of the two segments that are intersecting, separated by '+'
     * lambda - position in the first segment (between 0 and 1)
     * mu - position in the second segment (between 0 and 1)  
     */
    getSegmentIntersections() {
      var points = [];
      //var segments = [];
      var intersections = [];
      
      // make sure that we don't cross the 180 degrees longitude (changes into -180 -> would not be comparable)
      // if we have a point at longitude greater than 140 degrees and we find another with longitude < 0, I assume the 180 line has been crossed
      // this will not work if there is a trajectory crossing half of the planet, but I assume this will not happen
      var lonOver140 = false;

      this.trajectories.geojson.forEach(geojson => {
        geojson.features[0].geometry.coordinates.forEach(coord => {
          lonOver140 = lonOver140 || coord[0] > 140;
        });
      });

      this.trajectories.geojson.forEach(geojson => {
        let coords = geojson.features[0].geometry.coordinates;
        for (let c = 1; c < coords.length; c++) {
          let lon0 = coords[c-1][0];
          let lon1 = coords[c][0];
          let lat0 = coords[c-1][1];
          let lat1 = coords[c][1];

          if (lonOver140 && lon1 < 0) {
            lon1 += 360; 
          } 
          if (lonOver140 && lon0 < 0 ) {
            lon0 += 360;
          }

          // need to have the start and end set correctly (north->south, east->west)
          if (lat0 < lat1 || (lat0 == lat1 && lon0 > lon1)) {
            let tmp = lat1;
            lat1 = lat0;
            lat0 = tmp;

            tmp = lon1;
            lon1 = lon0;
            lon0 = tmp;
          }          

          let segment = {
            start: null,
            end: null,
            id: geojson.features[0].properties.name + '_' + (c)
          } 

          let pt0 = {
            x: lon0,
            y: lat0,
            role: 'start',
            seg: segment
          }
            
          let pt1 = {
            x: lon1,
            y: lat1,
            role: 'end',
            seg: segment 
          }

          segment.start = pt0;
          segment.end = pt1;

          points.push(pt0);
          points.push(pt1);
          //segments.push(segment);
        }
      });

      /*
      just some testing data for debugging, I'll leave those here
      let s1 = {
        start: null,
        end: null,
        id: 's1'
      }
      let s2 = {
        start: null,
        end: null,
        id: 's2'
      }
      let s3 = {
        start: null,
        end: null,
        id: 's3'
      }
      let s4 = {
        start: null,
        end: null,
        id: 's4'
      }
      let s5 = {
        start: null,
        end: null,
        id: 's5'
      }

      let p1 = {
        x: 3,
        y: 10,
        role: 'start',
        seg: s1
      }
      let p2 = {
        x: 1,
        y: 5,
        role: 'end',
        seg: s1
      }
      
      let p3 = {
        x: 3,
        y: 10,
        role: 'start',
        seg: s2
      }
      let p4 = {
        x: 4,
        y: 3,
        role: 'end',
        seg: s2
      }

      let p5 = {
        x: 5,
        y: 9,
        role: 'start',
        seg: s3
      }
      let p6 = {
        x: 9,
        y: 5,
        role: 'end',
        seg: s3
      }
      
      let p7 = {
        x: 8,
        y: 8,
        role: 'start',
        seg: s4
      }
      let p8 = {
        x: 6,
        y: 4,
        role: 'end',
        seg: s4
      }
      
      let p9 = {
        x: 0,
        y: 6,
        role: 'start',
        seg: s5
      }
      let p10 = {
        x: 20,
        y: 6,
        role: 'end',
        seg: s5
      }

      s1.start = p1;
      s1.end = p2;
      s2.start = p3;
      s2.end = p4;
      s3.start = p5;
      s3.end = p6;
      s4.start = p7;
      s4.end = p8;
      s5.start = p9;
      s5.end = p10;

      points = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10];*/

      points.sort((a,b) => {
        if (a.y == b.y) { 
          if (a.x == b.x) {
            if (a.role == 'start' && b.role == 'end') return 1;
            else if (b.role == 'start' && a.role == 'end') return -1;
            else return 0;
          }
          return a.x - b.x;
        }
        else return b.y - a.y;
      });

      let activeSegments = [];

      for (let i=0; i < points.length; i++) {
        if (points[i].role == 'start') {
          let seg_idx = activeSegments.findIndex(elem => {
            return elem.start.x > points[i].x;
          });

          if (seg_idx == -1) {
            activeSegments.push(points[i].seg);
          } else {
            activeSegments.splice(seg_idx, 0, points[i].seg);
          }
        } else {
          let seg_idx = activeSegments.findIndex(elem => {
            return elem.id == points[i].seg.id;
          });

          if (seg_idx != -1) {
            activeSegments.splice(seg_idx, 1);
          }
        }

        for (let s=1; s < activeSegments.length; s++) {
          let intersection = this.checkIntersection(activeSegments[s-1], activeSegments[s]);

          if (intersection) {
            intersections.push(intersection.point1);

            let point_idx = points.findIndex(pt => {
              if (pt.y == intersection.point1.y) return pt.x > intersection.point1.x;
              else return pt.y < intersection.point1.y;
            });

            // point_idx should never be -1
            points.splice(point_idx, 0, intersection.point1, intersection.point2, intersection.point3, intersection.point4);
          }
        }
      }

      return intersections;
    },

    addIntersectionMarkers() {
      var features = [];

      this.intersections.forEach(intersection => {      

        let feature = {
          type: 'feature',
          properties: {
            title: 'Intersection',
            'marker-color': '#f86767',
            'marker-size': 'small',
            intersecting: intersection.intersecting,
            lambda: intersection.lambda,
            mu: intersection.mu
          },
          geometry: {
            type: 'Point',
            coordinates: [intersection.x, intersection.y]
          }
        }

        features.push(feature);
      });

      let geojson = {
        type: 'FeatureCollection',
        features: features
      }

      if (Object.prototype.hasOwnProperty.call(this, 'intersID')) {
        this.$options.map.removeLayer(this.intersID);
        this.$options.map.removeSource(this.intersID);
        }

      this.intersID = 'intersections';

      this.$options.map.addSource(this.intersID, {
        type: 'geojson',
        lineMetrics: false,
        data: geojson
      });

      this.$options.map.addLayer({
        'id': this.intersID,
        'type': 'circle',
        'source': this.intersID,
        'paint': {
          'circle-radius': {
            'base': 4.75,
            'stops': [
              [12, 5],
              [22, 10]
            ]
          },
          'circle-color': 'white'
        }
      });
      
      this.$options.map.on('click', this.intersID, (e) => {
        let ids = e.features[0].properties.intersecting.split('+');
        let l1 = Number.parseInt(ids[0].split('_')[1]);
        let seg1 = Number.parseInt(ids[0].split('_')[2]);
        let l2 = Number.parseInt(ids[1].split('_')[1]);
        let seg2 = Number.parseInt(ids[1].split('_')[2]);

        let line1 = this.trajectories.geojson[l1].features[0];
        let line2 = this.trajectories.geojson[l2].features[0];

        // interpolate times
        let a = line1.geometry.coordinates[seg1-1];
        let b = line1.geometry.coordinates[seg1];
        let c = line2.geometry.coordinates[seg2-1];
        let d = line2.geometry.coordinates[seg2];
        
        let lambda = e.features[0].properties.lambda;
        let mu = e.features[0].properties.mu;

        if (a[1] < b[1] || (a[1] == b[1] && a[0] > b[0])) {
          lambda = 1 - lambda;
        }
        if (c[1] < d[1] || (c[1] == d[1] && c[0] > d[0])) {
          mu = 1 - mu;
        }

        let t1 = lambda * line1.properties.time[seg1-1] + (1 - lambda) * line1.properties.time[seg1];
        let t2 = mu * line2.properties.time[seg2-1] + (1 - mu) * line2.properties.time[seg2];

        let times = [{name: line1.properties.name, t: t1}, {name: line2.properties.name, t: t2}];

        times.sort((a,b) => {return a.t - b.t});
        let timeDiff = times[1].t - times[0].t;
        let diffDate = new Date(timeDiff);

        let popupHTML = '<p>' + times[0].name.replace('_', ' ') + ': ' + new Date(times[0].t).toLocaleString() + '</p><p>' 
                        + times[1].name.replace('_', ' ') + ': + ' + diffDate.getHours() + 'h ' + diffDate.getMinutes() + 'm ' + diffDate.getSeconds() + 's</p>';

        if (Object.prototype.hasOwnProperty.call(this.$options, 'popup')) {
          this.$options.popup.remove();
        } 

        this.$options.popup = new this.mapbox.Popup()
                .setLngLat(e.lngLat)
                .setHTML(popupHTML)
                .addTo(this.$options.map);
      });

      //this.$options.intersectionLayer = this.mapbox.featureLayer().addTo(this.$options.map);
      //this.$options.intersectionLayer.setGeoJSON(geojson);
    },

    /**
     * Run this every time the data change
     */
    dataChanged() {

      if (Object.prototype.hasOwnProperty.call(this.$options, 'map')) {

        // get minimum and maximum time of all the trajectories
        let mins = [], maxes = [];
        this.trajectories.geojson.forEach((geojson) => {
          mins.push(Math.min(...geojson.features[0].properties.time));
          maxes.push(Math.max(...geojson.features[0].properties.time));
        });

        var minTime = Math.min(...mins);
        var maxTime = Math.max(...maxes);

        this.time1 = new Date(minTime).toLocaleString();
        this.time2 = new Date(maxTime).toLocaleString();

        // fly the map to the new location
        this.$options.map.flyTo({
          center: [
            this.trajectories.lon,
            this.trajectories.lat
          ],
          zoom: 10.5,
          essential: true
        });

        // if there was something shown before, remove it

        if (Object.prototype.hasOwnProperty.call(this, 'lineIDs')) {

          this.lineIDs.forEach((lid) => {
            this.$options.map.removeLayer(lid);
            this.$options.map.removeSource(lid);
          });
        }

        this.lineIDs = [];

        // iterate through all lines, add each as separate layer

        for (let l=0; l < this.trajectories.geojson.length; l++) {

          console.log('Line ' + l);

          this.lineIDs[l] = 'line' + l;

          this.$options.map.on('click', this.lineIDs[l], (evt) => this.lineClicked(this.trajectories, evt));

          // add new data source
          this.$options.map.addSource(this.lineIDs[l], {
            type: 'geojson',
            lineMetrics: true,
            data: this.trajectories.geojson[l]
          });

          // set up the color interpolation 
          var lineGradient = [ 'interpolate', ['linear'], ['line-progress']];
          var prevT1 = 0, prevT2 = 0;

          // count lengths of segments and the total distance
          let distanceTraveled = 0, totalDistance = 0;
          let segmentLengths = [];
          for (let i=1; i < this.trajectories.geojson[l].features[0].geometry.coordinates.length; i++) {
            let lon0 = this.trajectories.geojson[l].features[0].geometry.coordinates[i-1][0];
            let lat0 = this.trajectories.geojson[l].features[0].geometry.coordinates[i-1][1];
            let lon1 = this.trajectories.geojson[l].features[0].geometry.coordinates[i][0];
            let lat1 = this.trajectories.geojson[l].features[0].geometry.coordinates[i][1];

            let lngLat0 = new this.mapbox.LngLat(lon0, lat0);

            let dist = lngLat0.distanceTo(new this.mapbox.LngLat(lon1, lat1));

            totalDistance += dist;
            segmentLengths.push(dist);

            let time0 = this.trajectories.geojson[l].features[0].properties.time[i-1];
            let time1 = this.trajectories.geojson[l].features[0].properties.time[i];

            console.log('[' + lon0 + '; ' + lat0 + '] -> [' + lon1 + '; ' + lat1 + ']: ' + new Date(time0) + " -> " + new Date(time1));
          }

          for (let i=0; i < this.trajectories.geojson[l].features[0].geometry.coordinates.length; i++) {
            let tCurrent = this.trajectories.geojson[l].features[0].properties.time[i];

            if (i > 0) {
              distanceTraveled += segmentLengths[i-1];
            }

            // distance on the trajectory (mapped to [0, 1])
            let t1 = distanceTraveled / totalDistance; 

            // "distance" on the color map, based on the cuurent timestamp relative to the total time range (mapped to [0, 1])
            let t2 = (tCurrent - minTime) / (maxTime - minTime);

            if (t1 != 0) {
              if (t2 - prevT2 > 0.01) {
                let t1_2 = (t1 + prevT1) / 2;
                let t2_2 = (t2 + prevT2) / 2;

                lineGradient.push(t1_2);
                lineGradient.push(this.colorMap(t2_2));
              }
            }

            prevT1 = t1;
            prevT2 = t2;

            lineGradient.push(t1);
            lineGradient.push(this.colorMap(t2));
          }

          // add a layer to show the trajectory
          this.$options.map.addLayer({
            type: 'line',
            source: this.lineIDs[l],
            id: this.lineIDs[l],
            paint: {
              'line-color': 'red',
              'line-width': 14,
              // 'line-gradient' must be specified using an expression
              // with the special 'line-progress' property
            'line-gradient': lineGradient
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          }
          });
        }

        this.intersections = this.getSegmentIntersections();

        if (this.intersections.length > 0) this.addIntersectionMarkers();
      }
    }
  },

  created() {
    // We need to set mapbox-gl library here in order to use it in template
    this.mapbox = Mapbox;
  }
};
</script>

<style>
#map {
  width: 30vw;
  height: 50vh;
}

#map-color-legend {
  width:30vw;
  height:2.5vh;
  margin-top: 10px;
}

.time-legend{
  display: inline;
}

#time2 {
  text-align: right;
  margin-left: 11vw;
}

.marker {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
}

</style>
