<template>
  <div id="app">
   <!--  <img alt="Vue logo" src="./assets/logo.png"> -->
    <div id="contents">
      <h2 v-if="shown_idx != -1">Trajectory of {{ all_data[shown_idx].name }}</h2>
      <MyMap ref="mymap"></MyMap>
      <button id='btn-change' @click="changeData">Change data</button>
    </div>
  </div>
</template>

<script>
import MyMap from './components/MyMap.vue' 
//import * as d3 from "d3";

export default {
  name: 'App',
  components: {
    MyMap
  },
  data() {
    return {
      all_data: [],
      shown_idx: -1
    }
  },
  methods: {
    parse_csv(data_text) {
        console.log("Parsing");
        var date = new Date();

        this.all_data = global.d3.csvParse(data_text, (d) => {
          global.noise.seed(Math.random());
          
          // generate a random trajectory with time data as a geojson object
          
          let time = date.getTime() + Math.round(Math.random() * 10000);
          let current_lat = parseFloat(d.lat);
          let current_lon = parseFloat(d.lon);
          let name = d.nickname.charAt(0).toUpperCase() + d.nickname.slice(1) + " " + d.name.split(",")[0].split("(")[0];

          let geojson = {
            'type': 'FeatureCollection',
            'features': [{
              'type': 'Feature',
              'properties': {
                'name': name,
                'time': []
              },
              'geometry': {
                'coordinates': [],
                'type': 'LineString'
              },
            }]
          };

          for (var i=0; i < 30; i++) {
            current_lat += global.noise.simplex2(1, i/6.0) * 0.01 - 0.005;
            current_lon += global.noise.simplex2(i/6.0, 1) * 0.01 - 0.005;

            time += Math.round(Math.random() * 100000) + 50000;

            geojson['features'][0]['properties']['time'].push(time);
            geojson['features'][0]['geometry']['coordinates'].push([current_lon, current_lat]);
          }

          // save it
          return {
              id: parseInt(d.id),
              name: name,
              lat: parseFloat(d.lat),
              lon: parseFloat(d.lon),
              geojson: geojson
          }
        });

        console.log("Parsed");
    },

    load_data() {
        var client = new XMLHttpRequest();
        var data_text = "";
        client.open('GET', '/data/MOCK_DATA.csv');
        client.onreadystatechange = () => {
            if(client.responseText.length != 0 && this.all_data.length == 0) {
                data_text = client.responseText;
                this.parse_csv(data_text);
            }
        }
        client.send();
    } ,

    changeData() {
      this.shown_idx = Math.floor(Math.random() * this.all_data.length);
      this.$refs.mymap.setData(this.all_data[this.shown_idx]);
    }
  },

  mounted() {
    this.load_data();
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

#contents {
  text-align: left;
}
</style>
