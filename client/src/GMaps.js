let startautoComplete;
let destautoComplete;
let geocoder;
let directionsService;

// Places API - Autcomplete
export const loadScript = (url, callback) => {
  let script = document.createElement("script");
  script.type = "text/javascript";

  if (script.readyState) {
    script.onreadystatechange = function() {
      if (script.readyState === "loaded" || script.readyState === "complete") {
        script.onreadystatechange = null;
        callback();
      }
    };
  } else {
    script.onload = () => callback();
  }

  script.src = url;
  document.getElementsByTagName("head")[0].appendChild(script);
};

export const handleScriptLoad = (setRouteForm) => {
  // Autocomplete for start location
  startautoComplete = new window.google.maps.places.Autocomplete(
    document.getElementById("source"),
    { types: ["address"], componentRestrictions: { country: "us" } }
  );
  startautoComplete.setFields(["address_components", "formatted_address"]);
  startautoComplete.addListener("place_changed", () => handleStartSelect(setRouteForm));

  // Autocomplete for dest location
  destautoComplete = new window.google.maps.places.Autocomplete(
    document.getElementById("destination"),
    { types: ["address"], componentRestrictions: { country: "us" } }
  );
  destautoComplete.setFields(["address_components", "formatted_address"]);
  destautoComplete.addListener("place_changed", () => handleDestinationSelect(setRouteForm));
}

const handleStartSelect = async(setRouteForm) => {
  const addressObject = startautoComplete.getPlace()
  setRouteForm({start:addressObject.formatted_address, dest: document.getElementById("destination").value}) ;
  // console.log(addressObject);
}

const handleDestinationSelect = async(setRouteForm) => {
  const addressObject = destautoComplete.getPlace()
  setRouteForm({start: document.getElementById("source").value, dest:addressObject.formatted_address}) ;
  // console.log(addressObject);
}

//Geocoding
export const geocodeLocation = async(address) => {
  geocoder = new window.google.maps.Geocoder();

  try {
    const result =  await geocoder.geocode({ 'address': address });
    return ({ lng: result.results[0].geometry.location.lng(), 
              lat: result.results[0].geometry.location.lat() }); 
  } catch (err) {
    console.error(err);
    return { lat: 35, lng: -105};
  }
}

//Directions API
export const getDirections = async(routeForm) => {
  directionsService = new window.google.maps.DirectionsService();
  if (!routeForm.start || !routeForm.dest || !routeForm.start.length || !routeForm.dest.length) {
   return null;
  }

  const result =  await directionsService.route({
                            origin: { query: routeForm.start, },
                            destination: { query: routeForm.dest, },
                            travelMode: window.google.maps.TravelMode.DRIVING,
                            provideRouteAlternatives: true
                  });
  return result;
}
