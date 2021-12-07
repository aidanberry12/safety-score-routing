import './App.css';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Button,
  CircularProgress,
  Tooltip,
  TextField,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper
} from '@mui/material';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import HelpIcon from '@mui/icons-material/Help';
import * as d3 from 'd3';

// import { exampleGraph } from './graphs';
import { GraphComponent, severityGraph, tempGraph, visGraph, countGraph } from './graphs';
import { loadScript, handleScriptLoad, geocodeLocation, getDirections } from './GMaps';
import { initLeaflet, showRoutes, selectRoute } from './map';

// Setup `process.env`
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
});

// Get the IP of the server to make requests against, or default to a test server on localhost
const api_ip = process.env.REACT_APP_API_IP || 'http://localhost:5000';
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || 'ERROR';
const METER_TO_MILE = 0.000621371;

const graphHelp = [
  'This line graph shows when past nearby accidents ocurred.',
  'This bar graph shows how serious past nearby accidents were from 1-4, with 4 being the most severe.',
  'This bar graph shows what the temperature was at the time of past nearby accidents.',
  'This bar graph shows what the visibility was in miles at the time of past nearby accidents.'
];

function App() {
  // Used to manuallu prompt updates by updating this var
  const [updateTime, setUpdateTime] = useState(0);
  // Tracks what's typed into the main form up top
  const [routeForm, setRouteForm] = useState({ start: '', dest: '' });
  // When defined cluster vizualiations are shown
  const [clusterVizState, setClusterVizState] = useState(null);
  // Tracks which graph is being shown by index (0-3)
  const [curGraph, setCurGraph] = useState(0);
  // When defined and no cluster is selected, route vizualiations are shown
  const [routeVizState, setRouteVizState] = useState(null);
  // This is a 2D array representing accidents - format matches column order, see database_creation.py
  const [accidentList, setAccidentList] = useState([]);
  // Controls wether the loading icon is shown
  const [isLoading, setIsLoading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  /**
   * OnChange handler for changes to the "route" form, which controls what routes are generated.
   * Parameters are set for this by the html properties defined for the TextField objects that use this.
   */
  const updateRouteForm = event => {
    const newData = Object.assign({}, routeForm, {
      [event.target.name]: event.target.value
    });
    setRouteForm(newData);
  };

  /**
   * Change which route is currently being highlighted of the 1-3 options returned from google.
   */
  const changeActiveRoute = idx => {
    setRouteVizState(curState =>
      Object.assign(
        {},
        curState,
        idx !== curState.activeRoute
          ? {
              activeRoute: idx,
              activeSafetyScore: curState.safetyScores ? curState.safetyScores[idx] : 0.0,
              activeDuration: curState.durations ? curState.durations[idx] : 0.0,

            }
          : {}
      )
    );
  };

  /**
   * STEP 1: Call this when user first enters their start & destination coords, to request data from google maps.
   */
  const submitRouteForm = async () => {
    /* Uncomment the below two lines if we need start and destination coords for any other operation */
    const startCoord = await geocodeLocation(routeForm.start);
    const destCoord = await geocodeLocation(routeForm.dest);

    const results = await getDirections(routeForm);
    // console.log("GMaps results:", results);
    if (results != null && results.routes != null && results.routes.length > 0) {
      // Close the cluster viz components if necessary
      setClusterVizState(null);

      const distances = results.routes.map(route =>
        route.legs.reduce((acc, leg) => acc + leg.distance.value * METER_TO_MILE, 0)
      );
      const durations = results.routes.map(
        route => route.legs.reduce((acc, leg) => acc + leg.duration.value / 60, 0).toFixed(0) + ' mins'
      );

      // Show the route viz components
      let newRouteState = {
        startCoord,
        destCoord,
        distances,
        durations,
        activeRoute: 0,
        activeSafetyScore: 0,
        routeDetails: results.routes.map(route => {
          const sw = route.bounds.getSouthWest();
          const ne = route.bounds.getNorthEast();
          return {
            // Turn bounds into lat/lons
            bounds: [
              { lat: sw.lat(), lng: sw.lng() },
              { lat: ne.lat(), lng: ne.lng() }
            ],
            points: route.overview_path.map(point => ({
              lat: point.lat().toFixed(7),
              lng: point.lng().toFixed(7)
            }))
          };
        }),
        buttons: results.routes.map((route, idx) => ({
          text: `Option ${idx + 1}: ${route.summary}`,
          idx
        })),
        rows: [
          {
            text: 'Safety Score',
            value: null,
            isBold: true,
            help: 'Describes your projected safety on this route (if you depart immediately) on a scale from 0-10, where 0 is very unsafe and 10 is very safe.'
          },
          {
            text: 'Duration',
            value: durations[0],
            isBold: true,
            help: 'How long it takes to drive this route in minutes, on average.'
          },
          {
            text: 'Length of Route',
            value: distances[0].toFixed(2) + ' miles',
            help: 'The length of this route in miles.'
          },
          {
            text: 'Average Severity',
            value: null,
            help: 'The average severity of these accidents from 1-4, with 4 being the most severe.'
          },
          {
            text: 'Number of Accidents',
            value: null,
            help: 'The number of accidents between 2016-2020 found within 1 mile of this route.'
          },
          {
            text: '% Rainy',
            value: null,
            help: 'The percentage of accidents in this cluster that occured while it was raining.'
          },
          {
            text: '% Nighttime',
            value: null,
            help: 'The percentage of accidents in this cluster that occured while it was dark outside.'
          }
        ]
      };

      const pointArrs = newRouteState.routeDetails.map(route => route.points.map(point => [point.lat, point.lng]));
      getSafetyScores(pointArrs, distances, durations);

      setRouteVizState(newRouteState);
    }
  };

  /**
   * STEP 2: Call this when we get routes back from google maps after the initial call.
   * @param routes A 2D array of lat/lon coordinate floating point values
   */
  const getSafetyScores = async (routes, distances, durations) => {
    // We decided this should first be implemented just to check one weather/time (current time)
    // per route, then possibly enhanced later to handle multi-hour routes with multiple conditions.

    // This fetches the list of accidents for this route
    setIsLoading(true);
    fetch(`${api_ip}/score-routes`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ routes, distances })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Received 404');
        }

        return response.json();
      })
      .then(data => {
        const safetyScores = data.scores.map(score => score.toFixed(2));
        const accidents = data.accidents;
        const activeRoute = (routeVizState && routeVizState.activeRoute) || 0;
        const activeSafetyScore = safetyScores[activeRoute];
        const activeDuration = durations[activeRoute];
        const activeDistance = distances[activeRoute];

        setRouteVizState(curState =>
          Object.assign({}, curState, {
            safetyScores,
            accidents,
            activeSafetyScore,
            activeDuration
          })
        );

        handleAccidentList(accidents[activeRoute], false, activeSafetyScore, activeDuration, activeDistance);
      })
      .catch(err => {
        console.error('Unable to get safety scores.', err);
      });
  };

  const handleClusterResponse = async response => {
    if (!response.ok) {
      throw new Error('Received 404');
    }

    const data = await response.json();
    // console.log('handleClusterResponse', data);

    handleAccidentList(data, true);
  };

  /**
   * Close out a selecter cluster when there's a route selected in the background, reopening that route's
   * graphs. 
   */
  const handleReturnToRoute = (event) => {
    setClusterVizState(null);

    if (routeVizState) {
      const idx = routeVizState.activeRoute;
      handleAccidentList(routeVizState.accidents[idx], false, routeVizState.safetyScores[idx], routeVizState.durations[idx], routeVizState.distances[idx]);
    }
  }

  /**
   * Process an incoming accident list describing a cluster or a route.
   * @param data 2D array representing accidents
   * @param isCluster true if cluster, false if route
   * @param safetyScore Required for routes - the float safety score
   * @param duration Required for routes - duration of the route
   * @param distance  Required for routes - distance of the route
   */
  const handleAccidentList = (data, isCluster, safetyScore, duration, distance) => {
    // Calculate some simple statistics
    const percentages = data.reduce(
      (acc, row) => {
        const isDay = !row[36];

        if (row[21] > 0.01) {
          acc.rainy++;
        }
        if (isDay) {
          acc.nighttime++;
        }
        acc.severity += row[1];

        return acc;
      },
      { rainy: 0, nighttime: 0, severity: 0 }
    );

    Object.keys(percentages).forEach(key => {
      percentages[key] /= data.length;
      if (isNaN(percentages[key])) {
        percentages[key] = 0;
      }
    });

    // console.log("handleAccidentList", {isCluster, safetyScore, duration, distance});

    // Parse arrays of values into updates to clusterVizState
    const newRowsFunc = curState => {
      const newRows = [...curState.rows];
      if (!isCluster) {
        // Update route rows
        newRows[0].value = (
          <span
            style={{
              color: safetyScore ? safetyColorScheme(safetyScore) : 'black'
            }}
            className="safety_score"
          >
            {safetyScore || 'Not enough data found along route'}{' '}
          </span>
        );
        newRows[1].value = duration;
        newRows[2].value = distance.toFixed(2) + ' miles';
        newRows[3].value = percentages.severity.toFixed(2);
        newRows[4].value = data.length;
        newRows[5].prefix = 'Avg: 5%';
        newRows[5].value = (percentages.rainy * 100).toFixed(0) + '%';
        newRows[6].prefix = 'Avg: 60%';
        newRows[6].value = (percentages.nighttime * 100).toFixed(0) + '%';
      } else {
        // Update cluster rows
        newRows[2].value = data.length;
        newRows[3].prefix = 'Avg: 5%';
        newRows[3].value = (percentages.rainy * 100).toFixed(0) + '%';
        newRows[4].prefix = 'Avg: 60%';
        newRows[4].value = (percentages.nighttime * 100).toFixed(0) + '%';
      }

      return Object.assign({}, curState, { rows: newRows });
    };

    isCluster ? setClusterVizState(newRowsFunc) : setRouteVizState(newRowsFunc);

    setAccidentList([...data]);

    setIsLoading(false);
  };

  /**
   * The click handler for a cluster marker, which changes the visualization state to
   * show details for that cluster. Saves data from map marker into react state.
   * Kicks off an async operation to fetch all the accidents part of this cluster.
   * @param event Object
   */
  const expandCluster = event => {
    const location = event.target._latlng;

    const avg_severity = event.target.options.avg_severity.toFixed(2);
    const cluster_id = event.target.options.cluster_id;
    const locStr = `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;

    setIsLoading(true);
    fetch(`${api_ip}/accidents/cluster`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ clusterId: cluster_id })
    })
      .then(handleClusterResponse)
      .catch(err => {
        console.error('Unable to get details for cluster:', err);
      });

    // Set the object that controls what's shown
    setClusterVizState({
      locStr,
      avg_severity,
      cluster_id,
      rows: [
        {
          text: 'Center of Cluster',
          value: locStr,
          help: 'The latitude and longitude of the center of this cluster of accident records.'
        },
        {
          text: 'Average Severity',
          value: avg_severity,
          help: 'The average severity of these accidents, from 1-4.'
        },
        {
          text: 'Number of Accidents',
          value: null,
          help: 'The number of accidents in this cluster.'
        },
        {
          text: '% Rainy',
          value: null,
          help: 'The number of accidents in this cluster that occured while it was raining.'
        },
        {
          text: '% Nighttime',
          value: null,
          help: 'The number of accidents in this cluster that occured while it was dark outside.'
        }
      ]
    });
  };

  const handleTextEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Enter') {
      submitRouteForm();
    }
  }

  const TabPanel = ({ children, value, index, ...other }) => {
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {isLoading ? <CircularProgress /> : value === index ? children : null}
        {!isLoading && (
          <Tooltip title={graphHelp[index]} position="left">
            <HelpIcon className="tooltip-icon graph-tooltip" />
          </Tooltip>
        )}
      </div>
    );
  };

  /**
   * Nested component that renders information for the given route or cluster.
   */
  const TableContents = props => {
    // Describe a cluster if possible, otherwise describe a route
    const obj = clusterVizState || routeVizState;
    if (!obj) {
      return <div />;
    }

    return (
      <TableContainer component={Paper} className="viz-text-info">
        <Table size="small" sx={{ width: '20rem' }} aria-label="simple table">
          <colgroup>
            <col style={{ width: '60%' }} />
            <col style={{ width: '40%' }} />
          </colgroup>
          <TableBody>
            {obj.rows.map((row, idx) => (
              <TableRow
                key={row.text}
                sx={{
                  '&:last-child td, &:last-child th': { border: 0 }
                }}
                className={row.isBold ? 'bold-row' : undefined}
              >
                <TableCell component="th" scope="row">
                  {' '}
                  {row.text}
                  {row.help && (
                    <Tooltip title={row.help} position="right">
                      <HelpIcon className="tooltip-icon" />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell align="right">
                  {' '}
                  <span className="prefix">{row.prefix || ''}</span> {row.value || ''}{' '}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // --------
  // LIFECYLE
  // --------
  // Any useEffect() or useMemo() calls go here, AKA basically all our calculations
  // Generate a range of colors
  const safetyColorScheme = useMemo(() => d3.scaleLinear().domain([0, 10]).range(['red', 'green']), []);

  // This function only executes once (on initial mount)
  useEffect(() => {
    // Initialize the map
    initLeaflet(expandCluster);

    // Initialize google maps connection
    loadScript(`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`, () =>
      handleScriptLoad(setRouteForm)
    );

    window.addEventListener('resize', () => setUpdateTime(Date.now()));
  }, []);

  // Reset the map and graphs whenever the user selects a new route from the available options
  useEffect(() => {
    if (routeVizState && routeVizState.accidents) {
      // Change the map
      selectRoute(routeVizState.activeRoute);

      // Change the accident lists
      handleAccidentList(
        routeVizState.accidents[routeVizState.activeRoute],
        false,
        routeVizState.activeSafetyScore,
        routeVizState.activeDuration,
        routeVizState.distances[routeVizState.activeRoute]
      );
    }
  }, [routeVizState && routeVizState.activeRoute]);

  // When route info loads, show routes on map
  useEffect(() => {
    if (routeVizState && !isLoading && !clusterVizState) {
      showRoutes(
        routeVizState.routeDetails[0].bounds,
        routeVizState.routeDetails.map(e => e.points),
        changeActiveRoute
      );
    }
  }, [isLoading]);

  const isMobile = window.innerWidth < 900;

  return (
    <div className={`App ${isMobile ? 'App-Mobile' : ''}` }>
      <header className="app-header">
        <span className="subtitle"> CSE6242 TEAM 175 </span>
        <span className="title">Web Tool for Driver Safety and Accident Transparency</span>
        <Button variant="outlined" onClick={() => setShowTutorial(cur => !cur)}>
          {' '}
          {showTutorial ? 'Hide' : 'What is this?'}{' '}
        </Button>
      </header>

      <div className="app-body">
        {showTutorial && (
          <p>
            You can use this tool to calculate the "Safety Score" for any US driving route, which describes the relative
            chance of serious accident given current weather condtions and past accidents found along that route. From
            there, you can compare and contrast alternative routes, inspect accident hotspots in the area, and view
            graphs.
          </p>
        )}

        {isMobile && isLoading ? <CircularProgress /> : null}

        {/* The form for entering start/destination locations */}
        <form className="route-entry-form">
          <TextField
            id="source"
            label="Start Point"
            variant="filled"
            name="start"
            value={routeForm.start}
            onChange={updateRouteForm}
            // onKeyUp={e => e.key==='Enter' ? submitRouteForm() : null }
          />
          <TextField
            id="destination"
            label="Destination"
            variant="filled"
            name="dest"
            value={routeForm.dest}
            onChange={updateRouteForm}
            onKeyUp={handleTextEnter}
          />
          <Button className="primary-button" variant="contained" onClick={submitRouteForm}>
            <AltRouteIcon />
            Calculate Safety Score
          </Button>
        </form>

        {/* Contains the whole map */}
        <div className="map-container">
          <div id="leaflet-map-element" />
        </div>

        <h3> {clusterVizState ? 'Cluster' : 'Route'} Details </h3>
        {/* Button to return to route is shown when user clicked away to a cluster after getting a route */}
        {clusterVizState && routeVizState && (
          <Button
            size="small"
            variant="contained"
            classes={{ root: 'return-route' }}
            onClick={handleReturnToRoute}
          >
            Show Routes
          </Button>
        )}

        <div className="viz-container">
          {!clusterVizState && !routeVizState && <h4>Enter a route or select a cluster...</h4>}

          {/* Buttons to choose a route, and table info for routes and containers */}
          <div className="viz-text-container">
            {!clusterVizState && routeVizState && (
              <React.Fragment>
                <Paper className="viz-text-info" sx={{ width: '20rem' }}>
                  {routeVizState.buttons.map((button, idx) => (
                    <Button
                      key={idx}
                      className={`primary-button ${button.idx === routeVizState.activeRoute ? 'active' : ''}`}
                      disabled={isLoading}
                      onClick={e => changeActiveRoute(button.idx)}
                    >
                      {button.text}
                    </Button>
                  ))}
                </Paper>

                {/* Warning for single-route results */}
                {routeVizState.buttons && routeVizState.buttons.length === 1 && (
                  <div>
                    {' '}
                    <h3> Only found one possible route. Please try another query to compare multiple options. </h3>{' '}
                  </div>
                )}
              </React.Fragment>
            )}

            {/* This single line uses a nested component to render the table */}
            {(clusterVizState || routeVizState) && <TableContents />}
          </div>

          {/* The graphs for this route or cluster */}
          {(clusterVizState || routeVizState) && (
            <Paper className="viz-graph-container">
              <Tabs value={curGraph} onChange={(e, idx) => setCurGraph(idx)}>
                <Tab label="Frequency" id="frequency-tab" />
                <Tab label="Severity" id="severity-tab" />
                <Tab label="Temperature" id="temperature-tab" />
                <Tab label="Visibility" id="visibility-tab" />
              </Tabs>
              <TabPanel value={curGraph} index={0}>
                <GraphComponent
                  idx={0}
                  func={countGraph}
                  id="count_dataviz"
                  isLoading={isLoading}
                  accidentList={accidentList}
                  isMobile={isMobile && window.innerWidth < 600}
                />
              </TabPanel>
              <TabPanel value={curGraph} index={1}>
                <GraphComponent
                  idx={1}
                  func={severityGraph}
                  id="sev_dataviz"
                  isLoading={isLoading}
                  accidentList={accidentList}
                  isMobile={isMobile && window.innerWidth < 600}
                />
              </TabPanel>
              <TabPanel value={curGraph} index={2}>
                <GraphComponent
                  idx={2}
                  func={tempGraph}
                  id="temp_dataviz"
                  isLoading={isLoading}
                  accidentList={accidentList}
                  isMobile={isMobile && window.innerWidth < 600}
                />
              </TabPanel>
              <TabPanel value={curGraph} index={3}>
                <GraphComponent
                  idx={3}
                  func={visGraph}
                  id="vis_dataviz"
                  isLoading={isLoading}
                  accidentList={accidentList}
                  isMobile={isMobile && window.innerWidth < 600}
                />
              </TabPanel>
            </Paper>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
