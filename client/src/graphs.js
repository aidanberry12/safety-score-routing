import React, { useEffect } from 'react';
import * as d3 from "d3";

export const GraphComponent = ({width, id, func, accidentList, idx, isLoading, isMobile}) => {
  const size = isMobile ? 600 : 400; 
  // Reload the currently visible graph whenever tabs change, or the data changes
  useEffect(() => {
  func(accidentList) 
  }, [idx, accidentList.length, isLoading, ]);
  return (
      <svg viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet" id={id} />
  );
}

/**
 * Show the severity 1-4 of a set of accidents
 */
export const severityGraph = (data) => {
  // set the dimensions and margins of the graph
  var margin = { top: 50, right: 30, bottom: 50, left: 50 },
    width = 480 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  // set the ranges of graphs
  var x_sev = d3.scaleLinear().range([0, width]).domain([0, 4]);
  var y_sev = d3.scaleLinear().range([height, 0]);

  // Append the svg object to the body of the page
  var svg = d3.select("#sev_dataviz")
              .attr("width", width + margin.left + margin.right)
              .attr("height", height + margin.top + margin.bottom)

  var severity_data = data.map(function (value, index) {
      return value[1];
  });

  if (severity_data.length <= 1){
    svg = svg.append("text")
              .attr("x", width/2)
              .attr("y", height/2)
              .attr("fill", "white")
              .attr("font-size", "14px")
              .style("text-anchor", "middle")
              .text("Not enough accident severity data available");
    return
  }
  svg = svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  //Drop nan
  severity_data = severity_data.filter((n) => n).map(n => parseInt(n));

  //Plot #1 - Accident Severity
  var histogram = d3
    .bin()

  var bins = histogram(severity_data);
  // Scale the range of the data in the y domain
  y_sev.domain([
    0,
    d3.max(bins, function (d) {
      return d.length;
    }),
  ]);


  if (bins.length && bins.some(bin => bin.length)) {
    // append the bar rectangles to the svg element
    svg
      .selectAll("rect")
      .data(bins)
      .enter()
      .append("rect")
      .attr("class", "bar")
      // .attr("x", 1)
      .attr("transform", function (d) {
        return "translate(" + (x_sev(d.x0) - (width / 4) + 1) + "," + y_sev(d.length) + ")";
      })
      .attr("width", () => (width / 4) - 2)
      .attr("height", function (d) {
        return height - y_sev(d.length);
      })
      .attr("fill", "#69b3a2");
  }

  // add the x Axis
  svg
    .append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x_sev).tickValues([0, 1, 2, 3, 4]));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("fill", "white")
    .attr("font-size", "14px")
    .style("text-anchor", "middle")
    .text("Severity Ranking");
  // add the y Axis
  svg.append("g").call(d3.axisLeft(y_sev));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(height / 2))
    .attr("y", -40)
    .attr("fill", "white")
    .attr("font-size", "14px")
    .style("text-anchor", "middle")
    .text("#Accidents");
};

/**
 * Show the temeperature of a set of accidents
 */
export const tempGraph = (data) => {
  // set the dimensions and margins of the graph
  var margin = { top: 50, right: 30, bottom: 50, left: 30 },
    width = 480 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  // set the ranges of graphs
  var x_temp = d3.scaleLinear().range([0, width]);
  var y_temp = d3.scaleLinear().range([height, 0]);

  // Append the svg object to the body of the page
  var svg = d3.select("#temp_dataviz")
              .attr("width", width + margin.left + margin.right)
              .attr("height", height + margin.top + margin.bottom)

  var temperature_data = data.map(function (value, index) {
    return value[16];
  });

  if (temperature_data.length <= 1){
    svg = svg.append("text")
              .attr("x", width/2)
              .attr("y", height/2)
              .attr("fill", "white")
              .attr("font-size", "14px")
              .style("text-anchor", "middle")
              .text("Not enough temperature data available");
    return
  }
  svg = svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  //Drop nan
  temperature_data = temperature_data.filter((n) => n);

  var temperature_min_num = Math.min.apply(null, temperature_data);
  var temperature_max_num = Math.max.apply(null, temperature_data);

  //Plot #2 - Temperature
  x_temp.domain([0, 100]);

  var histogram2 = d3
    .bin()
    .value(function (d) {
      return d > 100 ? 99 : d;
    })
    .domain(x_temp.domain())
    .thresholds(x_temp.ticks(10));

  // group the data for the bars
  var bins2 = histogram2(temperature_data);
  // Scale the range of the data in the y domain
  y_temp.domain([
    0,
    d3.max(bins2, function (d) {
      return d.length;
    }),
  ]);

  // append the bar rectangles to the svg element
  if (bins2.length && bins2.some(bin => bin.length)) {
    svg
      .selectAll("rect")
      .data(bins2)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", 1)
      .attr("transform", function (d) {
        return "translate(" + x_temp(d.x0) + "," + y_temp(d.length) + ")";
      })
      .attr("width", function (d) {
        return x_temp(d.x1) - x_temp(d.x0) - 1;
      })
      .attr("height", function (d) {
        return height - y_temp(d.length);
      })
      .attr("fill", "pink");
  }

  // add the x Axis
  svg
    .append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x_temp));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("fill", "white")
    .attr("font-size", "14px")
    .style("text-anchor", "middle")
    .text("Temperature [F]");

  // add the y Axis
  svg.append("g").call(d3.axisLeft(y_temp));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(height / 2))
    .attr("y", -40)
    .attr("fill", "white")
    .attr("font-size", "14px")
    .style("text-anchor", "middle")
    .text("#Accidents");
};

/**
 * Show the visibility of a set of accidents
 */
