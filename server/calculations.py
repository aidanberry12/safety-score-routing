import sys
import time

import requests
import json
import pandas as pd
from datetime import datetime
import math
from statistics import mean
from suntime import Sun
import pytz
# from IPython.display import Image, display


def calculateSafetyScore(route, accidents, currentConditions, route_distance, options={}):
    # double check that these values are accurate
    # accident data column numbers of interest:
    # 2  - time date
    # 11 - zipcode
    # 20 - wind speed
    # 21 - precipitation
    # 36 - sunrise, sunset
    # 40 - temp
    # 41 - visibility

    # scoring data:
    # 0 - temp
    # 1 - visibility
    # 2 - wind speed
    # 3 - precipitaiton
    # 4 - night
    # 5 - spring
    # 6 - summer
    # 7 - fall
    startProfileTime = time.time()

    # max value per column
    max_temp = 129.2
    max_vis = 20.0
    max_wind = 48.3
    max_precip = 0.35
    max_severity = 4.0
    max_night = 1
    max_season = 1

    # get current weather
    current_weather = currentConditions["current"]

    # get local timezone and current time
    local_timezone = accidents[0][13]
    current_time = datetime.now(pytz.timezone(local_timezone)).astimezone()

    # get sunrise and sunset time *** UTC ***
    sun = Sun(float(route[0][0]), float(route[0][1]))
    today_sr = sun.get_sunrise_time()
    today_ss = sun.get_sunset_time()

    # convert sunrise and sunset time to Local Timezone
    # time_zone = options["current_time"].tzinfo
    today_sr = today_sr.astimezone(pytz.timezone(local_timezone))
    today_ss = today_ss.astimezone(pytz.timezone(local_timezone))

    # build vector of current conditions
    current_conditions = []
    # 0 - temp
    current_conditions.append(current_weather["Temperature(F)"]/max_temp)
    # 1 - visibility
    current_conditions.append(current_weather["Visibility(mi)"]/max_vis)
    # 2 - wind speed
    current_conditions.append(current_weather["Wind_Speed(mph)"]/max_wind)
    # 3 - Precipitation
    current_conditions.append((current_weather["Rain in last hr(in)"] + current_weather["Snow in last hr(in)"])/max_precip)
    # 4 - night or day
    if today_sr < current_time < today_ss:
        current_conditions.append(0)
    else:
        current_conditions.append(1)

    # 5, 6, 7 - season
    # needs to be passed in as a string so that the function can handle the accident data which is strings, not a python datetime class
    current_conditions.extend(get_season(current_time.strftime("%a, %d %b %Y %H:%M:%S ")))

    # create vector for accident conditions
    clean_data = []
    distance = []
    clusters_with_severity = []
    for index, row in enumerate(accidents):
        clusters_with_severity.append((row[44],row[45]))
        clean_data.append([])
        # 0 - temp
        clean_data[index].append(row[40]/max_temp)
        # 1 - visibility
        clean_data[index].append(row[41]/max_vis)
        # 2 - wind speed
        if row[20] == None:
            clean_data[index].append(0.0)
        else:
            clean_data[index].append(row[20]/max_wind)
        # 3 - Precipitation
        if row[21] == None:
            clean_data[index].append(0.0)
        else:
            clean_data[index].append(row[21]/max_precip)
        # 4 - night or day
        clean_data[index].append(int(row[36]))
        # 5, 6, 7 - season
        clean_data[index].extend(get_season(row[2].strftime("%a, %d %b %Y %H:%M:%S ")))

        # Calculate the euclidean distance
        distance.append(math.dist(current_conditions, clean_data[index]))

    clusters_with_severity = list(set(clusters_with_severity))
    clusters = [x[0] for x in clusters_with_severity]
    severity = [x[1] for x in clusters_with_severity]
    clusters.remove(-1) if -1 in clusters else None
    severity.remove(0.0) if 0 in severity else None
    route_score = 1
    avg_severity = 0.0
    if len(clusters) != 0:
        avg_severity = mean(severity) / max_severity
        route_score = 1 - (len(clusters)/ route_distance * avg_severity)
        route_score = 0 if route_score < 0 else route_score
    # calculate safety score from euclidean distance
    # max distance is 3 so shift to 0-10 safety score range
    weather_score = mean(distance) /3
    if weather_score > 1:
        weather_score = 1
    if weather_score < 0:
        weather_score = 0

    # 80% safety score determined by accident clusters and severity along the route.
    # 20% determined by weather factors
    score = 8 * route_score + 2 * weather_score
    print("No.of hotspots: ", len(clusters),"\t Route distance: ", route_distance, "\t Accident severity: ", avg_severity)
    print( "Weather score: ", 2 * weather_score, "Route score: ", 8 * route_score, "Safety score: ", score)
    print("calculateSafetyScore profile: ", time.time() - startProfileTime, route_distance)
    return score


