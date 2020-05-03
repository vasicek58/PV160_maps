<template>
  <div id="map">
    <MglMap :accessToken="accessToken" :mapStyle="mapStyle" @load="onMapLoaded"/>
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
  data() {
    return {
      accessToken: 'pk.eyJ1IjoiamF5dmFzNTgiLCJhIjoiY2s4YzBsdHpxMDluczNmbnJlbDl6MnI5bSJ9.jmbb2fYiFBHMLVy0Pq1XKA',
      mapStyle: 'mapbox://styles/mapbox/streets-v11',
      datapoint: null,
      marker: null
    };
  },
  methods: {
    onMapLoaded(evt) {

      //  store the map object to be able to manipulate it later
      //  it cannot be stored as this.map, because tha would make the map component reactive and it would break
      //  see https://stackoverflow.com/questions/50824353/mapbox-style-changes-breaks-on-zoom-when-a-layer-is-added
      
      //  this is the way to make it non-reactive and still be able to access and manipulate it
      //  https://stackoverflow.com/questions/45814507/how-to-set-a-component-non-reactive-data-in-vue-2
      this.$options.map = evt.map;

      // add mouse interaction event to show tooltip
      this.$options.map.on('click', 'line', (e) => {

        // find two nearest points on the trajectory
        let idx_1, idx_2, idx = 0;
        let min_1 = Number.MAX_VALUE, min_2 = Number.MAX_VALUE;
        let times = JSON.parse(e.features[0].properties.time);

        e.features[0].geometry.coordinates.forEach((lngLat) => {
          let dist = e.lngLat.distanceTo(new this.mapbox.LngLat(lngLat[0], lngLat[1]));

          if (dist < min_1) {
            min_2 = min_1;
            idx_2 = idx_1;
            min_1 = dist;
            idx_1 = idx;
          } else if (dist < min_2) {
            min_2 = dist;
            idx_2 = idx;
          }

          idx++;
        });

        // interpolate time
        let coef_1 = min_1 / (min_1 + min_2);
        let coef_2 = min_2 / (min_1 + min_2);

        let time_interpolated = Math.round(times[idx_1] * coef_1 + times[idx_2] * coef_2);

        if (Object.prototype.hasOwnProperty.call(this.$options, 'popup')) {
          this.$options.popup.remove();
        } 

        this.$options.popup = new this.mapbox.Popup()
                .setLngLat(e.lngLat)
                .setHTML(new Date(time_interpolated))
                .addTo(this.$options.map);
      });
    },

    setData(data) {
      
      this.datapoint = data;  

      // fly the map to the new location
      if (Object.prototype.hasOwnProperty.call(this.$options, 'map')) {
        this.$options.map.flyTo({
          center: [
            this.datapoint.lon,
            this.datapoint.lat
          ],
          zoom: 10.5,
          essential: true
        });

        // if there was something shown before, remove it
        if (Object.prototype.hasOwnProperty.call(this, 'lineID')) {
          //this.$options.marker.remove();
          this.$options.map.removeLayer(this.lineID);
          this.$options.map.removeSource(this.lineID);
        }

        /*this.$options.marker = new Mapbox.Marker().setLngLat([
            this.datapoint.lon,
            this.datapoint.lat
        ]).addTo(this.$options.map);*/


        this.lineID = 'line';

        // add new data source
        this.$options.map.addSource(this.lineID, {
          type: 'geojson',
          lineMetrics: true,
          data: this.datapoint.geojson
        });

        // add a layer to show the trajectory
        this.$options.map.addLayer({
          type: 'line',
          source: this.lineID,
          id: this.lineID,
          paint: {
            'line-color': 'red',
            'line-width': 14,
            // 'line-gradient' must be specified using an expression
            // with the special 'line-progress' property
            'line-gradient': [
              'interpolate',
              ['linear'],
              ['line-progress'],
              0,
              'blue',
              0.1,
              'royalblue',
              0.3,
              'cyan',
              0.5,
              'lime',
              0.7,
              'yellow',
              1,
              'red'
              ]
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          }
        });
      }
    }
  },

  created() {
    // We need to set mapbox-gl library here in order to use it in template
    this.mapbox = Mapbox;
  },

  mounted() {
    //alert("baf");
  }
};
</script>

<style>
#map {
  width: 30vw;
  height: 50vh;
}

.marker {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
}

</style>