export const visGraph = (data) => {
  // set the dimensions and margins of the graph
  var margin = { top: 50, right: 30, bottom: 50, left: 50 },
    width = 480 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  // set the ranges of graphs
  var x_vis = d3.scaleLinear().range([0, width]);
  var y_vis = d3.scaleLinear().range([height, 0]);

  // Append the svg object to the body of the page
  var svg = d3.select("#vis_dataviz")
              .attr("width", width + margin.left + margin.right)
              .attr("height", height + margin.top + margin.bottom)

  var visibility_data = data.map(function (value, index) {
    return value[20];
  });

  if (visibility_data.length <= 1){
    svg = svg.append("text")
              .attr("x", width/2)
              .attr("y", height/2)
              .attr("fill", "white")
              .attr("font-size", "14px")
              .style("text-anchor", "middle")
              .text("Not enough visibility data available");
    return
  }

  svg = svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  //Drop nan
  visibility_data = visibility_data.filter((n) => n);

  var visibility_min_num = Math.min.apply(null, visibility_data);
  var visibility_max_num = Math.max.apply(null, visibility_data);

  //Plot #3 - Visibility
  x_vis.domain([visibility_min_num, visibility_max_num + 1]);
  var histogram3 = d3
    .bin()
    .value(function (d) {
      return d;
    })
    .domain(x_vis.domain())
    .thresholds(x_vis.ticks(10));

  // group the data for the bars
  var bins3 = histogram3(visibility_data);

  // Scale the range of the data in the y domain
  y_vis.domain([
    0,
    d3.max(bins3, function (d) {
      return d.length;
    }),
  ]);

  // append the bar rectangles to the svg element
  if (bins3.length && bins3.some(bin => bin.length)) {
    svg
      .selectAll("rect")
      .data(bins3)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", 1)
      .attr("transform", function (d) {
        return "translate(" + x_vis(d.x0) + "," + y_vis(d.length) + ")";
      })
      .attr("width", function (d) {
        return x_vis(d.x1) - x_vis(d.x0) - 1;
      })
      .attr("height", function (d) {
        return height - y_vis(d.length);
      })
      .attr("fill", "lightblue");
  }

  // add the x Axis
  svg
    .append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x_vis));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("fill", "white")
    .attr("font-size", "14px")
    .style("text-anchor", "middle")
    .text("Visibility");

  // add the y Axis
  svg.append("g").call(d3.axisLeft(y_vis));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(height / 2))
    .attr("y", -40)
    .attr("fill", "white")
    .attr("font-size", "14px")
    .style("text-anchor", "middle")
    .text("#Accidents");
};

// It will show a count of historical accidentes either in a route or in a cluster
export const countGraph = (dataArray) => {
  // In oder to get the count (this would be done on a per month basis) use the date time
  //and break it down by month and year, also adding a 1 to have the (%Y-%m-%d) format
  const list_accident = [];
  dataArray.forEach((e) => {
    var date_date = new Date(e[2]);
    var month = date_date.getMonth() + 1;
    var year = date_date.getFullYear();
    list_accident.push(year + "-" + month);
  });

  // Sort the new created list
  const list_accident_sorted = list_accident.sort();

  // Function to obtain the count baed on the key (%Y-%m-%d) and add it to a Map
  var map_values = new Map();
  for (var i = 0, l = list_accident_sorted.length; i < l; i++) {
    var date = list_accident_sorted[i];
    map_values[date] = map_values[date] ? map_values[date] + 1 : 1;
  }

  // implement regular line chart requirements
  var parseDate = d3.timeParse("%Y-%m");

  // Things seem to be easier to change to a list of maps to plot
  var xy = [];

  var value;
  Object.keys(map_values).forEach(function (key) {
    value = map_values[key];
    xy.push({ Date: parseDate(key), count: value });
  });

  xy.sort(function (a, b) {
    return a.Date > b.Date ? 1 : -1;
  });

  // set the dimensions and margins of the graph
  var margin = { top: 10, right: 30, bottom: 70, left: 60 },
    width = 480 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  // define the line
  var valueline = d3
    .line()
    .x(function (d) {
      return x(d.Date);
    })
    .y(function (d) {
      return y(d.count);
    })
    .curve(d3.curveMonotoneX);

  var svg = d3.select("#count_dataviz")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)

  if (xy.length <= 1 ){
    svg = svg.append("text")
              .attr("x", width/2)
              .attr("y", height/2)
              .attr("fill", "white")
              .attr("font-size", "14px")
              .style("text-anchor", "middle")
              .text("Not enough accident data available to plot accident frequency graph");
    return
  }

  svg = svg.append("g")
            .attr("transform", "translate(" + margin.right + "," + 10 + ")");

  // Scale the range of the data
  var x = d3
    .scaleTime()
    .domain(
      d3.extent(xy, function (d) {
        return d.Date;
      })
    )
    .range([0, width-10]);
  svg
    .append("g")
    .attr("transform", "translate(0," + (height-10) + ")")
    .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%Y-%m")))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-65)");

  svg
    .append("text")
    .attr("class", "x label")
    .attr("text-anchor", "end")
    .attr("x", width/2)
    .attr("y", height + margin.bottom)
    .text("Time")
    .style("fill", "white");

  // Add Y axis
  var y = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(xy, function (d) {
        return +d.count;
      }),
    ])
    .range([height-margin.top, 0]);
  svg.append("g").call(d3.axisLeft(y));

  svg
    .append("text")
    .attr("class", "y label")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-90)")
    .attr("x", -(height / 2 - 100))
    .attr("y", -50)
    .attr("dy", ".75em")
    .text("Number of accidents per month")
    .style("fill", "white");

  // Add the line
  svg
    .append("path")
    .data([xy])
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 1.5)
    .attr("d", valueline);

  return svg;
};