# openweathermap API key
api_key = "b1dc76cffbcde8e04b16658f87420e91"
# unit conversions
hpa_to_inhg = 0.02952998
m_to_mi = 0.000621371
mm_to_in = 0.0393701


def start_coord_one_call_API(start_lat_coord, start_long_coord):
    # Current + Forecast data (+5 hourly/daily)
    weather_output = {}
    weather_output["current"] = {}
    weather_output["hourly"] = {}
    weather_output["daily"] = {}

    # url request
    base_url = "http://pro.openweathermap.org/data/2.5/onecall?"
    url_request = base_url + "lat=" + str(start_lat_coord) + "&lon=" + str(start_long_coord) + "&exclude=minutely""&units=imperial" + "&appid=" + api_key

    response = requests.get(url_request)
    json_response = response.json()

    # invalid coordinate
    if "cod" in json_response:
        if json_response["cod"] == "400":
            print("Error - Wrong Coordinate. Please try again")
            return

    # Current Weather
    weather_output["current"]["lat"] = json_response["lat"]
    weather_output["current"]["lon"] = json_response["lon"]
    weather_output["current"]["main_weather"] = json_response["current"]["weather"][0]["main"]
    weather_output["current"]["main_weather_description"] = json_response["current"]["weather"][0]["description"]
    weather_output["current"]["Temperature(F)"] = json_response["current"]["temp"]
    weather_output["current"]["Humidity(%)"] = json_response["current"]["humidity"]
    weather_output["current"]["Pressure(inhg)"] = json_response["current"]["pressure"] * hpa_to_inhg
    weather_output["current"]["Visibility(mi)"] = json_response["current"]["visibility"] * m_to_mi
    weather_output["current"]["Wind_Speed(mph)"] = json_response["current"]["wind_speed"]

    # Rain conditional
    if "rain" in json_response:
        weather_output["current"]["Rain in last hr(in)"] = json_response["rain"]["1h"] * mm_to_in
    else:
        weather_output["current"]["Rain in last hr(in)"] = 0

    # Snow conditional
    if "snow" in json_response:
        weather_output["current"]["Snow in last hr(in)"] = json_response["snow"]["1h"] * mm_to_in
    else:
        weather_output["current"]["Snow in last hr(in)"] = 0

    # Show Weather Icon (disable if unneeded)
    # print("Current Weather Description: " + weather_output["current"]["main_weather_description"])
    # url_request = "http://openweathermap.org/img/wn/"+json_response["current"]["weather"][0]["icon"]+"@2x.png"
    # r = requests.get(url_request, stream=all)
    # display(Image(r.content))

    # Hourly Weather
    # print("Hourly Weather Forecast: \n")
    for i in range(5):
        weather_output["hourly"][i] = {}
        weather_output["hourly"][i]["dt"] = json_response["hourly"][i]["dt"]
        weather_output["hourly"][i]["main_weather"] = json_response["hourly"][i]["weather"][0]["main"]
        weather_output["hourly"][i]["main_weather_description"] = json_response["hourly"][i]["weather"][0]["description"]
        weather_output["hourly"][i]["Temperature(F)"] = json_response["hourly"][i]["temp"]
        weather_output["hourly"][i]["Humidity(%)"] = json_response["hourly"][i]["humidity"]
        weather_output["hourly"][i]["Pressure(inhg)"] = json_response["hourly"][i]["pressure"] * hpa_to_inhg
        weather_output["hourly"][i]["Visibility(mi)"] = json_response["hourly"][i]["visibility"] * m_to_mi
        weather_output["hourly"][i]["Wind_Speed(mph)"] = json_response["hourly"][i]["wind_speed"]

        # Rain conditional
        if "rain" in json_response["hourly"][i]:
            weather_output["hourly"][i]["Rain in last hr(in)"] = json_response["hourly"][i]["rain"]["1h"] * mm_to_in
        else:
            weather_output["hourly"][i]["Rain in last hr(in)"] = 0

        # Snow conditional
        if "snow" in json_response["hourly"][i]:
            weather_output["hourly"][i]["Snow in last hr(in)"] = json_response["hourly"][i]["snow"]["1h"] * mm_to_in
        else:
            weather_output["hourly"][i]["Snow in last hr(in)"] = 0

        # Show Weather Icon(disable if unneeded)
        # print("Weather in +"+str(i+1)+' hr: ' + weather_output["hourly"][i]["main_weather_description"])
        # url_request = "http://openweathermap.org/img/wn/"+json_response["hourly"][i]["weather"][0]["icon"]+"@2x.png"
        # r = requests.get(url_request, stream=all)
        # display(Image(r.content))

    # Daily Weather
    # print("Daily Weather Forecast: \n")
    for i in range(5):
        weather_output["daily"][i] = {}
        weather_output["daily"][i]["dt"] = json_response["daily"][i]["dt"]
        weather_output["daily"][i]["main_weather"] = json_response["daily"][i]["weather"][0]["main"]
        weather_output["daily"][i]["main_weather_description"] = json_response["daily"][i]["weather"][0]["description"]
        weather_output["daily"][i]["Temperature(F)"] = json_response["daily"][i]["temp"]
        weather_output["daily"][i]["Humidity(%)"] = json_response["daily"][i]["humidity"]
        weather_output["daily"][i]["Pressure(inhg)"] = json_response["daily"][i]["pressure"] * hpa_to_inhg
        weather_output["daily"][i]["Wind_Speed(mph)"] = json_response["daily"][i]["wind_speed"]

        # Rain
        if "rain" in json_response["daily"][i]:
            weather_output["daily"][i]["Rain volume(in)"] = json_response["daily"][i]["rain"] * mm_to_in
        else:
            weather_output["daily"][i]["Rain volume(in)"] = 0

        # Snow
        if "snow" in json_response["daily"][i]:
            weather_output["daily"][i]["Snow volume(in)"] = json_response["daily"][i]["snow"] * mm_to_in
        else:
            weather_output["daily"][i]["Snow volume(in)"] = 0

        # Show Weather Icon(disable if unneeded)
        # print("Weather in +"+str(i+1)+' hr: ' + weather_output["daily"][i]["main_weather_description"])
        # url_request = "http://openweathermap.org/img/wn/"+json_response["daily"][i]["weather"][0]["icon"]+"@2x.png"
        # r = requests.get(url_request, stream=all)
        # display(Image(r.content))

    return weather_output


def get_season(timestamp_str):
    timestamp = datetime.strptime(timestamp_str, "%a, %d %b %Y %H:%M:%S ")

    # get the current day of the year
    doy = timestamp.timetuple().tm_yday

    # "day of year" ranges for the northern hemisphere
    spring = range(80, 172)
    summer = range(172, 264)
    fall = range(264, 355)
    # winter = everything else

    if doy in spring:
        season = [1, 0, 0]
    elif doy in summer:
        season = [0, 1, 0]
    elif doy in fall:
        season = [0, 0, 1]
    else:  # in winter
        season = [0, 0, 0]
    return season
